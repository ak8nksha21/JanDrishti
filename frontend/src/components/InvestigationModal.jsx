import React, { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Layers,
  MapPin,
  Clock,
  TrendingUp,
  Cpu,
  ShieldAlert,
  Info,
  IndianRupee,
  ExternalLink,
} from 'lucide-react';
import { runAIInvestigation } from '../services/api';
import { formatCroresLakhs, formatIndianNumber } from '../utils/formatting';
import { RISK_DISCLAIMER } from '../utils/riskLanguage';

export default function InvestigationModal({ workId, onClose, onUpdateStatus }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!workId) return;
    setLoading(true);
    setError(null);
    runAIInvestigation(workId)
      .then((res) => {
        setResult(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[AI Investigation Error]:', err);
        setError(err.message || 'Failed to execute AI investigation pipeline.');
        setLoading(false);
      });
  }, [workId]);

  if (!workId) return null;

  const getRiskLevelBadge = (level) => {
    const norm = String(level || '').toLowerCase();
    if (norm === 'critical') {
      return {
        label: 'Critical Risk',
        bg: 'bg-[#44312A] text-[#E7DDCA] border-[#44312A]',
        dot: 'bg-[#E7DDCA]',
      };
    }
    if (norm === 'high') {
      return {
        label: 'High Risk',
        bg: 'bg-[#504F47] text-[#E7DDCA] border-[#504F47]',
        dot: 'bg-[#E7DDCA]',
      };
    }
    if (norm === 'medium') {
      return {
        label: 'Medium Risk',
        bg: 'bg-[#6B5145] text-[#FAF7F2] border-[#6B5145]',
        dot: 'bg-[#FAF7F2]',
      };
    }
    return {
      label: 'Low Risk',
      bg: 'bg-[#FAF7F2] text-[#44312A] border-[#D8CBB6]',
      dot: 'bg-[#44312A]',
    };
  };

  const getSeverityBadge = (sev) => {
    const s = String(sev || '').toLowerCase();
    if (s === 'critical') return 'bg-[#44312A] text-[#E7DDCA] border-[#44312A]';
    if (s === 'high') return 'bg-[#504F47] text-[#E7DDCA] border-[#504F47]';
    if (s === 'medium') return 'bg-[#6B5145] text-[#FAF7F2] border-[#6B5145]';
    if (s === 'low') return 'bg-[#FAF7F2] text-[#44312A] border-[#D8CBB6]';
    return 'bg-[#FAF7F2] text-[#504F47] border-[#D8CBB6]';
  };

  const costFormatted = result?.cost !== undefined && result?.cost !== null
    ? formatCroresLakhs(result.cost)
    : null;

  const badgeConfig = getRiskLevelBadge(result?.risk_level);

  // Extract similar works from tool results if present
  const similarWorksList = result?.tool_results?.similar_works?.similar_works || [];
  const duplicateCheck = result?.tool_results?.duplicate_check || {};

  return (
    <div className="fixed inset-0 z-50 bg-[#44312A]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#D8CBB6] overflow-hidden animate-in fade-in zoom-in duration-150 text-[#44312A]">
        
        {/* 1. Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[#D8CBB6] flex items-center justify-between bg-[#44312A] text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#504F47] rounded-xl border border-[#D8CBB6]/40">
              <Sparkles className="w-5 h-5 text-[#E7DDCA] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-tight font-display">
                  AI Investigation Agent
                </span>
                <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-[#504F47] text-[#FAF7F2] border border-[#D8CBB6]/40">
                  8-Tool Orchestration
                </span>
              </div>
              <p className="text-xs text-[#FAF7F2]/80 mt-0.5 font-mono">
                Target Work Identifier: <strong className="text-[#E7DDCA] font-bold">#{workId}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#FAF7F2]/70 hover:text-white hover:bg-[#504F47] transition cursor-pointer"
            title="Close investigation modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#D8CBB6] border-t-[#44312A] rounded-full animate-spin" />
              <div className="text-center space-y-1">
                <div className="font-bold text-[#44312A] text-sm">
                  Orchestrating AI Investigation Agent...
                </div>
                <div className="text-xs text-[#504F47] font-mono max-w-md">
                  Executing deterministic tools: get_work_details, get_cost_analysis, get_similar_works, get_mp_financials, check_duplicate, check_data_quality, get_geographic_context...
                </div>
              </div>
            </div>
          ) : error || !result ? (
            <div className="py-16 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-[#44312A] mx-auto" />
              <div className="font-bold text-sm text-[#44312A]">
                Investigation Query Failed
              </div>
              <p className="text-xs text-[#504F47] max-w-md mx-auto">
                {error || 'Unable to retrieve investigation brief for the specified work item.'}
              </p>
              <button
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  runAIInvestigation(workId)
                    .then((res) => { setResult(res); setLoading(false); })
                    .catch((err) => { setError(err.message); setLoading(false); });
                }}
                className="px-4 py-2 bg-[#44312A] text-[#E7DDCA] rounded-xl font-bold text-xs"
              >
                Retry Investigation
              </button>
            </div>
          ) : (
            <>
              {/* Top Hero Verdict Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-[#D8CBB6] bg-[#FAF7F2] space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#44312A] bg-white px-2 py-0.5 rounded border border-[#D8CBB6]">
                        WORK #{result.work_id}
                      </span>
                      {result.category && (
                        <span className="text-[11px] font-medium text-[#504F47]">
                          Category: <strong className="text-[#44312A]">{result.category}</strong>
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-[#44312A] mt-1.5 leading-snug">
                      {result.work_description || 'Completed Infrastructure Project'}
                    </h2>
                  </div>

                  {/* Overall Risk Score Badge */}
                  <div className="flex items-center gap-3 shrink-0 bg-white p-3 rounded-xl border border-[#D8CBB6] shadow-2xs">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                        Composite Risk
                      </span>
                      <div className="text-2xl font-black font-mono text-[#44312A]">
                        {result.overall_score !== undefined && result.overall_score !== null ? (
                          <>
                            {Number(result.overall_score).toFixed(1)}
                            <span className="text-xs text-[#504F47] font-normal"> / 100</span>
                          </>
                        ) : (
                          <span className="text-sm font-bold">Insufficient Data</span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${badgeConfig.bg}`}>
                      <span className={`w-2 h-2 rounded-full ${badgeConfig.dot}`} />
                      <span>{badgeConfig.label}</span>
                    </span>
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#D8CBB6] text-[11px] text-[#504F47]">
                  <div>
                    <span className="text-[10px] block text-[#8C7769]">Member of Parliament:</span>
                    <strong className="text-[#44312A] truncate block">{result.mp_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] block text-[#8C7769]">Constituency & State:</span>
                    <strong className="text-[#44312A] truncate block">{result.constituency || 'N/A'}, {result.state || ''}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] block text-[#8C7769]">Reported Completed Cost:</span>
                    <strong className="text-[#44312A] font-mono block">
                      {costFormatted ? costFormatted.compact : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] block text-[#8C7769]">Investigated At:</span>
                    <span className="text-[#44312A] font-mono block">
                      {result.investigated_at ? new Date(result.investigated_at).toLocaleTimeString() : 'Live'}
                    </span>
                  </div>
                </div>

                {/* Synthesis Summary */}
                {result.summary && (
                  <div className="p-3 bg-white rounded-xl border border-[#D8CBB6] text-[#44312A] leading-relaxed text-xs">
                    <span className="font-bold text-[#44312A] block text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#44312A]" />
                      <span>Objective Risk Synthesis</span>
                    </span>
                    <p className="text-[#504F47]">{result.summary}</p>
                  </div>
                )}
              </div>

              {/* Section 1: Why This Work Was Flagged (Primary Reasons) */}
              {result.primary_reasons && result.primary_reasons.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-[#D8CBB6] space-y-2 shadow-xs">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#44312A] flex items-center space-x-1.5">
                    <Cpu className="w-4 h-4 text-[#44312A]" />
                    <span>Why This Work Was Flagged (Primary Signals)</span>
                  </h3>
                  <div className="space-y-2 pt-1">
                    {result.primary_reasons.map((reason, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-2.5 bg-[#FAF7F2] p-3 rounded-xl border border-[#D8CBB6]"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#44312A] mt-1.5 shrink-0" />
                        <span className="text-[#44312A] font-medium leading-relaxed">
                          {reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: 6-Signal Composite Risk Breakdown */}
              <div className="bg-white rounded-2xl p-4 border border-[#D8CBB6] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#44312A] flex items-center space-x-1.5">
                    <TrendingUp className="w-4 h-4 text-[#44312A]" />
                    <span>Six-Signal Risk Breakdown</span>
                  </h3>
                  <span className="text-[10px] font-mono text-[#8C7769]">Canonical Weighted Model</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    {
                      title: 'ML Anomaly Score',
                      weight: '25% Weight',
                      score: result.signal_breakdown?.ml_anomaly_score,
                      desc: 'Multi-variable statistical distribution anomaly',
                    },
                    {
                      title: 'Cost Deviation Score',
                      weight: '25% Weight',
                      score: result.signal_breakdown?.cost_score,
                      desc: 'Peer category & district cost divergence',
                    },
                    {
                      title: 'Duplicate & Overlap Score',
                      weight: '20% Weight',
                      score: result.signal_breakdown?.duplicate_score,
                      desc: 'Text, cost & proximity similarity checks',
                    },
                    {
                      title: 'Utilization Score',
                      weight: '15% Weight',
                      score: result.signal_breakdown?.utilization_score,
                      desc: 'Constituency allocation vs disbursement ratio',
                    },
                    {
                      title: 'Geographic Score',
                      weight: '10% Weight',
                      score: result.signal_breakdown?.geographic_score,
                      desc: 'Spatial collision & geotagging verification',
                    },
                    {
                      title: 'Data Quality Score',
                      weight: '5% Weight',
                      score: result.signal_breakdown?.data_quality_score,
                      desc: 'Completeness of mandatory administrative fields',
                    },
                  ].map((sig, i) => {
                    const scoreVal = sig.score !== undefined && sig.score !== null ? Number(sig.score) : null;
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#44312A] text-xs">{sig.title}</span>
                            <span className="text-[10px] font-mono text-[#8C7769] font-semibold">{sig.weight}</span>
                          </div>
                          <p className="text-[10px] text-[#504F47] mt-0.5 leading-tight">{sig.desc}</p>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[#504F47] font-medium">Risk Signal:</span>
                            <span className="font-mono font-bold text-[#44312A]">
                              {scoreVal !== null ? `${scoreVal.toFixed(1)} / 100` : 'Insufficient Data'}
                            </span>
                          </div>
                          <div className="w-full bg-[#E7DDCA] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-[#44312A]"
                              style={{ width: `${Math.min(100, scoreVal !== null ? scoreVal : 0)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Structured Evidence Items */}
              {result.evidence && result.evidence.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-[#D8CBB6] space-y-3 shadow-xs">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#44312A] flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-[#44312A]" />
                    <span>Structured Audit Evidence ({result.evidence.length} Findings)</span>
                  </h3>

                  <div className="space-y-2.5">
                    {result.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-[#44312A] text-xs">{ev.title}</span>
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white text-[#504F47] border border-[#D8CBB6]">
                              {ev.category}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(ev.severity)}`}>
                            {ev.severity || 'Info'}
                          </span>
                        </div>
                        <p className="text-[#504F47] text-xs leading-relaxed">
                          {ev.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Similar Works & Duplicate Analysis */}
              {similarWorksList.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-[#D8CBB6] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#44312A] flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-[#44312A]" />
                      <span>Similar & Comparable Works Analysis</span>
                    </h3>
                    <span className="text-[10px] font-mono text-[#8C7769]">
                      {similarWorksList.length} Peer Works Evaluated
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FAF7F2] text-[#504F47] border-b border-[#D8CBB6] text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Work ID</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-2">Cost</th>
                          <th className="py-2 px-2">Constituency</th>
                          <th className="py-2 px-3 text-right">Similarity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8CBB6] text-[11px]">
                        {similarWorksList.map((sw, sIdx) => (
                          <tr key={sIdx} className="hover:bg-[#FAF7F2] transition">
                            <td className="py-2 px-3 font-mono font-bold text-[#44312A]">#{sw.work_id}</td>
                            <td className="py-2 px-3 text-[#504F47] max-w-xs truncate font-medium">{sw.work_description}</td>
                            <td className="py-2 px-2 font-mono font-bold text-[#44312A]">
                              {formatCroresLakhs(sw.cost).compact}
                            </td>
                            <td className="py-2 px-2 text-[#504F47]">{sw.constituency || 'N/A'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[#44312A]">
                              {sw.similarity_score ? `${(sw.similarity_score * 100).toFixed(1)}%` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 5: Recommended Human Verification Checklist */}
              {result.recommended_actions && result.recommended_actions.length > 0 && (
                <div className="bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 border border-[#D8CBB6] space-y-2.5">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#44312A] flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#44312A]" />
                    <span>Recommended Human Verification Actions (Officer Checklist)</span>
                  </h3>
                  <ul className="space-y-2 pt-1">
                    {result.recommended_actions.map((act, idx) => (
                      <li
                        key={idx}
                        className="flex items-start space-x-2.5 bg-white p-3 rounded-xl border border-[#D8CBB6] text-xs font-semibold text-[#44312A]"
                      >
                        <span className="w-4 h-4 rounded border border-[#44312A] flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-mono">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Statutory Disclaimer Notice */}
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#D8CBB6] text-[11px] text-[#504F47] flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-[#44312A] shrink-0 mt-0.5" />
                <span>{RISK_DISCLAIMER}</span>
              </div>
            </>
          )}
        </div>

        {/* 3. Modal Footer */}
        <div className="p-4 border-t border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between text-xs shrink-0">
          <span className="text-[#8C7769] text-[11px] font-mono hidden sm:inline">
            JanDrishti AI Investigation Engine • Safe Statistical Review
          </span>
          <div className="flex items-center space-x-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#D8CBB6] bg-white rounded-xl hover:bg-[#FAF7F2] text-[#44312A] font-bold transition cursor-pointer"
            >
              Close
            </button>
            {onUpdateStatus && (
              <button
                onClick={() => {
                  onUpdateStatus(workId, 'Under Review');
                  onClose();
                }}
                className="px-4 py-2 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded-xl font-bold transition cursor-pointer shadow-xs"
              >
                Mark "Under Review"
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
