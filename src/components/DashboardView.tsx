import React from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Send,
  Server,
  PenSquare,
  ShieldCheck,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { DashboardStats, NavTab } from '../types';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
  onSelectTab: (tab: NavTab) => void;
  onViewCampaign: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  onRefresh,
  onSelectTab,
  onViewCampaign,
}) => {
  const total = stats?.totalRecipients || 0;
  const accepted = stats?.accepted || 0;
  const failed = stats?.failed || 0;
  const pending = stats?.pending || 0;

  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Delivery Operations Console</h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Verified SMTP Relay Active</span>
            <span aria-hidden="true">·</span>
            <span>Cryptographic TLS Dispatch</span>
            <span aria-hidden="true">·</span>
            <span>Rate Limited Queue Daemon</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
          <button
            onClick={() => onSelectTab('composer')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors whitespace-nowrap"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>New Dispatch</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recipients */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Processed</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
              {total.toLocaleString()}
            </span>
            <div className="mt-1 text-xs text-slate-400">Recipients queued across all jobs</div>
          </div>
        </div>

        {/* SMTP Accepted */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">SMTP Relay Accepted</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-emerald-400 font-mono tabular-nums">
              {accepted.toLocaleString()}
            </span>
            <div className="mt-1 text-xs text-slate-400">
              {acceptanceRate}% handoff rate to upstream MTA
            </div>
          </div>
        </div>

        {/* Failed Submissions */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rejected / Failed</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-rose-400 font-mono tabular-nums">
              {failed.toLocaleString()}
            </span>
            <div className="mt-1 text-xs text-slate-400">Bounced or suppressed recipients</div>
          </div>
        </div>

        {/* Pending Queue */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending In Queue</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-amber-400 font-mono tabular-nums">
              {pending.toLocaleString()}
            </span>
            <div className="mt-1 text-xs text-slate-400">Awaiting scheduled batch release</div>
          </div>
        </div>
      </div>

      {/* Distinction Callout Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-300">
        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-200">Strict SMTP Handoff Accounting:</span>
          <p className="text-slate-400 leading-relaxed">
            ApexMail accurately reports SMTP server acceptance (250 OK relay queuing). We strictly distinguish upstream transport acceptance from downstream inbox placement, preventing misleading deliverability claims.
          </p>
        </div>
      </div>

      {/* Grid: Recent Campaigns & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Campaigns (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Recent Campaigns</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest dispatch jobs and their execution states</p>
            </div>
            <button
              onClick={() => onSelectTab('campaigns')}
              className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                  <th className="pb-3 font-medium">Campaign</th>
                  <th className="pb-3 font-medium text-right">Recipients</th>
                  <th className="pb-3 font-medium text-right">Accepted</th>
                  <th className="pb-3 font-medium text-right">Failed</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats?.recentCampaigns && stats.recentCampaigns.length > 0 ? (
                  stats.recentCampaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pr-2">
                        <div className="font-medium text-slate-200 truncate max-w-[200px]">{c.name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{c.subject}</div>
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-300">
                        {c.recipientCount}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-emerald-400">
                        {c.accepted}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-rose-400">
                        {c.failed}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-xs font-medium capitalize text-slate-300">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <button
                          onClick={() => onViewCampaign(c.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                      No campaigns dispatched yet. Click "New Dispatch" to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations & Tools (1 col) */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Quick Operations</h3>
            <p className="text-xs text-slate-400 mt-0.5">Core workflow gateways</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => onSelectTab('composer')}
              className="w-full text-left p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors group flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-500/20">
                <PenSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200 group-hover:text-indigo-300">Compose HTML Message</div>
                <div className="text-xs text-slate-400 mt-0.5">Raw code editor with live sandboxed mobile/desktop preview</div>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('recipients')}
              className="w-full text-left p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors group flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-500/20">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200 group-hover:text-emerald-300">Import CSV Recipients</div>
                <div className="text-xs text-slate-400 mt-0.5">Parse, deduplicate, validate RFC syntax, and check suppression</div>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('smtp')}
              className="w-full text-left p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors group flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500/20">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200 group-hover:text-blue-300">SMTP Gateway Config</div>
                <div className="text-xs text-slate-400 mt-0.5">Inspect port, SSL/STARTTLS mode, and test authentication probe</div>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('monitor')}
              className="w-full text-left p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors group flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500/20">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200 group-hover:text-amber-300">SMTP Connection Monitor</div>
                <div className="text-xs text-slate-400 mt-0.5">Live connectivity checks, TLS handshakes, and diagnostic probes</div>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Suppression entries:</span>
              <span className="font-mono tabular-nums text-slate-200 font-semibold">{stats?.suppressionCount || 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
              <span>Total campaigns registered:</span>
              <span className="font-mono tabular-nums text-slate-200 font-semibold">{stats?.totalCampaignsCount || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
