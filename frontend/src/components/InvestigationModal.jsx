import React, { useEffect, useState } from 'react';
import { X, Sparkles, CheckCircle2, ShieldAlert, Cpu, Terminal, FileCheck, Layers } from 'lucide-react';
import { runAIInvestigation } from '../api/client';

export default function InvestigationModal({ workId, onClose, onUpdateStatus }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

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
    <div className="fixed inset-0 z-50 bg-[#44312A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#D8CBB6] overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#D8CBB6] flex items-center justify-between bg-[#44312A] text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#504F47] rounded-xl border border-[#D8CBB6]/40">
              <Sparkles className="w-5 h-5 text-[#E7DDCA] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm">AI Investigation Agent</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#504F47] text-[#FAF7F2] border border-[#D8CBB6]/40">
                  Autonomous Tool Orchestration
                </span>
              </div>
              <p className="text-xs text-[#FAF7F2]/80 mt-0.5">
                Investigating Work: <span className="font-mono text-[#E7DDCA] font-bold">{workId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#FAF7F2]/70 hover:text-white hover:bg-[#504F47] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#D8CBB6] border-t-[#44312A] rounded-full animate-spin" />
              <div className="text-center">
                <div className="font-bold text-[#44312A] text-sm">Agent In Progress...</div>
                <div className="text-xs text-[#504F47] mt-1">
                  Calling deterministic tools: get_cost_analysis(), check_duplicate(), get_mp_financials()...
                </div>
              </div>
            </div>
          ) : !result ? (
            <div className="py-16 text-center text-[#44312A] font-bold">
              Failed to run AI investigation. Check backend connection.
            </div>
          ) : (
            <>
              {/* Top Synthesis Card */}
              <div className="p-4 rounded-2xl border bg-[#FAF7F2] border-[#D8CBB6] text-[#44312A]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-[#44312A]" />
                    <span className="font-bold text-sm">Investigation Verdict: {result.risk_level} Risk</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#D8CBB6] text-[#44312A] shadow-2xs">
                      Score: {result.overall_score} / 100
                    </span>
                  </div>
                  <span className="text-[10px] text-[#504F47] font-mono">
                    Generated {new Date(result.generated_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-2 text-xs font-semibold text-[#44312A]">
                  {result.work_title}
                </div>
              </div>

              {/* Primary Evidence-Backed Reasons */}
              <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#D8CBB6]">
                <h4 className="font-bold text-[#44312A] mb-2.5 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-[#44312A]" />
                  <span>Surfaced Primary Irregularity Signals</span>
                </h4>
                <ul className="space-y-2">
                  {result.primary_reasons.map((r, i) => (
                    <li key={i} className="flex items-start space-x-2 text-[#504F47] bg-white p-3 rounded-xl border border-[#D8CBB6]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#44312A] mt-1.5 shrink-0" />
                      <span className="leading-relaxed font-semibold">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Duplicate Matches Table */}
              {result.matched_works && result.matched_works.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-[#D8CBB6] shadow-xs">
                  <h4 className="font-bold text-[#44312A] mb-2.5 flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-[#44312A]" />
                    <span>Identified Duplicate / Overlapping Candidates</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FAF7F2] text-[#504F47] border-b border-[#D8CBB6] text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Matched Work ID</th>
                          <th className="py-2 px-3">Title</th>
                          <th className="py-2 px-2">Cost</th>
                          <th className="py-2 px-2">Text Match</th>
                          <th className="py-2 px-2">Spatial Proximity</th>
                          <th className="py-2 px-3 text-right">Combined Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8CBB6]">
                        {result.matched_works.map((m, idx) => (
                          <tr key={idx} className="hover:bg-[#FAF7F2]">
                            <td className="py-2 px-3 font-mono font-bold text-[#44312A]">{m.matched_work_id}</td>
                            <td className="py-2 px-3 font-semibold text-[#44312A] max-w-xs truncate">{m.matched_title}</td>
                            <td className="py-2 px-2 font-bold font-mono text-[#44312A]">₹{m.matched_cost_lakhs}L</td>
                            <td className="py-2 px-2 font-mono text-[#504F47]">{m.text_similarity}%</td>
                            <td className="py-2 px-2 font-mono text-[#504F47]">{m.geographic_similarity}%</td>
                            <td className="py-2 px-3 text-right font-bold text-[#44312A] font-mono">{m.combined_similarity}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommended Action & Data Limitations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-[#D8CBB6] bg-[#FAF7F2]">
                  <div className="font-bold text-[#44312A] mb-1 flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-[#44312A]" />
                    <span>Recommended Human Verification Action</span>
                  </div>
                  <p className="text-[#504F47] font-medium leading-relaxed mt-1">
                    {result.recommended_action}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-[#D8CBB6] bg-[#FAF7F2]">
                  <div className="font-bold text-[#44312A] mb-1">
                    Data Limitations & Audit Boundaries
                  </div>
                  <ul className="text-[#504F47] space-y-1 list-disc list-inside">
                    {result.data_limitations && result.data_limitations.length > 0 ? (
                      result.data_limitations.map((d, idx) => <li key={idx}>{d}</li>)
                    ) : (
                      <li>No severe data completeness limitations observed.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Tool Execution Trace */}
              <div className="border border-[#D8CBB6] rounded-2xl overflow-hidden">
                <div className="bg-[#FAF7F2] text-[#44312A] p-3 border-b border-[#D8CBB6] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-[#44312A]" />
                    <span className="font-mono text-xs font-bold">Agent Tool Execution Audit Trail</span>
                  </div>
                  <span className="text-[10px] text-[#504F47] font-mono">
                    {result.tools_called?.length || 0} Deterministic Tools Invoked
                  </span>
                </div>
                <div className="p-3 bg-white text-[#504F47] font-mono text-[11px] space-y-2 max-h-48 overflow-y-auto">
                  {result.tools_called?.map((tc, idx) => (
                    <div key={idx} className="border-b border-[#D8CBB6] pb-1.5 last:border-0">
                      <div className="flex items-center space-x-2 text-[#44312A]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold">{tc.tool}({JSON.stringify(tc.arguments)})</span>
                      </div>
                      <div className="text-[#8C7769] pl-5 text-[10px] truncate mt-0.5">
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
        <div className="p-4 border-t border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between text-xs">
          <span className="text-[#504F47] italic text-[11px]">
            Investigation findings are signed and logged to the central audit registry.
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#D8CBB6] rounded-xl hover:bg-[#FAF7F2] text-[#504F47] font-bold transition"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onUpdateStatus) onUpdateStatus(workId, 'Under Review');
                onClose();
              }}
              className="px-4 py-2 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded-xl font-bold shadow-xs transition"
            >
              Mark Alert "Under Review"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
