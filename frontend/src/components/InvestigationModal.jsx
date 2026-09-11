import React, { useEffect, useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertOctagon, ArrowRight, ShieldAlert, Cpu, Terminal, FileCheck, Layers } from 'lucide-react';
import { runAIInvestigation } from '../api/client';

export default function InvestigationModal({ workId, onClose, onUpdateStatus }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!workId) return;
    setLoading(true);
    runAIInvestigation(workId)
      .then((res) => {
        setResult(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [workId]);

  if (!workId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
              <Sparkles className="w-5 h-5 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm">AI Investigation Agent</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  Autonomous Tool Orchestration
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Investigating Work: <span className="font-mono text-indigo-300 font-bold">{workId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <div className="text-center">
                <div className="font-semibold text-slate-800 text-sm">Agent In Progress...</div>
                <div className="text-xs text-slate-400 mt-1">
                  Calling deterministic tools: get_cost_analysis(), check_duplicate(), get_mp_financials()...
                </div>
              </div>
            </div>
          ) : !result ? (
            <div className="py-16 text-center text-red-500">
              Failed to run AI investigation. Check backend connection.
            </div>
          ) : (
            <>
              {/* Top Synthesis Card */}
              <div className={`p-4 rounded-xl border ${
                result.risk_level === 'Critical' ? 'bg-rose-50/70 border-rose-200 text-rose-900' :
                result.risk_level === 'High' ? 'bg-orange-50/70 border-orange-200 text-orange-900' :
                result.risk_level === 'Medium' ? 'bg-amber-50/70 border-amber-200 text-amber-900' :
                'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-sm">Investigation Verdict: {result.risk_level} Risk</span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/70 shadow-2xs">
                      Score: {result.overall_score} / 100
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Generated {new Date(result.generated_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium text-slate-700">
                  {result.work_title}
                </div>
              </div>

              {/* Primary Evidence-Backed Reasons */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2.5 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span>Surfaced Primary Irregularity Signals</span>
                </h4>
                <ul className="space-y-2">
                  {result.primary_reasons.map((r, i) => (
                    <li key={i} className="flex items-start space-x-2 text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                      <span className="leading-relaxed font-medium">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Duplicate Matches Table (if any) */}
              {result.matched_works && result.matched_works.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                  <h4 className="font-semibold text-slate-800 mb-2.5 flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-orange-600" />
                    <span>Identified Duplicate / Overlapping Candidates</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b text-[10px] uppercase font-semibold">
                          <th className="py-2 px-3">Matched Work ID</th>
                          <th className="py-2 px-3">Title</th>
                          <th className="py-2 px-2">Cost</th>
                          <th className="py-2 px-2">Text Match</th>
                          <th className="py-2 px-2">Spatial Proximity</th>
                          <th className="py-2 px-3 text-right">Combined Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.matched_works.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-blue-700">{m.matched_work_id}</td>
                            <td className="py-2 px-3 font-medium text-slate-800 max-w-xs truncate">{m.matched_title}</td>
                            <td className="py-2 px-2 font-semibold">₹{m.matched_cost_lakhs}L</td>
                            <td className="py-2 px-2">{m.text_similarity}%</td>
                            <td className="py-2 px-2">{m.geographic_similarity}%</td>
                            <td className="py-2 px-3 text-right font-bold text-rose-600">{m.combined_similarity}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommended Action & Data Limitations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
                  <div className="font-semibold text-blue-900 mb-1 flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-blue-700" />
                    <span>Recommended Human Verification Action</span>
                  </div>
                  <p className="text-blue-950 font-medium leading-relaxed mt-1">
                    {result.recommended_action}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="font-semibold text-slate-700 mb-1">
                    Data Limitations & Audit Boundaries
                  </div>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside">
                    {result.data_limitations && result.data_limitations.length > 0 ? (
                      result.data_limitations.map((d, idx) => <li key={idx}>{d}</li>)
                    ) : (
                      <li>No severe data completeness limitations observed.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Tool Execution Trace (Deterministic Audit Trail) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-800 text-slate-200 p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-xs font-semibold">Agent Tool Execution Audit Trail</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {result.tools_called?.length || 0} Deterministic Tools Invoked
                  </span>
                </div>
                <div className="p-3 bg-slate-900 text-slate-300 font-mono text-[11px] space-y-2 max-h-48 overflow-y-auto">
                  {result.tools_called?.map((tc, idx) => (
                    <div key={idx} className="border-b border-slate-800 pb-1.5 last:border-0">
                      <div className="flex items-center space-x-2 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold">{tc.tool}({JSON.stringify(tc.arguments)})</span>
                      </div>
                      <div className="text-slate-400 pl-5 text-[10px] truncate mt-0.5">
                        Output: {JSON.stringify(tc.output)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 italic">
            Investigation findings are signed and logged to the central audit registry.
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onUpdateStatus) onUpdateStatus(workId, 'Under Review');
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs transition"
            >
              Mark Alert "Under Review"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
