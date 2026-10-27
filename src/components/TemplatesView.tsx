import React, { useState, useEffect } from 'react';
import { FileCode, Eye, Send, Monitor, Smartphone, Layers } from 'lucide-react';
import { EmailTemplate } from '../types';
import { api } from '../api/client';

interface TemplatesViewProps {
  onSelectTemplate: (template: EmailTemplate) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  onSelectTemplate,
  onNotify,
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      onNotify('error', 'Failed to load templates', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Responsive Email Templates</h2>
          <p className="text-xs text-slate-400 mt-1">
            Pre-tested responsive layouts with inline CSS, table architectures, and mobile optimizations
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col overflow-hidden"
          >
            {/* Card Header */}
            <div className="p-5 flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 font-mono">
                  {tmpl.category}
                </span>
                <span className="text-xs text-slate-500 font-mono">HTML5 / Tables</span>
              </div>
              <h3 className="text-base font-bold text-slate-100">{tmpl.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{tmpl.description}</p>
              <div className="pt-2 text-xs text-slate-400 font-mono truncate">
                Subject: <span className="text-slate-300 font-sans">{tmpl.subject}</span>
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
              <button
                onClick={() => setPreviewTemplate(tmpl)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live Preview</span>
              </button>

              <button
                onClick={() => onSelectTemplate(tmpl)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Use In Composer</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full p-6 space-y-4 shadow-2xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-100">{previewTemplate.name}</h3>
                <span className="text-xs text-slate-400">· {previewTemplate.category}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                  <button
                    onClick={() => setDeviceMode('desktop')}
                    className={`p-1.5 rounded transition-colors ${
                      deviceMode === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Desktop Preview"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeviceMode('mobile')}
                    className={`p-1.5 rounded transition-colors ${
                      deviceMode === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Mobile Preview (375px)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-slate-400 hover:text-slate-200 text-sm ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sandboxed Iframe */}
            <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto rounded-lg">
              <div
                className={`h-full transition-all duration-200 bg-white rounded-lg shadow-xl overflow-hidden ${
                  deviceMode === 'mobile' ? 'w-[375px]' : 'w-full max-w-[650px]'
                }`}
              >
                <iframe
                  title="Template Preview"
                  sandbox="allow-same-origin"
                  srcDoc={previewTemplate.htmlContent}
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onSelectTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
              >
                Load This Template into Composer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
