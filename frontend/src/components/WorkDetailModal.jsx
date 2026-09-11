import React, { useEffect, useState } from 'react';
import { X, Sparkles, MapPin, IndianRupee } from 'lucide-react';
import { fetchWorkDetail } from '../services/api';
import { formatCroresLakhs, formatIndianNumber } from '../utils/formatting';

export default function WorkDetailModal({ workId, onClose, onInvestigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workId) return;
    setLoading(true);
    fetchWorkDetail(workId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [workId]);

  if (!workId) return null;

  const costFormatted = data?.work?.cost !== undefined && data?.work?.cost !== null
    ? formatCroresLakhs(data.work.cost)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#44312A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#D8CBB6] overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#D8CBB6] flex items-center justify-between bg-[#FAF7F2]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-[#44312A] bg-white px-2.5 py-0.5 rounded border border-[#D8CBB6]">
                #{workId}
              </span>
              <span className="text-xs text-[#504F47] font-semibold">Work Details & Evidence Inspector</span>
            </div>
            <h2 className="text-base font-bold text-[#44312A] mt-1 line-clamp-1 font-display">
              {data?.work?.description || 'Loading work details...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#504F47] hover:text-[#44312A] hover:bg-[#E7DDCA] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-16 text-center text-[#504F47]">Loading project breakdown...</div>
          ) : !data || !data.work ? (
            <div className="py-16 text-center text-[#44312A] font-bold">Failed to load work record.</div>
          ) : (
            <>
              {/* Risk Composite Header Card */}
              <div className="p-4 rounded-2xl border border-[#D8CBB6] bg-[#FAF7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">Composite Risk Score</span>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="text-3xl font-black text-[#44312A]">{data.risk_score?.overall_score || 0}</span>
                    <span className="text-sm text-[#504F47]">/ 100</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#44312A] border border-[#D8CBB6]">
                      {data.risk_score?.risk_level || 'Low'} Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-[#504F47] mt-1 font-mono">
                    Model: {data.risk_score?.model_version || 'v1.0-ensemble'} (Weighted Multi-Detector)
                  </p>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    if (onInvestigate) onInvestigate(workId);
                  }}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded-xl font-bold shadow-md shadow-[#44312A]/20 transition cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-[#E7DDCA]" />
                  <span>Launch AI Investigation</span>
                </button>
              </div>

              {/* 6 Component Risk Signals Breakdown */}
              <div>
                <h4 className="font-bold text-[#44312A] mb-3 text-xs uppercase tracking-wider">
                  6-Signal Risk Decomposition
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { name: 'Cost Anomaly (25%)', val: data.risk_score?.cost_score || 0, desc: 'Peer category median benchmarking' },
                    { name: 'Multi-Variable ML Anomaly (25%)', val: data.risk_score?.ml_anomaly_score || 0, desc: 'Statistical distribution anomaly' },
                    { name: 'Duplicate / Overlap Risk (20%)', val: data.risk_score?.duplicate_score || 0, desc: 'TF-IDF text, cost & spatial similarity' },
                    { name: 'Fund Utilization Risk (15%)', val: data.risk_score?.utilization_score || 0, desc: 'Constituency expenditure vs unspent balance' },
                    { name: 'Geographic Conflict (10%)', val: data.risk_score?.geographic_score || 0, desc: 'Haversine distance to peer works (<60m)' },
                    { name: 'Data Quality / Evidence Risk (5%)', val: data.risk_score?.data_quality_score || 0, desc: 'Field completeness & audit trails' },
                  ].map((signal, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl border border-[#D8CBB6] bg-[#FAF7F2]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-[#44312A]">{signal.name}</span>
                        <span className="font-bold font-mono text-[#44312A]">
                          {signal.val} / 100
                        </span>
                      </div>
                      <div className="w-full bg-[#E7DDCA] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-[#44312A]"
                          style={{ width: `${Math.min(100, signal.val)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#504F47] mt-1">{signal.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Metadata */}
              <div className="border-t border-[#D8CBB6] pt-4">
                <h4 className="font-bold text-[#44312A] mb-3 text-xs uppercase tracking-wider">
                  Source Registry Attributes
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[#504F47]">
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Sanctioned Cost</span>
                    <span className="font-bold text-[#44312A] text-sm">
                      {costFormatted ? costFormatted.compact : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Sector / Category</span>
                    <span className="font-medium text-[#44312A]">{data.work.category}</span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Constituency</span>
                    <span className="font-medium text-[#44312A]">{data.work.constituency} ({data.work.state})</span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Member of Parliament</span>
                    <span className="font-medium text-[#44312A]">{data.work.mp_name}</span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Implementing Agency</span>
                    <span className="font-medium text-[#44312A]">{data.work.implementing_agency || data.work.agency || <span className="text-[#8C7769]">Unspecified</span>}</span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Quality Inspection Rating</span>
                    <span className="font-medium text-[#44312A]">
                      {data.work.quality_rating ? `${data.work.quality_rating} / 5.0` : <span className="text-[#8C7769]">Not Audited</span>}
                    </span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">GPS Coordinates</span>
                    <span className="font-medium text-[#44312A] font-mono">
                      {data.work.latitude ? `${data.work.latitude}, ${data.work.longitude}` : <span className="text-[#8C7769]">Missing GPS (0 Points)</span>}
                    </span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Uploaded Evidence Photos</span>
                    <span className="font-medium text-[#44312A]">
                      {data.work.photos_count || 0} Photographs
                    </span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <span className="text-[10px] text-[#504F47] block font-bold">Completion Date</span>
                    <span className="font-medium text-[#44312A]">{data.work.completion_date || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
