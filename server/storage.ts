import {
  SmtpConfig,
  SanitizedSmtpConfig,
  SmtpProfile,
  SanitizedSmtpProfile,
  MonitorDiagnosticLog,
  Campaign,
  EmailDraft,
  SuppressionEntry,
  DeliveryLog,
  EmailTemplate,
  SmtpSecurity,
} from './types.js';
import { predefinedTemplates } from './emailTemplates.js';

class DataStorage {
  private smtpConfig: SmtpConfig;
  private profiles: Map<string, SmtpProfile> = new Map();
  private diagnosticLogs: MonitorDiagnosticLog[] = [];
  private campaigns: Map<string, Campaign> = new Map();
  private drafts: Map<string, EmailDraft> = new Map();
  private suppressionList: Map<string, SuppressionEntry> = new Map();
  private logs: DeliveryLog[] = [];
  private templates: EmailTemplate[] = [...predefinedTemplates];

  constructor() {
    // Default initial configuration specified by user
    const defaultHost = process.env.SMTP_HOST || 'out.postassl.it';
    const defaultPort = parseInt(process.env.SMTP_PORT || '465', 10);
    const defaultSecurity = (process.env.SMTP_SECURITY as any) || 'ssl';
    const defaultUser = process.env.SMTP_USER || 'noreply@smaltimento-rifiuti-roma.it';
    const defaultPass = process.env.SMTP_PASS || '';
    const defaultFromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@smaltimento-rifiuti-roma.it';
    const defaultFromName = process.env.SMTP_FROM_NAME || 'ApexMail Dispatcher';
    const defaultReplyTo = process.env.SMTP_REPLY_TO || 'noreply@smaltimento-rifiuti-roma.it';
    // If no password is provided in env, default to safe Sandbox mode so app works out of the box
    const isDevMode = process.env.DEVELOPMENT_MODE === 'true' || !defaultPass;

    this.smtpConfig = {
      host: defaultHost,
      port: defaultPort,
      security: defaultSecurity,
      username: defaultUser,
      password: defaultPass,
      fromEmail: defaultFromEmail,
      fromName: defaultFromName,
      replyTo: defaultReplyTo,
      devMode: isDevMode,
    };

    // Prepopulate initial primary and backup SMTP profiles for the monitor
    this.profiles.set('primary', {
      id: 'primary',
      name: 'Primary PostaSSL Relay (SSL 465)',
      host: defaultHost,
      port: defaultPort,
      security: defaultSecurity,
      username: defaultUser,
      password: defaultPass,
      fromEmail: defaultFromEmail,
      fromName: defaultFromName,
      replyTo: defaultReplyTo,
      lastConnectionStatus: 'Pending',
      lastTestEmailStatus: 'Not Requested',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.profiles.set('backup-starttls', {
      id: 'backup-starttls',
      name: 'Secondary MX Gateway (STARTTLS 587)',
      host: 'smtp.smaltimento-rifiuti-roma.it',
      port: 587,
      security: 'starttls',
      username: defaultUser,
      password: defaultPass,
      fromEmail: defaultFromEmail,
      fromName: defaultFromName,
      replyTo: defaultReplyTo,
      lastConnectionStatus: 'Pending',
      lastTestEmailStatus: 'Not Requested',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Prepopulate suppression list with common sample bounces for realism and test safety
    this.addSuppressionEntry({
      email: 'bounce-test@invalid-domain-demo.org',
      reason: 'bounced',
      addedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      notes: 'Host MX destination rejected address permanently (550 User unknown)'
    });
    this.addSuppressionEntry({
      email: 'optout@example-subscriber.com',
      reason: 'unsubscribed',
      addedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      notes: 'One-click RFC8058 List-Unsubscribe requested by recipient'
    });

    // Prepopulate a sample completed campaign for rich dashboard initial state
    const sampleCampaignId = 'cmp_' + Date.now().toString(36);
    this.campaigns.set(sampleCampaignId, {
      id: sampleCampaignId,
      name: 'Q3 Enterprise Architecture Update',
      subject: 'Scheduled Infrastructure Upgrade Notice',
      fromName: defaultFromName,
      fromEmail: defaultFromEmail,
      replyTo: defaultReplyTo,
      htmlContent: predefinedTemplates[0].htmlContent,
      textContent: predefinedTemplates[0].textContent,
      recipients: [
        {
          email: 'admin@apex-systems.internal',
          name: 'Platform Administrator',
          status: 'accepted',
          attempts: 1,
          lastAttemptAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          messageId: '<apx-msg-001@smaltimento-rifiuti-roma.it>',
          smtpResponse: '250 2.0.0 OK: queued as 4XjL9K3m',
        },
        {
          email: 'tech-ops@smaltimento-rifiuti-roma.it',
          name: 'Operations Lead',
          status: 'accepted',
          attempts: 1,
          lastAttemptAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          messageId: '<apx-msg-002@smaltimento-rifiuti-roma.it>',
          smtpResponse: '250 2.0.0 OK: queued as 4XjL9K3n',
        },
        {
          email: 'bounce-test@invalid-domain-demo.org',
          name: 'Invalid Mailbox',
          status: 'failed',
          attempts: 1,
          lastAttemptAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          error: 'Suppression policy: Address on suppression list (bounced)',
        }
      ],
      status: 'completed',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      startedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 3 + 45000).toISOString(),
      rateLimitPerSec: 5,
      batchSize: 10,
      stats: {
        total: 3,
        pending: 0,
        accepted: 2,
        failed: 1,
        cancelled: 0,
        retries: 0
      },
      isSimulated: true,
    });

    // Prepopulate sample draft
    const sampleDraftId = 'draft_initial_welcome';
    this.drafts.set(sampleDraftId, {
      id: sampleDraftId,
      title: 'Monthly Partner Briefing Draft',
      subject: 'Monthly Operational Digest & Security Enhancements',
      fromName: defaultFromName,
      fromEmail: defaultFromEmail,
      replyTo: defaultReplyTo,
      htmlContent: predefinedTemplates[2].htmlContent,
      textContent: predefinedTemplates[2].textContent,
      recipientCount: 0,
      updatedAt: new Date().toISOString(),
    });
  }

  // SMTP Settings
  public getSmtpConfig(): SmtpConfig {
    return { ...this.smtpConfig };
  }

  public getSanitizedSmtpConfig(): SanitizedSmtpConfig {
    return {
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      security: this.smtpConfig.security,
      username: this.smtpConfig.username,
      hasPassword: Boolean(this.smtpConfig.password && this.smtpConfig.password.trim().length > 0),
      fromEmail: this.smtpConfig.fromEmail,
      fromName: this.smtpConfig.fromName,
      replyTo: this.smtpConfig.replyTo,
      devMode: this.smtpConfig.devMode,
    };
  }

  public updateSmtpConfig(newConfig: Partial<SmtpConfig>): SanitizedSmtpConfig {
    const updated: SmtpConfig = {
      ...this.smtpConfig,
      ...newConfig,
    };
    // Keep existing password if not updated or empty
    if (newConfig.password === undefined || newConfig.password === '') {
      updated.password = this.smtpConfig.password;
    }
    this.smtpConfig = updated;

    // Sync primary profile in monitor
    const primary = this.profiles.get('primary');
    if (primary) {
      this.profiles.set('primary', {
        ...primary,
        host: updated.host,
        port: updated.port,
        security: updated.security,
        username: updated.username,
        password: updated.password,
        fromEmail: updated.fromEmail,
        fromName: updated.fromName,
        replyTo: updated.replyTo,
        updatedAt: new Date().toISOString(),
      });
    }

    return this.getSanitizedSmtpConfig();
  }

  // -------------------------------------------------------------
  // SMTP Monitor Profiles & Diagnostic History
  // -------------------------------------------------------------
  public listProfiles(): SanitizedSmtpProfile[] {
    return Array.from(this.profiles.values()).map((p) => this.sanitizeProfile(p));
  }

  public getProfile(id: string): SmtpProfile | undefined {
    return this.profiles.get(id);
  }

  public getSanitizedProfile(id: string): SanitizedSmtpProfile | undefined {
    const p = this.profiles.get(id);
    return p ? this.sanitizeProfile(p) : undefined;
  }

  public saveProfile(data: Partial<SmtpProfile> & { host: string; port: number }): SanitizedSmtpProfile {
    const id = data.id || 'prof_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const existing = this.profiles.get(id);

    const profile: SmtpProfile = {
      id,
      name: data.name ? data.name.trim() : (existing ? existing.name : `${data.host}:${data.port}`),
      host: data.host.trim(),
      port: Number(data.port),
      security: data.security || (Number(data.port) === 465 ? 'ssl' : 'starttls'),
      username: data.username !== undefined ? data.username.trim() : (existing ? existing.username : ''),
      password: (data.password !== undefined && data.password !== '') ? data.password : (existing ? existing.password : ''),
      fromEmail: data.fromEmail ? data.fromEmail.trim() : (existing ? existing.fromEmail : this.smtpConfig.fromEmail),
      fromName: data.fromName ? data.fromName.trim() : (existing ? existing.fromName : this.smtpConfig.fromName),
      replyTo: data.replyTo ? data.replyTo.trim() : (existing ? existing.replyTo : this.smtpConfig.replyTo),
      lastVerificationTime: existing ? existing.lastVerificationTime : undefined,
      lastConnectionStatus: existing ? existing.lastConnectionStatus : 'Pending',
      lastResponseTimeMs: existing ? existing.lastResponseTimeMs : undefined,
      lastErrorCode: existing ? existing.lastErrorCode : undefined,
      lastErrorDetails: existing ? existing.lastErrorDetails : undefined,
      lastRawResponse: existing ? existing.lastRawResponse : undefined,
      lastTestEmailStatus: existing ? existing.lastTestEmailStatus : 'Not Requested',
      lastTestEmailTime: existing ? existing.lastTestEmailTime : undefined,
      lastTestEmailRecipient: existing ? existing.lastTestEmailRecipient : undefined,
      lastTestEmailMessageId: existing ? existing.lastTestEmailMessageId : undefined,
      lastTestEmailResponse: existing ? existing.lastTestEmailResponse : undefined,
      lastTestEmailError: existing ? existing.lastTestEmailError : undefined,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(id, profile);
    return this.sanitizeProfile(profile);
  }

  public findProfileByEndpoint(host: string, port: number, username: string): SmtpProfile | undefined {
    const normHost = host.trim().toLowerCase();
    const normPort = Number(port);
    const normUser = (username || '').trim().toLowerCase();
    for (const p of this.profiles.values()) {
      if (
        p.host.trim().toLowerCase() === normHost &&
        p.port === normPort &&
        (p.username || '').trim().toLowerCase() === normUser
      ) {
        return p;
      }
    }
    return undefined;
  }

  public saveProfilesBatch(
    items: Array<{
      name?: string;
      host: string;
      port: number;
      security?: SmtpSecurity;
      username: string;
      password?: string;
      fromEmail?: string;
      fromName?: string;
    }>
  ): { added: SanitizedSmtpProfile[]; duplicatesSkipped: number } {
    const added: SanitizedSmtpProfile[] = [];
    let duplicatesSkipped = 0;

    for (const item of items) {
      // Prevent duplicate configurations
      const existing = this.findProfileByEndpoint(item.host, item.port, item.username);
      if (existing) {
        duplicatesSkipped++;
        continue;
      }

      const sec: SmtpSecurity =
        item.security || (Number(item.port) === 465 ? 'ssl' : Number(item.port) === 25 ? 'none' : 'starttls');

      const saved = this.saveProfile({
        name: item.name || `${item.host}:${item.port} (${item.username || 'relay'})`,
        host: item.host.trim(),
        port: Number(item.port),
        security: sec,
        username: item.username.trim(),
        password: item.password,
        fromEmail: item.fromEmail || (item.username.includes('@') ? item.username.trim() : this.smtpConfig.fromEmail),
        fromName: item.fromName || 'ApexMail Dispatcher',
      });
      added.push(saved);
    }

    return { added, duplicatesSkipped };
  }

  public updateProfileDiagnostics(id: string, updates: Partial<SmtpProfile>): SanitizedSmtpProfile | undefined {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;

    const updated: SmtpProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(id, updated);
    return this.sanitizeProfile(updated);
  }

  public deleteProfile(id: string): boolean {
    if (id === 'primary') return false; // Protect primary profile
    const deleted = this.profiles.delete(id);
    if (deleted) {
      // Clean up associated diagnostic records for this profile
      this.diagnosticLogs = this.diagnosticLogs.filter((l) => l.profileId !== id);
    }
    return deleted;
  }

  public deleteProfilesBatch(ids: string[]): { deletedCount: number; deletedIds: string[]; notFoundIds: string[] } {
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];
    const idSet = new Set<string>();

    for (const rawId of ids) {
      const id = String(rawId || '').trim();
      if (!id || id === 'primary') continue; // Always protect primary gateway

      if (this.profiles.has(id)) {
        this.profiles.delete(id);
        deletedIds.push(id);
        idSet.add(id);
      } else {
        notFoundIds.push(id);
      }
    }

    if (idSet.size > 0) {
      // Clean up associated diagnostic records for deleted profiles
      this.diagnosticLogs = this.diagnosticLogs.filter((l) => !idSet.has(l.profileId || ''));
    }

    return {
      deletedCount: deletedIds.length,
      deletedIds,
      notFoundIds,
    };
  }

  public addDiagnosticLog(log: MonitorDiagnosticLog): void {
    this.diagnosticLogs.unshift(log);
    if (this.diagnosticLogs.length > 500) {
      this.diagnosticLogs.length = 500;
    }
  }

  public listDiagnosticLogs(limit = 100, profileId?: string): MonitorDiagnosticLog[] {
    let list = this.diagnosticLogs;
    if (profileId) {
      list = list.filter((l) => l.profileId === profileId);
    }
    return list.slice(0, limit);
  }

  public exportDiagnosticLogsCsv(): string {
    const headers = [
      'Timestamp',
      'Profile ID',
      'Profile Name',
      'Host',
      'Port',
      'Security',
      'Diagnostic Type',
      'Status',
      'Response Time (ms)',
      'Error Code',
      'Message',
    ];

    const rows = this.diagnosticLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.profileId}"`,
      `"${(l.profileName || '').replace(/"/g, '""')}"`,
      `"${l.host}"`,
      l.port,
      `"${l.security}"`,
      `"${l.type}"`,
      `"${l.status}"`,
      l.responseTimeMs || '',
      `"${l.code || ''}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
    ]);

    const headerLine = headers.join(',');
    const dataLines = rows.map((r) => r.join(','));
    return [headerLine, ...dataLines].join('\r\n') + '\r\n';
  }

  private sanitizeProfile(p: SmtpProfile): SanitizedSmtpProfile {
    return {
      id: p.id,
      name: p.name,
      host: p.host,
      port: p.port,
      security: p.security,
      username: p.username,
      hasPassword: Boolean(p.password && p.password.trim().length > 0),
      fromEmail: p.fromEmail,
      fromName: p.fromName,
      replyTo: p.replyTo,
      lastVerificationTime: p.lastVerificationTime,
      lastConnectionStatus: p.lastConnectionStatus,
      lastResponseTimeMs: p.lastResponseTimeMs,
      lastErrorCode: p.lastErrorCode,
      lastErrorDetails: p.lastErrorDetails,
      lastRawResponse: p.lastRawResponse,
      lastTestEmailStatus: p.lastTestEmailStatus,
      lastTestEmailTime: p.lastTestEmailTime,
      lastTestEmailRecipient: p.lastTestEmailRecipient,
      lastTestEmailMessageId: p.lastTestEmailMessageId,
      lastTestEmailResponse: p.lastTestEmailResponse,
      lastTestEmailError: p.lastTestEmailError,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  // Campaigns
  public listCampaigns(): Campaign[] {
    return Array.from(this.campaigns.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getCampaign(id: string): Campaign | undefined {
    return this.campaigns.get(id);
  }

  public saveCampaign(campaign: Campaign): Campaign {
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  public deleteCampaign(id: string): boolean {
    return this.campaigns.delete(id);
  }

  // Drafts
  public listDrafts(): EmailDraft[] {
    return Array.from(this.drafts.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getDraft(id: string): EmailDraft | undefined {
    return this.drafts.get(id);
  }

  public saveDraft(draft: EmailDraft): EmailDraft {
    this.drafts.set(draft.id, draft);
    return draft;
  }

  public deleteDraft(id: string): boolean {
    return this.drafts.delete(id);
  }

  // Suppression
  public listSuppression(): SuppressionEntry[] {
    return Array.from(this.suppressionList.values()).sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );
  }

  public isSuppressed(email: string): boolean {
    return this.suppressionList.has(email.toLowerCase().trim());
  }

  public addSuppressionEntry(entry: SuppressionEntry): SuppressionEntry {
    const normalized = {
      ...entry,
      email: entry.email.toLowerCase().trim(),
      addedAt: entry.addedAt || new Date().toISOString(),
    };
    this.suppressionList.set(normalized.email, normalized);
    return normalized;
  }

  public removeSuppressionEntry(email: string): boolean {
    return this.suppressionList.delete(email.toLowerCase().trim());
  }

  // Delivery Logs
  public addLog(log: DeliveryLog) {
    this.logs.unshift(log);
    // Keep last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs.length = 1000;
    }
  }

  public listLogs(limit = 100, status?: string): DeliveryLog[] {
    let filtered = this.logs;
    if (status && status !== 'all') {
      filtered = filtered.filter(l => l.status === status);
    }
    return filtered.slice(0, limit);
  }

  // Templates
  public listTemplates(): EmailTemplate[] {
    return this.templates;
  }

  // Aggregated Dashboard Stats
  public getDashboardStats() {
    const campaigns = this.listCampaigns();
    let totalRecipients = 0;
    let accepted = 0;
    let failed = 0;
    let pending = 0;

    for (const c of campaigns) {
      totalRecipients += c.stats.total;
      accepted += c.stats.accepted;
      failed += c.stats.failed;
      pending += c.stats.pending;
    }

    const activeQueues = campaigns.filter(c => c.status === 'sending' || c.status === 'queued');

    return {
      totalRecipients,
      accepted,
      failed,
      pending,
      activeCampaignsCount: activeQueues.length,
      totalCampaignsCount: campaigns.length,
      suppressionCount: this.suppressionList.size,
      recentCampaigns: campaigns.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        createdAt: c.createdAt,
        recipientCount: c.stats.total,
        accepted: c.stats.accepted,
        failed: c.stats.failed,
        status: c.status,
      })),
      recentLogs: this.logs.slice(0, 10),
    };
  }
}

export const storage = new DataStorage();
