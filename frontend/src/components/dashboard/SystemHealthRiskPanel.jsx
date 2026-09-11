import React from 'react';
import {
  Database,
  Layers,
  AlertTriangle,
  ChevronRight,
  Info,
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
  const dataSources = dashboardData?.data_sources || {};
  const macroIndicators = dashboardData?.macro_indicators || {};
  const works = dashboardData?.works_summary || {};
  const mps = dashboardData?.mps_summary || {};

  const empowered = dataSources.empowered_indian || {};
  const mospi = dataSources.mospi_esakshi || {};

  // Macro metrics array from dashboard dictionary
  const macroList = Object.entries(macroIndicators).map(([key, item]) => ({
    key,
    name: item.metric_name || key.replace(/_/g, ' ').toUpperCase(),
    valueCrores: item.value_crores || null,
    count: item.count !== null && item.count !== undefined ? item.count : null,
    valueRaw: item.value_raw || null,
  }));

  const riskReviewSignals = [
    {
      id: 'cost_outliers',
      title: 'Statistical Cost Outlier Scan',
      level: 'Flagged Risk',
      badgeVariant: 'warning',
      description:
        'Identifies works whose final executed cost deviates beyond 2.5 standard deviations from the state/category baseline for human review.',
      scope: works.total_works !== null ? `${formatIndianNumber(works.total_works)} Works Analyzed` : 'N/A',
      actionText: 'Explore Works Registry',
      link: '/works',
    },
    {
      id: 'utilization_divergence',
      title: 'Expenditure & Entitlement Gap',
      level: 'Needs Review',
      badgeVariant: 'default',
      description:
        'Flags parliamentarian allocations where the gap between recommended works and completed disbursements exceeds normative thresholds.',
      scope: mps.total_mps !== null ? `${formatIndianNumber(mps.total_mps)} MPs Monitored` : 'N/A',
      actionText: 'Inspect MP Ledgers',
      link: '/mps',
    },
    {
      id: 'data_completeness',
      title: 'Geospatial & Metadata Quality Audit',
      level: 'Needs Review',
      badgeVariant: 'outline',
      description:
        'Continuous audit verifying GPS coordinate presence, implementing agency attribution, and citizen beneficiary completeness in ingested records.',
      scope: 'Live Feed Verification',
      actionText: 'View Data Sources',
      link: '/data-sources',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-[#44312A] tracking-tight font-display">
              System Health & Risk Summary
            </h2>
            <Badge variant="primary" size="sm" dot>
              SYSTEM ACTIVE
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Operational status of ingested data sources, official MoSPI benchmarks, and active risk monitoring signals.
          </p>
        </div>

        {healthStatus && (
          <div className="flex items-center gap-2 text-xs font-mono text-[#44312A] bg-white px-3 py-1.5 rounded-xl border border-[#D8CBB6] shadow-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                healthStatus.isOnline ? 'bg-[#44312A]' : 'bg-transparent border border-[#44312A]'
              }`}
            />
            <span>FastAPI: {healthStatus.status || 'Connected'}</span>
            <span className="text-[#8C7769]">•</span>
            <span className="text-[#44312A] font-bold">{healthStatus.latencyMs || 0}ms</span>
          </div>
        )}
      </div>

      {/* Main Grid: Data Sources + MoSPI Benchmarks + Risk Review Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Data Sources Operational Status */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#44312A]" />
                <span>Data Sources Health</span>
              </CardTitle>
              <Badge variant="primary" size="sm">
                CONNECTED
              </Badge>
            </div>
            <CardDescription>
              Lineage and sync status of parliamentary data feeds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-1">
            {/* Empowered Indian Source */}
            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#44312A] font-mono">
                  empowered_indian
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] font-bold">
                  {empowered.status || 'Active'}
                </span>
              </div>
              <p className="text-[11px] text-[#504F47]">
                Granular itemized works and MP performance summaries.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                <div className="bg-white p-2 rounded-xl border border-[#D8CBB6]">
                  <span className="text-[#504F47] block text-[10px]">Ingested Works</span>
                  <span className="text-[#44312A] font-bold">
                    {formatIndianNumber(empowered.ingested_works)}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-[#D8CBB6]">
                  <span className="text-[#504F47] block text-[10px]">Ingested MPs</span>
                  <span className="text-[#44312A] font-bold">
                    {formatIndianNumber(empowered.ingested_mps)}
                  </span>
                </div>
              </div>
            </div>

            {/* MoSPI e-SAKSHI Source */}
            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#44312A] font-mono">
                  mospi_esakshi
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] font-bold">
                  {mospi.status || 'Active'}
                </span>
              </div>
              <p className="text-[11px] text-[#504F47]">
                Official national dashboard benchmark indicators.
              </p>
              <div className="bg-white p-2 rounded-xl border border-[#D8CBB6] text-[11px] font-mono flex items-center justify-between">
                <span className="text-[#504F47] text-[10px]">Macro Metrics Tracked</span>
                <span className="text-[#44312A] font-bold">
                  {formatIndianNumber(mospi.macro_metrics_tracked || macroList.length)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Official MoSPI Macro Metric Benchmarks */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#44312A]" />
                <span>MoSPI Macro Benchmarks</span>
              </CardTitle>
              <span className="text-[11px] font-mono text-[#504F47]">Official Feed</span>
            </div>
            <CardDescription>
              High-level governmental indicators for macro baseline validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {macroList.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] text-center space-y-1">
                <p className="text-xs text-[#44312A] font-semibold">
                  Official macro indicators awaiting synchronization.
                </p>
                <p className="text-[11px] text-[#504F47]">
                  Baseline metrics will populate upon MoSPI feed update.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {macroList.slice(0, 4).map((macro) => (
                  <div
                    key={macro.key}
                    className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="text-[#44312A] font-semibold block truncate">
                        {macro.name}
                      </span>
                      {macro.valueRaw && (
                        <span className="text-[10px] text-[#504F47] font-mono">
                          {macro.valueRaw}
                        </span>
                      )}
                    </div>
                    <div className="text-right font-mono shrink-0">
                      {macro.valueCrores ? (
                        <span className="font-bold text-[#44312A] block">
                          ₹{macro.valueCrores}
                        </span>
                      ) : macro.count !== null ? (
                        <span className="font-bold text-[#44312A] block">
                          {formatIndianNumber(macro.count)}
                        </span>
                      ) : (
                        <span className="text-[#504F47]">N/A</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-2 border-t border-[#D8CBB6] text-[11px] text-[#504F47] flex items-center justify-between">
              <span>Source Authority:</span>
              <span className="text-[#44312A] font-mono font-semibold">MoSPI e-Sakshi Portal</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Flagged Risk & Verification Signals */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#44312A]" />
                <span>Risk & Anomaly Signals</span>
              </CardTitle>
              <Badge variant="warning" size="sm">
                FLAGGED RISK
              </Badge>
            </div>
            <CardDescription>
              Heuristic patterns requiring administrative inspection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-1">
            {riskReviewSignals.map((signal) => (
              <div
                key={signal.id}
                className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1.5 hover:border-[#44312A] transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#44312A]">
                    {signal.title}
                  </span>
                  <Badge variant={signal.badgeVariant} size="sm">
                    {signal.level}
                  </Badge>
                </div>
                <p className="text-[11px] text-[#504F47] leading-relaxed">
                  {signal.description}
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-[#D8CBB6] text-[11px]">
                  <span className="text-[#504F47] font-mono">{signal.scope}</span>
                  <Link
                    to={signal.link}
                    className="text-[#44312A] hover:underline font-bold inline-flex items-center gap-0.5"
                  >
                    <span>{signal.actionText}</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Institutional Governance Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-[#F4EFE6] border border-[#D8CBB6] text-xs text-[#44312A] flex items-start gap-2.5">
        <Info className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#44312A]">Public Governance Assurance: </strong>
          {RISK_DISCLAIMER} All identifiers, allocations, and expenditures reflect verified parliamentary disclosures.
        </p>
      </div>
    </div>
  );
}
