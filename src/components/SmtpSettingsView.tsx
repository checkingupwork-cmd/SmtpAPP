import React, { useState, useEffect } from 'react';
import {
  Server,
  Lock,
  Mail,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { SanitizedSmtpConfig, SmtpSecurity, SmtpVerifyResult, SendTestResult } from '../types';
import { api } from '../api/client';

interface SmtpSettingsViewProps {
  currentConfig: SanitizedSmtpConfig | null;
  onConfigSaved: (config: SanitizedSmtpConfig) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  onOpenSendTestModal: () => void;
}

export const SmtpSettingsView: React.FC<SmtpSettingsViewProps> = ({
  currentConfig,
  onConfigSaved,
  onNotify,
  onOpenSendTestModal,
}) => {
  const [host, setHost] = useState(currentConfig?.host || 'out.postassl.it');
  const [port, setPort] = useState(currentConfig?.port || 465);
  const [security, setSecurity] = useState<SmtpSecurity>(currentConfig?.security || 'ssl');
  const [username, setUsername] = useState(currentConfig?.username || 'noreply@smaltimento-rifiuti-roma.it');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fromEmail, setFromEmail] = useState(currentConfig?.fromEmail || 'noreply@smaltimento-rifiuti-roma.it');
  const [fromName, setFromName] = useState(currentConfig?.fromName || 'ApexMail Dispatcher');
  const [replyTo, setReplyTo] = useState(currentConfig?.replyTo || 'noreply@smaltimento-rifiuti-roma.it');

  // Inline Test Email states
  const [testDestination, setTestDestination] = useState('checkingupwork@gmail.com');
  const [testSubject, setTestSubject] = useState('[ApexMail] Real SMTP Verification Probe');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [testResult, setTestResult] = useState<SmtpVerifyResult | null>(null);
  const [sendResult, setSendResult] = useState<SendTestResult | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setHost(currentConfig.host);
      setPort(currentConfig.port);
      setSecurity(currentConfig.security);
      setUsername(currentConfig.username);
      setFromEmail(currentConfig.fromEmail);
      setFromName(currentConfig.fromName);
      setReplyTo(currentConfig.replyTo || '');
    }
  }, [currentConfig]);

  // Adjust default ports when changing security mode
  const handleSecurityChange = (mode: SmtpSecurity) => {
    setSecurity(mode);
    if (mode === 'ssl') setPort(465);
    if (mode === 'starttls') setPort(587);
    if (mode === 'none') setPort(25);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.saveSmtpConfig({
        host: host.trim(),
        port: Number(port),
        security,
        username: username.trim(),
        password: password ? password : undefined,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        replyTo: replyTo.trim() || undefined,
        devMode: false,
      });
      onConfigSaved(res.config);
      setPassword(''); // clear password input after saving
      onNotify('success', 'SMTP Settings Saved', 'Server configuration updated securely.');
    } catch (err: any) {
      onNotify('error', 'Failed to Save Settings', err.message);
    } finally {
      setSaving(false);
    }
  };

  // 1. Real Test Connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await api.testSmtpConnection({
        host: host.trim(),
        port: Number(port),
        security,
        username: username.trim(),
        password: password ? password : undefined,
      });

      setTestResult(res);

      if (res.success) {
        onNotify('success', 'SMTP Connection Successful', res.message);
      } else {
        const errLabel = res.code ? `[${res.code}] ` : '';
        onNotify('error', 'SMTP Connection Failed', `${errLabel}${res.message}`);
      }
    } catch (err: any) {
      const failObj: SmtpVerifyResult = {
        success: false,
        message: err.message || 'Unexpected connection error',
        code: 'ECLIENT',
        timestamp: new Date().toISOString(),
      };
      setTestResult(failObj);
      onNotify('error', 'Connection Error', err.message);
    } finally {
      setTesting(false);
    }
  };

  // 2. Real Send Test Email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDestination.trim()) {
      onNotify('warning', 'Destination Required', 'Please enter a valid destination email address.');
      return;
    }

    setSendingTest(true);
    setSendResult(null);

    try {
      const res = await api.sendTestEmail({
        destinationEmail: testDestination.trim(),
        customSubject: testSubject.trim() || undefined,
      });

      setSendResult(res);

      if (res.success) {
        onNotify('success', 'Test Email Accepted', res.message);
      } else {
        const errLabel = res.code ? `[${res.code}] ` : '';
        onNotify('error', 'Test Email Rejected', `${errLabel}${res.message}`);
      }
    } catch (err: any) {
      const failObj: SendTestResult = {
        success: false,
        message: err.message || 'Unexpected delivery error',
        code: 'ECLIENT',
        timestamp: new Date().toISOString(),
      };
      setSendResult(failObj);
      onNotify('error', 'Delivery Failure', err.message);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">SMTP Gateway Configuration</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure, verify TLS connectivity, and dispatch real test messages via Nodemailer
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || saving || sendingTest}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {testing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Verifying TLS Handshake...</span>
              </>
            ) : (
              <>
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Test SMTP Connection</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSendTestModal}
            disabled={testing || sendingTest}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Email (Modal)</span>
          </button>
        </div>
      </div>

      {/* Real SMTP Connection Test Diagnostic Banner */}
      {testResult && (
        <div
          className={`p-5 rounded-xl border flex flex-col gap-3 transition-all ${
            testResult.success
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <span>{testResult.success ? 'SMTP Connection & Verification Successful' : 'SMTP Connection Failed'}</span>
                  {testResult.code && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      Code: {testResult.code}
                    </span>
                  )}
                  {testResult.responseCode && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      SMTP: {testResult.responseCode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{testResult.message}</p>
              </div>
            </div>

            <button
              onClick={() => setTestResult(null)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
            >
              Dismiss
            </button>
          </div>

          {/* Detailed SMTP Handshake Diagnostics */}
          <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1.5">
            <div className="text-slate-400 font-sans font-semibold text-xs border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Nodemailer Diagnostic Result</span>
              <span>{testResult.timestamp ? new Date(testResult.timestamp).toLocaleTimeString() : ''}</span>
            </div>
            {testResult.details && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
                <div><span className="text-slate-500">Host:</span> {testResult.details.host}:{testResult.details.port}</div>
                <div><span className="text-slate-500">Encryption:</span> {testResult.details.security}</div>
                <div><span className="text-slate-500">Auth User:</span> {testResult.details.user}</div>
                <div><span className="text-slate-500">Auth Attempted:</span> {testResult.details.authAttempted ? 'Yes (Credentials Sent)' : 'No (Greeting probe only)'}</div>
              </div>
            )}
            {testResult.command && (
              <div><span className="text-slate-500">Last Command:</span> {testResult.command}</div>
            )}
            {testResult.response && (
              <div className="text-amber-300"><span className="text-slate-500">Raw Server Response:</span> {testResult.response}</div>
            )}
            {testResult.error && (
              <div className="text-rose-400 break-all"><span className="text-slate-500">Raw Error:</span> {testResult.error}</div>
            )}
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
        {/* Section 1: Server Connection */}
        <div>
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>1. Server Connection Parameters</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Host */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                SMTP Host / Relay Domain <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="out.postassl.it"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono placeholder-slate-600"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Default: out.postassl.it</span>
            </div>

            {/* Port */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Port <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                {port === 465 ? 'SSL/TLS direct encryption' : port === 587 ? 'STARTTLS encrypted upgrade' : 'Port 25 (Plain)'}
              </span>
            </div>
          </div>

          {/* Security Protocol Segmented Control */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Transport Encryption (Security Mode)
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => handleSecurityChange('ssl')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                  security === 'ssl'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SSL / TLS (Port 465, secure: true)
              </button>
              <button
                type="button"
                onClick={() => handleSecurityChange('starttls')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                  security === 'starttls'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                STARTTLS (Port 587, requireTLS)
              </button>
              <button
                type="button"
                onClick={() => handleSecurityChange('none')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                  security === 'none'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                None / Plain (Port 25)
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Authentication Credentials */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>2. SMTP Authentication (Server-Side Storage)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                SMTP Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="noreply@smaltimento-rifiuti-roma.it"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono placeholder-slate-600"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  SMTP Password
                </label>
                {currentConfig?.hasPassword && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Password Stored On Server</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={currentConfig?.hasPassword ? '•••••••••••• (Leave blank to keep existing password)' : 'Enter SMTP password'}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono placeholder-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Stored exclusively in server memory; never returned or serialized to client browser.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Sender Identity */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>3. Sender Identity & Headers</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sender From Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                From Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@smaltimento-rifiuti-roma.it"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono placeholder-slate-600"
              />
            </div>

            {/* Sender Display Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Sender Display Name
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="ApexMail Dispatcher"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>

            {/* Reply-To Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reply-To Email Address
              </label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="support@smaltimento-rifiuti-roma.it"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono placeholder-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5" />
            <span>Click Save Settings to persist configuration into server session.</span>
          </div>

          <button
            type="submit"
            disabled={saving || testing || sendingTest}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Section 4: Live Send Test Email Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <span>4. Send Real Test Email via POST /api/smtp/send-test</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Transmits a live verification message to a destination mailbox you control using <code className="text-slate-300">transporter.sendMail()</code>.
          </p>
        </div>

        <form onSubmit={handleSendTestEmail} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Destination Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={testDestination}
                onChange={(e) => setTestDestination(e.target.value)}
                placeholder="admin@yourdomain.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Subject Line
              </label>
              <input
                type="text"
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="SMTP Live Verification Test"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>Sending from: <strong className="text-slate-300 font-mono">{fromEmail}</strong></span>
              <span aria-hidden="true">·</span>
              <span>via <strong className="text-slate-300 font-mono">{host}:{port}</strong></span>
            </div>

            <button
              type="submit"
              disabled={sendingTest || testing || saving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm shadow-emerald-600/30 transition-colors disabled:opacity-50"
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Transmitting Email to SMTP Server...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Real Test Email</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Real Test Email Delivery Result */}
        {sendResult && (
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 mt-4 ${
              sendResult.success
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {sendResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>{sendResult.success ? 'Message Accepted by SMTP Server' : 'Message Rejected by SMTP Server'}</span>
                    {sendResult.code && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        {sendResult.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{sendResult.message}</p>
                </div>
              </div>

              <button
                onClick={() => setSendResult(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
              >
                Dismiss
              </button>
            </div>

            {/* Diagnostic Box */}
            <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
              {sendResult.messageId && (
                <div><span className="text-slate-500">Relay Message ID:</span> {sendResult.messageId}</div>
              )}
              {sendResult.response && (
                <div><span className="text-slate-500">SMTP Server Response:</span> {sendResult.response}</div>
              )}
              {sendResult.error && (
                <div className="text-rose-400 break-all"><span className="text-slate-500">Error Details:</span> {sendResult.error}</div>
              )}
              {sendResult.details && (
                <div className="text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>To: {sendResult.details.to} · Host: {sendResult.details.host}:{sendResult.details.port}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
