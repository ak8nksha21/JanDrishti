import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, Clock, XCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { updateAlertStatus } from '../api/client';

export default function AlertsView({ alerts, onInvestigate, onRefresh }) {
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);

  const statuses = ['All', 'New', 'Under Review', 'Verified', 'Dismissed', 'Resolved'];

  const filtered = alerts.filter(a => selectedStatus === 'All' || a.status === selectedStatus);

  const handleStatusChange = async (alertId, newStatus) => {
    setUpdatingId(alertId);
    try {
      await updateAlertStatus(alertId, {
        status: newStatus,
        reviewed_by: 'Officer (Auth Verified)',
        notes: `Status transitioned to ${newStatus} during monitoring review.`
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getSeverityBadge = (sev) => {
    if (sev === 'Critical') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">CRITICAL</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">HIGH</span>;
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Workflow Tabs Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Alerts Lifecycle Management</h3>
          <p className="text-slate-400 text-[11px]">
            Statutory review workflow: New &rarr; Under Review &rarr; Verified / Dismissed &rarr; Resolved
          </p>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition ${
                selectedStatus === st
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st} {st !== 'All' && `(${alerts.filter(a => a.status === st).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No alerts currently in "{selectedStatus}" status.
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-blue-700">{alert.work_id}</span>
                    {getSeverityBadge(alert.severity)}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    alert.status === 'New' ? 'bg-blue-100 text-blue-800' :
                    alert.status === 'Under Review' ? 'bg-amber-100 text-amber-800' :
                    alert.status === 'Verified' ? 'bg-rose-100 text-rose-800' :
                    alert.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {alert.status}
                  </span>
                </div>

                <h4 className="font-semibold text-slate-900 mt-2 text-sm line-clamp-1">
                  {alert.work_title}
                </h4>

                <div className="mt-1 text-[11px] text-slate-500 flex space-x-3">
                  <span>Constituency: <strong>{alert.constituency}</strong></span>
                  <span>Cost: <strong>₹{alert.cost}L</strong></span>
                </div>

                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-700 font-medium">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Reason For Alert</span>
                  {alert.reason}
                </div>

                {alert.reviewed_by && (
                  <div className="mt-2 text-[10px] text-slate-400">
                    Last reviewed by <span className="font-semibold">{alert.reviewed_by}</span> on {new Date(alert.reviewed_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Status Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => onInvestigate(alert.work_id)}
                  className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-semibold text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Investigation</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  {alert.status === 'New' && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'Under Review')}
                      disabled={updatingId === alert.id}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium transition"
                    >
                      Start Review
                    </button>
                  )}
                  {alert.status === 'Under Review' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(alert.id, 'Verified')}
                        disabled={updatingId === alert.id}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium transition"
                      >
                        Flag Irregularity
                      </button>
                      <button
                        onClick={() => handleStatusChange(alert.id, 'Dismissed')}
                        disabled={updatingId === alert.id}
                        className="px-2.5 py-1 bg-slate-400 hover:bg-slate-500 text-white rounded font-medium transition"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {alert.status === 'Verified' && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'Resolved')}
                      disabled={updatingId === alert.id}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {(alert.status === 'Resolved' || alert.status === 'Dismissed') && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'Under Review')}
                      disabled={updatingId === alert.id}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium transition"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
