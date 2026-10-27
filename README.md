# ApexMail - Secure SMTP Mailing Web Application

ApexMail is a full-stack, production-grade email dispatch and campaign platform built with **React**, **TypeScript**, **Node.js**, **Express**, and **Nodemailer**.

It is engineered for high-assurance transactional and newsletter delivery with live sandboxed preview, opt-in recipient validation, CSV deduplication, and rate-limited queueing.

---

## 1. Key Architectural Features

- **Strict Credential Isolation**: SMTP passwords and credentials remain strictly server-side. No passwords or tokens are stored in browser local storage or exposed in client bundles.
- **Dedicated Port & Cipher Support**:
  - **SSL/TLS on Port 465** (`out.postassl.it` default preset).
  - **STARTTLS on Port 587** with strict TLS 1.2+ certificate validation.
  - Plain/Internal relay on Port 25.
- **Sandbox Simulation Mode**: Built-in development mode that verifies SMTP handshakes and generates preview transcripts locally without requiring live external network access.
- **Sandboxed HTML Preview**: Employs sandboxed iframes (`sandbox="allow-same-origin"`) to preview rich responsive HTML email templates (inline CSS, tables, media queries) safely without XSS vulnerability.
- **Individual Personalized Envelopes**: Each email in a campaign is dispatched as a separate envelope. Recipient addresses are never combined into a public `To` header, preventing privacy leaks.
- **Suppression & Opt-Out Compliance**: Automated exclusion of hard-bounced addresses (550 errors) and recipients who have unsubscribed (RFC 8058 compliant `List-Unsubscribe` headers).
- **Adaptive Rate-Limiting & Concurrency**: Configurable messages-per-second throttling and batch concurrency limits with automatic retry logic for transient errors.
- **Real-Time Progress & Cancellation**: Live queue status with pause/cancellation controls and distinct reporting of upstream SMTP acceptance vs mailbox delivery.

---

## 2. Configuration & Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Available variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server listening port | `3000` |
| `SMTP_HOST` | Outbound SMTP relay hostname | `out.postassl.it` |
| `SMTP_PORT` | SMTP port | `465` |
| `SMTP_SECURITY` | `ssl` (port 465), `starttls` (port 587), or `none` | `ssl` |
| `SMTP_USER` | SMTP username | `noreply@smaltimento-rifiuti-roma.it` |
| `SMTP_PASS` | SMTP password (keep secret) | `""` |
| `SMTP_FROM_EMAIL` | Default sender email address | `noreply@smaltimento-rifiuti-roma.it` |
| `SMTP_FROM_NAME` | Default sender display name | `ApexMail Dispatcher` |
| `SMTP_REPLY_TO` | Default Reply-To address | `noreply@smaltimento-rifiuti-roma.it` |
| `DEVELOPMENT_MODE` | If `true`, runs in simulated sandbox mode | `false` |
| `RATE_LIMIT_PER_SECOND` | Maximum outgoing messages dispatched per second | `5` |
| `BATCH_SIZE` | Concurrent batch dispatch slice size | `10` |

---

## 3. Local Installation & Development

### Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Start dev server (Full-stack Express + Vite middleware)
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 4. Production Build & Deployment

### Build Application
```bash
npm run build
```
This builds the optimized frontend bundle into the `dist/` directory.

### Start Production Server
```bash
npm start
```
The Express server in `server.ts` automatically serves the production assets from `dist/` and runs all API and queue endpoints on port 3000.

### Docker Deployment
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
RUN npm install -g tsx
EXPOSE 3000
CMD ["tsx", "server.ts"]
```

---

## 5. Security & Deliverability Guidelines

1. **SPF and DKIM Alignment**: Ensure your sending domain has an active SPF record authorizing the IP address of your SMTP host (`out.postassl.it`).
2. **Reverse DNS (PTR)**: Verify that reverse DNS is correctly configured on the relay server.
3. **No Open Relay**: The server enforces rate limiting, local session authorization, and strict schema validation to prevent unauthorized proxying.
4. **Sandboxed Iframe**: Prevents malicious scripts from escaping email preview frames.
