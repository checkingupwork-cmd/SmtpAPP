import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Plus,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Download,
  Trash2,
  Edit,
  ExternalLink,
  ChevronRight,
  X,
  Play,
  Lock,
  Mail,
  Zap,
  Globe,
  Radio,
  FileSpreadsheet,
  Layers,
  FileText,
  AlertCircle,
  Info,
  StopCircle,
  MailCheck,
} from 'lucide-react';
import {
  SanitizedSmtpProfile,
  MonitorConnectionStatus,
  MonitorTestEmailStatus,
  MonitorDiagnosticLog,
  DeepDiagnosticsResult,
  SmtpSecurity,
  BatchAddProfileInput,
  GroupTestEmailItemResult,
} from '../types';
import { api } from '../api/client';

interface SmtpMonitorViewProps {
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  onOpenSettings?: () => void;
}

export const SmtpMonitorView: React.FC<SmtpMonitorViewProps> = ({ onNotify, onOpenSettings }) => {
  // Profiles & Logs
  const [profiles, setProfiles] = useState<SanitizedSmtpProfile[]>([]);
  const [logs, setLogs] = useState<MonitorDiagnosticLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(10);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SanitizedSmtpProfile | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const [isSendTestModalOpen, setIsSendTestModalOpen] = useState(false);
  const [selectedProfileForTest, setSelectedProfileForTest] = useState<SanitizedSmtpProfile | null>(null);

  const [isDiagModalOpen, setIsDiagModalOpen] = useState(false);
  const [selectedProfileForDiag, setSelectedProfileForDiag] = useState<SanitizedSmtpProfile | null>(null);
  const [diagData, setDiagData] = useState<DeepDiagnosticsResult | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [diagActiveTab, setDiagActiveTab] = useState<'probe' | 'history'>('probe');

  // Deletion & Selection state
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    mode: 'single' | 'bulk';
    profile?: SanitizedSmtpProfile;
    ids?: string[];
    isDeleting: boolean;
    error?: string | null;
  }>({
    isOpen: false,
    mode: 'single',
    isDeleting: false,
    error: null,
  });

  // Group Test Email modal state
  const [isGroupTestModalOpen, setIsGroupTestModalOpen] = useState(false);
  const [groupTestTargets, setGroupTestTargets] = useState<SanitizedSmtpProfile[]>([]);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
    loadLogs();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await api.getMonitorProfiles();
      setProfiles(data);
    } catch (err: any) {
      onNotify('error', 'Failed to Load SMTP Profiles', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await api.getMonitorLogs(100);
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load logs:', err);
    }
  };

  // Test Connection for a Single Profile
  const handleTestConnection = async (profileId: string) => {
    if (testingProfileId || testingAll) return;
    setTestingProfileId(profileId);

    try {
      const res = await api.testMonitorProfile(profileId, timeoutSeconds * 1000);
      if (res.success) {
        onNotify('success', 'SMTP Connection Verified', `${res.profile.name} responded in ${res.responseTimeMs}ms.`);
      } else {
        onNotify(
          'error',
          'SMTP Verification Failed',
          res.profile.lastErrorDetails || res.error || 'Connection probe failed'
        );
      }
      setProfiles((prev) => prev.map((p) => (p.id === profileId ? res.profile : p)));
      loadLogs();
    } catch (err: any) {
      onNotify('error', 'Test Failed', err.message);
      await loadProfiles();
    } finally {
      setTestingProfileId(null);
    }
  };

  // Test All Configurations Sequentially
  const handleTestAll = async () => {
    if (testingAll || testingProfileId || profiles.length === 0) return;
    setTestingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const profile of profiles) {
      try {
        setTestingProfileId(profile.id);
        const res = await api.testMonitorProfile(profile.id, timeoutSeconds * 1000);
        if (res.success) successCount++;
        else failCount++;
        setProfiles((prev) => prev.map((p) => (p.id === profile.id ? res.profile : p)));
      } catch {
        failCount++;
      }
    }

    setTestingProfileId(null);
    setTestingAll(false);
    loadLogs();
    onNotify(
      failCount === 0 ? 'success' : 'warning',
      'Batch Verification Completed',
      `Verified ${profiles.length} relays (${successCount} successful, ${failCount} failed).`
    );
  };

  // Open Diagnostics Modal & fetch deep probe
  const handleOpenDiagnostics = async (profile: SanitizedSmtpProfile) => {
    setSelectedProfileForDiag(profile);
    setIsDiagModalOpen(true);
    setDiagActiveTab('probe');
    setLoadingDiag(true);
    setDiagData(null);

    try {
      const res = await api.getMonitorProfileDiagnostics(profile.id, timeoutSeconds * 1000);
      setDiagData(res.diagnostics);
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? res.profile : p)));
      loadLogs();
    } catch (err: any) {
      onNotify('error', 'Diagnostics Probe Failed', err.message);
    } finally {
      setLoadingDiag(false);
    }
  };

  // Selection & Group Test Handlers
  const handleToggleSelectProfile = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedProfileIds(new Set());
  };

  // Launch Group Test Email for selected configurations
  const handleOpenGroupTestSelected = () => {
    const selectedList = profiles.filter((p) => selectedProfileIds.has(p.id));
    if (selectedList.length === 0) {
      onNotify('warning', 'No Configurations Selected', 'Please select at least one configuration to test.');
      return;
    }
    setGroupTestTargets(selectedList);
    setIsGroupTestModalOpen(true);
  };

  // Launch Group Test Email for all saved configurations
  const handleOpenGroupTestAll = () => {
    if (profiles.length === 0) {
      onNotify('warning', 'No Configurations', 'No SMTP configurations registered yet.');
      return;
    }
    setGroupTestTargets(profiles);
    setIsGroupTestModalOpen(true);
  };

  // Prompt Single Delete Modal (in-app dialog, replaces blocked window.confirm)
  const handlePromptDeleteSingle = (profile: SanitizedSmtpProfile) => {
    if (profile.id === 'primary') {
      onNotify('warning', 'Action Forbidden', 'Primary relay configuration is protected and cannot be deleted.');
      return;
    }
    setDeleteModal({
      isOpen: true,
      mode: 'single',
      profile,
      ids: [profile.id],
      isDeleting: false,
      error: null,
    });
  };

  // Prompt Bulk Delete Modal
  const handlePromptBulkDelete = () => {
    const ids = Array.from(selectedProfileIds).filter((id) => id !== 'primary');
    if (ids.length === 0) {
      onNotify('warning', 'No Configurations Selected', 'Please select at least one configuration to delete.');
      return;
    }
    setDeleteModal({
      isOpen: true,
      mode: 'bulk',
      ids,
      isDeleting: false,
      error: null,
    });
  };

  // Confirm and Execute Deletion (Single or Bulk)
  const handleConfirmDelete = async () => {
    if (!deleteModal.ids || deleteModal.ids.length === 0) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true, error: null }));

    try {
      if (deleteModal.mode === 'single' && deleteModal.profile) {
        const targetId = deleteModal.profile.id;
        const targetName = deleteModal.profile.name;
        await api.deleteMonitorProfile(targetId);

        // Update local state immediately
        setProfiles((prev) => prev.filter((p) => p.id !== targetId));
        setSelectedProfileIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        loadLogs();

        onNotify('success', 'Configuration Deleted', `"${targetName}" was successfully removed.`);
      } else {
        // Bulk deletion
        const targetIds = deleteModal.ids;
        const res = await api.bulkDeleteMonitorProfiles(targetIds);

        const deletedSet = new Set(res.deletedIds);
        // Update local state immediately
        setProfiles((prev) => prev.filter((p) => !deletedSet.has(p.id)));
        setSelectedProfileIds((prev) => {
          const next = new Set(prev);
          res.deletedIds.forEach((id) => next.delete(id));
          return next;
        });
        loadLogs();

        onNotify(
          'success',
          'Configurations Deleted',
          `Successfully deleted ${res.deletedCount} SMTP configuration${res.deletedCount === 1 ? '' : 's'}.`
        );
      }

      setDeleteModal({ isOpen: false, mode: 'single', isDeleting: false, error: null });
    } catch (err: any) {
      const errorMsg = err.message || 'An unexpected error occurred while deleting.';
      setDeleteModal((prev) => ({
        ...prev,
        isDeleting: false,
        error: errorMsg,
      }));
      onNotify('error', 'Deletion Failed', errorMsg);
    }
  };

  // Metrics computation
  const totalCount = profiles.length;
  const connectedCount = profiles.filter((p) => p.lastConnectionStatus === 'Connected').length;
  const failedCount = profiles.filter(
    (p) =>
      p.lastConnectionStatus === 'Authentication Failed' ||
      p.lastConnectionStatus === 'Connection Failed' ||
      p.lastConnectionStatus === 'Timeout' ||
      p.lastConnectionStatus === 'TLS Error'
  ).length;

  const validResponseTimes = profiles
    .map((p) => p.lastResponseTimeMs)
    .filter((ms): ms is number => typeof ms === 'number' && ms > 0);
  const avgLatency =
    validResponseTimes.length > 0
      ? Math.round(validResponseTimes.reduce((acc, curr) => acc + curr, 0) / validResponseTimes.length)
      : null;

  // Filtered profiles
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.fromEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'connected'
        ? p.lastConnectionStatus === 'Connected'
        : statusFilter === 'failed'
        ? ['Authentication Failed', 'Connection Failed', 'Timeout', 'TLS Error'].includes(p.lastConnectionStatus)
        : statusFilter === 'pending'
        ? p.lastConnectionStatus === 'Pending'
        : p.lastConnectionStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Selection computation
  const isAllSelected =
    filteredProfiles.length > 0 &&
    filteredProfiles.every((p) => selectedProfileIds.has(p.id));
  const isSomeSelected =
    filteredProfiles.some((p) => selectedProfileIds.has(p.id)) && !isAllSelected;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-indigo-400" />
            <span>Authorized SMTP Connection Monitor</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time connection probes, TLS handshake audits, and verification diagnostics for registered relays.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={() => {
              setEditingProfile(null);
              setIsEditModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-sm shadow-indigo-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add SMTP Configuration</span>
          </button>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 hover:border-slate-600 shadow-sm transition-colors"
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Bulk Add SMTPs</span>
          </button>

          <button
            onClick={handleOpenGroupTestAll}
            disabled={profiles.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 font-medium text-xs rounded-lg border border-emerald-700/60 shadow-sm transition-colors disabled:opacity-50"
            title="Send real test emails through all or selected SMTP configurations"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>Send Test Email by Group</span>
          </button>

          <button
            onClick={handleTestAll}
            disabled={testingAll || Boolean(testingProfileId) || profiles.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            {testingAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{testingAll ? 'Testing All...' : 'Test All Connections'}</span>
          </button>

          <a
            href={api.exportMonitorLogsCsvUrl()}
            download
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 font-medium text-xs rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export Audit CSV</span>
          </a>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Monitored Relays</div>
            <div className="text-2xl font-bold text-white mt-1 font-mono">{totalCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Configured gateway endpoints</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Connected & Verified</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{connectedCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Passed real Nodemailer probe</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-rose-400 uppercase tracking-wider">Failures & Alerts</div>
            <div className="text-2xl font-bold text-rose-400 mt-1 font-mono">{failedCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Auth or socket handshake issue</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Average Latency</div>
            <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">
              {avgLatency !== null ? `${avgLatency} ms` : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Round-trip verification probe</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by name, host, user, or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses ({profiles.length})</option>
              <option value="connected">Connected ({connectedCount})</option>
              <option value="failed">Failed / Alerts ({failedCount})</option>
              <option value="pending">Pending</option>
              <option value="Timeout">Timeout</option>
              <option value="Authentication Failed">Auth Failed</option>
              <option value="TLS Error">TLS Error</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Timeout:</span>
            <select
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            >
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
            </select>
          </div>

          <button
            onClick={() => loadProfiles()}
            disabled={loading}
            title="Refresh monitor list"
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/80 rounded-lg border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Configurations Table / Cards */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <Server className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">No SMTP configurations found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {profiles.length === 0
                ? 'No authorized SMTP relays have been registered yet. Add your first configuration to begin monitoring.'
                : 'No configurations match your current search or filter query.'}
            </p>
            {profiles.length === 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  onClick={() => {
                    setEditingProfile(null);
                    setIsEditModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add SMTP Configuration</span>
                </button>
                <button
                  onClick={() => setIsBulkModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-colors"
                >
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Bulk Add SMTPs</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Bulk Selection & Actions Header Bar */}
            <div className="bg-slate-950/70 px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-slate-300 hover:text-white font-medium">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={() => {
                      if (isAllSelected) {
                        handleClearSelection();
                      } else {
                        const next = new Set(selectedProfileIds);
                        filteredProfiles.forEach((p) => next.add(p.id));
                        setSelectedProfileIds(next);
                      }
                    }}
                    disabled={filteredProfiles.length === 0}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-slate-950 cursor-pointer disabled:opacity-40"
                  />
                  <span>Select All ({filteredProfiles.length})</span>
                </label>

                {selectedProfileIds.size > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold text-[11px]">
                    {selectedProfileIds.size} of {filteredProfiles.length} selected
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedProfileIds.size > 0 ? (
                  <>
                    <button
                      onClick={handleOpenGroupTestSelected}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm shadow-emerald-950/30 transition-colors"
                      title="Send real test email through all selected configurations"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test Email to Selected ({selectedProfileIds.size})</span>
                    </button>

                    <button
                      onClick={handlePromptBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-sm shadow-rose-950/30 transition-colors"
                      title="Delete selected non-primary configurations"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected</span>
                    </button>

                    <button
                      onClick={handleClearSelection}
                      className="px-2.5 py-1 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Deselect All
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleOpenGroupTestAll}
                    disabled={profiles.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Email to All Saved ({profiles.length})</span>
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {filteredProfiles.map((profile) => {
                const isSelected = selectedProfileIds.has(profile.id);
                const isCheckingThis = testingProfileId === profile.id || profile.lastConnectionStatus === 'Checking';
                const status = profile.lastConnectionStatus;

                return (
                  <div
                    key={profile.id}
                    className={`p-5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isSelected ? 'bg-indigo-950/20 hover:bg-indigo-950/30' : 'hover:bg-slate-900/80'
                    }`}
                  >
                    {/* Left Column: Checkbox + Name, Host, Port, Badges */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="pt-0.5 shrink-0 flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProfile(profile.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-slate-950 cursor-pointer"
                          title={`Select "${profile.name}"`}
                          aria-label={`Select ${profile.name}`}
                        />
                        {profile.id === 'primary' && (
                          <span title="Primary gateway relay is protected from deletion">
                            <Lock className="w-3 h-3 text-slate-500" />
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-semibold text-white tracking-tight truncate">{profile.name}</h3>
                          {profile.id === 'primary' && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              Primary Relay
                            </span>
                          )}
                          <StatusBadge status={isCheckingThis ? 'Checking' : status} />
                          {profile.lastResponseTimeMs && !isCheckingThis && (
                            <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-indigo-400" />
                              {profile.lastResponseTimeMs} ms
                            </span>
                          )}
                        </div>

                        {/* Metadata line */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Server className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {profile.host}:{profile.port}
                            </span>
                            <span className="text-[10px] uppercase font-sans font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                              {profile.port === 465 ? 'SSL/TLS' : profile.port === 587 ? 'STARTTLS' : profile.security}
                            </span>
                          </div>

                          <span aria-hidden="true" className="text-slate-700">
                            ·
                          </span>

                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-slate-300 font-sans">{profile.fromEmail}</span>
                          </div>

                          {profile.username && (
                            <>
                              <span aria-hidden="true" className="text-slate-700">
                                ·
                              </span>
                              <span className="text-slate-400 truncate max-w-xs">User: {profile.username}</span>
                            </>
                          )}
                        </div>

                        {/* Diagnostic notes or error messages */}
                        {profile.lastErrorDetails && profile.lastConnectionStatus !== 'Connected' && !isCheckingThis && (
                          <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-900/50 rounded-lg p-2 font-mono flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="font-bold">[{profile.lastErrorCode || 'ERROR'}]: </span>
                              <span>{profile.lastErrorDetails}</span>
                            </div>
                          </div>
                        )}

                        {profile.lastTestEmailStatus && profile.lastTestEmailStatus !== 'Not Requested' && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span className="text-slate-400">Last Test Email:</span>
                            <span
                              className={`font-semibold ${
                                profile.lastTestEmailStatus === 'Email Accepted'
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {profile.lastTestEmailStatus}
                            </span>
                            {profile.lastTestEmailRecipient && (
                              <span className="text-slate-400">to {profile.lastTestEmailRecipient}</span>
                            )}
                            {profile.lastTestEmailMessageId && (
                              <span className="font-mono text-slate-400 text-[10px] truncate max-w-xs">
                                ID: {profile.lastTestEmailMessageId}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                      <button
                        onClick={() => handleTestConnection(profile.id)}
                        disabled={isCheckingThis || testingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
                      >
                        {isCheckingThis ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>{isCheckingThis ? 'Probing...' : 'Test Connection'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedProfileForTest(profile);
                          setIsSendTestModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Send Test Email</span>
                      </button>

                      <button
                        onClick={() => handleOpenDiagnostics(profile)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                      >
                        <Activity className="w-3.5 h-3.5 text-amber-400" />
                        <span>Diagnostics</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingProfile(profile);
                          setIsEditModalOpen(true);
                        }}
                        title="Edit Configuration"
                        className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {profile.id !== 'primary' && (
                        <button
                          onClick={() => handlePromptDeleteSingle(profile)}
                          title="Delete Configuration"
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/40 rounded-lg border border-slate-700 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent Diagnostic Activity Log */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Recent Audit History & Probe Events</h2>
          </div>
          <button
            onClick={loadLogs}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Audit Log</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No diagnostic audit events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Profile Name</th>
                  <th className="py-2.5 px-3">Host & Port</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                  <th className="py-2.5 px-3">Message / Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/60">
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 font-sans font-medium text-white whitespace-nowrap">{log.profileName}</td>
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {log.host}:{log.port}
                    </td>
                    <td className="py-2 px-3 uppercase text-[10px] text-slate-400 whitespace-nowrap">
                      {log.type === 'connection_test' ? 'Verify' : 'Test Email'}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          log.status === 'Connected' || log.status === 'Email Accepted'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400 whitespace-nowrap">
                      {log.responseTimeMs ? `${log.responseTimeMs} ms` : '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-sans truncate max-w-xs">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Modal 1: Add or Edit SMTP Configuration */}
      {/* ------------------------------------------------------------- */}
      {isEditModalOpen && (
        <EditConfigModal
          profile={editingProfile}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={(saved) => {
            setProfiles((prev) => {
              const idx = prev.findIndex((p) => p.id === saved.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [...prev, saved];
            });
            setIsEditModalOpen(false);
            onNotify('success', 'Configuration Saved', `Successfully configured "${saved.name}".`);
          }}
          onNotify={onNotify}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal: Bulk Add SMTP Configurations */}
      {/* ------------------------------------------------------------- */}
      {isBulkModalOpen && (
        <BulkAddModal
          existingProfiles={profiles}
          onClose={() => setIsBulkModalOpen(false)}
          onAdded={(newProfiles) => {
            setProfiles((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              for (const np of newProfiles) {
                map.set(np.id, np);
              }
              return Array.from(map.values());
            });
            setIsBulkModalOpen(false);
            loadLogs();
          }}
          onNotify={onNotify}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Send Test Email per Configuration */}
      {/* ------------------------------------------------------------- */}
      {isSendTestModalOpen && selectedProfileForTest && (
        <SendTestEmailModal
          profile={selectedProfileForTest}
          onClose={() => setIsSendTestModalOpen(false)}
          onSent={(updatedProfile) => {
            setProfiles((prev) => prev.map((p) => (p.id === updatedProfile.id ? updatedProfile : p)));
            loadLogs();
          }}
          onNotify={onNotify}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 3: View Deep Diagnostics & Audit */}
      {/* ------------------------------------------------------------- */}
      {isDiagModalOpen && selectedProfileForDiag && (
        <DiagnosticsModal
          profile={selectedProfileForDiag}
          diagData={diagData}
          loading={loadingDiag}
          activeTab={diagActiveTab}
          setActiveTab={setDiagActiveTab}
          logs={logs.filter((l) => l.profileId === selectedProfileForDiag.id)}
          onClose={() => setIsDiagModalOpen(false)}
          onRetest={() => handleOpenDiagnostics(selectedProfileForDiag)}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 4: Delete Confirmation Dialog (Single & Bulk) */}
      {/* ------------------------------------------------------------- */}
      {deleteModal.isOpen && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          mode={deleteModal.mode}
          profile={deleteModal.profile}
          ids={deleteModal.ids}
          allProfiles={profiles}
          isDeleting={deleteModal.isDeleting}
          error={deleteModal.error}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteModal({ isOpen: false, mode: 'single', isDeleting: false, error: null })}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 5: Send Test Email by Group */}
      {/* ------------------------------------------------------------- */}
      {isGroupTestModalOpen && (
        <GroupTestEmailModal
          isOpen={isGroupTestModalOpen}
          targetProfiles={groupTestTargets}
          onClose={() => setIsGroupTestModalOpen(false)}
          onProfileUpdated={(updated) => {
            setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
          onFinished={() => {
            loadLogs();
          }}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Component: Status Badge
// -------------------------------------------------------------
const StatusBadge: React.FC<{ status: MonitorConnectionStatus }> = ({ status }) => {
  switch (status) {
    case 'Connected':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Connected
        </span>
      );
    case 'Checking':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Checking
        </span>
      );
    case 'Authentication Failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3 h-3" />
          Auth Failed
        </span>
      );
    case 'Timeout':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <Clock className="w-3 h-3" />
          Timeout
        </span>
      );
    case 'TLS Error':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Lock className="w-3 h-3" />
          TLS Error
        </span>
      );
    case 'Connection Failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertTriangle className="w-3 h-3" />
          Connection Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          Pending
        </span>
      );
  }
};

// -------------------------------------------------------------
// Submodal: Add / Edit SMTP Configuration
// -------------------------------------------------------------
interface EditConfigModalProps {
  profile: SanitizedSmtpProfile | null;
  onClose: () => void;
  onSaved: (saved: SanitizedSmtpProfile) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

const EditConfigModal: React.FC<EditConfigModalProps> = ({ profile, onClose, onSaved, onNotify }) => {
  const [name, setName] = useState(profile?.name || '');
  const [host, setHost] = useState(profile?.host || 'out.postassl.it');
  const [port, setPort] = useState(profile?.port || 465);
  const [security, setSecurity] = useState<SmtpSecurity>(profile?.security || 'ssl');
  const [username, setUsername] = useState(profile?.username || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fromEmail, setFromEmail] = useState(profile?.fromEmail || 'noreply@smaltimento-rifiuti-roma.it');
  const [fromName, setFromName] = useState(profile?.fromName || 'ApexMail Dispatcher');
  const [replyTo, setReplyTo] = useState(profile?.replyTo || '');
  const [saving, setSaving] = useState(false);

  const applyPreset = (preset: 'postassl' | 'starttls587' | 'plain25') => {
    if (preset === 'postassl') {
      setName('PostaSSL Enterprise Gateway');
      setHost('out.postassl.it');
      setPort(465);
      setSecurity('ssl');
    } else if (preset === 'starttls587') {
      setName('STARTTLS Submissions Gateway');
      setHost('smtp.smaltimento-rifiuti-roma.it');
      setPort(587);
      setSecurity('starttls');
    } else {
      setName('Internal SMTP Relay');
      setPort(25);
      setSecurity('none');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !port || !fromEmail) {
      onNotify('error', 'Validation Error', 'Host, Port, and From Email are required fields.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.saveMonitorProfile({
        id: profile?.id,
        name: name.trim() || `${host}:${port}`,
        host: host.trim(),
        port: Number(port),
        security,
        username: username.trim(),
        password: password.trim().length > 0 ? password : undefined,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        replyTo: replyTo.trim() || undefined,
      });

      onSaved(res.profile);
    } catch (err: any) {
      onNotify('error', 'Failed to Save Configuration', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              {profile ? `Edit Configuration: ${profile.name}` : 'Add Authorized SMTP Relay'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Presets */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('postassl')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
              >
                PostaSSL (465 SSL)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('starttls587')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
              >
                STARTTLS (587)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('plain25')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
              >
                Standard (25 Plain)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Configuration Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary PostaSSL Relay (SSL 465)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">SMTP Hostname</label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="out.postassl.it"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setPort(val);
                  if (val === 465) setSecurity('ssl');
                  else if (val === 587) setSecurity('starttls');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Encryption Mode</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSecurity('ssl')}
                className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                  security === 'ssl'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                SSL / TLS (Implicit)
              </button>
              <button
                type="button"
                onClick={() => setSecurity('starttls')}
                className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                  security === 'starttls'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                STARTTLS (Explicit)
              </button>
              <button
                type="button"
                onClick={() => setSecurity('none')}
                className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                  security === 'none'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                None (Plain)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Username / Auth User</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="noreply@smaltimento-rifiuti-roma.it"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Password {profile?.hasPassword && <span className="text-slate-400">(Saved on Server)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={profile?.hasPassword ? '•••••••••••• (Leave blank to keep)' : 'Enter password'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-9 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Sender Email (From)</label>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@smaltimento-rifiuti-roma.it"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Sender Display Name</label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="ApexMail Dispatcher"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Credentials are kept securely in server memory and never stored in the browser. Target hostnames are
              validated against SSRF attacks.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Submodal: Send Test Email per Configuration
// -------------------------------------------------------------
interface SendTestEmailModalProps {
  profile: SanitizedSmtpProfile;
  onClose: () => void;
  onSent: (updatedProfile: SanitizedSmtpProfile) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

const SendTestEmailModal: React.FC<SendTestEmailModalProps> = ({ profile, onClose, onSent, onNotify }) => {
  const [destinationEmail, setDestinationEmail] = useState('');
  const [subject, setSubject] = useState(
    `[ApexMail Test] Relay Verification Probe - ${new Date().toLocaleTimeString()}`
  );
  const [customBody, setCustomBody] = useState(
    `This test email confirms real end-to-end SMTP delivery via ${profile.name} (${profile.host}:${profile.port}).`
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinationEmail.trim())) {
      onNotify('error', 'Invalid Email', 'Please enter a valid destination recipient address.');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await api.sendTestMonitorProfile(profile.id, {
        destinationEmail: destinationEmail.trim(),
        subject: subject.trim(),
        textBody: customBody.trim(),
      });

      setResult(res.result || { success: res.success, message: res.error || 'Message dispatched' });
      onSent(res.profile);

      if (res.success) {
        onNotify('success', 'Email Accepted by Relay', `Delivered to ${destinationEmail}.`);
      } else {
        onNotify('error', 'Delivery Rejected', res.result?.message || 'SMTP server rejected transmission.');
      }
    } catch (err: any) {
      onNotify('error', 'Transmission Failed', err.message);
      setResult({ success: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Send className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">Send Real Test Email</h3>
              <p className="text-xs text-slate-400">Via relay: {profile.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Relay:</span>
              <span className="text-white">
                {profile.host}:{profile.port}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sender Identity:</span>
              <span className="text-white">{profile.fromEmail}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Destination Recipient Email</label>
            <input
              type="email"
              required
              value={destinationEmail}
              onChange={(e) => setDestinationEmail(e.target.value)}
              placeholder="e.g. administrator@yourdomain.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Message Content</label>
            <textarea
              rows={3}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
            />
          </div>

          {result && (
            <div
              className={`p-3.5 rounded-lg border text-xs font-mono ${
                result.success
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {result.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{result.success ? 'ACCEPTED BY SMTP SERVER' : 'REJECTED / FAILED'}</span>
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div>Message: {result.message}</div>
                {result.messageId && <div>Message-ID: {result.messageId}</div>}
                {result.smtpResponse && <div>Response: {result.smtpResponse}</div>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm shadow-emerald-600/30 transition-colors disabled:opacity-50"
            >
              {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{sending ? 'Dispatching...' : 'Dispatch Test Email'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Submodal: Deep Diagnostics & Audit Logs
// -------------------------------------------------------------
interface DiagnosticsModalProps {
  profile: SanitizedSmtpProfile;
  diagData: DeepDiagnosticsResult | null;
  loading: boolean;
  activeTab: 'probe' | 'history';
  setActiveTab: (tab: 'probe' | 'history') => void;
  logs: MonitorDiagnosticLog[];
  onClose: () => void;
  onRetest: () => void;
}

const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  profile,
  diagData,
  loading,
  activeTab,
  setActiveTab,
  logs,
  onClose,
  onRetest,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Diagnostics & Handshake Audit</span>
                <span className="text-xs font-normal text-slate-400">· {profile.name}</span>
              </h3>
              <p className="text-xs font-mono text-slate-400">
                {profile.host}:{profile.port} ({profile.security.toUpperCase()})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRetest}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Rerun Probe</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="px-6 border-b border-slate-800 flex items-center gap-4 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('probe')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'probe'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Probe & TLS Handshake
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Diagnostic Audit Log ({logs.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          {activeTab === 'probe' && (
            <>
              {loading ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-300">Resolving DNS & Probing TLS Handshake...</p>
                  <p className="text-xs text-slate-400">Verifying SMTP server greeting and auth credentials</p>
                </div>
              ) : diagData ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      diagData.smtpVerify.success
                        ? 'bg-emerald-950/20 border-emerald-800/50'
                        : 'bg-rose-950/20 border-rose-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {diagData.smtpVerify.success ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-bold text-white">
                          {diagData.smtpVerify.success
                            ? 'SMTP Authentication & Connection Verified'
                            : 'SMTP Probe Failed'}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">{diagData.smtpVerify.message}</div>
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs">
                      <div className="text-slate-400">Total Latency</div>
                      <div className="text-base font-bold text-white">{diagData.totalLatencyMs} ms</div>
                    </div>
                  </div>

                  {/* DNS & Resolution Section */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-indigo-400" />
                        <span>DNS Host Resolution & MX Records</span>
                      </span>
                      <span className="font-mono text-slate-400">{diagData.dns.dnsLatencyMs} ms</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-1">Resolved IPv4 Addresses:</span>
                        {diagData.dns.resolvedIps.length > 0 ? (
                          <div className="space-y-0.5">
                            {diagData.dns.resolvedIps.map((ip) => (
                              <div key={ip} className="text-emerald-400">
                                {ip}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">No IPv4 resolved</span>
                        )}
                      </div>

                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-1">Domain MX Records:</span>
                        {diagData.dns.mxRecords && diagData.dns.mxRecords.length > 0 ? (
                          <div className="space-y-0.5">
                            {diagData.dns.mxRecords.map((mx) => (
                              <div key={mx.exchange} className="text-slate-300 truncate">
                                [{mx.priority}] {mx.exchange}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">Direct hostname lookup</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TLS Handshake Details */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-emerald-400" />
                        <span>TLS / SSL Encryption & Cipher Details</span>
                      </span>
                      <span className="text-slate-400">Strict Validation Active</span>
                    </div>

                    {diagData.tls ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                          <div className="text-slate-400">Protocol Version:</div>
                          <div className="text-white font-bold">{diagData.tls.protocol || 'TLSv1.2+'}</div>

                          <div className="text-slate-400 pt-1">Cipher Suite:</div>
                          <div className="text-indigo-400 truncate">{diagData.tls.cipherName || 'AES-GCM-SHA256'}</div>
                        </div>

                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                          <div className="text-slate-400">Certificate Subject:</div>
                          <div className="text-white truncate">{diagData.tls.certSubject || diagData.host}</div>

                          <div className="text-slate-400 pt-1">Issuer / CA:</div>
                          <div className="text-slate-300 truncate">{diagData.tls.certIssuer || 'Verified CA'}</div>

                          {diagData.tls.certDaysRemaining !== undefined && (
                            <div className="text-[11px] text-emerald-400 pt-0.5">
                              Valid for ~{diagData.tls.certDaysRemaining} more days
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-mono">
                        Handshake conducted via standard Nodemailer STARTTLS layer.
                      </p>
                    )}
                  </div>

                  {/* Server Banner & Greeting */}
                  {diagData.serverBanner && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                      <span className="font-semibold text-white text-xs block">Remote SMTP Banner / Service Greeting</span>
                      <pre className="text-xs font-mono text-indigo-300 bg-slate-900 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                        {diagData.serverBanner}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">No diagnostic data available. Click "Rerun Probe" above.</div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No historical tests recorded for this profile.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                            log.status === 'Connected' || log.status === 'Email Accepted'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <div className="text-slate-200 font-sans">{log.message}</div>
                      {log.responseTimeMs && <div className="text-slate-400">Response Time: {log.responseTimeMs} ms</div>}
                      {log.details && <div className="text-slate-400 text-[11px] truncate">{log.details}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>SSRF guard and strict certificate validation enabled on all probes.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Submodal: Bulk Add SMTP Configurations
// -------------------------------------------------------------
interface BulkAddModalProps {
  existingProfiles: SanitizedSmtpProfile[];
  onClose: () => void;
  onAdded: (newProfiles: SanitizedSmtpProfile[]) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

interface BulkParsedEntry {
  id: string;
  lineNumber: number;
  rawLine: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  isExistingDuplicate: boolean;
  isBatchDuplicate: boolean;
}

interface BulkInvalidEntry {
  lineNumber: number;
  rawLine: string;
  error: string;
}

const SAMPLE_BULK_INPUT = `smtp.example.com|587|user1@example.com|password1
mail.example.com|465|user2@example.com|password2
relay.example.com|25|user3@example.com|password3`;

const BulkAddModal: React.FC<BulkAddModalProps> = ({
  existingProfiles,
  onClose,
  onAdded,
  onNotify,
}) => {
  const [bulkText, setBulkText] = useState('');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedRowIds, setRevealedRowIds] = useState<Set<string>>(new Set());
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Automatic parsing and validation of each line using the '|' delimiter
  const { validEntries, invalidEntries, totalProcessedLines, duplicatesCount } = React.useMemo(() => {
    if (!bulkText.trim()) {
      return { validEntries: [], invalidEntries: [], totalProcessedLines: 0, duplicatesCount: 0 };
    }

    const lines = bulkText.split(/\r?\n/);
    const valid: BulkParsedEntry[] = [];
    const invalid: BulkInvalidEntry[] = [];
    const seenBatchKeys = new Set<string>();
    let dupes = 0;
    let lineCount = 0;

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const trimmed = rawLine.trim();

      // Gracefully skip empty whitespace lines
      if (!trimmed) return;
      lineCount++;

      // Strict check: must contain exactly four fields separated by '|'
      const parts = trimmed.split('|');
      if (parts.length !== 4) {
        invalid.push({
          lineNumber: lineNum,
          rawLine: trimmed,
          error: `Expected exactly 4 fields (Host|Port|User|Pass), found ${parts.length} field${parts.length === 1 ? '' : 's'}.`,
        });
        return;
      }

      const host = parts[0].trim();
      const portStr = parts[1].trim();
      const user = parts[2].trim();
      const pass = parts[3].trim();

      if (!host) {
        invalid.push({
          lineNumber: lineNum,
          rawLine: trimmed,
          error: 'Missing Host field.',
        });
        return;
      }

      if (/\s/.test(host)) {
        invalid.push({
          lineNumber: lineNum,
          rawLine: trimmed,
          error: 'Hostname contains illegal whitespace characters.',
        });
        return;
      }

      if (!portStr) {
        invalid.push({
          lineNumber: lineNum,
          rawLine: trimmed,
          error: 'Missing Port field.',
        });
        return;
      }

      const port = parseInt(portStr, 10);
      if (isNaN(port) || port < 1 || port > 65535 || String(port) !== portStr) {
        invalid.push({
          lineNumber: lineNum,
          rawLine: trimmed,
          error: `Port must be an integer between 1 and 65535 (found: "${portStr}").`,
        });
        return;
      }

      if (!user) {
        invalid.push({
          lineNumber: lineNum,
          rawLine: trimmed,
          error: 'Missing User (username) field.',
        });
        return;
      }

      if (!pass) {
        invalid.push({
          lineNumber: lineNum,
          rawLine: trimmed,
          error: 'Missing Pass (password) field.',
        });
        return;
      }

      // Automatically determine TLS/SSL mode from port
      const security: SmtpSecurity = port === 465 ? 'ssl' : port === 25 ? 'none' : 'starttls';

      // Check duplicates within the pasted batch
      const batchKey = `${host.toLowerCase()}:${port}:${user.toLowerCase()}`;
      const isBatchDuplicate = seenBatchKeys.has(batchKey);
      seenBatchKeys.add(batchKey);

      // Check duplicates against existing saved configurations
      const isExistingDuplicate = existingProfiles.some(
        (p) =>
          p.host.trim().toLowerCase() === host.toLowerCase() &&
          p.port === port &&
          (p.username || '').trim().toLowerCase() === user.toLowerCase()
      );

      if (isBatchDuplicate || isExistingDuplicate) {
        dupes++;
      }

      const fromEmail = user.includes('@') ? user : `noreply@${host}`;

      valid.push({
        id: `entry_${lineNum}_${host}_${port}_${user}`,
        lineNumber: lineNum,
        rawLine: trimmed,
        host,
        port,
        security,
        username: user,
        password: pass,
        fromEmail,
        fromName: 'ApexMail Dispatcher',
        isExistingDuplicate,
        isBatchDuplicate,
      });
    });

    return {
      validEntries: valid,
      invalidEntries: invalid,
      totalProcessedLines: lineCount,
      duplicatesCount: dupes,
    };
  }, [bulkText, existingProfiles]);

  // Active items to save (excluding duplicates and user-discarded rows)
  const readyToSaveEntries = validEntries.filter(
    (e) => !e.isExistingDuplicate && !e.isBatchDuplicate && !discardedIds.has(e.id)
  );

  const toggleRowPassword = (id: string) => {
    setRevealedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDiscardRow = (id: string) => {
    setDiscardedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleAddAll = async () => {
    if (readyToSaveEntries.length === 0) {
      onNotify('warning', 'No New Configurations', 'No valid, non-duplicate configurations available to add.');
      return;
    }

    setSaving(true);
    try {
      const toSend: BatchAddProfileInput[] = readyToSaveEntries.map((e) => ({
        name: `${e.host}:${e.port} (${e.username})`,
        host: e.host,
        port: e.port,
        security: e.security,
        username: e.username,
        password: e.password,
        fromEmail: e.fromEmail,
        fromName: e.fromName,
      }));

      const res = await api.saveMonitorProfilesBatch(toSend);

      if (res.success) {
        let msg = `Successfully added ${res.count} authorized SMTP configuration${res.count === 1 ? '' : 's'}.`;
        if (res.duplicatesSkipped > 0) {
          msg += ` (${res.duplicatesSkipped} duplicate${res.duplicatesSkipped === 1 ? '' : 's'} skipped).`;
        }
        onNotify('success', 'Bulk Import Succeeded', msg);

        if (res.errors && res.errors.length > 0) {
          onNotify('warning', 'Partial Import Notices', res.errors.join('; '));
        }

        onAdded(res.added);
        onClose();
      }
    } catch (err: any) {
      onNotify('error', 'Failed to Import Configurations', err.message || 'An error occurred during bulk import.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Bulk Add Authorized SMTP Relays</h3>
              <p className="text-xs text-slate-400">
                Import multiple SMTP configurations at once using the pipe-delimited format
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Format Instructions Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Expected Format (one configuration per line):</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkText(SAMPLE_BULK_INPUT);
                    setDiscardedIds(new Set());
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 font-medium rounded border border-slate-700 transition-colors"
                >
                  Insert Sample Format
                </button>
                {bulkText && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkText('');
                      setDiscardedIds(new Set());
                    }}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5 font-mono text-xs text-indigo-300 flex items-center justify-between">
              <code>Host|Port|User|Pass</code>
              <span className="text-[11px] font-sans text-slate-400">465: SSL/TLS · 587: STARTTLS · 25: Plain</span>
            </div>
          </div>

          {/* Large Text Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-300">
                Paste SMTP Configurations <span className="text-slate-400 font-normal">({totalProcessedLines} lines detected)</span>
              </label>
              <span className="text-slate-400 text-[11px]">Exact delimiter: pipe (|)</span>
            </div>
            <textarea
              rows={7}
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setDiscardedIds(new Set());
              }}
              placeholder={`smtp.example.com|587|user1@example.com|password1\nmail.example.com|465|user2@example.com|password2\nrelay.example.com|25|user3@example.com|password3`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all leading-relaxed"
            />
          </div>

          {/* Validation Status & Counters Bar */}
          {bulkText.trim() && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                Total Detected: <span className="font-mono font-bold text-white">{totalProcessedLines}</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{validEntries.length} Valid Configurations</span>
              </div>
              {invalidEntries.length > 0 && (
                <div className="px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{invalidEntries.length} Invalid Lines</span>
                </div>
              )}
              {duplicatesCount > 0 && (
                <div className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{duplicatesCount} Duplicates (Will be skipped)</span>
                </div>
              )}
            </div>
          )}

          {/* Clear Error Messages for Invalid Lines */}
          {invalidEntries.length > 0 && (
            <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{invalidEntries.length} Invalid Line{invalidEntries.length === 1 ? '' : 's'} Detected — Correct them in the text area above:</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {invalidEntries.map((err, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 bg-slate-950/80 rounded-lg border border-rose-950 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-rose-900/50 text-rose-200 text-[10px] font-bold">
                        Line {err.lineNumber}
                      </span>
                      <span className="text-rose-300 font-sans">{err.error}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] truncate max-w-xs">{err.rawLine}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Entries Review Table */}
          {validEntries.length > 0 && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden space-y-0">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">
                    Review Parsed Configurations ({readyToSaveEntries.length} ready to save)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllPasswords(!showAllPasswords)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium px-2 py-1 rounded bg-slate-900 border border-slate-800 transition-colors"
                >
                  {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showAllPasswords ? 'Mask Passwords' : 'Show Passwords'}</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Host & Port</th>
                      <th className="py-2.5 px-3">Security</th>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Password</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {validEntries.map((entry) => {
                      const isDiscarded = discardedIds.has(entry.id);
                      const isRevealed = showAllPasswords || revealedRowIds.has(entry.id);
                      const isDupe = entry.isExistingDuplicate || entry.isBatchDuplicate;

                      return (
                        <tr
                          key={entry.id}
                          className={`hover:bg-slate-900/50 transition-colors ${
                            isDiscarded ? 'opacity-40 bg-slate-950' : isDupe ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-slate-400">{entry.lineNumber}</td>
                          <td className="py-2.5 px-3 text-white font-semibold">
                            {entry.host}:{entry.port}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                              {entry.port === 465 ? 'SSL/TLS' : entry.port === 587 ? 'STARTTLS' : 'Plain'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-sans truncate max-w-[140px]">
                            {entry.username}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span>{isRevealed ? entry.password : '••••••••••••'}</span>
                              <button
                                type="button"
                                onClick={() => toggleRowPassword(entry.id)}
                                title={isRevealed ? 'Hide password' : 'View password'}
                                className="text-slate-400 hover:text-slate-200"
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {isDiscarded ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-slate-800 text-slate-400">
                                Discarded
                              </span>
                            ) : entry.isExistingDuplicate ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Duplicate (Existing Relay)
                              </span>
                            ) : entry.isBatchDuplicate ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Duplicate (In Batch)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Ready to Add
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {!isDiscarded && (
                              <button
                                type="button"
                                onClick={() => handleDiscardRow(entry.id)}
                                title="Remove from batch"
                                className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Security & Credentials Storage Note */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-200 font-medium">Secure Credential Storage & Safe Import:</span>{' '}
              Credentials are encrypted and safely stored in backend memory. Relays will not be automatically tested or
              contacted during import; you can verify connections and run diagnostics whenever you choose.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {readyToSaveEntries.length > 0 ? (
              <span className="text-indigo-400 font-medium">
                {readyToSaveEntries.length} new relay{readyToSaveEntries.length === 1 ? '' : 's'} will be added to the monitor
              </span>
            ) : (
              <span>Paste authorized relays above to begin import</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddAll}
              disabled={saving || readyToSaveEntries.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving Configurations...' : `Add All (${readyToSaveEntries.length})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Component: Delete Confirmation Modal (Single & Bulk)
// -------------------------------------------------------------
interface DeleteConfirmModalProps {
  isOpen: boolean;
  mode: 'single' | 'bulk';
  profile?: SanitizedSmtpProfile;
  ids?: string[];
  allProfiles: SanitizedSmtpProfile[];
  isDeleting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  mode,
  profile,
  ids = [],
  allProfiles,
  isDeleting,
  error,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const targetProfiles =
    mode === 'single' && profile
      ? [profile]
      : allProfiles.filter((p) => ids.includes(p.id));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {mode === 'single'
                  ? 'Delete SMTP Configuration'
                  : `Delete ${targetProfiles.length} SMTP Configuration${targetProfiles.length === 1 ? '' : 's'}`}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'single'
                  ? 'Are you sure you want to delete this configuration from the monitor?'
                  : `Are you sure you want to permanently delete these ${targetProfiles.length} configurations?`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-mono">{error}</div>
          </div>
        )}

        {mode === 'single' && profile ? (
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">Configuration Name:</span>
              <span className="font-semibold text-white truncate max-w-[240px]">{profile.name}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">SMTP Host & Port:</span>
              <span className="font-mono text-indigo-300 font-medium">{profile.host}:{profile.port}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">Username:</span>
              <span className="font-mono text-slate-300">{profile.username || '(None)'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Sender Email:</span>
              <span className="text-slate-300 truncate max-w-[240px]">{profile.fromEmail}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Selected configurations to be removed:</span>
              <span className="text-rose-400 font-semibold">{targetProfiles.length} selected</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs divide-y divide-slate-800/60">
              {targetProfiles.map((p) => (
                <div key={p.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                  <div className="truncate flex-1">
                    <span className="font-medium text-white">{p.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-indigo-300">{p.host}:{p.port}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 font-mono">{p.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-amber-300/90 bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Associated diagnostic records and historical probes for the deleted configuration{targetProfiles.length === 1 ? '' : 's'} will also be cleared. The primary gateway relay is protected and will not be deleted.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting || targetProfiles.length === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-rose-900/20 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {mode === 'single'
                    ? 'Confirm Delete'
                    : `Delete (${targetProfiles.length}) Configurations`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Component: Group Test Email Modal
// -------------------------------------------------------------
interface GroupTestEmailModalProps {
  isOpen: boolean;
  targetProfiles: SanitizedSmtpProfile[];
  onClose: () => void;
  onProfileUpdated: (profile: SanitizedSmtpProfile) => void;
  onFinished: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

const GroupTestEmailModal: React.FC<GroupTestEmailModalProps> = ({
  isOpen,
  targetProfiles,
  onClose,
  onProfileUpdated,
  onFinished,
  onNotify,
}) => {
  // Phase: 'confirm' | 'running' | 'completed'
  const [phase, setPhase] = useState<'confirm' | 'running' | 'completed'>('confirm');

  // Form Fields
  const [destinationEmail, setDestinationEmail] = useState('');
  const [subject, setSubject] = useState('SMTP Test');
  const [textBody, setTextBody] = useState('Test message');
  const [concurrency, setConcurrency] = useState(2);
  const [timeoutSeconds, setTimeoutSeconds] = useState(10);
  const [rateLimitMs, setRateLimitMs] = useState(500);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Execution State
  const [results, setResults] = useState<GroupTestEmailItemResult[]>([]);
  const [activeWorkers, setActiveWorkers] = useState(0);
  const stoppedRef = React.useRef(false);

  if (!isOpen) return null;

  // Counters
  const totalCount = results.length || targetProfiles.length;
  const completedCount = results.filter(
    (r) => r.status !== 'Pending' && r.status !== 'Sending'
  ).length;
  const acceptedCount = results.filter((r) => r.status === 'Email Accepted').length;
  const failedCount = results.filter((r) =>
    ['Authentication Failed', 'Connection Failed', 'Timeout', 'Email Sending Failed'].includes(r.status)
  ).length;
  const remainingCount = results.filter(
    (r) => r.status === 'Pending' || r.status === 'Sending'
  ).length;

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Start Test
  const handleStartTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedRecipient = destinationEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedRecipient || !emailRegex.test(trimmedRecipient)) {
      setEmailError('Please enter a valid destination recipient email address.');
      return;
    }
    setEmailError(null);

    // Initialize results array
    const initial: GroupTestEmailItemResult[] = targetProfiles.map((p) => ({
      profileId: p.id,
      name: p.name,
      host: p.host,
      port: p.port,
      security: p.security,
      username: p.username,
      fromEmail: p.fromEmail,
      status: 'Pending',
    }));

    setResults(initial);
    setPhase('running');
    stoppedRef.current = false;

    let currentIndex = 0;
    const workerCount = Math.min(concurrency, targetProfiles.length);
    setActiveWorkers(workerCount);

    const runWorker = async () => {
      while (currentIndex < targetProfiles.length && !stoppedRef.current) {
        const idx = currentIndex++;
        const target = targetProfiles[idx];
        if (!target || stoppedRef.current) break;

        // Mark as Sending
        setResults((prev) =>
          prev.map((item, i) => (i === idx ? { ...item, status: 'Sending' } : item))
        );

        // Optional inter-dispatch delay
        if (rateLimitMs > 0 && idx > 0) {
          await new Promise((r) => setTimeout(r, rateLimitMs));
        }
        if (stoppedRef.current) break;

        const startTime = Date.now();
        try {
          const res = await api.sendTestMonitorProfile(target.id, {
            destinationEmail: trimmedRecipient,
            subject: subject.trim() || 'SMTP Test',
            textBody: textBody.trim() || 'Test message',
            timeoutMs: timeoutSeconds * 1000,
          });

          const latencyMs = res.responseTimeMs ?? (Date.now() - startTime);
          const finalStatus: MonitorTestEmailStatus =
            res.status || (res.success ? 'Email Accepted' : 'Email Sending Failed');

          setResults((prev) =>
            prev.map((item, i) =>
              i === idx
                ? {
                    ...item,
                    status: finalStatus,
                    responseTimeMs: latencyMs,
                    messageId: res.result?.messageId,
                    response: res.result?.response || res.result?.smtpResponse,
                    error: res.error || (!res.success ? res.result?.message : undefined),
                    code: res.result?.code,
                    timestamp: new Date().toISOString(),
                  }
                : item
            )
          );

          if (res.profile) {
            onProfileUpdated(res.profile);
          }
        } catch (err: any) {
          const latencyMs = Date.now() - startTime;
          const finalStatus: MonitorTestEmailStatus =
            err.code === 'EAUTH'
              ? 'Authentication Failed'
              : err.code === 'ETIMEDOUT'
              ? 'Timeout'
              : err.code === 'ECONNREFUSED' || err.code === 'ESOCKET' || err.code === 'ENOTFOUND'
              ? 'Connection Failed'
              : 'Email Sending Failed';

          setResults((prev) =>
            prev.map((item, i) =>
              i === idx
                ? {
                    ...item,
                    status: finalStatus,
                    responseTimeMs: latencyMs,
                    error: err.message || 'Transmission failed',
                    code: err.code,
                    timestamp: new Date().toISOString(),
                  }
                : item
            )
          );
        }
      }
    };

    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);

    setActiveWorkers(0);
    setPhase('completed');
    onFinished();

    if (!stoppedRef.current) {
      onNotify('info', 'Group SMTP Test Finished', 'All scheduled test emails have been processed.');
    }
  };

  // Stop pending tests
  const handleStop = () => {
    stoppedRef.current = true;
    setActiveWorkers(0);
    setPhase('completed');
    onNotify('warning', 'Group Test Stopped', 'Pending test email dispatches have been stopped.');
  };

  // Export Sanitized CSV
  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Profile Name',
      'Host',
      'Port',
      'Security',
      'Username',
      'Sender Email',
      'Recipient Email',
      'Subject',
      'Status',
      'Response Time (ms)',
      'Error Code',
      'Error Details',
      'Message ID',
      'Server Response',
    ];

    const rows = results.map((r) => [
      `"${r.timestamp || new Date().toISOString()}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.host}"`,
      r.port,
      `"${r.security}"`,
      `"${(r.username || '').replace(/"/g, '""')}"`,
      `"${(r.fromEmail || '').replace(/"/g, '""')}"`,
      `"${destinationEmail.replace(/"/g, '""')}"`,
      `"${subject.replace(/"/g, '""')}"`,
      `"${r.status}"`,
      r.responseTimeMs !== undefined ? r.responseTimeMs : '',
      `"${(r.code || '').replace(/"/g, '""')}"`,
      `"${(r.error || '').replace(/"/g, '""')}"`,
      `"${(r.messageId || '').replace(/"/g, '""')}"`,
      `"${(r.response || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `group_smtp_test_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Render Status Badge
  const renderTestStatusBadge = (status: MonitorTestEmailStatus) => {
    switch (status) {
      case 'Email Accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" />
            <span>Email Accepted</span>
          </span>
        );
      case 'Sending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Sending...</span>
          </span>
        );
      case 'Authentication Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
            <Lock className="w-3 h-3" />
            <span>Auth Failed</span>
          </span>
        );
      case 'Connection Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3" />
            <span>Connection Failed</span>
          </span>
        );
      case 'Timeout':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 whitespace-nowrap">
            <Clock className="w-3 h-3" />
            <span>Timeout</span>
          </span>
        );
      case 'Email Sending Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
            <XCircle className="w-3 h-3" />
            <span>Sending Failed</span>
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Send Test Email by Group
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {targetProfiles.length} Relay{targetProfiles.length === 1 ? '' : 's'} Selected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Execute real outbound test email deliveries across authorized SMTP configurations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={phase === 'running'}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Phase 1: Configuration Form */}
          {phase === 'confirm' && (
            <form onSubmit={handleStartTest} className="space-y-5">
              {/* Recipient Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Test Destination Recipient Email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={destinationEmail}
                  onChange={(e) => {
                    setDestinationEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="e.g. administrator@yourdomain.com"
                  className={`w-full bg-slate-950 border ${
                    emailError ? 'border-rose-500' : 'border-slate-800'
                  } rounded-lg px-3.5 py-2 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500`}
                />
                {emailError ? (
                  <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{emailError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Send only to an authorized recipient address under your administrative control.
                  </p>
                )}
              </div>

              {/* Subject & Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-200">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="SMTP Test"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Default: SMTP Test</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-200">
                    Email Body Content
                  </label>
                  <textarea
                    rows={2}
                    value={textBody}
                    onChange={(e) => setTextBody(e.target.value)}
                    placeholder="Test message"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                  <p className="text-[11px] text-slate-500">Default: Test message</p>
                </div>
              </div>

              {/* Rate Limit, Concurrency & Timeout Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Concurrency Limit
                  </label>
                  <select
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value={1}>1 connection (Sequential)</option>
                    <option value={2}>2 simultaneous (Recommended)</option>
                    <option value={3}>3 simultaneous</option>
                    <option value={5}>5 simultaneous</option>
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Prevents target server overload
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Connection Timeout
                  </label>
                  <select
                    value={timeoutSeconds}
                    onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds (Standard)</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Socket & TLS handshake limit
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Inter-dispatch Delay
                  </label>
                  <select
                    value={rateLimitMs}
                    onChange={(e) => setRateLimitMs(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value={0}>0 ms (No delay)</option>
                    <option value={250}>250 ms</option>
                    <option value={500}>500 ms (Recommended)</option>
                    <option value={1000}>1000 ms (1s)</option>
                    <option value={2000}>2000 ms (2s)</option>
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Gentle pace for strict relays
                  </span>
                </div>
              </div>

              {/* Selected Relays Preview Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Authorized SMTP configurations to be tested:</span>
                  <span className="text-indigo-400 font-semibold">{targetProfiles.length} total</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs divide-y divide-slate-800/60 font-mono">
                  {targetProfiles.map((p) => (
                    <div key={p.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                      <div className="truncate flex-1 font-sans">
                        <span className="font-semibold text-white">{p.name}</span>
                        <span className="ml-2 font-mono text-[11px] text-indigo-300">
                          {p.host}:{p.port}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 shrink-0">
                        Sender: <span className="text-slate-300">{p.fromEmail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informational Policy Notice */}
              <div className="text-xs text-amber-300/90 bg-amber-950/20 border border-amber-900/40 rounded-xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <div>
                    <span className="font-semibold text-amber-300">Technical Note:</span> SMTP connection verification and test email transmission are monitored separately. Relay acceptance confirms receipt by the configured SMTP server and does not constitute proof of inbox delivery or bypass of recipient spam filters.
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Credentials are stored securely and passwords are never exposed in logs, interfaces, or exports.
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Phase 2 & 3: Live Progress & Results Monitor */}
          {(phase === 'running' || phase === 'completed') && (
            <div className="space-y-5">
              {/* Summary KPI Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</span>
                  <div className="text-xl font-bold text-white font-mono mt-0.5">{totalCount}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Completed</span>
                  <div className="text-xl font-bold text-indigo-300 font-mono mt-0.5">{completedCount}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Accepted</span>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{acceptedCount}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Failed</span>
                  <div className="text-xl font-bold text-rose-400 font-mono mt-0.5">{failedCount}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Remaining</span>
                  <div className="text-xl font-bold text-amber-300 font-mono mt-0.5">{remainingCount}</div>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    {phase === 'running' ? (
                      <span className="flex items-center gap-1.5 text-indigo-400">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Transmitting test emails ({activeWorkers} active connections)...</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Test sequence complete</span>
                    )}
                  </span>
                  <span className="font-mono text-slate-300 font-semibold">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      failedCount > 0 ? 'bg-gradient-to-r from-emerald-500 to-indigo-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Recipient & Subject Info Bar */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-slate-300">
                  <span className="text-slate-500">To:</span>
                  <span className="font-semibold text-white">{destinationEmail}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500 font-sans">Subject:</span>
                  <span className="text-slate-300 font-sans">{subject}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Concurrency: {concurrency} · Timeout: {timeoutSeconds}s · Delay: {rateLimitMs}ms
                </div>
              </div>

              {/* Individual Live Results Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Relay Endpoint</th>
                        <th className="py-2.5 px-3">Username</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Latency</th>
                        <th className="py-2.5 px-4">Response / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {results.map((res) => (
                        <tr
                          key={res.profileId}
                          className={`hover:bg-slate-900/50 transition-colors ${
                            res.status === 'Sending' ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="font-sans font-semibold text-white truncate max-w-[180px]">
                              {res.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {res.host}:{res.port} ({res.security})
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-300 font-sans truncate max-w-[140px]">
                            {res.username || '—'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {renderTestStatusBadge(res.status)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-right text-slate-300 font-mono">
                            {res.responseTimeMs !== undefined ? `${res.responseTimeMs} ms` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-sans">
                            {res.status === 'Email Accepted' ? (
                              <div className="text-emerald-400 font-mono text-[11px] truncate max-w-xs">
                                {res.messageId ? `ID: ${res.messageId}` : res.response || '250 OK Message Accepted'}
                              </div>
                            ) : res.error ? (
                              <div className="text-rose-400 font-mono text-[11px] truncate max-w-xs">
                                {res.code ? `[${res.code}] ` : ''}
                                {res.error}
                              </div>
                            ) : res.status === 'Sending' ? (
                              <span className="text-indigo-400 text-[11px]">Connecting to mail relay...</span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Waiting in dispatch queue...</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div>
            {phase === 'confirm' ? (
              <span className="text-xs text-slate-400">
                Ready to test {targetProfiles.length} configuration{targetProfiles.length === 1 ? '' : 's'}
              </span>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>
                  {phase === 'running' ? 'Test sequence in progress' : 'Testing completed'}
                </span>
                {phase === 'completed' && (
                  <span className="font-semibold text-emerald-400 font-mono">
                    ({acceptedCount}/{totalCount} Accepted)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {phase === 'confirm' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartTest}
                  disabled={!destinationEmail.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm shadow-emerald-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Start Test ({targetProfiles.length})</span>
                </button>
              </>
            )}

            {phase === 'running' && (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm shadow-rose-900/30 transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop Testing</span>
              </button>
            )}

            {phase === 'completed' && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Export Results CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('confirm')}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                >
                  Configure New Test
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

