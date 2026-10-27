import { Campaign, RecipientRecord } from './types.js';
import { storage } from './storage.js';
import { SmtpService } from './smtpService.js';

export class CampaignQueueManager {
  private activeJobs: Map<string, boolean> = new Map(); // campaignId -> isRunning
  private cancelFlags: Map<string, boolean> = new Map(); // campaignId -> shouldCancel

  /**
   * Enqueues and starts campaign processing in background.
   */
  public startCampaign(campaignId: string) {
    if (this.activeJobs.get(campaignId)) {
      return { success: false, message: 'Campaign is already actively processing.' };
    }

    const campaign = storage.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campaign not found.' };
    }

    if (campaign.status === 'completed') {
      return { success: false, message: 'Campaign has already finished sending.' };
    }

    this.activeJobs.set(campaignId, true);
    this.cancelFlags.set(campaignId, false);

    campaign.status = 'sending';
    campaign.startedAt = campaign.startedAt || new Date().toISOString();
    storage.saveCampaign(campaign);

    // Fire background execution loop (do not block HTTP response)
    this.processCampaignLoop(campaignId).catch(err => {
      console.error(`Error processing campaign ${campaignId}:`, err);
    });

    return { success: true, message: 'Campaign queued and dispatch started.' };
  }

  /**
   * Requests cancellation of any pending recipients in an active campaign.
   */
  public cancelCampaign(campaignId: string) {
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campaign not found.' };
    }

    this.cancelFlags.set(campaignId, true);

    // If campaign is not currently in sending loop (e.g. queued or paused), update immediately
    if (!this.activeJobs.get(campaignId)) {
      campaign.status = 'cancelled';
      campaign.recipients.forEach(r => {
        if (r.status === 'pending') {
          r.status = 'cancelled';
          r.error = 'Cancelled by user prior to dispatch.';
        }
      });
      this.recalculateStats(campaign);
      storage.saveCampaign(campaign);
    }

    return { success: true, message: 'Cancellation signal received. Pending messages will be cancelled.' };
  }

  /**
   * Core execution loop with rate limiting, batching, suppression filtering, and retries.
   */
  private async processCampaignLoop(campaignId: string) {
    try {
      const smtpConfig = storage.getSmtpConfig();
      const campaign = storage.getCampaign(campaignId);
      if (!campaign) return;

      const rateLimitPerSec = Math.max(1, campaign.rateLimitPerSec || 5);
      const batchSize = Math.max(1, campaign.batchSize || 10);
      const delayBetweenBatchesMs = Math.round((1000 / rateLimitPerSec) * batchSize);
      const maxRetries = 2;

      // Identify pending recipients
      let pendingList = campaign.recipients.filter(r => r.status === 'pending');

      while (pendingList.length > 0) {
        // Check for user cancellation request
        if (this.cancelFlags.get(campaignId)) {
          campaign.status = 'cancelled';
          for (const r of campaign.recipients) {
            if (r.status === 'pending') {
              r.status = 'cancelled';
              r.error = 'Dispatch cancelled by user.';
            }
          }
          this.recalculateStats(campaign);
          storage.saveCampaign(campaign);
          break;
        }

        // Slice next batch
        const currentBatch = pendingList.slice(0, batchSize);

        // Process batch items concurrently
        await Promise.all(
          currentBatch.map(async (recipient) => {
            // Check cancellation again before sending each
            if (this.cancelFlags.get(campaignId)) {
              recipient.status = 'cancelled';
              recipient.error = 'Dispatch cancelled by user.';
              return;
            }

            // 1. Suppression check
            if (storage.isSuppressed(recipient.email)) {
              recipient.status = 'failed';
              recipient.attempts += 1;
              recipient.lastAttemptAt = new Date().toISOString();
              recipient.error = 'Suppression policy: Address on suppression list (unsubscribed or bounced).';

              storage.addLog({
                id: 'log_' + Math.random().toString(36).substring(2, 9),
                campaignId: campaign.id,
                campaignName: campaign.name,
                recipientEmail: recipient.email,
                status: 'failed',
                attempts: recipient.attempts,
                timestamp: new Date().toISOString(),
                error: recipient.error,
              });
              return;
            }

            // 2. Attempt dispatch with retry logic for temporary failures
            let success = false;
            let lastError = '';
            let messageId = '';
            let smtpResponse = '';
            let isSimulated = false;

            while (recipient.attempts <= maxRetries && !success) {
              recipient.attempts += 1;
              recipient.lastAttemptAt = new Date().toISOString();

              const res = await SmtpService.sendMail(smtpConfig, {
                to: recipient.email,
                toName: recipient.name,
                fromEmail: campaign.fromEmail,
                fromName: campaign.fromName,
                replyTo: campaign.replyTo,
                subject: campaign.subject,
                html: campaign.htmlContent,
                text: campaign.textContent,
              });

              if (res.success) {
                success = true;
                messageId = res.messageId || '';
                smtpResponse = res.smtpResponse || '';
                isSimulated = Boolean(res.isSimulated);
                break;
              } else {
                lastError = res.error || 'SMTP delivery rejected';
                const isPermanent = this.isPermanentFailure(lastError);
                if (isPermanent) {
                  // Do not retry permanent failures (e.g. 550, invalid mailbox, auth failure)
                  break;
                }
                // Temporary error: back off briefly before retrying
                if (recipient.attempts <= maxRetries) {
                  campaign.stats.retries += 1;
                  await new Promise(r => setTimeout(r, 400 * recipient.attempts));
                }
              }
            }

            if (success) {
              // Crucial distinction: Marked as 'accepted' by SMTP relay server
              recipient.status = 'accepted';
              recipient.messageId = messageId;
              recipient.smtpResponse = smtpResponse;
              recipient.error = undefined;

              storage.addLog({
                id: 'log_' + Math.random().toString(36).substring(2, 9),
                campaignId: campaign.id,
                campaignName: campaign.name,
                recipientEmail: recipient.email,
                status: 'accepted',
                attempts: recipient.attempts,
                timestamp: new Date().toISOString(),
                messageId: recipient.messageId,
                smtpResponse: recipient.smtpResponse,
                isSimulated,
              });
            } else {
              recipient.status = 'failed';
              recipient.error = lastError;

              // If address looks bad or hard bounced, auto-add to suppression list
              if (lastError.includes('550') || lastError.includes('User unknown') || lastError.includes('NoSuchUser')) {
                storage.addSuppressionEntry({
                  email: recipient.email,
                  reason: 'bounced',
                  addedAt: new Date().toISOString(),
                  notes: `Hard bounce in campaign ${campaign.name}: ${lastError.substring(0, 80)}`,
                });
              }

              storage.addLog({
                id: 'log_' + Math.random().toString(36).substring(2, 9),
                campaignId: campaign.id,
                campaignName: campaign.name,
                recipientEmail: recipient.email,
                status: 'failed',
                attempts: recipient.attempts,
                timestamp: new Date().toISOString(),
                error: lastError,
              });
            }
          })
        );

        // Update campaign snapshot in storage after each batch for real-time visibility
        this.recalculateStats(campaign);
        storage.saveCampaign(campaign);

        // Refresh pending list
        pendingList = campaign.recipients.filter(r => r.status === 'pending');

        if (pendingList.length > 0) {
          // Rate-limiting delay between batches
          await new Promise(r => setTimeout(r, delayBetweenBatchesMs));
        }
      }

      // Finish campaign
      if (campaign.status === 'sending') {
        campaign.status = 'completed';
        campaign.completedAt = new Date().toISOString();
        this.recalculateStats(campaign);
        storage.saveCampaign(campaign);
      }
    } finally {
      this.activeJobs.delete(campaignId);
      this.cancelFlags.delete(campaignId);
    }
  }

  /**
   * Recalculates aggregate counts on a campaign.
   */
  private recalculateStats(campaign: Campaign) {
    let pending = 0;
    let accepted = 0;
    let failed = 0;
    let cancelled = 0;

    for (const r of campaign.recipients) {
      if (r.status === 'pending') pending++;
      else if (r.status === 'accepted' || r.status === 'sent') accepted++;
      else if (r.status === 'failed' || r.status === 'bounced') failed++;
      else if (r.status === 'cancelled') cancelled++;
    }

    campaign.stats = {
      ...campaign.stats,
      total: campaign.recipients.length,
      pending,
      accepted,
      failed,
      cancelled,
    };
  }

  /**
   * Detects whether an SMTP failure is permanent (5xx code, syntax error)
   * to avoid wasteful and aggressive retries.
   */
  private isPermanentFailure(errorMsg: string): boolean {
    const permanentMarkers = [
      '550', '551', '552', '553', '554',
      'user unknown', 'mailbox unavailable', 'does not exist',
      'invalid recipient', 'relay access denied', 'suppression policy',
      'syntax error', 'no such user'
    ];
    const lower = errorMsg.toLowerCase();
    return permanentMarkers.some(marker => lower.includes(marker));
  }
}

export const queueManager = new CampaignQueueManager();
