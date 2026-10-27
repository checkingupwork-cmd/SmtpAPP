import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  Users,
  Upload,
  UserPlus,
  ShieldBan,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Send,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import { SuppressionEntry, ValidationSummary } from '../types';
import { api } from '../api/client';

interface RecipientItem {
  email: string;
  name?: string;
  valid: boolean;
  duplicate: boolean;
  suppressed: boolean;
  reason?: string;
}

interface RecipientsViewProps {
  onSendToComposer: (recipients: string[]) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const RecipientsView: React.FC<RecipientsViewProps> = ({
  onSendToComposer,
  onNotify,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'recipients' | 'suppression'>('recipients');

  // Input states
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Working list of parsed recipients
  const [recipients, setRecipients] = useState<RecipientItem[]>([
    { email: 'admin@apex-systems.internal', name: 'Platform Admin', valid: true, duplicate: false, suppressed: false },
    { email: 'tech-ops@smaltimento-rifiuti-roma.it', name: 'Tech Lead', valid: true, duplicate: false, suppressed: false },
    { email: 'bounce-test@invalid-domain-demo.org', name: 'Legacy Contact', valid: true, duplicate: false, suppressed: true, reason: 'Suppressed (bounced)' },
  ]);

  // Suppression list state
  const [suppressionList, setSuppressionList] = useState<SuppressionEntry[]>([]);
  const [newSuppressionEmail, setNewSuppressionEmail] = useState('');
  const [newSuppressionReason, setNewSuppressionReason] = useState<'unsubscribed' | 'bounced' | 'manual'>('manual');
  const [newSuppressionNotes, setNewSuppressionNotes] = useState('');

  const [loadingSuppression, setLoadingSuppression] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSuppression();
  }, []);

  const loadSuppression = async () => {
    setLoadingSuppression(true);
    try {
      const data = await api.getSuppression();
      setSuppressionList(data);
    } catch (err: any) {
      onNotify('error', 'Failed to load suppression list', err.message);
    } finally {
      setLoadingSuppression(false);
    }
  };

  // Add Single Recipient
  const handleAddSingle = () => {
    const trimmed = manualEmail.trim().toLowerCase();
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(trimmed);
    const isDup = recipients.some((r) => r.email === trimmed);
    const isSuppressed = suppressionList.some((s) => s.email.toLowerCase() === trimmed);

    setRecipients([
      {
        email: trimmed,
        name: manualName.trim() || undefined,
        valid: isValid,
        duplicate: isDup,
        suppressed: isSuppressed,
        reason: isSuppressed ? 'Address on suppression list' : (!isValid ? 'Invalid syntax' : undefined),
      },
      ...recipients,
    ]);

    setManualEmail('');
    setManualName('');
    onNotify('success', 'Recipient Added', `${trimmed} added to staging list.`);
  };

  // Process Bulk Input
  const handleProcessBulk = () => {
    const lines = bulkInput
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set(recipients.map((r) => r.email));
    const newItems: RecipientItem[] = [];

    lines.forEach((entry) => {
      // Support "Name <email@domain.com>" or just email
      let email = entry.toLowerCase();
      let name: string | undefined = undefined;

      const angleMatch = entry.match(/(.*?)\s*<([^\s@]+@[^\s@]+\.[^\s@]+)>/);
      if (angleMatch) {
        name = angleMatch[1].trim().replace(/^["']|["']$/g, '');
        email = angleMatch[2].toLowerCase();
      }

      const isValid = emailRegex.test(email);
      const isDup = seen.has(email);
      const isSuppressed = suppressionList.some((s) => s.email.toLowerCase() === email);

      if (!isDup) {
        seen.add(email);
      }

      newItems.push({
        email,
        name,
        valid: isValid,
        duplicate: isDup,
        suppressed: isSuppressed,
        reason: isSuppressed ? 'Address on suppression list' : (!isValid ? 'Invalid syntax' : undefined),
      });
    });

    setRecipients([...newItems, ...recipients]);
    setBulkInput('');
    onNotify('info', 'Bulk Processed', `Added ${newItems.length} parsed recipients.`);
  };

  // CSV File Upload handling
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const seen = new Set(recipients.map((r) => r.email));
        const imported: RecipientItem[] = [];

        rows.forEach((row) => {
          // Detect email column regardless of casing
          const emailKey = Object.keys(row).find((k) =>
            /email|e-mail|mail|indirizzo/i.test(k)
          );
          const nameKey = Object.keys(row).find((k) =>
            /name|full_name|fullname|nome|contatto/i.test(k)
          );

          const rawEmail = (emailKey ? row[emailKey] : Object.values(row)[0]) || '';
          const email = String(rawEmail).trim().toLowerCase();
          const name = nameKey && row[nameKey] ? String(row[nameKey]).trim() : undefined;

          if (email) {
            const isValid = emailRegex.test(email);
            const isDup = seen.has(email);
            const isSuppressed = suppressionList.some((s) => s.email.toLowerCase() === email);

            if (!isDup) {
              seen.add(email);
            }

            imported.push({
              email,
              name,
              valid: isValid,
              duplicate: isDup,
              suppressed: isSuppressed,
              reason: isSuppressed
                ? 'Suppression opt-out/bounce'
                : (!isValid ? 'Malformed syntax' : undefined),
            });
          }
        });

        setRecipients([...imported, ...recipients]);
        onNotify('success', 'CSV Import Complete', `Loaded ${imported.length} rows from ${file.name}.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (err) => {
        onNotify('error', 'CSV Parse Error', err.message);
      },
    });
  };

  // Clean / Deduplicate / Filter Actions
  const handleRemoveDuplicates = () => {
    const seen = new Set<string>();
    const deduplicated = recipients.filter((r) => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });
    const removedCount = recipients.length - deduplicated.length;
    setRecipients(deduplicated);
    onNotify('info', 'Deduplication Complete', `Removed ${removedCount} duplicate address(es).`);
  };

  const handleRemoveInvalid = () => {
    const filtered = recipients.filter((r) => r.valid && !r.suppressed);
    const removedCount = recipients.length - filtered.length;
    setRecipients(filtered);
    onNotify('info', 'Sanitization Complete', `Removed ${removedCount} invalid or suppressed address(es).`);
  };

  const handleClearAll = () => {
    if (confirm('Clear all staged recipients?')) {
      setRecipients([]);
    }
  };

  // Push valid addresses to Composer
  const handlePushToComposer = () => {
    const ready = recipients
      .filter((r) => r.valid && !r.suppressed && !r.duplicate)
      .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));

    if (ready.length === 0) {
      onNotify('warning', 'No Valid Recipients', 'Add valid, non-suppressed recipients before sending to composer.');
      return;
    }

    onSendToComposer(ready);
    onNotify('success', 'Composer Loaded', `Sent ${ready.length} verified recipient(s) to composer.`);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const csv = Papa.unparse(
      recipients.map((r) => ({
        Email: r.email,
        Name: r.name || '',
        Status: r.suppressed ? 'Suppressed' : r.valid ? 'Valid' : 'Invalid',
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recipients_export_${Date.now()}.csv`;
    link.click();
  };

  // Suppression list actions
  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppressionEmail.trim()) return;

    try {
      const added = await api.addSuppression(
        newSuppressionEmail.trim(),
        newSuppressionReason,
        newSuppressionNotes.trim()
      );
      setSuppressionList([added, ...suppressionList]);
      setNewSuppressionEmail('');
      setNewSuppressionNotes('');
      onNotify('success', 'Address Suppressed', `${added.email} added to global suppression list.`);
    } catch (err: any) {
      onNotify('error', 'Suppression Failed', err.message);
    }
  };

  const handleRemoveSuppression = async (email: string) => {
    try {
      await api.removeSuppression(email);
      setSuppressionList(suppressionList.filter((s) => s.email !== email));
      onNotify('info', 'Address Restored', `${email} removed from suppression list.`);
    } catch (err: any) {
      onNotify('error', 'Failed to remove', err.message);
    }
  };

  // Filtered view
  const filteredRecipients = recipients.filter(
    (r) =>
      r.email.includes(searchQuery.toLowerCase()) ||
      (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const validCount = recipients.filter((r) => r.valid && !r.suppressed && !r.duplicate).length;
  const invalidCount = recipients.filter((r) => !r.valid).length;
  const duplicateCount = recipients.filter((r) => r.duplicate).length;
  const suppressedCount = recipients.filter((r) => r.suppressed).length;

  return (
    <div className="space-y-6">
      {/* View Header with Sub-tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Recipient & Suppression Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Import CSV lists, deduplicate contacts, enforce opt-in compliance, and filter suppressed addresses
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setActiveSubTab('recipients')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'recipients' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staging List ({recipients.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('suppression')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'suppression' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldBan className="w-3.5 h-3.5" />
            <span>Suppression List ({suppressionList.length})</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'recipients' ? (
        <div className="space-y-6">
          {/* Top Row: Import Controls (CSV & Manual) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. CSV File Dropzone / Uploader */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Import From CSV File</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Upload a spreadsheet containing email contacts. ApexMail automatically detects email and name columns.
                </p>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-950 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-300 transition-colors group cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Click to select CSV file</span>
                  <span className="text-[11px] text-slate-500">Supports comma & semicolon separated formats</span>
                </button>
              </div>
            </div>

            {/* 2. Manual Recipient Add */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <span>Add Single Recipient</span>
                </h3>
                <div className="space-y-2 mt-3">
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Recipient Full Name (optional)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddSingle}
                className="w-full mt-3 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors"
              >
                Add To List
              </button>
            </div>

            {/* 3. Bulk Quick Paste */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Bulk Text Input</span>
                </h3>
                <textarea
                  rows={3}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Paste multiple emails separated by newlines, commas, or semicolons..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleProcessBulk}
                className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors"
              >
                Process Raw Text
              </button>
            </div>
          </div>

          {/* Validation Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase">Valid & Ready</span>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">{validCount}</div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase">Duplicate Records</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">{duplicateCount}</div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase">Suppressed / Opted Out</span>
              <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">{suppressedCount}</div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase">Invalid Syntax</span>
              <div className="text-xl font-bold font-mono text-slate-400 tabular-nums">{invalidCount}</div>
            </div>
          </div>

          {/* Table Toolbar & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staged contacts..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {duplicateCount > 0 && (
                <button
                  onClick={handleRemoveDuplicates}
                  className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
                >
                  Deduplicate ({duplicateCount})
                </button>
              )}

              {(invalidCount > 0 || suppressedCount > 0) && (
                <button
                  onClick={handleRemoveInvalid}
                  className="px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
                >
                  Exclude Invalid/Suppressed
                </button>
              )}

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleClearAll}
                className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                title="Clear list"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={handlePushToComposer}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Composer ({validCount})</span>
              </button>
            </div>
          </div>

          {/* Staging Recipient Table */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                    <th className="py-3 px-4 font-medium">Recipient Address</th>
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Validation Status</th>
                    <th className="py-3 px-4 font-medium">Compliance Reason</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRecipients.length > 0 ? (
                    filteredRecipients.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-200">{r.email}</td>
                        <td className="py-3 px-4 text-slate-400 font-sans">{r.name || '—'}</td>
                        <td className="py-3 px-4">
                          {r.suppressed ? (
                            <span className="text-rose-400 font-medium">Suppressed</span>
                          ) : !r.valid ? (
                            <span className="text-rose-400 font-medium">Syntax Error</span>
                          ) : r.duplicate ? (
                            <span className="text-amber-400 font-medium">Duplicate</span>
                          ) : (
                            <span className="text-emerald-400 font-medium">Ready</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                          {r.reason || 'Verified opt-in recipient'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setRecipients(recipients.filter((_, idx) => idx !== i))}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 font-sans">
                        No recipients staged. Import a CSV or enter addresses above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Suppression List Management Tab */
        <div className="space-y-6">
          {/* Add to Suppression Form */}
          <form onSubmit={handleAddSuppression} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldBan className="w-4 h-4 text-rose-400" />
              <span>Add Address to Global Suppression List</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newSuppressionEmail}
                  onChange={(e) => setNewSuppressionEmail(e.target.value)}
                  placeholder="suppress@domain.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Suppression Category</label>
                <select
                  value={newSuppressionReason}
                  onChange={(e) => setNewSuppressionReason(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="manual">Manual Admin Opt-Out</option>
                  <option value="unsubscribed">Unsubscribed via List-Unsubscribe</option>
                  <option value="bounced">Hard Bounced Mailbox (550)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Reference</label>
                <input
                  type="text"
                  value={newSuppressionNotes}
                  onChange={(e) => setNewSuppressionNotes(e.target.value)}
                  placeholder="User requested removal"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white rounded-lg transition-colors"
              >
                Suppress Address
              </button>
            </div>
          </form>

          {/* Suppression Entries Table */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                    <th className="py-3 px-4 font-medium">Suppressed Email</th>
                    <th className="py-3 px-4 font-medium">Reason</th>
                    <th className="py-3 px-4 font-medium">Notes</th>
                    <th className="py-3 px-4 font-medium">Date Added</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {suppressionList.length > 0 ? (
                    suppressionList.map((entry) => (
                      <tr key={entry.email} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-200">{entry.email}</td>
                        <td className="py-3 px-4 font-sans text-rose-300 capitalize">{entry.reason}</td>
                        <td className="py-3 px-4 font-sans text-slate-400">{entry.notes || '—'}</td>
                        <td className="py-3 px-4 text-slate-400">{new Date(entry.addedAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRemoveSuppression(entry.email)}
                            className="text-xs text-slate-400 hover:text-slate-200 hover:underline font-sans"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 font-sans">
                        Suppression list is currently empty.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
