import React, { useEffect, useState } from 'react';
import { Building2, AlertTriangle, CheckCircle, Clock, Database, TrendingUp, Layers, ArrowUpRight } from 'lucide-react';
import axios from 'axios';

export default function AgencyBenchmarks({ onSyncSuccess }) {
  const [stats, setStats] = useState(null);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingState, setSyncingState] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  const baseURL = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : 'http://localhost:8000/api';

  useEffect(() => {
    Promise.all([
      axios.get(`${baseURL}/dataset/stats`),
      axios.get(`${baseURL}/dataset/agency-benchmarks?limit=15`)
    ]).then(([statsRes, agencyRes]) => {
      setStats(statsRes.data);
      setAgencies(agencyRes.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleIngestFromState = async (stateName) => {
    setSyncingState(stateName);
    try {
      const res = await axios.post(`${baseURL}/dataset/sync?state=${encodeURIComponent(stateName)}&limit=100`);
      setSyncMsg(`Successfully ingested ${res.data.records_ingested_from_csv} works from ${stateName} into the risk engine!`);
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      console.error(err);
      setSyncMsg('Failed to ingest records.');
    } finally {
      setSyncingState(null);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[#504F47] text-xs">
        Loading official eSAKSHI national dataset and Implementing District Authority (IDA) benchmarks...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      {/* Banner */}
      <div className="bg-[#44312A] text-[#FAF7F2] p-5 rounded-2xl border border-[#504F47] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-[#E7DDCA]" />
            <span className="font-bold text-sm font-display">Official MoSPI eSAKSHI National Dataset (2023–Present)</span>
            <span className="bg-[#FAF7F2]/10 text-[#E7DDCA] px-2 py-0.5 rounded text-[10px] font-semibold border border-[#D8CBB6]/30">
              60,359 Real Works
            </span>
          </div>
          <p className="text-[#E7DDCA]/80 text-xs mt-1">
            Work-level records sourced from the official eSAKSHI portal across 33 States, 456 Constituencies, and 699 Implementing District Authorities (IDAs).
          </p>
        </div>

        {syncMsg && (
          <div className="bg-[#FAF7F2] text-[#44312A] px-3 py-1.5 rounded-xl border border-[#D8CBB6] text-xs font-bold">
            {syncMsg}
          </div>
        )}
      </div>

      {/* Dataset Macro KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#504F47]">Total Sanctioned Works</span>
            <div className="text-xl font-black text-[#44312A] mt-1 font-mono">{stats.total_records.toLocaleString()}</div>
            <span className="text-[10px] text-[#8C7769]">Across 33 States</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#504F47]">Total Allocation</span>
            <div className="text-xl font-black text-[#44312A] mt-1 font-mono">₹{stats.total_allocation_cr.toLocaleString()} Cr</div>
            <span className="text-[10px] text-[#8C7769]">All India Scheme Fund</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#504F47]">Avg Valuation</span>
            <div className="text-xl font-black text-[#44312A] mt-1 font-mono">₹{stats.avg_project_cost_lakhs}L</div>
            <span className="text-[10px] text-[#8C7769]">Median: ₹{stats.median_project_cost_lakhs}L</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#504F47]">District Authorities</span>
            <div className="text-xl font-black text-[#44312A] mt-1 font-mono">{stats.unique_implementing_authorities}</div>
            <span className="text-[10px] text-[#8C7769]">IDAs Monitored</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#504F47]">Action Pending</span>
            <div className="text-xl font-black text-[#6B5145] mt-1 font-mono">
              {stats.ida_approval_breakdown['Action Pending']?.toLocaleString() || '0'}
            </div>
            <span className="text-[10px] text-[#8C7769]">64.4% of all works</span>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#504F47]">Rejected Proposals</span>
            <div className="text-xl font-black text-[#504F47] mt-1 font-mono">
              {stats.ida_approval_breakdown['Rejected by IDA']?.toLocaleString() || '0'}
            </div>
            <span className="text-[10px] text-[#8C7769]">IDA vetoed</span>
          </div>
        </div>
      )}

      {/* State Quick-Ingestion Badges */}
      {stats && stats.top_states && (
        <div className="bg-white p-4 rounded-2xl border border-[#D8CBB6] shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-1">
            <h3 className="font-bold text-[#44312A] text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-[#44312A]" />
              <span>Ingest State Work Batches for Multi-Detector Risk Scoring</span>
            </h3>
            <span className="text-[11px] text-[#504F47]">Click any state to stream its official eSAKSHI works into the risk engine</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.top_states.map((st, i) => (
              <button
                key={i}
                onClick={() => handleIngestFromState(st.state)}
                disabled={syncingState === st.state}
                className="px-3 py-1.5 rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] hover:bg-[#E7DDCA] transition flex items-center space-x-2 text-xs font-semibold cursor-pointer"
              >
                <span className="font-bold text-[#44312A]">{st.state}</span>
                <span className="text-[#504F47] text-[11px]">({st.works_count.toLocaleString()} works, ₹{st.total_cr} Cr)</span>
                {syncingState === st.state ? (
                  <span className="text-[#44312A] animate-pulse text-[10px] font-bold">Ingesting...</span>
                ) : (
                  <ArrowUpRight className="w-3 h-3 text-[#504F47]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Implementing District Authority (IDA) Anomaly Benchmarks Table */}
      <div className="bg-white rounded-2xl border border-[#D8CBB6] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#D8CBB6] bg-[#FAF7F2] flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-[#44312A] text-sm flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#44312A]" />
              <span>Implementing District Authority (IDA) Anomaly Detector</span>
            </h3>
            <p className="text-[#504F47] text-xs">
              Detects authorities exhibiting abnormal bottleneck rates, extreme proposal stagnation, and proposal rejection anomalies.
            </p>
          </div>
          <span className="text-[11px] text-[#504F47] font-mono">
            Benchmarked against 699 District Authorities
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[#504F47] uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Implementing District Authority (IDA)</th>
                <th className="py-3 px-3">State</th>
                <th className="py-3 px-3">Total Works</th>
                <th className="py-3 px-3">Total Spend</th>
                <th className="py-3 px-3">Pending Rate</th>
                <th className="py-3 px-3">Rejection Rate</th>
                <th className="py-3 px-3">Avg Valuation</th>
                <th className="py-3 px-4 text-right">Anomaly Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CBB6] font-mono text-[11px]">
              {agencies.map((a, i) => (
                <tr key={i} className="hover:bg-[#FAF7F2] transition-colors">
                  <td className="py-3 px-4 font-sans font-bold text-[#44312A] max-w-xs truncate">
                    {a.ida_name}
                  </td>
                  <td className="py-3 px-3 font-sans text-[#504F47]">
                    {a.state}
                  </td>
                  <td className="py-3 px-3 font-bold text-[#44312A]">
                    {a.total_works}
                  </td>
                  <td className="py-3 px-3 text-[#504F47]">
                    ₹{a.total_spend_cr} Cr
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#D8CBB6] text-[#44312A] font-bold">
                      {a.pending_rate}%
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-lg text-[#504F47]">
                      {a.rejection_rate}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#504F47]">
                    ₹{a.avg_work_cost_lakhs}L
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <div className="flex items-center justify-end space-x-1">
                      {a.anomaly_signals.map((sig, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
