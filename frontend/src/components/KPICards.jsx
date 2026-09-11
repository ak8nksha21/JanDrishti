import React from 'react';
import { Briefcase, IndianRupee, AlertCircle, AlertOctagon, TrendingUp } from 'lucide-react';

export default function KPICards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      label: 'Total Works Monitored',
      value: summary.total_works,
      subtext: 'Across monitored states',
      icon: Briefcase,
      color: 'text-[#44312A]',
      bg: 'bg-[#FAF7F2]',
      border: 'border-[#D8CBB6]',
    },
    {
      label: 'Fund Allocation',
      value: `₹${(summary.total_allocation / 100).toFixed(1)} Cr`,
      subtext: `Expenditure: ₹${(summary.total_expenditure / 100).toFixed(1)} Cr`,
      icon: IndianRupee,
      color: 'text-[#44312A]',
      bg: 'bg-[#FAF7F2]',
      border: 'border-[#D8CBB6]',
    },
    {
      label: 'Average Utilization',
      value: `${summary.average_utilization}%`,
      subtext: 'Across all constituencies',
      icon: TrendingUp,
      color: 'text-[#44312A]',
      bg: 'bg-[#FAF7F2]',
      border: 'border-[#D8CBB6]',
    },
    {
      label: 'Flagged Risk Works',
      value: summary.high_risk_works,
      subtext: 'Flagged for officer verification',
      icon: AlertOctagon,
      color: 'text-[#6B5145]',
      bg: 'bg-[#FAF7F2]',
      border: 'border-[#D8CBB6]',
    },
    {
      label: 'Active Critical Alerts',
      value: summary.critical_alerts,
      subtext: 'Requires immediate review',
      icon: AlertCircle,
      color: 'text-[#44312A]',
      bg: 'bg-[#FAF7F2]',
      border: 'border-[#D8CBB6]',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-4 rounded-3xl border bg-white shadow-xs transition-transform hover:-translate-y-0.5 ${card.border}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#504F47]">{card.label}</span>
              <div className={`p-2 rounded-2xl border border-[#D8CBB6] ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#44312A] tracking-tight font-mono">{card.value}</span>
            </div>
            <p className="text-[11px] text-[#8C7769] mt-1 font-medium">{card.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}

