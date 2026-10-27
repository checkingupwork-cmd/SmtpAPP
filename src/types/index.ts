export type NavTab =
  | 'dashboard'
  | 'smtp'
  | 'monitor'
  | 'composer'
  | 'recipients'
  | 'campaigns'
  | 'templates'
  | 'logs';

export type SmtpSecurity = 'ssl' | 'starttls' | 'none';

export type MonitorConnectionStatus =
  | 'Pending'
  | 'Checking'
  | 'Connected'
  | 'Authentication Failed'
  | 'Connection Failed'
  | 'Timeout'
  | 'TLS Error';

export type MonitorTestEmailStatus =
  | 'Not Requested'
  | 'Pending'
  | 'Sending'
  | 'Email Accepted'
  | 'Authentication Failed'
  | 'Connection Failed'
  | 'Timeout'
  | 'Email Sending Failed';

export interface SanitizedSmtpProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  lastVerificationTime?: string;
  lastConnectionStatus: MonitorConnectionStatus;
  lastResponseTimeMs?: number;
  lastErrorCode?: string;
  lastErrorDetails?: string;
  lastRawResponse?: string;
  lastTestEmailStatus: MonitorTestEmailStatus;
  lastTestEmailTime?: string;
  lastTestEmailRecipient?: string;
  lastTestEmailMessageId?: string;
  lastTestEmailResponse?: string;
  lastTestEmailError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorDiagnosticLog {
  id: string;
  profileId: string;
  profileName: string;
  host: string;
  port: number;
  security: string;
  type: 'connection_test' | 'test_email';
  status: string;
  responseTimeMs?: number;
  code?: string;
  responseCode?: number;
  message: string;
  details?: string;
  destinationEmail?: string;
  timestamp: string;
}

export interface DeepDiagnosticsResult {
  host: string;
  port: number;
  security: string;
  dns: {
    resolvedIps: string[];
    mxRecords?: Array<{ exchange: string; priority: number }>;
    dnsLatencyMs: number;
  };
  tls?: {
    protocol?: string;
    cipherName?: string;
    cipherVersion?: string;
    certSubject?: string;
    certIssuer?: string;
    certValidTo?: string;
    certDaysRemaining?: number;
    authorized?: boolean;
    authError?: string;
  };
  serverBanner?: string;
  smtpVerify: {
    success: boolean;
    message: string;
    code?: string;
    responseCode?: number;
    response?: string;
  };
  totalLatencyMs: number;
  timestamp: string;
}

export interface SanitizedSmtpConfig {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  devMode?: boolean;
}

export interface SmtpVerifyResult {
  success: boolean;
  message: string;
  code?: string;
  responseCode?: number;
  command?: string;
  response?: string;
  error?: string;
  details?: {
    host: string;
    port: number;
    security: string;
    user: string;
    authAttempted?: boolean;
    tlsVersion?: string;
  };
  timestamp?: string;
}

export interface SendTestResult {
  success: boolean;
  message: string;
  messageId?: string;
  response?: string;
  smtpResponse?: string;
  code?: string;
  responseCode?: number;
  command?: string;
  error?: string;
  details?: {
    from: string;
    to: string;
    host: string;
    port: number;
  };
  timestamp?: string;
}

export type MessageStatus = 'pending' | 'accepted' | 'sent' | 'failed' | 'bounced' | 'cancelled';

export interface RecipientRecord {
  email: string;
  name?: string;
  status: MessageStatus;
  attempts: number;
  lastAttemptAt?: string;
  messageId?: string;
  smtpResponse?: string;
  error?: string;
}

export type CampaignStatus = 'draft' | 'queued' | 'sending' | 'completed' | 'cancelled' | 'failed';

export interface CampaignStats {
  total: number;
  pending: number;
  accepted: number;
  failed: number;
  cancelled: number;
  retries: number;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  htmlContent: string;
  textContent?: string;
  recipients: RecipientRecord[];
  status: CampaignStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  rateLimitPerSec: number;
  batchSize: number;
  stats: CampaignStats;
  isSimulated?: boolean;
}

export interface EmailDraft {
  id: string;
  title: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  htmlContent: string;
  textContent: string;
  recipientCount: number;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface SuppressionEntry {
  email: string;
  reason: 'unsubscribed' | 'bounced' | 'complaint' | 'manual';
  addedAt: string;
  notes?: string;
}

export interface DeliveryLog {
  id: string;
  campaignId: string;
  campaignName: string;
  recipientEmail: string;
  status: MessageStatus;
  attempts: number;
  timestamp: string;
  messageId?: string;
  smtpResponse?: string;
  error?: string;
  isSimulated?: boolean;
}

export interface DashboardStats {
  totalRecipients: number;
  accepted: number;
  failed: number;
  pending: number;
  activeCampaignsCount: number;
  totalCampaignsCount: number;
  suppressionCount: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    subject: string;
    createdAt: string;
    recipientCount: number;
    accepted: number;
    failed: number;
    status: CampaignStatus;
  }>;
  recentLogs: DeliveryLog[];
}

export interface ValidationSummary {
  summary: {
    totalInput: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    suppressedCount: number;
  };
  valid: { email: string; name?: string }[];
  invalid: { email: string; reason: string }[];
  duplicates: string[];
  suppressed: { email: string; reason: string }[];
}

export interface BatchAddProfileInput {
  name?: string;
  host: string;
  port: number;
  security?: SmtpSecurity;
  username: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface BatchAddProfilesResult {
  success: boolean;
  count: number;
  added: SanitizedSmtpProfile[];
  duplicatesSkipped: number;
  errors: string[];
}

export interface BulkDeleteProfilesResult {
  success: boolean;
  deletedCount: number;
  deletedIds: string[];
  notFoundIds?: string[];
}

export interface GroupTestEmailItemResult {
  profileId: string;
  name: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  fromEmail: string;
  status: MonitorTestEmailStatus;
  responseTimeMs?: number;
  error?: string;
  code?: string;
  response?: string;
  messageId?: string;
  timestamp?: string;
}
