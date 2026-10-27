import React from 'react';
import {
  LayoutDashboard,
  Server,
  Activity,
  PenSquare,
  Users,
  Send,
  FileCode,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { NavTab, SanitizedSmtpConfig } from '../types';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  smtpConfig: SanitizedSmtpConfig | null;
  activeSendingCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  smtpConfig,
  activeSendingCount,
}) => {
  const navItems: Array<{ id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'smtp', label: 'SMTP Settings', icon: Server },
    { id: 'monitor', label: 'SMTP Monitor', icon: Activity },
    { id: 'composer', label: 'Email Composer', icon: PenSquare },
    { id: 'recipients', label: 'Recipients & Lists', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Send, badge: activeSendingCount },
    { id: 'templates', label: 'Email Templates', icon: FileCode },
    { id: 'logs', label: 'Sending Logs', icon: ScrollText },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 min-h-screen">
      {/* Brand Zone */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-500/20">
          A
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight text-white">ApexMail</span>
          <span className="text-[11px] text-slate-400 font-medium">Enterprise SMTP Relay</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Server Status Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-200 truncate">
              {smtpConfig?.host || 'out.postassl.it'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
              <span>Port {smtpConfig?.port || '465'}</span>
              <span aria-hidden="true">·</span>
              <span className="uppercase">{smtpConfig?.security || 'SSL'}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
