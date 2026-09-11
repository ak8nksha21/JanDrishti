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
      <div className="py-24 text-center text-[#7A685D] text-xs">
        Loading official eSAKSHI national dataset and Implementing District Authority (IDA) benchmarks...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      {/* Banner */}
      <div className="bg-[#2D1D15] text-white p-5 rounded-2xl border border-[#4A3225] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-[#D4A373]" />
            <span className="font-bold text-sm font-serif">Official MoSPI eSAKSHI National Dataset (2023–Present)</span>
            <span className="bg-[#3E5C38]/40 text-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold border border-[#3E5C38]">
              60,359 Real Works
            </span>
          </div>
          <p className="text-[#C5B4A5] text-xs mt-1">
            Work-level records sourced from the official eSAKSHI portal across 33 States, 456 Constituencies, and 699 Implementing District Authorities (IDAs).
          </p>
        </div>

        {syncMsg && (
          <div className="bg-[#3E5C38] text-white px-3 py-1.5 rounded-lg border border-[#2C4228] text-xs font-medium">
            {syncMsg}
          </div>
        )}
      </div>

      {/* Dataset Macro KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white rounded-xl border border-[#EAE3D8] shadow-xs">
            <span className="text-[10px] uppercase font-semibold text-[#8C7A70]">Total Sanctioned Works</span>
            <div className="text-xl font-bold text-[#231815] mt-1 font-serif">{stats.total_records.toLocaleString()}</div>
            <span className="text-[10px] text-[#7A685D]">Across 33 States</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-[#EAE3D8] shadow-xs">
            <span className="text-[10px] uppercase font-semibold text-[#8C7A70]">Total Allocation</span>
            <div className="text-xl font-bold text-[#3E5C38] mt-1 font-serif">₹{stats.total_allocation_cr.toLocaleString()} Cr</div>
            <span className="text-[10px] text-[#7A685D]">All India Scheme Fund</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-[#EAE3D8] shadow-xs">
            <span className="text-[10px] uppercase font-semibold text-[#8C7A70]">Avg Project Valuation</span>
            <div className="text-xl font-bold text-[#8B5A2B] mt-1 font-serif">₹{stats.avg_project_cost_lakhs}L</div>
            <span className="text-[10px] text-[#7A685D]">Median: ₹{stats.median_project_cost_lakhs}L</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-[#EAE3D8] shadow-xs">
            <span className="text-[10px] uppercase font-semibold text-[#8C7A70]">District Authorities</span>
            <div className="text-xl font-bold text-[#231815] mt-1 font-serif">{stats.unique_implementing_authorities}</div>
            <span className="text-[10px] text-[#7A685D]">IDAs Monitored</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-[#EAE3D8] shadow-xs">
            <span className="text-[10px] uppercase font-semibold text-[#8C7A70]">Action Pending</span>
            <div className="text-xl font-bold text-[#9C4E15] mt-1 font-serif">
              {stats.ida_approval_breakdown['Action Pending']?.toLocaleString() || '0'}
            </div>
            <span className="text-[10px] text-[#7A685D]">64.4% of all works</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-[#EAE3D8] shadow-xs">
            <span className="text-[10px] uppercase font-semibold text-[#8C7A70]">Rejected Proposals</span>
            <div className="text-xl font-bold text-[#8A2616] mt-1 font-serif">
              {stats.ida_approval_breakdown['Rejected by IDA']?.toLocaleString() || '0'}
            </div>
            <span className="text-[10px] text-[#7A685D]">IDA vetoed</span>
          </div>
        </div>
      )}

      {/* State Quick-Ingestion Badges */}
      {stats && stats.top_states && (
        <div className="bg-white p-4 rounded-xl border border-[#EAE3D8] shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-semibold text-[#231815] text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-[#8B5A2B]" />
              <span>Ingest State Work Batches for Multi-Detector Risk Scoring</span>
            </h3>
            <span className="text-[11px] text-[#8C7A70]">Click any state to stream its official eSAKSHI works into the risk engine</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.top_states.map((st, i) => (
              <button
                key={i}
                onClick={() => handleIngestFromState(st.state)}
                disabled={syncingState === st.state}
                className="px-3 py-1.5 rounded-lg border border-[#EAE3D8] bg-[#FAF7F2] hover:bg-[#F3EDE2] hover:border-[#D4A373] transition flex items-center space-x-2 text-xs font-medium cursor-pointer"
              >
                <span className="font-bold text-[#231815]">{st.state}</span>
                <span className="text-[#7A685D] text-[11px]">({st.works_count.toLocaleString()} works, ₹{st.total_cr} Cr)</span>
                {syncingState === st.state ? (
                  <span className="text-[#8B5A2B] animate-pulse text-[10px] font-semibold">Ingesting...</span>
                ) : (
                  <ArrowUpRight className="w-3 h-3 text-[#8C7A70]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Implementing District Authority (IDA) Anomaly Benchmarks Table */}
      <div className="bg-white rounded-xl border border-[#EAE3D8] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#EAE3D8] bg-[#FAF7F2] flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-[#231815] text-sm flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#8B5A2B]" />
              <span>Implementing District Authority (IDA) Anomaly Detector</span>
            </h3>
            <p className="text-[#7A685D] text-xs">
              Detects authorities exhibiting abnormal bottleneck rates, extreme proposal stagnation, and proposal rejection anomalies.
            </p>
          </div>
          <span className="text-[11px] text-[#8C7A70] font-mono">
            Benchmarked against 699 District Authorities
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#EAE3D8] text-[#7A685D] uppercase font-semibold text-[10px] tracking-wider">
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
            <tbody className="divide-y divide-[#EAE3D8] font-mono text-[11px]">
              {agencies.map((a, i) => (
                <tr key={i} className="hover:bg-[#FAF7F2] transition-colors">
                  <td className="py-3 px-4 font-sans font-semibold text-[#231815] max-w-xs truncate">
                    {a.ida_name}
                  </td>
                  <td className="py-3 px-3 font-sans text-[#7A685D]">
                    {a.state}
                  </td>
                  <td className="py-3 px-3 font-bold text-[#231815]">
                    {a.total_works}
                  </td>
                  <td className="py-3 px-3 text-[#5C4A3E]">
                    ₹{a.total_spend_cr} Cr
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      a.pending_rate >= 90.0 ? 'bg-[#8A2616]/10 text-[#8A2616] border border-[#8A2616]/20' :
                      a.pending_rate >= 75.0 ? 'bg-[#9C4E15]/10 text-[#9C4E15] border border-[#9C4E15]/20' :
                      'bg-[#FAF7F2] text-[#7A685D] border border-[#EAE3D8]'
                    }`}>
                      {a.pending_rate}%
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded ${
                      a.rejection_rate >= 15.0 ? 'bg-[#8A2616]/10 text-[#8A2616] border border-[#8A2616]/20 font-bold' : 'text-[#7A685D]'
                    }`}>
                      {a.rejection_rate}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#5C4A3E]">
                    ₹{a.avg_work_cost_lakhs}L
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <div className="flex items-center justify-end space-x-1">
                      {a.anomaly_signals.map((sig, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#8A2616]/10 text-[#8A2616] border border-[#8A2616]/20"
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
