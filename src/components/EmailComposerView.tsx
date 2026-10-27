import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Eye,
  Code2,
  Smartphone,
  Monitor,
  Trash2,
  FileCode,
  FolderOpen,
  Save,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  SplitSquareVertical,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SanitizedSmtpConfig, EmailTemplate, EmailDraft } from '../types';
import { api } from '../api/client';

interface EmailComposerViewProps {
  smtpConfig: SanitizedSmtpConfig | null;
  onSendCampaign: (campaignData: {
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    replyTo?: string;
    htmlContent: string;
    textContent?: string;
    recipients: string[];
    rateLimitPerSec: number;
    batchSize: number;
  }) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  initialRecipients?: string[];
  initialTemplate?: EmailTemplate | null;
}

export const EmailComposerView: React.FC<EmailComposerViewProps> = ({
  smtpConfig,
  onSendCampaign,
  onNotify,
  initialRecipients,
  initialTemplate,
}) => {
  // Campaign & Header fields
  const [campaignName, setCampaignName] = useState('New Dispatch Campaign');
  const [fromName, setFromName] = useState(smtpConfig?.fromName || 'ApexMail Dispatcher');
  const [fromEmail, setFromEmail] = useState(smtpConfig?.fromEmail || 'noreply@smaltimento-rifiuti-roma.it');
  const [replyTo, setReplyTo] = useState(smtpConfig?.replyTo || 'noreply@smaltimento-rifiuti-roma.it');
  const [toInput, setToInput] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [subject, setSubject] = useState('');

  // Content
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [showPlainTextInput, setShowPlainTextInput] = useState(false);

  // Editor View Modes: 'split' | 'source' | 'preview'
  const [viewMode, setViewMode] = useState<'split' | 'source' | 'preview'>('split');
  // Preview device mode: 'desktop' | 'mobile'
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');

  // Templates & Drafts modals
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Safety & Sending settings
  const [rateLimitPerSec, setRateLimitPerSec] = useState(5);
  const [batchSize, setBatchSize] = useState(10);

  // Validation output
  const [validationReport, setValidationReport] = useState<{
    validEmails: string[];
    invalidEmails: string[];
    htmlWarnings: string[];
  } | null>(null);

  // Populate from initial props if passed from other views
  useEffect(() => {
    if (initialRecipients && initialRecipients.length > 0) {
      setToInput(initialRecipients.join(', '));
    }
  }, [initialRecipients]);

  useEffect(() => {
    if (initialTemplate) {
      setSubject(initialTemplate.subject);
      setHtmlContent(initialTemplate.htmlContent);
      setTextContent(initialTemplate.textContent);
      setCampaignName(initialTemplate.name);
    } else if (!htmlContent) {
      // Default to sample template if editor is empty
      loadInitialDefault();
    }
  }, [initialTemplate]);

  useEffect(() => {
    if (smtpConfig) {
      if (!fromEmail) setFromEmail(smtpConfig.fromEmail);
      if (!fromName) setFromName(smtpConfig.fromName);
      if (!replyTo) setReplyTo(smtpConfig.replyTo || smtpConfig.fromEmail);
    }
  }, [smtpConfig]);

  const loadInitialDefault = async () => {
    try {
      const tmpls = await api.getTemplates();
      setTemplates(tmpls);
      if (tmpls.length > 0 && !htmlContent) {
        setSubject(tmpls[0].subject);
        setHtmlContent(tmpls[0].htmlContent);
        setTextContent(tmpls[0].textContent);
      }
    } catch {
      // fallback
    }
  };

  // Parse recipients from toInput string
  const parseRecipients = (raw: string): string[] => {
    return raw
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  };

  const recipientList = parseRecipients(toInput);

  // Run validation
  const handleValidate = () => {
    const list = parseRecipients(toInput);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid: string[] = [];
    const invalid: string[] = [];

    list.forEach((e) => {
      if (emailRegex.test(e)) valid.push(e);
      else invalid.push(e);
    });

    const htmlWarnings: string[] = [];
    if (!htmlContent.trim()) {
      htmlWarnings.push('HTML email body is completely empty.');
    } else {
      if (!htmlContent.includes('<html') && !htmlContent.includes('<div') && !htmlContent.includes('<table')) {
        htmlWarnings.push('Content lacks standard structural wrapping tags (html/table/div).');
      }
      if (htmlContent.includes('<script')) {
        htmlWarnings.push('Executable <script> tag detected. Email clients will strip or flag this message.');
      }
      if (!htmlContent.toLowerCase().includes('unsubscribe')) {
        htmlWarnings.push('Notice: No explicit unsubscribe link detected in message body.');
      }
    }

    setValidationReport({
      validEmails: valid,
      invalidEmails: invalid,
      htmlWarnings,
    });

    if (invalid.length === 0 && htmlWarnings.length === 0) {
      onNotify('success', 'Validation Passed', `${valid.length} valid recipient(s). HTML markup is compliant.`);
    } else {
      onNotify('warning', 'Validation Completed', `Found ${invalid.length} invalid email(s) and ${htmlWarnings.length} markup note(s).`);
    }
  };

  // Save Draft
  const handleSaveDraft = async () => {
    try {
      await api.saveDraft({
        title: campaignName || 'Untitled Draft',
        subject,
        fromName,
        fromEmail,
        replyTo,
        htmlContent,
        textContent,
        recipientCount: recipientList.length,
      });
      onNotify('success', 'Draft Saved', 'Draft stored securely in server state.');
      loadDrafts();
    } catch (err: any) {
      onNotify('error', 'Draft Save Failed', err.message);
    }
  };

  const loadDrafts = async () => {
    try {
      const d = await api.getDrafts();
      setDrafts(d);
    } catch {
      // ignore
    }
  };

  const handleOpenDraftsModal = async () => {
    await loadDrafts();
    setShowDraftsModal(true);
  };

  const handleApplyDraft = (draft: EmailDraft) => {
    setCampaignName(draft.title);
    setSubject(draft.subject);
    setFromName(draft.fromName);
    setFromEmail(draft.fromEmail);
    setReplyTo(draft.replyTo);
    setHtmlContent(draft.htmlContent);
    setTextContent(draft.textContent);
    setShowDraftsModal(false);
    onNotify('info', 'Draft Loaded', `Restored "${draft.title}".`);
  };

  const handleApplyTemplate = (tmpl: EmailTemplate) => {
    setSubject(tmpl.subject);
    setHtmlContent(tmpl.htmlContent);
    setTextContent(tmpl.textContent);
    setShowTemplatesModal(false);
    onNotify('info', 'Template Applied', `Applied "${tmpl.name}".`);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the composer? Unsaved changes will be lost.')) {
      setSubject('');
      setHtmlContent('');
      setTextContent('');
      setToInput('');
      setValidationReport(null);
    }
  };

  // Safe Sandboxing HTML Document creation
  // We sanitize by injecting inside a sandboxed iframe with allow-same-origin only,
  // neutralizing scripts while preserving rich email CSS and layouts.
  const createSandboxedDoc = (rawHtml: string) => {
    if (!rawHtml) {
      return `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #94a3b8; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a;"><p>No HTML body specified yet. Type or paste HTML in the source editor.</p></body></html>`;
    }
    // Neutralize dangerous scripts from preview
    const sanitized = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- script neutralized -->');
    return sanitized;
  };

  const handlePreSend = () => {
    const list = parseRecipients(toInput);
    if (list.length === 0) {
      onNotify('error', 'Missing Recipients', 'Please specify at least one recipient email.');
      return;
    }
    if (!subject.trim()) {
      onNotify('error', 'Missing Subject', 'Please specify a campaign subject.');
      return;
    }
    if (!htmlContent.trim()) {
      onNotify('error', 'Missing Body', 'HTML email body cannot be empty.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSend = () => {
    const list = parseRecipients(toInput);
    setShowConfirmModal(false);
    onSendCampaign({
      name: campaignName.trim() || subject,
      subject: subject.trim(),
      fromName: fromName.trim(),
      fromEmail: fromEmail.trim(),
      replyTo: replyTo.trim(),
      htmlContent,
      textContent: textContent.trim() || undefined,
      recipients: list,
      rateLimitPerSec,
      batchSize,
    });
  };

  return (
    <div className="space-y-6">
      {/* View Header with Mode Toggles */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Email Composer & HTML Engine</h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Responsive HTML Templates</span>
            <span aria-hidden="true">·</span>
            <span>Sandboxed Iframe Security</span>
            <span aria-hidden="true">·</span>
            <span>Batch Concurrency Controls</span>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented View Mode */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'split' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode('source')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'source' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Source</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Templates button */}
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Templates</span>
          </button>

          {/* Drafts */}
          <button
            onClick={handleOpenDraftsModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>Drafts</span>
          </button>

          {/* Save Draft */}
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Save Draft</span>
          </button>

          {/* Validate */}
          <button
            onClick={handleValidate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Validate</span>
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors"
            title="Clear editor"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Send Action */}
          <button
            onClick={handlePreSend}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch Campaign</span>
          </button>
        </div>
      </div>

      {/* Campaign Metadata & Envelopes */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Row 1: Campaign Name & From fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Internal Campaign Label
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. October Maintenance Alert"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              From Display Name
            </label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="ApexMail Dispatcher"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              From Email Address
            </label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="noreply@smaltimento-rifiuti-roma.it"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Row 2: To (Recipients) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Recipients (To) <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">
                Count: <strong className="text-slate-200 font-mono">{recipientList.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <span>{showCcBcc ? 'Hide CC / BCC / Reply-To' : 'Show CC / BCC / Reply-To'}</span>
                {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <textarea
            rows={2}
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            placeholder="Enter one or multiple recipient emails (separated by commas or newlines), or import via Recipients tab"
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono placeholder-slate-600"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            ApexMail sends individual personalized envelopes; recipient addresses are never leaked to each other in headers.
          </span>
        </div>

        {/* CC / BCC / Reply-To Expandable */}
        {showCcBcc && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">CC Email(s)</label>
              <input
                type="text"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                placeholder="optional-cc@domain.com"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">BCC Email(s)</label>
              <input
                type="text"
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                placeholder="archive-bcc@domain.com"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Reply-To Address</label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="support@domain.com"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Subject Line <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Official System Notice..."
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-medium placeholder-slate-600"
          />
        </div>
      </div>

      {/* Validation Report Banner if active */}
      {validationReport && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold">
            <span className="text-slate-200">Validation Pre-Flight Diagnostics</span>
            <span className="font-mono text-emerald-400">{validationReport.validEmails.length} Ready</span>
          </div>
          {validationReport.invalidEmails.length > 0 && (
            <div className="text-rose-400 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Invalid recipient syntax: {validationReport.invalidEmails.join(', ')}</span>
            </div>
          )}
          {validationReport.htmlWarnings.map((warn, i) => (
            <div key={i} className="text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Workspace (Editor + Sandboxed Preview) */}
      <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* 1. HTML Source Editor */}
        {(viewMode === 'split' || viewMode === 'source') && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[650px] overflow-hidden">
            <div className="h-11 px-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span className="font-medium text-slate-200">Raw HTML Email Markup</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>{htmlContent.length.toLocaleString()} chars</span>
                <span aria-hidden="true">·</span>
                <span>{htmlContent.split('\n').length} lines</span>
              </div>
            </div>

            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="Paste or write your full HTML email code here (including tables, styles, images)..."
              spellCheck={false}
              className="flex-1 w-full p-4 bg-slate-950 font-mono text-xs text-slate-200 resize-none focus:outline-none leading-relaxed selection:bg-indigo-600/30"
            />

            {/* Plain-text alternative toggle drawer */}
            <div className="border-t border-slate-800 bg-slate-900/60 p-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPlainTextInput(!showPlainTextInput)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
              >
                <span>{showPlainTextInput ? 'Hide Plain-Text Alternative' : 'Add Plain-Text Alternative (Optional)'}</span>
                {showPlainTextInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[11px] text-slate-500">Supports responsive tables & inline CSS</span>
            </div>

            {showPlainTextInput && (
              <textarea
                rows={4}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Plain-text alternative fallback for text-only clients..."
                className="p-3 bg-slate-950 border-t border-slate-800 text-xs font-mono text-slate-300 resize-none focus:outline-none"
              />
            )}
          </div>
        )}

        {/* 2. Visual Preview (Sandboxed Iframe) */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[650px] overflow-hidden">
            <div className="h-11 px-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-slate-200">Sandboxed Visual Preview</span>
              </div>

              {/* Desktop / Mobile Preview Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeviceMode('desktop')}
                  className={`p-1.5 rounded transition-colors ${
                    deviceMode === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Desktop Preview (Full Width)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('mobile')}
                  className={`p-1.5 rounded transition-colors ${
                    deviceMode === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Mobile Preview (375px Container)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950/80 p-4 flex items-center justify-center overflow-auto">
              <div
                className={`h-full transition-all duration-200 bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-700/60 ${
                  deviceMode === 'mobile' ? 'w-[375px]' : 'w-full max-w-[680px]'
                }`}
              >
                {/* Sandboxed iframe prevents parent DOM pollution, script execution, while rendering styles perfectly */}
                <iframe
                  title="Email Preview"
                  sandbox="allow-same-origin"
                  srcDoc={createSandboxedDoc(htmlContent)}
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Responsive Email Template Library</span>
              </h3>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-sm">{tmpl.name}</span>
                      <span className="text-[11px] text-slate-400">· {tmpl.category}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{tmpl.description}</p>
                    <div className="text-xs text-slate-500 font-mono mt-1.5">Subject: {tmpl.subject}</div>
                  </div>
                  <button
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Load Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drafts Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-slate-400" />
                <span>Saved Email Drafts</span>
              </h3>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {drafts.length > 0 ? (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex items-start justify-between gap-4"
                  >
                    <div>
                      <span className="font-semibold text-slate-100 text-sm">{d.title}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{d.subject}</p>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Updated {new Date(d.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApplyDraft(d)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No saved drafts found. Click "Save Draft" in the composer to preserve current work.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pre-Dispatch Final Summary & Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">Confirm Outbound Dispatch</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Campaign Name:</span>
                  <span className="font-semibold text-slate-200">{campaignName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Subject:</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[300px]">{subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sender Identity:</span>
                  <span className="font-mono text-slate-200">{fromName} &lt;{fromEmail}&gt;</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Envelopes:</span>
                  <span className="font-bold text-indigo-400 font-mono text-sm">{recipientList.length} recipients</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Relay:</span>
                  <span className="font-mono text-slate-300">
                    {smtpConfig?.devMode ? 'Sandbox Simulator (Local)' : `${smtpConfig?.host}:${smtpConfig?.port}`}
                  </span>
                </div>
              </div>

              {/* Rate Limit and Batch Concurrency Controls */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="font-semibold text-slate-200">Throttle & Safety Limits</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Rate Limit (msgs / sec)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={rateLimitPerSec}
                      onChange={(e) => setRateLimitPerSec(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Batch Concurrency Size</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                Messages will be queued into the background daemon and dispatched individually. Addresses on the suppression list will be automatically bypassed.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors"
              >
                Start Dispatching
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
