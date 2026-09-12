import React from 'react';
import {
  Briefcase,
  IndianRupee,
  Calculator,
  Users,
  Building2,
  MapPin,
  TrendingUp,
  Clock,
  PiggyBank,
  ArrowUpRight,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import Card from '../ui/Card';
import { KPISkeleton } from '../ui/Skeleton';
import {
  formatCroresLakhs,
  formatIndianNumber,
  formatIndianCurrency,
} from '../../utils/formatting';

export default function KPIGrid({ dashboardData, loading = false }) {
  if (loading || !dashboardData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6"><KPISkeleton /></div>
        <div className="md:col-span-6"><KPISkeleton /></div>
        <div className="md:col-span-3"><KPISkeleton /></div>
        <div className="md:col-span-3"><KPISkeleton /></div>
        <div className="md:col-span-3"><KPISkeleton /></div>
        <div className="md:col-span-3"><KPISkeleton /></div>
      </div>
    );
  }

  const works = dashboardData?.works_summary || {};
  const mps = dashboardData?.mps_summary || {};

  // Formatted financial amounts with strict null preservation
  const totalCost = formatCroresLakhs(works.total_cost);
  const avgCost = formatCroresLakhs(works.average_cost);
  const totalAllocated = formatCroresLakhs(mps.total_allocated_amount);
  const totalExpenditure = formatCroresLakhs(mps.total_expenditure);
  const totalUnspent = formatCroresLakhs(mps.total_unspent_amount);

  // National Expenditure Ratio (true expenditure / allocation)
  const totalAllocNum = Number(mps.total_allocated_amount || 0);
  const totalExpNum = Number(mps.total_expenditure || 0);
  const natExpRatio = totalAllocNum > 0 ? (totalExpNum / totalAllocNum) * 100 : 0;
  const utilizationDisplay = `${natExpRatio.toFixed(1)}%`;

  return (
    <div className="space-y-4">
      {/* Asymmetric Tier 1: Two Featured Hero Anchor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Hero Card 1: Total Executed Public Outlay (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#D8CBB6] shadow-xs hover:border-[#44312A] hover:shadow-md p-6 sm:p-7 relative overflow-hidden transition-all duration-300 group flex flex-col justify-between">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#44312A]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#44312A]/10 transition duration-500" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-[#E7DDCA] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#504F47] font-bold block">
                    Verified Disbursements
                  </span>
                  <span className="text-xs font-semibold text-[#44312A]">
                    National Financial Outlay (774 MPs)
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-[#FAF7F2] text-[#44312A] px-2.5 py-1 rounded-full border border-[#D8CBB6]">
                All-India Ledger
              </span>
            </div>

            <div className="space-y-1 my-3">
              <div
                className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#44312A] font-mono tracking-tight"
                title={`Exact: ${totalExpenditure.exact}`}
              >
                {totalExpenditure.compact}
              </div>
              <div className="text-xs text-[#504F47] font-mono">
                Exact Verified Outlay: <strong className="text-[#44312A]">{totalExpenditure.exact}</strong>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-[#D8CBB6] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#504F47]">
              <span>Total Allocated Limit:</span>
              <strong className="text-[#44312A] font-mono">{totalAllocated.compact}</strong>
            </div>
            <div className="flex items-center gap-2 text-[#504F47] font-mono text-[11px]">
              <span>National Expenditure Ratio:</span>
              <strong className="text-[#44312A] font-bold">{utilizationDisplay}</strong>
            </div>
          </div>
        </div>

        {/* Hero Card 2: Physical Works Infrastructure Delivery (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#D8CBB6] shadow-xs hover:border-[#44312A] hover:shadow-md p-6 sm:p-7 relative overflow-hidden transition-all duration-300 group flex flex-col justify-between">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#44312A]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#44312A]/10 transition duration-500" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-[#E7DDCA] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#504F47] font-bold block">
                    Active Works Registry
                  </span>
                  <span className="text-xs font-semibold text-[#44312A]">
                    Itemized Completed Works Sample
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-[#FAF7F2] text-[#44312A] px-2.5 py-1 rounded-full border border-[#D8CBB6]">
                Granular Registry
              </span>
            </div>

            <div className="space-y-1 my-3">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#44312A] font-mono tracking-tight">
                {formatIndianNumber(works.total_works)}
              </div>
              <div className="text-xs text-[#504F47]">
                National administrative registry across <strong className="text-[#44312A]">{works.unique_states || 36} States & UTs</strong> ({works.unique_constituencies || 539} constituencies)
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-[#D8CBB6] flex items-center justify-between text-xs text-[#504F47]">
            <span>Average Completed Work Cost:</span>
            <strong className="text-[#44312A] font-mono">{avgCost.compact}</strong>
          </div>
        </div>
      </div>

      {/* Asymmetric Tier 2: Four High-Density Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Average Cost */}
        <div className="rounded-2xl bg-white border border-[#D8CBB6] shadow-xs hover:border-[#44312A] hover:shadow-md p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
              Average Cost / Work
            </span>
            <div className="h-7 w-7 rounded-lg bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
              <Calculator className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black font-mono text-[#44312A] tracking-tight">
              {avgCost.compact}
            </div>
          </div>
          <div className="pt-2 border-t border-[#D8CBB6] text-[11px] text-[#504F47] truncate">
            Total Outlay: <span className="font-mono text-[#44312A] font-semibold">{totalCost.compact}</span>
          </div>
        </div>

        {/* Tile 2: Unspent Balance */}
        <div className="rounded-2xl bg-white border border-[#D8CBB6] shadow-xs hover:border-[#44312A] hover:shadow-md p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
              Unspent Balance
            </span>
            <div className="h-7 w-7 rounded-lg bg-[#E7DDCA] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black font-mono text-[#44312A] tracking-tight">
              {totalUnspent.compact}
            </div>
          </div>
          <div className="pt-2 border-t border-[#D8CBB6] text-[11px] text-[#504F47] truncate">
            Pending parliamentary utilization
          </div>
        </div>

        {/* Tile 3: Citizen Beneficiaries */}
        <div className="rounded-2xl bg-white border border-[#D8CBB6] shadow-xs hover:border-[#44312A] hover:shadow-md p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
              Citizen Beneficiaries
            </span>
            <div className="h-7 w-7 rounded-lg bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className={`font-black font-mono text-[#44312A] tracking-tight ${works.total_beneficiaries > 0 ? 'text-2xl' : 'text-lg text-[#8C7769]'}`}>
              {works.total_beneficiaries > 0 ? formatIndianNumber(works.total_beneficiaries) : 'Not Disclosed'}
            </div>
          </div>
          <div className="pt-2 border-t border-[#D8CBB6] text-[11px] text-[#504F47] truncate">
            {works.total_beneficiaries > 0 ? 'Reported citizen coverage' : 'Omitted in source feeds'}
          </div>
        </div>

        {/* Tile 4: States & UTs Monitored */}
        <div className="rounded-2xl bg-white border border-[#D8CBB6] shadow-xs hover:border-[#44312A] hover:shadow-md p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
              States & UTs Monitored
            </span>
            <div className="h-7 w-7 rounded-lg bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
              <MapPin className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black font-mono text-[#44312A] tracking-tight">
              {works.unique_states !== null ? `${works.unique_states} States & UTs` : '36 States & UTs'}
            </div>
          </div>
          <div className="pt-2 border-t border-[#D8CBB6] text-[11px] text-[#504F47] truncate">
            Full national coverage across all <span className="font-mono text-[#44312A] font-semibold">{works.unique_states || 36}</span> States & UTs
          </div>
        </div>
      </div>
    </div>
  );
}
