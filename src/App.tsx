import React, { useState, useEffect } from 'react';
import { NavTab, SanitizedSmtpConfig, DashboardStats, EmailTemplate, Campaign } from './types';
import { api } from './api/client';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { DashboardView } from './components/DashboardView';
import { SmtpSettingsView } from './components/SmtpSettingsView';
import { EmailComposerView } from './components/EmailComposerView';
import { RecipientsView } from './components/RecipientsView';
import { CampaignsView } from './components/CampaignsView';
import { TemplatesView } from './components/TemplatesView';
import { SendingLogsView } from './components/SendingLogsView';
import { SendTestEmailModal } from './components/SendTestEmailModal';
import { SmtpMonitorView } from './components/SmtpMonitorView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [smtpConfig, setSmtpConfig] = useState<SanitizedSmtpConfig | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Cross-tab data sharing
  const [composerRecipients, setComposerRecipients] = useState<string[]>([]);
  const [composerTemplate, setComposerTemplate] = useState<EmailTemplate | null>(null);
  const [targetCampaignId, setTargetCampaignId] = useState<string | null>(null);

  // Modals & Toasts
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initial load
  useEffect(() => {
    loadSmtpConfig();
    loadDashboardStats();

    // Periodic stats polling
    const timer = setInterval(() => {
      loadDashboardStats(true);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const addToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadSmtpConfig = async () => {
    try {
      const cfg = await api.getSmtpConfig();
      setSmtpConfig(cfg);
    } catch (err: any) {
      console.error('Failed to load SMTP config:', err);
    }
  };

  const loadDashboardStats = async (silent = false) => {
    if (!silent) setLoadingStats(true);
    try {
      const stats = await api.getDashboardStats();
      setDashboardStats(stats);
    } catch (err: any) {
      if (!silent) console.error('Failed to load stats:', err);
    } finally {
      if (!silent) setLoadingStats(false);
    }
  };

  // Workflow Handlers
  const handleSendToComposerFromRecipients = (recipients: string[]) => {
    setComposerRecipients(recipients);
    setCurrentTab('composer');
  };

  const handleSelectTemplateForComposer = (template: EmailTemplate) => {
    setComposerTemplate(template);
    setCurrentTab('composer');
  };

  const handleViewCampaignFromDashboard = (id: string) => {
    setTargetCampaignId(id);
    setCurrentTab('campaigns');
  };

  const handleSendCampaign = async (data: {
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
  }) => {
    try {
      const created = await api.createCampaign({
        ...data,
        autoStart: true,
      });
      addToast(
        'success',
        'Campaign Dispatched',
        `Queued ${data.recipients.length} messages for "${created.name}".`
      );
      loadDashboardStats(true);
      setTargetCampaignId(created.id);
      setCurrentTab('campaigns');
    } catch (err: any) {
      addToast('error', 'Campaign Failed', err.message);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        smtpConfig={smtpConfig}
        activeSendingCount={dashboardStats?.activeCampaignsCount || 0}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          smtpConfig={smtpConfig}
          onOpenTestModal={() => setIsTestModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                stats={dashboardStats}
                loading={loadingStats}
                onRefresh={() => loadDashboardStats()}
                onSelectTab={setCurrentTab}
                onViewCampaign={handleViewCampaignFromDashboard}
              />
            )}

            {currentTab === 'smtp' && (
              <SmtpSettingsView
                currentConfig={smtpConfig}
                onConfigSaved={(updated) => setSmtpConfig(updated)}
                onNotify={addToast}
                onOpenSendTestModal={() => setIsTestModalOpen(true)}
              />
            )}

            {currentTab === 'monitor' && (
              <SmtpMonitorView
                onNotify={addToast}
                onOpenSettings={() => setCurrentTab('smtp')}
              />
            )}

            {currentTab === 'composer' && (
              <EmailComposerView
                smtpConfig={smtpConfig}
                onSendCampaign={handleSendCampaign}
                onNotify={addToast}
                initialRecipients={composerRecipients}
                initialTemplate={composerTemplate}
              />
            )}

            {currentTab === 'recipients' && (
              <RecipientsView
                onSendToComposer={handleSendToComposerFromRecipients}
                onNotify={addToast}
              />
            )}

            {currentTab === 'campaigns' && (
              <CampaignsView
                onNotify={addToast}
                targetCampaignId={targetCampaignId}
                onClearTargetCampaignId={() => setTargetCampaignId(null)}
              />
            )}

            {currentTab === 'templates' && (
              <TemplatesView
                onSelectTemplate={handleSelectTemplateForComposer}
                onNotify={addToast}
              />
            )}

            {currentTab === 'logs' && (
              <SendingLogsView onNotify={addToast} />
            )}
          </div>
        </main>
      </div>

      {/* Modals and Toasts */}
      <SendTestEmailModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        smtpConfig={smtpConfig}
        onNotify={addToast}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
