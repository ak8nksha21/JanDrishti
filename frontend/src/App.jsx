import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import KPICards from './components/KPICards';
import ChartsSection from './components/ChartsSection';
import RiskTable from './components/RiskTable';
import GeoRiskMap from './components/GeoRiskMap';
import WorkDetailModal from './components/WorkDetailModal';
import InvestigationModal from './components/InvestigationModal';
import AlertsView from './components/AlertsView';
import AuditLogsView from './components/AuditLogsView';
import AgencyBenchmarks from './components/AgencyBenchmarks';
import { fetchRiskSummary, fetchRiskWorks, fetchAlerts, triggerSync, triggerLiveSync, triggerCsvLoad, updateAlertStatus } from './api/client';
import { Shield, Sparkles, RefreshCw, AlertTriangle, Globe } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [userRole, setUserRole] = useState('CENTRAL_OFFICER');

  const [summary, setSummary] = useState(null);
  const [works, setWorks] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [investigatingWorkId, setInvestigatingWorkId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, worksData, alertsData] = await Promise.all([
        fetchRiskSummary(),
        fetchRiskWorks({ limit: 100 }),
        fetchAlerts()
      ]);
      setSummary(sumData);
      setWorks(worksData.items || worksData || []);
      setAlerts(alertsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerSync();
      await loadData();
      showToast(`Pipeline re-run complete! Active works updated.`);
    } catch (err) {
      console.error(err);
      showToast('Sync failed. Check backend connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLiveSync = async (constituency) => {
    setIsSyncing(true);
    try {
      // Normalize colloquial raebarelli
      let target = constituency || 'RAE BARELI';
      if (target.toLowerCase().includes('raebar')) {
        target = 'RAE BARELI';
      }
      const res = await triggerLiveSync(target);
      await loadData();
      showToast(`Live sync completed for ${target}!`);
    } catch (err) {
      console.error(err);
      // Try CSV fallback load if live API network is unavailable
      try {
        const csvRes = await triggerCsvLoad(150, constituency);
        await loadData();
        showToast(`Loaded ${csvRes.inserted_records || 100} records from national dataset.`);
      } catch (e) {
        showToast('Sync error. Verify network connectivity.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusUpdateFromAgent = async (workId, status) => {
    const alert = alerts.find(a => a.work_id === workId);
    if (alert) {
      try {
        await updateAlertStatus(alert.id, {
          status: status,
          reviewed_by: userRole,
          notes: 'Marked under review following AI investigation agent briefing.'
        });
        loadData();
        showToast(`Alert for #${workId} updated to "${status}"`);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center space-x-2 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={setUserRole}
        onSync={handleSync}
        onLiveSync={handleLiveSync}
        isSyncing={isSyncing}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {loading && !summary ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-medium text-xs">
              Initializing JanDrishti Risk Engine and loading datasets...
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards always visible at top */}
            <KPICards summary={summary} />

            {/* Tab Views */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <ChartsSection summary={summary} />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-800 text-sm">Recent Risk Priorities</h3>
                    <button
                      onClick={() => setActiveTab('risk')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      View All Works &rarr;
                    </button>
                  </div>
                  <RiskTable
                    works={works.slice(0, 10)}
                    onSelectWork={setSelectedWorkId}
                    onInvestigate={setInvestigatingWorkId}
                  />
                </div>
              </div>
            )}

            {activeTab === 'risk' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Comprehensive Risk Registry</h2>
                    <p className="text-xs text-slate-500">
                      Sort and filter works by risk severity, cost, category, and detection flags
                    </p>
                  </div>
                </div>
                <RiskTable
                  works={works}
                  onSelectWork={setSelectedWorkId}
                  onInvestigate={setInvestigatingWorkId}
                />
              </div>
            )}

            {activeTab === 'agency' && (
              <AgencyBenchmarks onSyncSuccess={loadData} />
            )}

            {activeTab === 'map' && (
              <GeoRiskMap
                works={works}
                onInvestigate={setInvestigatingWorkId}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertsView
                alerts={alerts}
                onInvestigate={setInvestigatingWorkId}
                onRefresh={loadData}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLogsView />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Ministry of Statistics and Programme Implementation (MoSPI) • Decision Support System</span>
          <span className="font-mono text-[11px] text-slate-500">JanDrishti • FastAPI • Scikit-Learn • React • Leaflet</span>
        </div>
      </footer>

      {/* Modals */}
      <WorkDetailModal
        workId={selectedWorkId}
        onClose={() => setSelectedWorkId(null)}
        onInvestigate={(id) => {
          setSelectedWorkId(null);
          setInvestigatingWorkId(id);
        }}
      />

      <InvestigationModal
        workId={investigatingWorkId}
        onClose={() => setInvestigatingWorkId(null)}
        onUpdateStatus={handleStatusUpdateFromAgent}
      />
    </div>
  );
}
