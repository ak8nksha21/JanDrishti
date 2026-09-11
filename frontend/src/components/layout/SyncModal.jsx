import React, { useState } from 'react';
import { RefreshCw, X, AlertTriangle, CheckCircle2, Database, Shield } from 'lucide-react';
import { triggerSync } from '../../services/sync';

export default function SyncModal({
  isOpen,
  onClose,
  onSyncComplete = () => {},
}) {
  const [constituency, setConstituency] = useState('');
  const [state, setState] = useState('');
  const [maxPages, setMaxPages] = useState(5);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleStartSync = async (e) => {
    e.preventDefault();
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const options = {
        max_pages: Number(maxPages) || 5,
      };
      if (constituency.trim()) options.constituency = constituency.trim();
      if (state.trim()) options.state = state.trim();

      const response = await triggerSync(options);
      setResult(response);
      onSyncComplete(response);
    } catch (err) {
      console.error('Synchronization failed:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Unable to contact the ingestion service. Please ensure the backend is active.';
      setError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleResetAndClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#44312A]/60 backdrop-blur-xs transition-opacity"
        onClick={!syncing ? handleResetAndClose : undefined}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white border border-[#D8CBB6] rounded-2xl shadow-2xl overflow-hidden z-10">
        {/* Header */}
        <div className="p-5 border-b border-[#D8CBB6] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#E7DDCA] border border-[#D8CBB6] text-[#44312A] flex items-center justify-center">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#44312A] uppercase tracking-wide">
                MPLADS Data Synchronization
              </h3>
              <p className="text-xs text-[#504F47]">
                Trigger official feed ingestion & PostgreSQL update
              </p>
            </div>
          </div>
          {!syncing && (
            <button
              onClick={handleResetAndClose}
              className="p-1 text-[#504F47] hover:text-[#44312A] rounded-lg hover:bg-[#E7DDCA]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {!result && !error && (
            <form onSubmit={handleStartSync} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#F4EFE6] border border-[#D8CBB6] text-xs text-[#44312A] flex items-start gap-2.5 leading-relaxed">
                <Shield className="h-4 w-4 shrink-0 text-[#44312A] mt-0.5" />
                <div>
                  This triggers the real <code className="font-mono text-[#44312A] bg-white px-1 py-0.5 rounded border border-[#D8CBB6]">POST /api/sync</code> endpoint.
                  Records are processed through validation and PII sanitization before idempotent database storage.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44312A] mb-1">
                  Constituency Filter (Optional)
                </label>
                <input
                  type="text"
                  value={constituency}
                  onChange={(e) => setConstituency(e.target.value)}
                  placeholder="e.g. SHAHJAHANPUR or MALKAJGIRI"
                  disabled={syncing}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#44312A] mb-1">
                    State Filter (Optional)
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Uttar Pradesh"
                    disabled={syncing}
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44312A] mb-1">
                    Max Pages (100 works/page)
                  </label>
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    disabled={syncing}
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] focus:outline-none focus:border-[#44312A]"
                  >
                    <option value={1}>1 page (~100 works)</option>
                    <option value={3}>3 pages (~300 works)</option>
                    <option value={5}>5 pages (~500 works, Default)</option>
                    <option value={10}>10 pages (~1,000 works)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  disabled={syncing}
                  className="px-3.5 py-2 rounded-xl bg-[#E7DDCA] hover:bg-[#D8CBB6] text-xs font-semibold text-[#44312A] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncing}
                  className="px-4 py-2 rounded-xl bg-[#44312A] hover:bg-[#34241E] active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-[#44312A]/20"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                      <span>Ingesting & Processing...</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5" />
                      <span>Initiate Synchronization</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Syncing Progress Spinner */}
          {syncing && (
            <div className="py-8 text-center space-y-3">
              <div className="h-12 w-12 mx-auto rounded-full bg-[#E7DDCA] border border-[#D8CBB6] flex items-center justify-center text-[#44312A] animate-spin">
                <RefreshCw className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-[#44312A]">
                Contacting MPLADS Adapters...
              </h4>
              <p className="text-xs text-[#504F47] max-w-sm mx-auto">
                Ingesting data from Empowered Indian & MoSPI e-SAKSHI, applying regex PII sanitization, and updating database tables.
              </p>
            </div>
          )}

          {/* Success State */}
          {result && !syncing && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F4EFE6] border border-[#44312A] flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#44312A] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#44312A] uppercase tracking-wide">
                    Synchronization Successful
                  </h4>
                  <p className="text-xs text-[#44312A]">
                    {result.message || 'Database records have been updated with latest source feeds.'}
                  </p>
                  {result.metrics && (
                    <div className="pt-2 text-[11px] font-mono text-[#44312A] grid grid-cols-2 gap-2 font-medium">
                      <div>Works updated: {result.metrics.works_ingested || 0}</div>
                      <div>MPs updated: {result.metrics.mps_ingested || 0}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleResetAndClose}
                  className="px-4 py-2 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !syncing && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F4EFE6] border border-[#44312A] flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-[#44312A] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#44312A] uppercase tracking-wide">
                    Synchronization Alert
                  </h4>
                  <p className="text-xs text-[#44312A] leading-relaxed">{error}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setError(null)}
                  className="px-3 py-1.5 rounded-xl bg-[#E7DDCA] text-xs font-semibold text-[#44312A] hover:bg-[#D8CBB6]"
                >
                  Try Again
                </button>
                <button
                  onClick={handleResetAndClose}
                  className="px-3 py-1.5 rounded-xl bg-[#44312A] text-xs font-semibold text-white hover:bg-[#34241E]"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
