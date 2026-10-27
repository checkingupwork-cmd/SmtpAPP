import React from 'react';
import { PenSquare, Server, AlertCircle } from 'lucide-react';
import { NavTab, SanitizedSmtpConfig } from '../types';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  smtpConfig: SanitizedSmtpConfig | null;
  onOpenTestModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  smtpConfig,
  onOpenTestModal,
}) => {
  const tabTitles: Record<NavTab, string> = {
    dashboard: 'System Overview & Telemetry',
    smtp: 'SMTP Server & Gateway Settings',
    monitor: 'SMTP Connection Monitor & Diagnostics',
    composer: 'Email Composer & Template Engine',
    recipients: 'Recipient Management & Opt-In Validation',
    campaigns: 'Dispatch Campaigns & Real-Time Queue',
    templates: 'Responsive Email Templates Library',
    logs: 'Outbound Delivery Event Audit Logs',
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between gap-8 shrink-0 sticky top-0 z-20">
      {/* Zone 1: Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400 font-medium">ApexMail</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-100 font-semibold">{tabTitles[currentTab]}</span>
      </div>

      {/* Zone 2: Subtle Status indicator */}
      <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-300">{smtpConfig?.host || 'out.postassl.it'}:{smtpConfig?.port || 465}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="uppercase text-indigo-400">{smtpConfig?.security || 'SSL'}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">{smtpConfig?.fromEmail}</span>
        </div>
      </div>

      {/* Zone 3: Quick Action buttons */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenTestModal}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Server className="w-3.5 h-3.5 text-indigo-400" />
          <span>Send Test Email</span>
        </button>

        {currentTab !== 'composer' && (
          <button
            onClick={() => onSelectTab('composer')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors whitespace-nowrap shrink-0"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>Compose Email</span>
          </button>
        )}
      </div>
    </header>
  );
};
