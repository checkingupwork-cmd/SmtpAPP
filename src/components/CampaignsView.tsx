import React, { useState, useEffect } from 'react';
import {
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  Copy,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Campaign, CampaignStatus } from '../types';
import { api } from '../api/client';

interface CampaignsViewProps {
  onSelectCampaignForComposer?: (campaign: Campaign) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  targetCampaignId?: string | null;
  onClearTargetCampaignId?: () => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  onSelectCampaignForComposer,
  onNotify,
  targetCampaignId,
  onClearTargetCampaignId,
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected campaign for detail modal
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  // If navigated here with a specific campaign target from dashboard
  useEffect(() => {
    if (targetCampaignId) {
      handleOpenDetail(targetCampaignId);
      if (onClearTargetCampaignId) onClearTargetCampaignId();
    }
  }, [targetCampaignId]);

  // Polling for active sending campaigns
  useEffect(() => {
    const hasActive = campaigns.some((c) => c.status === 'sending' || c.status === 'queued');
    const isModalActive = selectedCampaign && (selectedCampaign.status === 'sending' || selectedCampaign.status === 'queued');

    if (!hasActive && !isModalActive) return;

    const interval = setInterval(() => {
      loadCampaigns(true);
      if (selectedCampaign) {
        api.getCampaign(selectedCampaign.id).then((fresh) => {
          setSelectedCampaign(fresh);
        }).catch(() => {});
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [campaigns, selectedCampaign]);

  const loadCampaigns = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await api.getCampaigns();
      setCampaigns(list);
    } catch (err: any) {
      if (!silent) onNotify('error', 'Failed to load campaigns', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenDetail = async (id: string) => {
    setModalLoading(true);
    try {
      const data = await api.getCampaign(id);
      setSelectedCampaign(data);
    } catch (err: any) {
      onNotify('error', 'Failed to load campaign detail', err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleStartCampaign = async (id: string) => {
    try {
      await api.startCampaign(id);
      onNotify('success', 'Dispatch Resumed', 'Queue worker active.');
      loadCampaigns(true);
      if (selectedCampaign && selectedCampaign.id === id) {
        const fresh = await api.getCampaign(id);
        setSelectedCampaign(fresh);
      }
    } catch (err: any) {
      onNotify('error', 'Failed to start dispatch', err.message);
    }
  };

  const handleCancelCampaign = async (id: string) => {
    try {
      await api.cancelCampaign(id);
      onNotify('info', 'Cancellation Dispatched', 'Pending messages cancelled.');
      loadCampaigns(true);
      if (selectedCampaign && selectedCampaign.id === id) {
        const fresh = await api.getCampaign(id);
        setSelectedCampaign(fresh);
      }
    } catch (err: any) {
      onNotify('error', 'Failed to cancel', err.message);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign record?')) return;
    try {
      await api.deleteCampaign(id);
      setCampaigns(campaigns.filter((c) => c.id !== id));
      if (selectedCampaign?.id === id) setSelectedCampaign(null);
      onNotify('info', 'Campaign Deleted', 'Record removed.');
    } catch (err: any) {
      onNotify('error', 'Failed to delete', err.message);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Campaign Dispatch Manager</h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor real-time progress, inspect delivery logs, manage pending queues, and control concurrency
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadCampaigns()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filter Segmented Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
          {(['all', 'sending', 'completed', 'queued', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                statusFilter === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Cards List */}
      <div className="space-y-4">
        {filteredCampaigns.length > 0 ? (
          filteredCampaigns.map((c) => {
            const total = c.stats.total || 1;
            const progressPct = Math.round(((c.stats.accepted + c.stats.failed + c.stats.cancelled) / total) * 100);

            return (
              <div
                key={c.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col gap-4"
              >
                {/* Top Row: Title, Status, and Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-100">{c.name}</h3>
                      <span className="text-xs text-slate-400 font-medium capitalize">
                        · {c.status}
                      </span>
                      {c.isSimulated && (
                        <span className="text-[11px] text-amber-400 font-medium">· Sandbox</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Subject: <strong className="text-slate-300 font-normal">{c.subject}</strong>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {c.status === 'sending' && (
                      <button
                        onClick={() => handleCancelCampaign(c.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Cancel Pending</span>
                      </button>
                    )}

                    {(c.status === 'draft' || c.status === 'cancelled') && (
                      <button
                        onClick={() => handleStartCampaign(c.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume Dispatch</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenDetail(c.id)}
                      className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                      <span>Inspect Progress</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteCampaign(c.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded transition-colors"
                      title="Delete campaign"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>Progress: {progressPct}% ({c.stats.accepted + c.stats.failed} / {c.stats.total})</span>
                    <span>Rate: {c.rateLimitPerSec || 5} msgs/sec</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        c.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Breakdown Strip */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <div className="flex items-center gap-4 font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{c.stats.accepted} Relay Accepted</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{c.stats.failed} Rejected</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{c.stats.pending} In Queue</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    Created {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            No campaigns matching the selected criteria.
          </div>
        )}
      </div>

      {/* Campaign Detail Modal with Live Progress & Recipient Log */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>Campaign Telemetry: {selectedCampaign.name}</span>
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>ID: {selectedCampaign.id}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{selectedCampaign.status}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Live Progress Bar in Modal */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Dispatcher State: <span className="uppercase text-indigo-400 font-mono">{selectedCampaign.status}</span>
                </span>
                <span className="font-mono text-slate-300">
                  {selectedCampaign.stats.accepted + selectedCampaign.stats.failed} / {selectedCampaign.stats.total} processed
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      ((selectedCampaign.stats.accepted + selectedCampaign.stats.failed + selectedCampaign.stats.cancelled) /
                        (selectedCampaign.stats.total || 1)) *
                        100
                    )}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1 font-mono">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Total</div>
                  <div className="text-sm font-bold text-white">{selectedCampaign.stats.total}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-emerald-400">Accepted</div>
                  <div className="text-sm font-bold text-emerald-400">{selectedCampaign.stats.accepted}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-rose-400">Failed</div>
                  <div className="text-sm font-bold text-rose-400">{selectedCampaign.stats.failed}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-amber-400">Pending</div>
                  <div className="text-sm font-bold text-amber-400">{selectedCampaign.stats.pending}</div>
                </div>
              </div>
            </div>

            {/* Recipient Details Table */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-[250px]">
              <div className="flex items-center justify-between pb-2 text-xs font-semibold text-slate-300">
                <span>Individual Envelopes & Relay Responses</span>
                <span className="text-slate-500 font-normal">Separate individual deliveries</span>
              </div>

              <div className="overflow-y-auto flex-1 border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Recipient Address</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium">Attempts</th>
                      <th className="py-2.5 px-3 font-medium">Relay Message ID / Diagnostics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {selectedCampaign.recipients.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-200">
                          {r.name ? `${r.name} <${r.email}>` : r.email}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.status === 'accepted' && <span className="text-emerald-400">Relay Accepted</span>}
                          {r.status === 'failed' && <span className="text-rose-400">Failed / Rejected</span>}
                          {r.status === 'pending' && <span className="text-amber-400">Pending</span>}
                          {r.status === 'cancelled' && <span className="text-slate-400">Cancelled</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{r.attempts}</td>
                        <td className="py-2.5 px-3 text-slate-400 truncate max-w-[280px]">
                          {r.error ? (
                            <span className="text-rose-400">{r.error}</span>
                          ) : r.messageId ? (
                            <span className="text-slate-300 font-mono text-[11px]">{r.messageId}</span>
                          ) : (
                            'Waiting in dispatch batch...'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500">
                Rate Limit: {selectedCampaign.rateLimitPerSec} msgs/sec · Batch Size: {selectedCampaign.batchSize}
              </div>

              <div className="flex items-center gap-2">
                {selectedCampaign.status === 'sending' && (
                  <button
                    onClick={() => handleCancelCampaign(selectedCampaign.id)}
                    className="px-3.5 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
                  >
                    Cancel Remaining
                  </button>
                )}
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
