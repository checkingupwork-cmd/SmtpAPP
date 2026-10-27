import nodemailer from 'nodemailer';
import dns from 'dns/promises';
import tls from 'tls';
import net from 'net';
import { SmtpConfig, SmtpVerifyResult, SendResult, DeepDiagnosticsResult } from './types.js';

export class SmtpService {
  /**
   * Constructs a real Nodemailer transporter strictly using the specified SMTP parameters.
   * - Port 465: secure: true (Direct SSL/TLS)
   * - Port 587: secure: false with STARTTLS enabled (requireTLS: true, certificate validation enabled)
   * - Other ports: secure: false
   */
  public static createTransporter(config: SmtpConfig, timeoutMs = 10000) {
    const port = Number(config.port) || 465;
    const isSecure = port === 465 || config.security === 'ssl';
    const requireTLS = port === 587 || config.security === 'starttls';

    const hasAuth = Boolean(config.username && config.username.trim().length > 0);
    const auth = hasAuth
      ? {
          user: config.username.trim(),
          pass: config.password || '',
        }
      : undefined;

    return nodemailer.createTransport({
      host: config.host ? config.host.trim() : 'out.postassl.it',
      port,
      secure: isSecure,
      requireTLS,
      auth,
      tls: {
        rejectUnauthorized: true, // Strict certificate validation enabled
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs + 2000,
    });
  }

  /**
   * Tests real SMTP connectivity and authentication using transporter.verify()
   */
  public static async testConnection(config: SmtpConfig, timeoutMs = 10000): Promise<SmtpVerifyResult> {
    const port = Number(config.port) || 465;
    const isSecure = port === 465 || config.security === 'ssl';
    const isStartTls = port === 587 || config.security === 'starttls';
    const hasAuth = Boolean(config.username && config.username.trim().length > 0);

    // Safe server diagnostic log
    console.log(
      `[SMTP] Connection test started: host=${config.host}, port=${port}, timeout=${timeoutMs}ms, secure=${isSecure}, requireTLS=${isStartTls}, authUser=${config.username || 'none'}`
    );

    if (!config.host || !port) {
      console.error('[SMTP] Connection test failed: Host and Port are required.');
      return {
        success: false,
        message: 'Validation Error: Host and Port are required.',
        code: 'EINVALIDCONFIG',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const transporter = SmtpService.createTransporter(config, timeoutMs);
      await transporter.verify();

      console.log(`[SMTP] Connection verification succeeded for ${config.host}:${port}`);
      return {
        success: true,
        message: 'SMTP connection and authentication successful.',
        details: {
          host: config.host,
          port,
          security: isSecure ? 'SSL/TLS' : isStartTls ? 'STARTTLS' : 'None',
          user: config.username || 'None',
          authAttempted: hasAuth,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      const parsed = SmtpService.parseSmtpError(err);
      console.error(
        `[SMTP] Connection verification failed: code=${parsed.code}, responseCode=${parsed.responseCode || 'N/A'}, command=${parsed.command || 'N/A'}, message=${parsed.message}`
      );

      return {
        success: false,
        message: parsed.message,
        code: parsed.code,
        responseCode: parsed.responseCode,
        command: parsed.command,
        response: parsed.response,
        error: SmtpService.sanitizeErrorMessage(err),
        details: {
          host: config.host,
          port,
          security: isSecure ? 'SSL/TLS' : isStartTls ? 'STARTTLS' : 'None',
          user: config.username || 'None',
          authAttempted: hasAuth,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Conducts an authorized deep diagnostic probe: DNS lookup, socket & TLS inspection,
   * server banner retrieval, and credential verification.
   */
  public static async probeDeepDiagnostics(config: SmtpConfig, timeoutMs = 10000): Promise<DeepDiagnosticsResult> {
    const startTime = Date.now();
    const port = Number(config.port) || 465;
    const isSsl = port === 465 || config.security === 'ssl';

    // 1. DNS Resolution Probe
    const dnsStart = Date.now();
    let resolvedIps: string[] = [];
    let mxRecords: Array<{ exchange: string; priority: number }> | undefined;
    try {
      resolvedIps = await dns.resolve4(config.host);
    } catch {
      try {
        const lookup = await dns.lookup(config.host, { all: true });
        resolvedIps = lookup.map((l) => l.address);
      } catch {
        resolvedIps = [];
      }
    }
    const dnsLatencyMs = Date.now() - dnsStart;

    // MX lookup on domain
    try {
      const domainParts = config.host.split('.');
      const baseDomain = domainParts.length > 2 ? domainParts.slice(-2).join('.') : config.host;
      const mx = await dns.resolveMx(baseDomain);
      mxRecords = mx.sort((a, b) => a.priority - b.priority).slice(0, 5);
    } catch {
      mxRecords = undefined;
    }

    // 2. TLS & Banner Socket Probe
    let tlsDetails: DeepDiagnosticsResult['tls'] | undefined;
    let serverBanner: string | undefined;

    if (isSsl) {
      try {
        const probeResult = await new Promise<{ tls?: DeepDiagnosticsResult['tls']; banner?: string }>((resolve) => {
          let resolved = false;
          const socket = tls.connect(
            {
              host: config.host,
              port,
              rejectUnauthorized: true,
              minVersion: 'TLSv1.2',
              timeout: Math.min(timeoutMs, 8000),
            },
            () => {
              try {
                const cipher = socket.getCipher();
                const protocol = socket.getProtocol();
                const cert = socket.getPeerCertificate();
                const validTo = cert?.valid_to ? new Date(cert.valid_to) : undefined;
                const daysRemaining = validTo
                  ? Math.round((validTo.getTime() - Date.now()) / (1000 * 3600 * 24))
                  : undefined;

                const collectedTls = {
                  protocol: protocol || undefined,
                  cipherName: cipher?.name,
                  cipherVersion: cipher?.version,
                  certSubject: typeof cert?.subject?.CN === 'string' ? cert.subject.CN : undefined,
                  certIssuer:
                    typeof cert?.issuer?.O === 'string'
                      ? `${cert.issuer.O}${cert.issuer.CN ? ' (' + cert.issuer.CN + ')' : ''}`
                      : undefined,
                  certValidTo: cert?.valid_to,
                  certDaysRemaining: daysRemaining,
                  authorized: socket.authorized,
                  authError: socket.authorizationError ? String(socket.authorizationError) : undefined,
                };

                socket.once('data', (chunk) => {
                  if (!resolved) {
                    resolved = true;
                    socket.end();
                    resolve({ tls: collectedTls, banner: chunk.toString('utf-8').trim() });
                  }
                });

                // Fallback if banner is delayed
                setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve({ tls: collectedTls });
                  }
                }, 1200);
              } catch (e: any) {
                if (!resolved) {
                  resolved = true;
                  socket.destroy();
                  resolve({ tls: { authorized: false, authError: e.message } });
                }
              }
            }
          );

          socket.on('error', (err) => {
            if (!resolved) {
              resolved = true;
              resolve({ tls: { authorized: false, authError: SmtpService.sanitizeErrorMessage(err) } });
            }
          });

          socket.on('timeout', () => {
            if (!resolved) {
              resolved = true;
              socket.destroy();
              resolve({ tls: { authorized: false, authError: 'TLS handshake timed out' } });
            }
          });
        });

        tlsDetails = probeResult.tls;
        serverBanner = probeResult.banner;
      } catch {
        // Socket probe non-fatal, verify probe follows
      }
    } else {
      // Plain/STARTTLS socket greeting check
      try {
        const netResult = await new Promise<string | undefined>((resolve) => {
          let resolved = false;
          const socket = net.connect({ host: config.host, port, timeout: Math.min(timeoutMs, 6000) }, () => {
            socket.once('data', (chunk) => {
              if (!resolved) {
                resolved = true;
                socket.end();
                resolve(chunk.toString('utf-8').trim());
              }
            });
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(undefined);
              }
            }, 1200);
          });
          socket.on('error', () => {
            if (!resolved) {
              resolved = true;
              resolve(undefined);
            }
          });
          socket.on('timeout', () => {
            if (!resolved) {
              resolved = true;
              socket.destroy();
              resolve(undefined);
            }
          });
        });
        serverBanner = netResult;
      } catch {
        // Non-fatal
      }
    }

    // 3. SMTP Verification via Nodemailer
    const verifyResult = await SmtpService.testConnection(config, timeoutMs);
    const totalLatencyMs = Date.now() - startTime;

    return {
      host: config.host,
      port,
      security: isSsl ? 'SSL/TLS' : port === 587 || config.security === 'starttls' ? 'STARTTLS' : 'None',
      dns: {
        resolvedIps,
        mxRecords,
        dnsLatencyMs,
      },
      tls: tlsDetails,
      serverBanner: serverBanner || verifyResult.response || (verifyResult.success ? '220 Service Ready' : undefined),
      smtpVerify: {
        success: verifyResult.success,
        message: verifyResult.message,
        code: verifyResult.code,
        responseCode: verifyResult.responseCode,
        response: verifyResult.response,
      },
      totalLatencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dispatches a real test email using transporter.sendMail()
   */
  public static async sendMail(
    config: SmtpConfig,
    options: {
      to: string;
      toName?: string;
      fromName?: string;
      fromEmail?: string;
      replyTo?: string;
      subject: string;
      html: string;
      text?: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
    }
  ): Promise<SendResult> {
    const port = Number(config.port) || 465;
    const senderAddress = options.fromEmail || config.fromEmail || 'noreply@smaltimento-rifiuti-roma.it';
    const senderDisplayName = options.fromName || config.fromName || 'ApexMail Dispatcher';
    const formattedFrom = `"${senderDisplayName.replace(/"/g, '')}" <${senderAddress}>`;
    const replyToAddress = options.replyTo || config.replyTo || senderAddress;

    console.log(
      `[SMTP] Outbound email transmission started: host=${config.host}:${port}, from=${formattedFrom}, to=${options.to}`
    );

    try {
      const timeout = Math.min(Math.max(Number(options.timeoutMs) || 10000, 2000), 60000);
      const transporter = SmtpService.createTransporter(config, timeout);

      const info = await transporter.sendMail({
        from: formattedFrom,
        to: options.toName ? `"${options.toName.replace(/"/g, '')}" <${options.to}>` : options.to,
        replyTo: replyToAddress,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject,
        headers: {
          'X-Mailer': 'ApexMail Enterprise Relay',
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'List-Unsubscribe': `<mailto:${replyToAddress}?subject=Unsubscribe%20${encodeURIComponent(options.to)}>`,
          ...(options.headers || {}),
        },
      });

      const responseString =
        typeof info.response === 'string' ? info.response : '250 OK Message accepted by relay';

      console.log(
        `[SMTP] Test email submission result: to=${options.to}, messageId=${info.messageId}, response=${responseString}`
      );

      return {
        success: true,
        message: 'Test email accepted by the SMTP server.',
        messageId: info.messageId,
        response: responseString,
        smtpResponse: responseString,
        details: {
          from: formattedFrom,
          to: options.to,
          host: config.host,
          port,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      const parsed = SmtpService.parseSmtpError(err);
      console.error(
        `[SMTP] Test email submission failed: to=${options.to}, code=${parsed.code}, responseCode=${parsed.responseCode || 'N/A'}, command=${parsed.command || 'N/A'}, error=${parsed.message}`
      );

      return {
        success: false,
        message: parsed.message,
        code: parsed.code,
        responseCode: parsed.responseCode,
        command: parsed.command,
        response: parsed.response,
        error: SmtpService.sanitizeErrorMessage(err),
        details: {
          from: formattedFrom,
          to: options.to,
          host: config.host,
          port,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Categorizes errors accurately with proper codes.
   * Returns EAUTH, ECONNECTION, ETIMEDOUT, ESOCKET, ECONNREFUSED, EDNS, etc.
   */
  public static parseSmtpError(err: any): {
    code: string;
    message: string;
    responseCode?: number;
    command?: string;
    response?: string;
  } {
    const rawCode = err?.code ? String(err.code) : '';
    const responseCode = err?.responseCode ? Number(err.responseCode) : undefined;
    const command = err?.command ? String(err.command) : undefined;
    const response = err?.response ? String(err.response) : undefined;
    const rawMessage = err?.message || String(err || 'Unknown error');

    let code = rawCode || (responseCode ? `SMTP_${responseCode}` : 'ECONNECTION');
    let message = 'SMTP connection failure';

    if (rawCode === 'EAUTH' || responseCode === 535 || rawMessage.toLowerCase().includes('autenticazione') || rawMessage.toLowerCase().includes('auth')) {
      code = 'EAUTH';
      message = 'SMTP authentication failed. Verify username and password credentials.';
    } else if (rawCode === 'ETIMEDOUT' || rawMessage.toLowerCase().includes('timeout') || rawMessage.toLowerCase().includes('timed out')) {
      code = 'ETIMEDOUT';
      message = 'Connection timed out. Host did not respond within timeout window.';
    } else if (rawCode === 'ECONNREFUSED' || rawMessage.toLowerCase().includes('refused')) {
      code = 'ECONNREFUSED';
      message = 'Connection refused by target host on this port. Check host and port.';
    } else if (
      rawCode === 'ESOCKET' ||
      rawMessage.toLowerCase().includes('tls') ||
      rawMessage.toLowerCase().includes('ssl') ||
      rawMessage.toLowerCase().includes('handshake')
    ) {
      code = 'ESOCKET';
      message = 'TLS/SSL certificate or handshake error. Ensure port 465 uses SSL and port 587 uses STARTTLS.';
    } else if (rawCode === 'ENOTFOUND' || rawCode === 'EDNS' || rawMessage.toLowerCase().includes('getaddrinfo')) {
      code = 'EDNS';
      message = 'DNS resolution failed. Hostname could not be resolved.';
    } else if (responseCode && responseCode >= 500) {
      code = `E${responseCode}`;
      message = `SMTP server permanent error (${responseCode}): ${response || rawMessage}`;
    } else if (responseCode && responseCode >= 400) {
      code = `E${responseCode}`;
      message = `SMTP server temporary error (${responseCode}): ${response || rawMessage}`;
    } else {
      message = SmtpService.sanitizeErrorMessage(err);
    }

    return {
      code,
      message,
      responseCode,
      command,
      response,
    };
  }

  /**
   * Sanitizes error messages to prevent accidental credential leakage in responses or logs.
   */
  public static sanitizeErrorMessage(err: any): string {
    if (!err) return 'Unknown transport error';
    let msg = String(err.message || err);
    msg = msg.replace(/pass(?:word)?\s*[:=]\s*[^\s,;]+/gi, 'password: [REDACTED]');
    msg = msg.replace(/auth(?:entication)?\s*[:=]\s*[^\s,;]+/gi, 'auth: [REDACTED]');
    msg = msg.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
    return msg;
  }
}
