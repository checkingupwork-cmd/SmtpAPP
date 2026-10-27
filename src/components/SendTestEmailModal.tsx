import React, { useState } from 'react';
import { Send, CheckCircle2, XCircle, Server, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { SanitizedSmtpConfig, SendTestResult } from '../types';

interface SendTestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  smtpConfig: SanitizedSmtpConfig | null;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const SendTestEmailModal: React.FC<SendTestEmailModalProps> = ({
  isOpen,
  onClose,
  smtpConfig,
  onNotify,
}) => {
  const [recipient, setRecipient] = useState('checkingupwork@gmail.com');
  const [customSubject, setCustomSubject] = useState('[ApexMail] Real SMTP Verification Probe');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendTestResult | null>(null);

  if (!isOpen) return null;

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) return;

    setSending(true);
    setResult(null);

    try {
      const res = await api.sendTestEmail({
        destinationEmail: recipient.trim(),
        customSubject: customSubject.trim() || undefined,
      });

      setResult(res);

      if (res.success) {
        onNotify('success', 'Test Email Accepted', res.message);
      } else {
        const errLabel = res.code ? `[${res.code}] ` : '';
        onNotify('error', 'Test Email Rejected', `${errLabel}${res.message}`);
      }
    } catch (err: any) {
      const failObj: SendTestResult = {
        success: false,
        message: err.message || 'Transmission failed',
        code: 'ECLIENT',
        timestamp: new Date().toISOString(),
      };
      setResult(failObj);
      onNotify('error', 'Delivery Error', err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">Send Real SMTP Test Email</h3>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-slate-400 hover:text-slate-200 text-sm disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSendTest} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Destination Email Address <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              required
              disabled={sending}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="admin@yourdomain.com"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600 disabled:opacity-50"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Enter an address you control to verify end-to-end receipt.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              disabled={sending}
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="SMTP Verification Probe"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600 disabled:opacity-50"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Relay: {smtpConfig?.host}:{smtpConfig?.port} ({smtpConfig?.security.toUpperCase()})</span>
            <span>Sender: {smtpConfig?.fromEmail}</span>
          </div>

          {result && (
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                result.success
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                {result.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                <span>{result.success ? 'Message Accepted by SMTP Server' : 'Message Rejected by SMTP Server'}</span>
                {result.code && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    {result.code}
                  </span>
                )}
              </div>
              <p className="text-slate-300">{result.message}</p>
              {result.messageId && (
                <div className="text-[11px] text-slate-400 font-mono">Message-ID: {result.messageId}</div>
              )}
              {result.response && (
                <div className="text-[11px] text-slate-400 font-mono">Server Response: {result.response}</div>
              )}
              {result.error && (
                <div className="text-[11px] text-rose-400 font-mono break-all">Error: {result.error}</div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Transmitting Probe...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Real Test Verification</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
