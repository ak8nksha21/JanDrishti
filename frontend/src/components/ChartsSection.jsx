import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ShieldCheck, Info, AlertTriangle } from 'lucide-react';

export default function ChartsSection({ summary }) {
  if (!summary) return null;

  const distData = [
    { name: 'Critical (81-100)', value: summary.risk_distribution.Critical || 0, color: '#8A2616' },
    { name: 'High (61-80)', value: summary.risk_distribution.High || 0, color: '#9C4E15' },
    { name: 'Medium (31-60)', value: summary.risk_distribution.Medium || 0, color: '#D4A373' },
    { name: 'Low (0-30)', value: summary.risk_distribution.Low || 0, color: '#3E5C38' },
  ];

  const catData = (summary.category_risk || []).map(c => ({
    name: c.category.split(' ')[0] + '...',
    fullName: c.category,
    worksCount: c.works_count,
    totalCost: c.total_cost,
    avgRisk: c.avg_risk,
  }));

  return (
    <div className="space-y-6">
      {/* Guiding Principle Callout Banner */}
      <div className="bg-[#2D1D15] text-white p-4 rounded-xl shadow border border-[#4A3225] flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-amber-200 mt-0.5 shrink-0" />
        <div className="text-xs">
          <span className="font-semibold text-white">System Principle: </span>
          <span className="text-[#D4C4B5]">
            This platform generates quantitative risk scores and surfacing evidence using deterministic statistical peer benchmarking and scikit-learn Isolation Forests. It flags potential irregularities requiring verification; it does not declare wrongdoing. Human verification remains the final decision.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Distribution Chart */}
        <div className="bg-white p-5 rounded-xl border border-[#EAE3D8] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#231815] text-sm">Risk Severity Distribution</h3>
            <span className="text-xs text-[#8C7A70]">Total: {summary.total_works} works</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {distData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} works`, name]}
                  contentStyle={{ backgroundColor: '#FAF7F2', borderColor: '#EAE3D8', borderRadius: '0.5rem', fontSize: '12px', color: '#231815' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#EAE3D8] text-xs">
            {distData.map((d, i) => (
              <div key={i} className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-[#7A685D] truncate">{d.name.split(' ')[0]}: <strong className="text-[#231815]">{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Sectoral Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-[#EAE3D8] shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-[#231815] text-sm">Sectoral Spend & Average Risk Index</h3>
              <p className="text-xs text-[#7A685D]">Comparing sanctioned expenditure vs average anomaly score</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE3D8" />
                <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" tick={{ fontSize: 11, fill: '#7A685D' }} />
                <YAxis yAxisId="left" orientation="left" stroke="#8B5A2B" tick={{ fontSize: 11, fill: '#7A685D' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#3E2723" tick={{ fontSize: 11, fill: '#7A685D' }} domain={[0, 100]} />
                <Tooltip
                  formatter={(val, name) => [name === 'totalCost' ? `₹${val} Lakhs` : `${val} / 100`, name === 'totalCost' ? 'Total Spend' : 'Avg Risk']}
                  labelFormatter={(label, items) => items[0]?.payload?.fullName || label}
                  contentStyle={{ backgroundColor: '#FAF7F2', borderColor: '#EAE3D8', borderRadius: '0.5rem', fontSize: '12px', color: '#231815' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar yAxisId="left" dataKey="totalCost" name="Total Spend (₹ Lakhs)" fill="#8B5A2B" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="avgRisk" name="Avg Risk Score" fill="#3E2723" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Risk Constituencies */}
      <div className="bg-white p-5 rounded-xl border border-[#EAE3D8] shadow-xs">
        <h3 className="font-semibold text-[#231815] text-sm mb-3 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-[#8B5A2B]" />
          <span>Priority Jurisdictions: Top Risk Constituencies</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(summary.top_risk_constituencies || []).map((c, i) => (
            <div key={i} className="p-3 rounded-lg border border-[#EAE3D8] bg-[#FAF7F2] hover:bg-[#F3EDE2] transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#231815] truncate">{c.constituency}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  c.avg_risk >= 60 ? 'bg-[#8A2616]/10 text-[#8A2616] border border-[#8A2616]/20' : 'bg-[#9C4E15]/10 text-[#9C4E15] border border-[#9C4E15]/20'
                }`}>
                  Risk {c.avg_risk}
                </span>
              </div>
              <p className="text-[11px] text-[#7A685D] mt-1">{c.state}</p>
              <div className="mt-2 text-[11px] text-[#5C4A3E] flex justify-between border-t border-[#EAE3D8] pt-1.5 font-mono">
                <span>{c.works_count} Works</span>
                <span>₹{c.total_spend}L Spent</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
