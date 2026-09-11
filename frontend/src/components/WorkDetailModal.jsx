import React, { useEffect, useState } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle, ExternalLink, MapPin, Building, Calendar, Image, Award } from 'lucide-react';
import { fetchWorkDetail } from '../api/client';

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {workId}
              </span>
              <span className="text-xs text-slate-500 font-medium">Work Details & Evidence Inspector</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
              {data?.work?.description || 'Loading work details...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading project breakdown...</div>
          ) : !data || !data.work ? (
            <div className="py-16 text-center text-red-500">Failed to load work record.</div>
          ) : (
            <>
              {/* Risk Composite Header Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Composite Risk Score</span>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="text-3xl font-extrabold text-slate-900">{data.risk_score?.overall_score || 0}</span>
                    <span className="text-sm text-slate-500">/ 100</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      data.risk_score?.risk_level === 'Critical' ? 'bg-rose-100 text-rose-800' :
                      data.risk_score?.risk_level === 'High' ? 'bg-orange-100 text-orange-800' :
                      data.risk_score?.risk_level === 'Medium' ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {data.risk_score?.risk_level} Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Model: {data.risk_score?.model_version || 'v1.0-ensemble'} (Weighted Multi-Detector)
                  </p>
                </div>

                <button
                  onClick={() => onInvestigate(workId)}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-500/20 transition cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Launch AI Investigation</span>
                </button>
              </div>

              {/* 6 Component Risk Signals Breakdown */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-3 text-xs uppercase tracking-wider">
                  6-Signal Risk Decomposition
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { name: 'Cost Anomaly (25%)', val: data.risk_score?.cost_score || 0, desc: 'Peer category median benchmarking' },
                    { name: 'Multi-Variable Isolation Forest (25%)', val: data.risk_score?.ml_anomaly_score || 0, desc: 'Multi-dimensional financial correlation' },
                    { name: 'Duplicate / Overlap Risk (20%)', val: data.risk_score?.duplicate_score || 0, desc: 'TF-IDF text, cost & spatial similarity' },
                    { name: 'Fund Utilization Risk (15%)', val: data.risk_score?.utilization_score || 0, desc: 'Constituency expenditure vs unspent balance' },
                    { name: 'Geographic Conflict (10%)', val: data.risk_score?.geographic_score || 0, desc: 'Haversine distance to peer works (<60m)' },
                    { name: 'Data Quality / Evidence Risk (5%)', val: data.risk_score?.data_quality_score || 0, desc: 'Field completeness & audit trails' },
                  ].map((signal, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50/70">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-slate-700">{signal.name}</span>
                        <span className={`font-bold ${signal.val >= 60 ? 'text-rose-600' : signal.val >= 35 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {signal.val} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            signal.val >= 60 ? 'bg-rose-500' : signal.val >= 35 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, signal.val)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{signal.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Metadata */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-800 mb-3 text-xs uppercase tracking-wider">
                  Source Registry Attributes
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-600">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Sanctioned Cost</span>
                    <span className="font-bold text-slate-900 text-sm">₹{data.work.cost} Lakhs</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Sector / Category</span>
                    <span className="font-medium text-slate-800">{data.work.category}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Constituency</span>
                    <span className="font-medium text-slate-800">{data.work.constituency} ({data.work.state})</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Member of Parliament</span>
                    <span className="font-medium text-slate-800">{data.work.mp_name}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Implementing Agency</span>
                    <span className="font-medium text-slate-800">{data.work.agency || <span className="text-red-500">Missing</span>}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Quality Inspection Rating</span>
                    <span className="font-medium text-slate-800">
                      {data.work.quality_rating ? `${data.work.quality_rating} / 5.0` : <span className="text-amber-500">Not Audited</span>}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">GPS Coordinates</span>
                    <span className="font-medium text-slate-800 font-mono">
                      {data.work.latitude ? `${data.work.latitude}, ${data.work.longitude}` : <span className="text-amber-600">Missing GPS</span>}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Uploaded Evidence Photos</span>
                    <span className="font-medium text-slate-800">
                      {data.work.photos_count || 0} Photographs
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Completion Date</span>
                    <span className="font-medium text-slate-800">{data.work.completion_date || 'N/A'}</span>
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
