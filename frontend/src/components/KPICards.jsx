import React from 'react';
import { Briefcase, IndianRupee, PieChart, AlertCircle, AlertOctagon, TrendingUp } from 'lucide-react';

export default function KPICards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      label: 'Total Works Monitored',
      value: summary.total_works,
      subtext: 'Across 6 monitored states',
      icon: Briefcase,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      label: 'Fund Allocation',
      value: `₹${(summary.total_allocation / 100).toFixed(1)} Cr`,
      subtext: `Expenditure: ₹${(summary.total_expenditure / 100).toFixed(1)} Cr`,
      icon: IndianRupee,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      label: 'Average Utilization',
      value: `${summary.average_utilization}%`,
      subtext: 'Across all constituencies',
      icon: TrendingUp,
      color: summary.average_utilization > 70 ? 'text-teal-600' : 'text-amber-600',
      bg: summary.average_utilization > 70 ? 'bg-teal-50' : 'bg-amber-50',
      border: summary.average_utilization > 70 ? 'border-teal-100' : 'border-amber-100',
    },
    {
      label: 'High & Critical Risk Works',
      value: summary.high_risk_works,
      subtext: 'Flagged for officer verification',
      icon: AlertOctagon,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
    {
      label: 'Active Critical Alerts',
      value: summary.critical_alerts,
      subtext: 'Requires immediate review',
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-4 rounded-xl border bg-white shadow-xs transition-transform hover:-translate-y-0.5 ${card.border}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">{card.value}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{card.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}
