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
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#44312A] text-[#E7DDCA] border border-[#504F47]">CRITICAL</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#504F47] text-[#E7DDCA] border border-[#504F47]">HIGH</span>;
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Workflow Tabs Header */}
      <div className="bg-white p-4 rounded-xl border border-[#D8CBB6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#44312A] text-sm">Alerts Lifecycle Management</h3>
          <p className="text-[#504F47] text-[11px]">
            Statutory review workflow: New &rarr; Under Review &rarr; Verified / Dismissed &rarr; Resolved
          </p>
        </div>

        <div className="flex items-center space-x-1 bg-[#FAF7F2] p-1 rounded-lg border border-[#D8CBB6]">
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition ${
                selectedStatus === st
                  ? 'bg-[#44312A] text-[#E7DDCA] shadow-xs font-semibold'
                  : 'text-[#504F47] hover:text-[#44312A]'
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
          <div className="col-span-2 py-16 text-center text-[#8C7769] bg-white rounded-xl border border-[#D8CBB6]">
            No alerts currently in "{selectedStatus}" status.
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className="bg-white p-5 rounded-xl border border-[#D8CBB6] shadow-xs hover:border-[#44312A] transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-[#44312A]">{alert.work_id}</span>
                    {getSeverityBadge(alert.severity)}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    alert.status === 'New' ? 'bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]' :
                    alert.status === 'Under Review' ? 'bg-[#FAF7F2] text-[#504F47] border border-[#D8CBB6]' :
                    alert.status === 'Verified' ? 'bg-[#44312A] text-[#E7DDCA] border border-[#504F47]' :
                    alert.status === 'Resolved' ? 'bg-[#504F47] text-[#E7DDCA] border border-[#504F47]' :
                    'bg-[#FAF7F2] text-[#504F47] border border-[#D8CBB6]'
                  }`}>
                    {alert.status}
                  </span>
                </div>

                <h4 className="font-semibold text-[#44312A] mt-2 text-sm line-clamp-1">
                  {alert.work_title}
                </h4>

                <div className="mt-1 text-[11px] text-[#504F47] flex space-x-3">
                  <span>Constituency: <strong className="text-[#44312A]">{alert.constituency}</strong></span>
                  <span>Cost: <strong className="text-[#44312A]">₹{alert.cost}L</strong></span>
                </div>

                <div className="mt-3 p-2.5 bg-[#FAF7F2] rounded-lg border border-[#D8CBB6] text-[#504F47] font-medium">
                  <span className="text-[#8C7769] font-semibold block text-[10px] uppercase">Reason For Alert</span>
                  {alert.reason}
                </div>

                {alert.reviewed_by && (
                  <div className="mt-2 text-[10px] text-[#8C7769]">
                    Last reviewed by <span className="font-semibold text-[#44312A]">{alert.reviewed_by}</span> on {new Date(alert.reviewed_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Status Action Buttons */}
              <div className="pt-3 border-t border-[#D8CBB6] flex items-center justify-between">
                <button
                  onClick={() => onInvestigate(alert.work_id)}
                  className="flex items-center space-x-1 text-[#44312A] hover:text-[#6B5145] font-semibold text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Investigation</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  {alert.status === 'New' && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'Under Review')}
                      disabled={updatingId === alert.id}
                      className="px-2.5 py-1 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded font-medium transition"
                    >
                      Start Review
                    </button>
                  )}
                  {alert.status === 'Under Review' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(alert.id, 'Verified')}
                        disabled={updatingId === alert.id}
                        className="px-2.5 py-1 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded font-medium transition"
                      >
                        Flag Irregularity
                      </button>
                      <button
                        onClick={() => handleStatusChange(alert.id, 'Dismissed')}
                        disabled={updatingId === alert.id}
                        className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] rounded font-medium transition"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {alert.status === 'Verified' && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'Resolved')}
                      disabled={updatingId === alert.id}
                      className="px-2.5 py-1 bg-[#504F47] hover:bg-[#44312A] text-[#E7DDCA] rounded font-medium transition"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {(alert.status === 'Resolved' || alert.status === 'Dismissed') && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'Under Review')}
                      disabled={updatingId === alert.id}
                      className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] rounded font-medium transition"
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
