import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { storage } from './server/storage.js';
import { SmtpService } from './server/smtpService.js';
import { queueManager } from './server/queueService.js';
import { Campaign, SmtpConfig, SmtpSecurity, BatchAddProfileInput, MonitorTestEmailStatus } from './server/types.js';
import { validateSmtpTarget } from './server/securityValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic Security & Sandboxing Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Allow iframe embedding from same origin for our sandboxed email preview
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Request rate limiter in memory (prevents relay abuse)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 200;

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    entry.count++;
  }
  requestCounts.set(ip, entry);

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }
  next();
});

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. SMTP Settings
app.get('/api/smtp/config', (req: Request, res: Response) => {
  res.json(storage.getSanitizedSmtpConfig());
});

app.post('/api/smtp/config', (req: Request, res: Response) => {
  const { host, port, security, username, password, fromEmail, fromName, replyTo, devMode } = req.body;

  if (!host || !port || !fromEmail) {
    res.status(400).json({ error: 'Host, Port, and From Email are required.' });
    return;
  }

  const updated = storage.updateSmtpConfig({
    host: String(host).trim(),
    port: parseInt(String(port), 10),
    security: security || 'ssl',
    username: String(username || '').trim(),
    password: password !== undefined ? String(password) : undefined,
    fromEmail: String(fromEmail).trim(),
    fromName: String(fromName || '').trim(),
    replyTo: replyTo ? String(replyTo).trim() : undefined,
    devMode: Boolean(devMode),
  });

  res.json({
    success: true,
    message: 'SMTP settings updated securely on server.',
    config: updated,
  });
});

// 2. Test SMTP Connection
app.post('/api/smtp/test-connection', async (req: Request, res: Response) => {
  try {
    const currentConfig = storage.getSmtpConfig();
    const testConfig: SmtpConfig = {
      ...currentConfig,
      ...(req.body.host ? { host: String(req.body.host).trim() } : {}),
      ...(req.body.port ? { port: parseInt(String(req.body.port), 10) } : {}),
      ...(req.body.security ? { security: req.body.security } : {}),
      ...(req.body.username ? { username: String(req.body.username).trim() } : {}),
      ...(req.body.password !== undefined && String(req.body.password).trim().length > 0
        ? { password: String(req.body.password) }
        : {}),
    };

    const result = await SmtpService.testConnection(testConfig);
    res.json(result);
  } catch (err: any) {
    console.error('[SMTP] API request failure in /api/smtp/test-connection:', err?.message || err);
    res.status(500).json({
      success: false,
      message: 'Failed to execute SMTP test probe.',
      code: 'ESERVER',
      error: err?.message || 'Internal server error',
    });
  }
});

// 3. Send Test Verification Email (POST /api/smtp/send-test and alias /api/smtp/send-test-email)
const handleSendTestEmail = async (req: Request, res: Response) => {
  const destinationEmail = (
    req.body.destinationEmail ||
    req.body.recipientEmail ||
    req.body.to ||
    ''
  ).trim();
  const customSubject = req.body.customSubject;

  // 1. Validate destination address
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!destinationEmail || !emailRegex.test(destinationEmail)) {
    console.error(`[SMTP] Send-test rejected: invalid destination address "${destinationEmail}"`);
    res.status(400).json({
      success: false,
      message: 'Invalid destination email address. Please provide a valid email format (e.g. user@domain.com).',
      code: 'EINVALID_EMAIL',
    });
    return;
  }

  try {
    const currentConfig = storage.getSmtpConfig();
    const testConfig: SmtpConfig = {
      ...currentConfig,
      ...(req.body.host ? { host: String(req.body.host).trim() } : {}),
      ...(req.body.port ? { port: parseInt(String(req.body.port), 10) } : {}),
      ...(req.body.security ? { security: req.body.security } : {}),
      ...(req.body.username ? { username: String(req.body.username).trim() } : {}),
      ...(req.body.password !== undefined && String(req.body.password).trim().length > 0
        ? { password: String(req.body.password) }
        : {}),
      ...(req.body.fromEmail ? { fromEmail: String(req.body.fromEmail).trim() } : {}),
      ...(req.body.fromName ? { fromName: String(req.body.fromName).trim() } : {}),
      ...(req.body.replyTo ? { replyTo: String(req.body.replyTo).trim() } : {}),
    };

    const timestamp = new Date().toLocaleString();
    const subject = customSubject || `[ApexMail Test] SMTP Verification Probe - ${timestamp}`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">SMTP Real Verification Probe</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          This verification message confirms that your SMTP dispatch configuration is functional and authenticated with the remote relay.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 13px; color: #334155; line-height: 1.8;">
            <tr><td style="font-weight: 600; width: 130px;">Relay Host:</td><td>${testConfig.host}</td></tr>
            <tr><td style="font-weight: 600;">Port & Cipher:</td><td>${testConfig.port} (${testConfig.port === 465 ? 'SSL/TLS' : testConfig.port === 587 ? 'STARTTLS' : 'Plain'})</td></tr>
            <tr><td style="font-weight: 600;">Sender Identity:</td><td>${testConfig.fromName} &lt;${testConfig.fromEmail}&gt;</td></tr>
            <tr><td style="font-weight: 600;">Destination:</td><td>${destinationEmail}</td></tr>
            <tr><td style="font-weight: 600;">Timestamp:</td><td>${timestamp}</td></tr>
          </table>
        </div>
        <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
          Dispatched by ApexMail Enterprise Relay via Nodemailer.
        </p>
      </div>
    `;

    const result = await SmtpService.sendMail(testConfig, {
      to: destinationEmail,
      subject,
      html: htmlBody,
      text: `SMTP Test Verification\nHost: ${testConfig.host}:${testConfig.port}\nDestination: ${destinationEmail}\nTimestamp: ${timestamp}`,
    });

    if (result.success) {
      storage.addLog({
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        campaignId: 'test_probe',
        campaignName: 'SMTP Test Probe',
        recipientEmail: destinationEmail,
        status: 'accepted',
        attempts: 1,
        timestamp: new Date().toISOString(),
        messageId: result.messageId,
        smtpResponse: result.smtpResponse,
        isSimulated: false,
      });

      res.json({
        success: true,
        message: 'Test email accepted by the SMTP server.',
        messageId: result.messageId,
        response: result.response || result.smtpResponse,
        details: result.details,
        timestamp: result.timestamp,
      });
    } else {
      storage.addLog({
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        campaignId: 'test_probe',
        campaignName: 'SMTP Test Probe',
        recipientEmail: destinationEmail,
        status: 'failed',
        attempts: 1,
        timestamp: new Date().toISOString(),
        error: result.message || result.error,
        isSimulated: false,
      });

      res.status(result.code === 'EAUTH' ? 401 : 502).json({
        success: false,
        message: result.message,
        code: result.code,
        responseCode: result.responseCode,
        command: result.command,
        response: result.response,
        error: result.error,
        details: result.details,
        timestamp: result.timestamp,
      });
    }
  } catch (err: any) {
    console.error('[SMTP] API request failure in send-test:', err?.message || err);
    res.status(500).json({
      success: false,
      message: 'Failed to process test email request.',
      code: 'ESERVER',
      error: err?.message || 'Internal server error',
    });
  }
};

app.post('/api/smtp/send-test', handleSendTestEmail);
app.post('/api/smtp/send-test-email', handleSendTestEmail);

// -------------------------------------------------------------
// SMTP Connection Monitor & Diagnostics Endpoints
// -------------------------------------------------------------
const activeMonitorTests = new Set<string>();
const MAX_CONCURRENT_DIAGNOSTICS = 5;

// List all saved profiles
app.get('/api/monitor/profiles', (req: Request, res: Response) => {
  res.json(storage.listProfiles());
});

// Save or update an authorized profile
app.post('/api/monitor/profiles', async (req: Request, res: Response) => {
  const { id, name, host, port, security, username, password, fromEmail, fromName, replyTo } = req.body;
  if (!host || !port) {
    res.status(400).json({ error: 'Host and port are required.' });
    return;
  }

  // SSRF check on target host
  const validation = await validateSmtpTarget(String(host));
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const saved = storage.saveProfile({
    id,
    name: name ? String(name).trim() : undefined,
    host: String(host).trim(),
    port: parseInt(String(port), 10),
    security: security || (parseInt(String(port), 10) === 465 ? 'ssl' : 'starttls'),
    username: username ? String(username).trim() : '',
    password: password ? String(password) : undefined,
    fromEmail: fromEmail ? String(fromEmail).trim() : undefined,
    fromName: fromName ? String(fromName).trim() : undefined,
    replyTo: replyTo ? String(replyTo).trim() : undefined,
  });

  res.json({ success: true, profile: saved });
});

// Batch add authorized profiles
app.post('/api/monitor/profiles/batch', async (req: Request, res: Response) => {
  const { profiles } = req.body;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    res.status(400).json({ error: 'Profiles array must be provided and cannot be empty.' });
    return;
  }

  if (profiles.length > 200) {
    res.status(400).json({ error: 'Cannot import more than 200 profiles in a single batch.' });
    return;
  }

  const validToSave: BatchAddProfileInput[] = [];
  const seenInBatch = new Set<string>();
  let duplicatesSkipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < profiles.length; i++) {
    const item = profiles[i];
    const indexNum = i + 1;
    if (!item || typeof item !== 'object') {
      errors.push(`Entry #${indexNum}: Invalid configuration format.`);
      continue;
    }

    const host = String(item.host || '').trim();
    const port = parseInt(String(item.port || ''), 10);
    const username = String(item.username || '').trim();
    const password = item.password !== undefined ? String(item.password) : '';

    if (!host) {
      errors.push(`Entry #${indexNum}: Hostname is required.`);
      continue;
    }

    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`Entry #${indexNum} (${host}): Invalid port number '${item.port}'.`);
      continue;
    }

    if (!username) {
      errors.push(`Entry #${indexNum} (${host}:${port}): Username is required.`);
      continue;
    }

    if (!password) {
      errors.push(`Entry #${indexNum} (${host}:${port}): Password is required.`);
      continue;
    }

    // SSRF check on target host
    const validation = await validateSmtpTarget(host);
    if (!validation.valid) {
      errors.push(`Entry #${indexNum} (${host}): ${validation.error}`);
      continue;
    }

    // Check duplicate in current batch
    const dedupeKey = `${host.toLowerCase()}:${port}:${username.toLowerCase()}`;
    if (seenInBatch.has(dedupeKey)) {
      duplicatesSkipped++;
      continue;
    }
    seenInBatch.add(dedupeKey);

    // Check duplicate in database
    const existing = storage.findProfileByEndpoint(host, port, username);
    if (existing) {
      duplicatesSkipped++;
      continue;
    }

    const sec: SmtpSecurity =
      item.security || (port === 465 ? 'ssl' : port === 25 ? 'none' : 'starttls');

    validToSave.push({
      name: item.name ? String(item.name).trim() : `${host}:${port} (${username})`,
      host,
      port,
      security: sec,
      username,
      password,
      fromEmail: item.fromEmail ? String(item.fromEmail).trim() : (username.includes('@') ? username : undefined),
      fromName: item.fromName ? String(item.fromName).trim() : undefined,
    });
  }

  const { added, duplicatesSkipped: storageDupes } = storage.saveProfilesBatch(validToSave);
  duplicatesSkipped += storageDupes;

  res.json({
    success: true,
    count: added.length,
    added,
    duplicatesSkipped,
    errors,
  });
});

// Delete a single profile
app.delete('/api/monitor/profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Profile ID is required.' });
    return;
  }
  if (id === 'primary') {
    res.status(400).json({ error: 'Primary gateway profile is protected and cannot be deleted.' });
    return;
  }
  const profile = storage.getProfile(id);
  if (!profile) {
    res.status(404).json({ error: 'SMTP profile not found or already deleted.' });
    return;
  }
  const deleted = storage.deleteProfile(id);
  if (!deleted) {
    res.status(500).json({ error: 'Failed to delete SMTP profile.' });
    return;
  }
  res.json({ success: true, message: `Configuration "${profile.name}" deleted successfully.` });
});

// Bulk delete profiles
app.post('/api/monitor/profiles/bulk-delete', (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'An array of configuration IDs is required.' });
    return;
  }

  // Filter out any empty, non-string, or primary IDs
  const targetIds = ids.filter((id) => typeof id === 'string' && id.trim() !== '' && id !== 'primary');

  if (targetIds.length === 0) {
    res.status(400).json({ error: 'No deletable configuration IDs provided. The primary configuration is protected and cannot be deleted.' });
    return;
  }

  const result = storage.deleteProfilesBatch(targetIds);

  res.json({
    success: true,
    deletedCount: result.deletedCount,
    deletedIds: result.deletedIds,
    notFoundIds: result.notFoundIds,
  });
});

// Test Connection for a specific profile
app.post('/api/monitor/profiles/:id/test-connection', async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const profile = storage.getProfile(profileId);
  if (!profile) {
    res.status(404).json({ error: 'SMTP profile not found.' });
    return;
  }

  if (activeMonitorTests.has(profileId)) {
    res.status(429).json({ error: 'A diagnostic probe for this profile is already running.' });
    return;
  }

  if (activeMonitorTests.size >= MAX_CONCURRENT_DIAGNOSTICS) {
    res.status(429).json({ error: `Simultaneous diagnostic limit (${MAX_CONCURRENT_DIAGNOSTICS}) reached. Please wait for active checks to finish.` });
    return;
  }

  // SSRF check
  const validation = await validateSmtpTarget(profile.host);
  if (!validation.valid) {
    storage.updateProfileDiagnostics(profileId, {
      lastConnectionStatus: 'Connection Failed',
      lastErrorCode: 'ESSRF_BLOCKED',
      lastErrorDetails: validation.error,
    });
    res.status(400).json({ success: false, message: validation.error, code: 'ESSRF_BLOCKED' });
    return;
  }

  activeMonitorTests.add(profileId);
  storage.updateProfileDiagnostics(profileId, { lastConnectionStatus: 'Checking' });

  const timeoutMs = Math.min(Math.max(Number(req.body.timeoutMs) || 10000, 2000), 60000);
  const startTime = Date.now();
  try {
    const result = await SmtpService.testConnection({
      host: profile.host,
      port: profile.port,
      security: profile.security,
      username: profile.username,
      password: profile.password,
      fromEmail: profile.fromEmail,
      fromName: profile.fromName,
    }, timeoutMs);

    const responseTimeMs = Date.now() - startTime;
    const connectionStatus = result.success
      ? 'Connected'
      : result.code === 'EAUTH'
      ? 'Authentication Failed'
      : result.code === 'ETIMEDOUT'
      ? 'Timeout'
      : result.code === 'ESOCKET'
      ? 'TLS Error'
      : 'Connection Failed';

    const updatedProfile = storage.updateProfileDiagnostics(profileId, {
      lastVerificationTime: new Date().toISOString(),
      lastConnectionStatus: connectionStatus,
      lastResponseTimeMs: responseTimeMs,
      lastErrorCode: result.code,
      lastErrorDetails: result.message,
      lastRawResponse: result.response,
    });

    storage.addDiagnosticLog({
      id: 'diag_' + Math.random().toString(36).substring(2, 9),
      profileId,
      profileName: profile.name,
      host: profile.host,
      port: profile.port,
      security: profile.security,
      type: 'connection_test',
      status: connectionStatus,
      responseTimeMs,
      code: result.code,
      responseCode: result.responseCode,
      message: result.message,
      details: result.response || result.error,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: result.success,
      profile: updatedProfile,
      result,
      responseTimeMs,
    });
  } catch (err: any) {
    const responseTimeMs = Date.now() - startTime;
    const updatedProfile = storage.updateProfileDiagnostics(profileId, {
      lastVerificationTime: new Date().toISOString(),
      lastConnectionStatus: 'Connection Failed',
      lastResponseTimeMs: responseTimeMs,
      lastErrorCode: 'ECONNECTION',
      lastErrorDetails: err.message,
    });
    res.json({ success: false, profile: updatedProfile, error: err.message, responseTimeMs });
  } finally {
    activeMonitorTests.delete(profileId);
  }
});

// Deep Diagnostics Probe
app.get('/api/monitor/profiles/:id/diagnostics', async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const profile = storage.getProfile(profileId);
  if (!profile) {
    res.status(404).json({ error: 'SMTP profile not found.' });
    return;
  }

  if (activeMonitorTests.has(profileId)) {
    res.status(429).json({ error: 'A diagnostic probe for this profile is already running.' });
    return;
  }

  if (activeMonitorTests.size >= MAX_CONCURRENT_DIAGNOSTICS) {
    res.status(429).json({ error: `Simultaneous diagnostic limit (${MAX_CONCURRENT_DIAGNOSTICS}) reached. Please wait for active checks to finish.` });
    return;
  }

  // SSRF check
  const validation = await validateSmtpTarget(profile.host);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  activeMonitorTests.add(profileId);
  const timeoutMs = Math.min(Math.max(Number(req.query.timeoutMs) || 10000, 2000), 60000);

  try {
    const deepResult = await SmtpService.probeDeepDiagnostics({
      host: profile.host,
      port: profile.port,
      security: profile.security,
      username: profile.username,
      password: profile.password,
      fromEmail: profile.fromEmail,
      fromName: profile.fromName,
    }, timeoutMs);

    const connectionStatus = deepResult.smtpVerify.success
      ? 'Connected'
      : deepResult.smtpVerify.code === 'EAUTH'
      ? 'Authentication Failed'
      : deepResult.smtpVerify.code === 'ETIMEDOUT'
      ? 'Timeout'
      : deepResult.smtpVerify.code === 'ESOCKET'
      ? 'TLS Error'
      : 'Connection Failed';

    const updatedProfile = storage.updateProfileDiagnostics(profileId, {
      lastVerificationTime: new Date().toISOString(),
      lastConnectionStatus: connectionStatus,
      lastResponseTimeMs: deepResult.totalLatencyMs,
      lastErrorCode: deepResult.smtpVerify.code,
      lastErrorDetails: deepResult.smtpVerify.message,
      lastRawResponse: deepResult.serverBanner || deepResult.smtpVerify.response,
    });

    storage.addDiagnosticLog({
      id: 'diag_' + Math.random().toString(36).substring(2, 9),
      profileId,
      profileName: profile.name,
      host: profile.host,
      port: profile.port,
      security: profile.security,
      type: 'connection_test',
      status: connectionStatus,
      responseTimeMs: deepResult.totalLatencyMs,
      code: deepResult.smtpVerify.code,
      responseCode: deepResult.smtpVerify.responseCode,
      message: deepResult.smtpVerify.message,
      details: deepResult.serverBanner || deepResult.smtpVerify.response,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      diagnostics: deepResult,
      profile: updatedProfile,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    activeMonitorTests.delete(profileId);
  }
});

// Send Test Email for a specific verified profile
app.post('/api/monitor/profiles/:id/send-test', async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const profile = storage.getProfile(profileId);
  if (!profile) {
    res.status(404).json({ error: 'SMTP profile not found.' });
    return;
  }

  const { destinationEmail, subject, textBody, timeoutMs } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!destinationEmail || !emailRegex.test(String(destinationEmail).trim())) {
    res.status(400).json({ error: 'Valid destination recipient email address required.' });
    return;
  }

  // SSRF check
  const validation = await validateSmtpTarget(profile.host);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  storage.updateProfileDiagnostics(profileId, { lastTestEmailStatus: 'Sending' });

  const finalSubject = subject ? String(subject).trim() : 'SMTP Test';
  const finalBody = textBody ? String(textBody).trim() : 'Test message';
  const effectiveTimeout = Math.min(Math.max(Number(timeoutMs) || 10000, 2000), 60000);
  const startTime = Date.now();

  try {
    const result = await SmtpService.sendMail(
      {
        host: profile.host,
        port: profile.port,
        security: profile.security,
        username: profile.username,
        password: profile.password,
        fromEmail: profile.fromEmail,
        fromName: profile.fromName,
        replyTo: profile.replyTo,
      },
      {
        to: String(destinationEmail).trim(),
        subject: finalSubject,
        html: `<p>${finalBody}</p>`,
        text: finalBody,
        timeoutMs: effectiveTimeout,
      }
    );

    const responseTimeMs = Date.now() - startTime;
    const testEmailStatus: MonitorTestEmailStatus = result.success
      ? 'Email Accepted'
      : result.code === 'EAUTH'
      ? 'Authentication Failed'
      : result.code === 'ETIMEDOUT'
      ? 'Timeout'
      : result.code === 'ECONNREFUSED' || result.code === 'ESOCKET' || result.code === 'ENOTFOUND'
      ? 'Connection Failed'
      : 'Email Sending Failed';

    const updatedProfile = storage.updateProfileDiagnostics(profileId, {
      lastTestEmailStatus: testEmailStatus,
      lastTestEmailTime: new Date().toISOString(),
      lastTestEmailRecipient: String(destinationEmail).trim(),
      lastTestEmailMessageId: result.messageId,
      lastTestEmailResponse: result.response,
      lastTestEmailError: result.error,
      lastResponseTimeMs: responseTimeMs,
    });

    storage.addDiagnosticLog({
      id: 'diag_' + Math.random().toString(36).substring(2, 9),
      profileId,
      profileName: profile.name,
      host: profile.host,
      port: profile.port,
      security: profile.security,
      type: 'test_email',
      status: testEmailStatus,
      responseTimeMs,
      code: result.code,
      responseCode: result.responseCode,
      message: result.message,
      details: result.response || result.error,
      destinationEmail: String(destinationEmail).trim(),
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: result.success,
      profile: updatedProfile,
      result,
      responseTimeMs,
      status: testEmailStatus,
    });
  } catch (err: any) {
    const responseTimeMs = Date.now() - startTime;
    const testEmailStatus: MonitorTestEmailStatus =
      err.code === 'EAUTH'
        ? 'Authentication Failed'
        : err.code === 'ETIMEDOUT'
        ? 'Timeout'
        : err.code === 'ECONNREFUSED' || err.code === 'ESOCKET' || err.code === 'ENOTFOUND'
        ? 'Connection Failed'
        : 'Email Sending Failed';

    const updatedProfile = storage.updateProfileDiagnostics(profileId, {
      lastTestEmailStatus: testEmailStatus,
      lastTestEmailTime: new Date().toISOString(),
      lastTestEmailRecipient: String(destinationEmail).trim(),
      lastTestEmailError: err.message,
      lastResponseTimeMs: responseTimeMs,
    });

    res.json({
      success: false,
      profile: updatedProfile,
      error: err.message,
      responseTimeMs,
      status: testEmailStatus,
    });
  }
});

// Logs & CSV Export
app.get('/api/monitor/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  const profileId = req.query.profileId ? String(req.query.profileId) : undefined;
  res.json(storage.listDiagnosticLogs(limit, profileId));
});

app.get('/api/monitor/logs/export', (req: Request, res: Response) => {
  const csv = storage.exportDiagnosticLogsCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="smtp_diagnostics_${Date.now()}.csv"`);
  res.send(csv);
});

// 4. Recipient Validation Endpoint
app.post('/api/recipients/validate', (req: Request, res: Response) => {
  const { rawList } = req.body;
  if (!Array.isArray(rawList)) {
    res.status(400).json({ error: 'Expected rawList array of recipients.' });
    return;
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  const valid: { email: string; name?: string }[] = [];
  const invalid: { email: string; reason: string }[] = [];
  const duplicates: string[] = [];
  const suppressed: { email: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    const email = (typeof item === 'string' ? item : item.email || '').toLowerCase().trim();
    const name = typeof item === 'object' && item.name ? String(item.name).trim() : undefined;

    if (!email) continue;

    if (!emailRegex.test(email)) {
      invalid.push({ email, reason: 'Invalid RFC email syntax' });
      continue;
    }

    if (seen.has(email)) {
      duplicates.push(email);
      continue;
    }
    seen.add(email);

    if (storage.isSuppressed(email)) {
      suppressed.push({ email, reason: 'Recipient is on suppression list (unsubscribed or bounced)' });
      continue;
    }

    valid.push({ email, name });
  }

  res.json({
    summary: {
      totalInput: rawList.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      duplicateCount: duplicates.length,
      suppressedCount: suppressed.length,
    },
    valid,
    invalid,
    duplicates,
    suppressed,
  });
});

// 5. Campaigns Management
app.get('/api/campaigns', (req: Request, res: Response) => {
  res.json(storage.listCampaigns());
});

app.post('/api/campaigns', (req: Request, res: Response) => {
  const {
    name,
    subject,
    fromName,
    fromEmail,
    replyTo,
    htmlContent,
    textContent,
    recipients,
    rateLimitPerSec,
    batchSize,
    autoStart,
  } = req.body;

  if (!name || !subject || !htmlContent || !Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: 'Name, subject, htmlContent, and at least one recipient are required.' });
    return;
  }

  const currentSmtp = storage.getSmtpConfig();
  const campaignId = 'cmp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  const recipientRecords = recipients.map((r: any) => ({
    email: (typeof r === 'string' ? r : r.email).toLowerCase().trim(),
    name: typeof r === 'object' && r.name ? String(r.name).trim() : undefined,
    status: 'pending' as const,
    attempts: 0,
  }));

  const newCampaign: Campaign = {
    id: campaignId,
    name: String(name).trim(),
    subject: String(subject).trim(),
    fromName: fromName ? String(fromName).trim() : currentSmtp.fromName,
    fromEmail: fromEmail ? String(fromEmail).trim() : currentSmtp.fromEmail,
    replyTo: replyTo ? String(replyTo).trim() : currentSmtp.replyTo,
    htmlContent,
    textContent: textContent || undefined,
    recipients: recipientRecords,
    status: autoStart ? 'queued' : 'draft',
    createdAt: new Date().toISOString(),
    rateLimitPerSec: Number(rateLimitPerSec) || 5,
    batchSize: Number(batchSize) || 10,
    stats: {
      total: recipientRecords.length,
      pending: recipientRecords.length,
      accepted: 0,
      failed: 0,
      cancelled: 0,
      retries: 0,
    },
    isSimulated: currentSmtp.devMode,
  };

  storage.saveCampaign(newCampaign);

  if (autoStart) {
    queueManager.startCampaign(campaignId);
  }

  res.status(201).json(newCampaign);
});

app.get('/api/campaigns/:id', (req: Request, res: Response) => {
  const campaign = storage.getCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  res.json(campaign);
});

app.post('/api/campaigns/:id/start', (req: Request, res: Response) => {
  const result = queueManager.startCampaign(req.params.id);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post('/api/campaigns/:id/cancel', (req: Request, res: Response) => {
  const result = queueManager.cancelCampaign(req.params.id);
  res.json(result);
});

app.delete('/api/campaigns/:id', (req: Request, res: Response) => {
  const deleted = storage.deleteCampaign(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  res.json({ success: true, message: 'Campaign deleted.' });
});

// 6. Drafts Management
app.get('/api/drafts', (req: Request, res: Response) => {
  res.json(storage.listDrafts());
});

app.post('/api/drafts', (req: Request, res: Response) => {
  const { id, title, subject, fromName, fromEmail, replyTo, htmlContent, textContent, recipientCount } = req.body;
  const draftId = id || 'draft_' + Date.now().toString(36);

  const draft = storage.saveDraft({
    id: draftId,
    title: title || 'Untitled Draft',
    subject: subject || '',
    fromName: fromName || '',
    fromEmail: fromEmail || '',
    replyTo: replyTo || '',
    htmlContent: htmlContent || '',
    textContent: textContent || '',
    recipientCount: recipientCount || 0,
    updatedAt: new Date().toISOString(),
  });

  res.json(draft);
});

app.delete('/api/drafts/:id', (req: Request, res: Response) => {
  storage.deleteDraft(req.params.id);
  res.json({ success: true });
});

// 7. Predefined Templates
app.get('/api/templates', (req: Request, res: Response) => {
  res.json(storage.listTemplates());
});

// 8. Suppression List Management
app.get('/api/suppression', (req: Request, res: Response) => {
  res.json(storage.listSuppression());
});

app.post('/api/suppression', (req: Request, res: Response) => {
  const { email, reason, notes } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email address required.' });
    return;
  }

  const entry = storage.addSuppressionEntry({
    email,
    reason: reason || 'manual',
    notes: notes || 'Manually added by administrator',
    addedAt: new Date().toISOString(),
  });

  res.json(entry);
});

app.delete('/api/suppression/:email', (req: Request, res: Response) => {
  const success = storage.removeSuppressionEntry(req.params.email);
  res.json({ success });
});

// Public Unsubscribe Endpoint (RFC compliant)
app.get('/api/unsubscribe', (req: Request, res: Response) => {
  const email = String(req.query.email || '').trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    storage.addSuppressionEntry({
      email,
      reason: 'unsubscribed',
      notes: 'Opt-out link clicked by recipient',
      addedAt: new Date().toISOString(),
    });
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Unsubscribe Confirmed</title></head>
      <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <div style="background: #1e293b; padding: 40px; border-radius: 12px; max-width: 450px; text-align: center; border: 1px solid #334155;">
          <h2 style="color: #10b981; margin-top: 0;">Unsubscribed Successfully</h2>
          <p style="color: #94a3b8; line-height: 1.6;">${email ? `<strong>${email}</strong> has been added to our global suppression list.` : 'Your email has been suppressed.'} You will not receive further campaign transmissions.</p>
        </div>
      </body>
    </html>
  `);
});

// 9. Delivery Logs
app.get('/api/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  const status = req.query.status ? String(req.query.status) : undefined;
  res.json(storage.listLogs(limit, status));
});

// 10. Dashboard Stats
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  res.json(storage.getDashboardStats());
});

// -------------------------------------------------------------
// Dev & Production Serving
// -------------------------------------------------------------
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ApexMail server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
