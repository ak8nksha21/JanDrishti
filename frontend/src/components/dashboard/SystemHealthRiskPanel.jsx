import React from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Info,
  TrendingUp,
  FileCheck,
  Copy,
  MapPin,
  Calculator,
  PieChart,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Badge from '../ui/Badge';
import { Link } from '../../router/Router';
import { formatIndianNumber } from '../../utils/formatting';
import { RISK_DISCLAIMER } from '../../utils/riskLanguage';

export default function SystemHealthRiskPanel({
  dashboardData,
  healthStatus = null,
  loading = false,
}) {
  const works = dashboardData?.works_summary || {};
  const mps = dashboardData?.mps_summary || {};

  const riskReviewSignals = [
    {
      id: 'cost_anomaly',
      icon: Calculator,
      title: 'Cost Anomaly Detection',
      weight: '25% Weight',
      level: 'Statistical Baseline',
      badgeVariant: 'warning',
      description:
        'Scans executed expenditures against category and state median benchmarks to highlight significant cost deviations for field review.',
      scope: works.total_works !== null ? `${formatIndianNumber(works.total_works)} Works Evaluated` : 'Live Feed',
      actionText: 'Explore Works',
      link: '/works',
    },
    {
      id: 'utilization_anomaly',
      icon: PieChart,
      title: 'Financial & Utilization Gap',
      weight: '15% Weight',
      level: 'Allocation Ledger',
      badgeVariant: 'default',
      description:
        'Monitors the divergence between sanctioned constituency allocations, completed works valuation, and unspent balances.',
      scope: mps.total_mps !== null ? `${formatIndianNumber(mps.total_mps)} MPs Monitored` : 'Live Feed',
      actionText: 'Inspect MPs',
      link: '/mps',
    },
    {
      id: 'duplicate_works',
      icon: Copy,
      title: 'Duplicate & Overlapping Works',
      weight: '20% Weight',
      level: 'Similarity Match',
      badgeVariant: 'warning',
      description:
        'Cross-checks project descriptions, executing timelines, and location names across constituencies to detect potential duplicate proposals.',
      scope: 'Pairwise Cross-Match',
      actionText: 'View Works',
      link: '/works',
    },
    {
      id: 'geographic_signal',
      icon: MapPin,
      title: 'Geographic & Proximity Signal',
      weight: '10% Weight',
      level: 'Spatial Audit',
      badgeVariant: 'outline',
      description:
        'Audits physical proximity clustering, district boundaries, and flags missing or irregular geotagging coordinates.',
      scope: `${works.unique_constituencies || 21} Constituencies`,
      actionText: 'Review Map',
      link: '/works',
    },
    {
      id: 'data_quality',
      icon: FileCheck,
      title: 'Data Quality & Evidence Completeness',
      weight: '5% Weight',
      level: 'Provenance Check',
      badgeVariant: 'outline',
      description:
        'Verifies record completeness including implementing agency attribution, photo documentation metadata, and citizen beneficiary counts.',
      scope: 'Record Audit',
      actionText: 'Inspect Works',
      link: '/works',
    },
  ];


  return (
    <div className="space-y-6">
      {/* Section Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-[#44312A] tracking-tight font-display">
              Risk & Anomaly Oversight Signals
            </h2>
            <Badge variant="primary" size="sm" dot>
              6-SIGNAL ENGINE ACTIVE
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Statistical indicators that transform raw public expenditures into explainable signals for administrative inquiry.
          </p>
        </div>

        <Link
          to="/analytics"
          className="text-xs font-bold text-[#44312A] hover:underline flex items-center gap-1 w-fit bg-white px-3 py-1.5 rounded-xl border border-[#D8CBB6] shadow-2xs"
        >
          <span>View Detailed Analytical Suite</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Grid of 5 Key Risk/Anomaly Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {riskReviewSignals.map((signal) => {
          const Icon = signal.icon;
          return (
            <Card
              key={signal.id}
              className="p-5 flex flex-col justify-between hover:border-[#44312A] hover:shadow-md transition duration-200 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-[#44312A] group-hover:bg-[#44312A] group-hover:text-[#E7DDCA] transition">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#44312A] leading-tight">
                        {signal.title}
                      </h3>
                      <span className="text-[10px] font-mono text-[#8C7769]">
                        {signal.weight}
                      </span>
                    </div>
                  </div>
                  <Badge variant={signal.badgeVariant} size="sm">
                    {signal.level}
                  </Badge>
                </div>

                <p className="text-[11px] text-[#504F47] leading-relaxed">
                  {signal.description}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-[#D8CBB6] flex items-center justify-between text-[11px]">
                <span className="text-[#504F47] font-mono">{signal.scope}</span>
                <Link
                  to={signal.link}
                  className="text-[#44312A] hover:underline font-bold inline-flex items-center gap-0.5"
                >
                  <span>{signal.actionText}</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          );
        })}

        {/* 6th Card: Explanatory Model Summary Card */}
        <Card className="p-5 flex flex-col justify-between bg-[#FAF7F2] border-[#D8CBB6]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-white border border-[#D8CBB6] flex items-center justify-center text-[#44312A]">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#44312A]">
                  Canonical Weighted Risk Score
                </h3>
                <span className="text-[10px] font-mono text-[#8C7769]">
                  0 – 100 Risk Index
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#504F47] leading-relaxed">
              Synthesizes all 6 signals with strict data completeness checks. If data is missing, the engine preserves data honesty rather than defaulting to zero.
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-[#D8CBB6] flex items-center justify-between text-[11px]">
            <span className="font-mono text-[#8C7769]">ML Anomaly: 25%</span>
            <Link
              to="/works"
              className="text-[#44312A] hover:underline font-bold inline-flex items-center gap-0.5"
            >
              <span>Inspect Scored Works</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Institutional Governance Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-[#F4EFE6] border border-[#D8CBB6] text-xs text-[#44312A] flex items-start gap-2.5">
        <Info className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#44312A]">Civic Governance Notice: </strong>
          {RISK_DISCLAIMER} All scores indicate heuristic priority for administrative review rather than legal conclusions.
        </p>
      </div>
    </div>
  );
}
