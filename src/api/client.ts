import {
  SanitizedSmtpConfig,
  SanitizedSmtpProfile,
  MonitorDiagnosticLog,
  DeepDiagnosticsResult,
  SmtpVerifyResult,
  SendTestResult,
  Campaign,
  EmailDraft,
  EmailTemplate,
  SuppressionEntry,
  DeliveryLog,
  DashboardStats,
  ValidationSummary,
  BatchAddProfileInput,
  BatchAddProfilesResult,
  BulkDeleteProfilesResult,
  MonitorTestEmailStatus,
} from '../types';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // SMTP
  async getSmtpConfig(): Promise<SanitizedSmtpConfig> {
    const res = await fetch('/api/smtp/config');
    return handleResponse<SanitizedSmtpConfig>(res);
  },

  async saveSmtpConfig(config: {
    host: string;
    port: number;
    security: string;
    username: string;
    password?: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    devMode: boolean;
  }): Promise<{ success: boolean; message: string; config: SanitizedSmtpConfig }> {
    const res = await fetch('/api/smtp/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return handleResponse(res);
  },

  async testSmtpConnection(params: {
    host?: string;
    port?: number;
    security?: string;
    username?: string;
    password?: string;
  }): Promise<SmtpVerifyResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s safety timeout

    try {
      const res = await fetch('/api/smtp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object' && 'success' in data) {
        return data as SmtpVerifyResult;
      }

      if (!res.ok) {
        return {
          success: false,
          message: `Server returned HTTP ${res.status}: ${res.statusText}`,
          code: `HTTP_${res.status}`,
          timestamp: new Date().toISOString(),
        };
      }

      return data as SmtpVerifyResult;
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      return {
        success: false,
        message: isAbort
          ? 'Client timeout: The SMTP server did not respond within 15 seconds.'
          : (err.message || 'Network request failed'),
        code: isAbort ? 'ETIMEDOUT' : 'ENETWORK',
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async sendTestEmail(params: {
    destinationEmail: string;
    customSubject?: string;
  }): Promise<SendTestResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const res = await fetch('/api/smtp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationEmail: params.destinationEmail,
          recipientEmail: params.destinationEmail,
          customSubject: params.customSubject,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object' && 'success' in data) {
        return data as SendTestResult;
      }

      if (!res.ok) {
        return {
          success: false,
          message: `Server returned HTTP ${res.status}: ${res.statusText}`,
          code: `HTTP_${res.status}`,
          timestamp: new Date().toISOString(),
        };
      }

      return data as SendTestResult;
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      return {
        success: false,
        message: isAbort
          ? 'Client timeout: Upstream SMTP relay did not accept message within 15 seconds.'
          : (err.message || 'Network request failed'),
        code: isAbort ? 'ETIMEDOUT' : 'ENETWORK',
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  // Recipient validation
  async validateRecipients(rawList: Array<string | { email: string; name?: string }>): Promise<ValidationSummary> {
    const res = await fetch('/api/recipients/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawList }),
    });
    return handleResponse<ValidationSummary>(res);
  },

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    const res = await fetch('/api/campaigns');
    return handleResponse<Campaign[]>(res);
  },

  async getCampaign(id: string): Promise<Campaign> {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`);
    return handleResponse<Campaign>(res);
  },

  async createCampaign(data: {
    name: string;
    subject: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    htmlContent: string;
    textContent?: string;
    recipients: Array<string | { email: string; name?: string }>;
    rateLimitPerSec?: number;
    batchSize?: number;
    autoStart?: boolean;
  }): Promise<Campaign> {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Campaign>(res);
  },

  async startCampaign(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}/start`, { method: 'POST' });
    return handleResponse(res);
  },

  async cancelCampaign(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    return handleResponse(res);
  },

  async deleteCampaign(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Drafts
  async getDrafts(): Promise<EmailDraft[]> {
    const res = await fetch('/api/drafts');
    return handleResponse<EmailDraft[]>(res);
  },

  async saveDraft(draft: Partial<EmailDraft>): Promise<EmailDraft> {
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    return handleResponse<EmailDraft>(res);
  },

  async deleteDraft(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Templates
  async getTemplates(): Promise<EmailTemplate[]> {
    const res = await fetch('/api/templates');
    return handleResponse<EmailTemplate[]>(res);
  },

  // Suppression
  async getSuppression(): Promise<SuppressionEntry[]> {
    const res = await fetch('/api/suppression');
    return handleResponse<SuppressionEntry[]>(res);
  },

  async addSuppression(email: string, reason?: string, notes?: string): Promise<SuppressionEntry> {
    const res = await fetch('/api/suppression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reason, notes }),
    });
    return handleResponse<SuppressionEntry>(res);
  },

  async removeSuppression(email: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/suppression/${encodeURIComponent(email)}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Logs
  async getLogs(status?: string, limit = 100): Promise<DeliveryLog[]> {
    const url = new URL('/api/logs', window.location.origin);
    if (status) url.searchParams.set('status', status);
    if (limit) url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString());
    return handleResponse<DeliveryLog[]>(res);
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch('/api/dashboard/stats');
    return handleResponse<DashboardStats>(res);
  },

  // SMTP Connection Monitor & Diagnostics
  async getMonitorProfiles(): Promise<SanitizedSmtpProfile[]> {
    const res = await fetch('/api/monitor/profiles');
    return handleResponse<SanitizedSmtpProfile[]>(res);
  },

  async saveMonitorProfile(data: {
    id?: string;
    name?: string;
    host: string;
    port: number;
    security?: 'ssl' | 'starttls' | 'none';
    username?: string;
    password?: string;
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
  }): Promise<{ success: boolean; profile: SanitizedSmtpProfile }> {
    const res = await fetch('/api/monitor/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; profile: SanitizedSmtpProfile }>(res);
  },

  async saveMonitorProfilesBatch(
    profiles: BatchAddProfileInput[]
  ): Promise<BatchAddProfilesResult> {
    const res = await fetch('/api/monitor/profiles/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles }),
    });
    return handleResponse<BatchAddProfilesResult>(res);
  },

  async deleteMonitorProfile(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/monitor/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return handleResponse<{ success: boolean; message?: string }>(res);
  },

  async bulkDeleteMonitorProfiles(ids: string[]): Promise<BulkDeleteProfilesResult> {
    const res = await fetch('/api/monitor/profiles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return handleResponse<BulkDeleteProfilesResult>(res);
  },

  async testMonitorProfile(
    id: string,
    timeoutMs = 10000
  ): Promise<{ success: boolean; profile: SanitizedSmtpProfile; result?: SmtpVerifyResult; responseTimeMs?: number; error?: string }> {
    const res = await fetch(`/api/monitor/profiles/${encodeURIComponent(id)}/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeoutMs }),
    });
    return handleResponse(res);
  },

  async sendTestMonitorProfile(
    id: string,
    params: { destinationEmail: string; subject?: string; textBody?: string; timeoutMs?: number }
  ): Promise<{
    success: boolean;
    profile: SanitizedSmtpProfile;
    result?: SendTestResult;
    responseTimeMs?: number;
    status?: MonitorTestEmailStatus;
    error?: string;
  }> {
    const res = await fetch(`/api/monitor/profiles/${encodeURIComponent(id)}/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse(res);
  },

  async getMonitorProfileDiagnostics(
    id: string,
    timeoutMs = 10000
  ): Promise<{ success: boolean; diagnostics: DeepDiagnosticsResult; profile: SanitizedSmtpProfile }> {
    const res = await fetch(`/api/monitor/profiles/${encodeURIComponent(id)}/diagnostics?timeoutMs=${timeoutMs}`);
    return handleResponse<{ success: boolean; diagnostics: DeepDiagnosticsResult; profile: SanitizedSmtpProfile }>(res);
  },

  async getMonitorLogs(limit = 100, profileId?: string): Promise<MonitorDiagnosticLog[]> {
    const url = new URL('/api/monitor/logs', window.location.origin);
    if (limit) url.searchParams.set('limit', String(limit));
    if (profileId) url.searchParams.set('profileId', profileId);
    const res = await fetch(url.toString());
    return handleResponse<MonitorDiagnosticLog[]>(res);
  },

  exportMonitorLogsCsvUrl(): string {
    return '/api/monitor/logs/export';
  },
};
