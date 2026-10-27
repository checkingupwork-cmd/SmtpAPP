import { EmailTemplate } from './types.js';

export const predefinedTemplates: EmailTemplate[] = [
  {
    id: 'announcement',
    name: 'Corporate Announcement',
    category: 'Corporate',
    description: 'Clean, modern executive update with brand header, rich content card, and CTA button.',
    subject: 'Important System Update: Platform Infrastructure Upgrade',
    textContent: 'Important System Update\n\nDear Valued Partner,\n\nWe are pleased to notify you that scheduled infrastructure upgrades have been completed with zero downtime.\n\nKey highlights:\n- 99.99% Guaranteed Dispatch Reliability\n- TLS 1.3 End-to-End Encryption\n- Enhanced Delivery Analytics\n\nVisit our portal for details: https://example.com/status\n\nBest regards,\nThe Operations Team',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Corporate Announcement</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #0f172a; padding: 40px 16px; }
    .main { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 36px; text-align: left; border-bottom: 3px solid #3b82f6; }
    .logo-text { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-top: 4px; }
    .body-content { padding: 36px; }
    h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.3; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; }
    .feature-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .feature-item { font-size: 14px; color: #1e293b; padding: 6px 0; font-weight: 500; }
    .feature-dot { display: inline-block; width: 6px; height: 6px; background-color: #3b82f6; border-radius: 50%; margin-right: 10px; vertical-align: middle; }
    .btn-container { text-align: center; margin: 32px 0 16px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 6px; }
    .footer { background-color: #f1f5f9; padding: 24px 36px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
    .footer a { color: #2563eb; text-decoration: underline; }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table class="main" role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td class="header">
              <div class="logo-text">Apex Enterprise</div>
              <div class="kicker">Official Notification</div>
            </td>
          </tr>
          <tr>
            <td class="body-content">
              <h1>Platform Infrastructure Upgrade Completed</h1>
              <p>Dear Partner,</p>
              <p>We are pleased to inform you that our global mailing infrastructure and relay nodes have been upgraded to provide enhanced throughput, lower queue latencies, and rigorous TLS 1.3 encryption across all communication pathways.</p>
              <div class="feature-box">
                <div class="feature-item"><span class="feature-dot"></span> 99.99% Guaranteed Dispatch Availability</div>
                <div class="feature-item"><span class="feature-dot"></span> End-to-End Cryptographic Transport Verification</div>
                <div class="feature-item"><span class="feature-dot"></span> Real-Time Recipient Suppression & Bouncing Protection</div>
              </div>
              <p>No client action is required on your part. Your existing configurations will continue to operate seamlessly with elevated performance.</p>
              <div class="btn-container">
                <a href="https://example.com/dashboard" class="btn">View System Telemetry</a>
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="margin: 0 0 8px 0;">This email was dispatched via our verified SMTP relay service.</p>
              <p style="margin: 0;">If you wish to manage your communication preferences, you may <a href="https://example.com/unsubscribe">unsubscribe here</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'transactional',
    name: 'Transactional Receipt & Confirmation',
    category: 'Transactional',
    description: 'Crisp, tabular receipt layout for account notices, order verifications, or activation tokens.',
    subject: 'Receipt #APX-84920: Dispatch Service Confirmation',
    textContent: 'Dispatch Service Confirmation\n\nOrder Ref: APX-84920\nDate: 2026-10-20\nStatus: Confirmed\n\nService: Enterprise SMTP Relay Gateway\nUnits: 50,000 Messages\nTotal: €149.00\n\nThank you for choosing ApexMail.\nVisit: https://example.com/account',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transactional Receipt</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1e293b; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 32px 16px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .header { padding: 28px 32px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .badge { font-size: 12px; font-weight: 600; color: #059669; background-color: #ecfdf5; padding: 4px 8px; border-radius: 4px; display: inline-block; }
    .body { padding: 32px; }
    .receipt-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .receipt-table th { text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    .receipt-table td { padding: 12px 0; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; }
    .receipt-table .num { text-align: right; font-variant-numeric: tabular-nums; font-family: monospace; }
    .total-row td { font-weight: 700; color: #0f172a; font-size: 16px; border-top: 2px solid #0f172a; border-bottom: none; padding-top: 16px; }
    .footer { background-color: #f8fafc; padding: 20px 32px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table class="container" role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td class="body">
              <div style="margin-bottom: 24px;">
                <span class="badge">Payment Confirmed</span>
                <h1 style="font-size: 22px; font-weight: 700; margin: 8px 0 4px 0; color: #0f172a;">Transaction Receipt</h1>
                <div style="font-size: 13px; color: #64748b;">Invoice Reference: APX-84920 · Dispatched on 2026-10-20</div>
              </div>

              <table class="receipt-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th class="num">Qty</th>
                    <th class="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Enterprise SMTP Dedicated Port Access</td>
                    <td class="num">1</td>
                    <td class="num">€99.00</td>
                  </tr>
                  <tr>
                    <td>High-Volume Queue Buffer (50k msgs)</td>
                    <td class="num">1</td>
                    <td class="num">€50.00</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="2">Total Paid (VAT incl.)</td>
                    <td class="num">€149.00</td>
                  </tr>
                </tbody>
              </table>

              <p style="font-size: 13px; color: #64748b; margin-top: 24px; line-height: 1.5;">
                This transaction has been securely processed and recorded. A PDF export is available in your administrative portal.
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              ApexMail Delivery Node · Rome, IT · VAT IT09876543210
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'newsletter',
    name: 'Executive Newsletter & Briefing',
    category: 'Newsletter',
    description: 'Multi-story newsletter with lead editorial article, two-column insights, and footer links.',
    subject: 'Apex Dispatch Digest: Deliverability Benchmarks & Sender Authentication',
    textContent: 'Apex Dispatch Digest\n\nEdition #42 · October 2026\n\nIn this edition:\n1. 2026 DMARC & SPF strict enforcement guidelines\n2. Optimizing SMTP queue latency under heavy load\n3. Warm-up strategies for fresh IP blocks\n\nRead full edition: https://example.com/digest-42',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Newsletter</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #e2e8f0; }
    .wrapper { width: 100%; background-color: #0b0f19; padding: 40px 16px; }
    .card { max-width: 620px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; }
    .lead-banner { background-color: #1e1b4b; border-bottom: 1px solid #312e81; padding: 32px 36px; }
    .content { padding: 36px; }
    h2 { font-size: 20px; color: #f8fafc; margin: 0 0 12px 0; font-weight: 600; }
    p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px 0; }
    .highlight-box { border-left: 3px solid #6366f1; background-color: #1e293b; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .footer { padding: 24px 36px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table class="card" role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td class="lead-banner">
              <div style="font-size: 12px; font-weight: 700; color: #818cf8; letter-spacing: 1.2px; text-transform: uppercase;">Mailing Operations Monthly</div>
              <h1 style="font-size: 26px; color: #ffffff; margin: 8px 0 0 0; font-weight: 700;">Deliverability & Security Benchmarks</h1>
            </td>
          </tr>
          <tr>
            <td class="content">
              <h2>1. DMARC Alignment & Strict SPF Enforcement</h2>
              <p>Mailbox providers have accelerated the deprecation of unauthenticated message streams. Maintaining strict SPF record alignment alongside cryptographic DKIM signing is now mandatory for inbox placement.</p>
              
              <div class="highlight-box">
                <div style="font-size: 14px; color: #e2e8f0; font-weight: 600;">Key Operational Recommendation:</div>
                <div style="font-size: 13px; color: #cbd5e1; margin-top: 4px;">Enforce STARTTLS or explicit SSL (Port 465) across all client dispatch daemons to eliminate plaintext interception vectors.</div>
              </div>

              <h2>2. Batch Concurrency Control</h2>
              <p>Throttling your outbound dispatch through adaptive rate limits prevents transient 421/451 server busy rejections from intermediate relays.</p>

              <div style="margin-top: 28px;">
                <a href="https://example.com/digest" class="btn">Read Full Technical Report</a>
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="margin: 0 0 8px 0;">Sent by ApexMail Dispatch Services to verified subscribers.</p>
              <p style="margin: 0;"><a href="https://example.com/unsubscribe" style="color: #818cf8;">Unsubscribe from monthly briefings</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
];
