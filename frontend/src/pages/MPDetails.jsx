import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  IndianRupee,
  ShieldAlert,
  TrendingUp,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import { fetchMPById } from '../services/mps';
import { formatCroresLakhs, formatIndianNumber } from '../utils/formatting';
import { calculateMPRisk, getMPRiskBadgeConfig, MP_RISK_DISCLAIMER } from '../utils/mpRisk';
import { useRouter, Link } from '../router/Router';

export default function MPDetails({ mpId: propMpId }) {
  const { path, navigate } = useRouter();
  const mpId = propMpId || path.split('/')[2];

  const [mp, setMp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mpId) return;

    const loadMP = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMPById(mpId);
        setMp(data);
      } catch (err) {
        console.error('Error fetching MP detail:', err);
        setError(`MP record '${mpId}' was not found in the database.`);
      } finally {
        setLoading(false);
      }
    };

    loadMP();
  }, [mpId]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !mp) {
    return (
      <div className="max-w-xl mx-auto pt-12">
        <ErrorState
          title="Parliamentarian Record Not Found"
          message={error || `Could not find MP record with ID "${mpId}".`}
          onRetry={() => navigate('/mps')}
        />
        <div className="mt-4 text-center">
          <Link
            to="/mps"
            className="text-xs text-[#44312A] hover:underline inline-flex items-center gap-1 font-bold"
          >
            <ArrowLeft className="h-3 w-3" /> Back to MP Performance List
          </Link>
        </div>
      </div>
    );
  }

  // Financial amounts formatted
  const allocated = formatCroresLakhs(mp.allocated_amount || 0);
  const expenditure = formatCroresLakhs(mp.total_expenditure || 0);
  const recommendedAmt = formatCroresLakhs(mp.total_recommended_amount || 0);
  const unspent = formatCroresLakhs(mp.unspent_amount || 0);

  // Utilization semantics: strictly separated
  const expUtil = mp.expenditure_percentage !== null && mp.expenditure_percentage !== undefined
    ? Number(mp.expenditure_percentage)
    : mp.allocated_amount
    ? (Number(mp.total_expenditure) / Number(mp.allocated_amount)) * 100
    : 0;

  const recUtil = mp.recommendation_utilization_percentage !== null && mp.recommendation_utilization_percentage !== undefined
    ? Number(mp.recommendation_utilization_percentage)
    : mp.utilization_percentage !== null && mp.utilization_percentage !== undefined
    ? Number(mp.utilization_percentage)
    : (mp.allocated_amount && mp.total_recommended_amount
    ? (Number(mp.total_recommended_amount) / Number(mp.allocated_amount)) * 100
    : 0);

  const completionRate = Number(
    mp.completion_rate !== null && mp.completion_rate !== undefined
      ? mp.completion_rate
      : (mp.recommended_works_count ? ((mp.completed_works_count || 0) / mp.recommended_works_count) * 100 : 0)
  );

  const pendingWorksCount = mp.pending_works !== null && mp.pending_works !== undefined
    ? mp.pending_works
    : Math.max(0, (mp.recommended_works_count || 0) - (mp.completed_works_count || 0));

  // Compute Indicative MP Portfolio Risk using existing 5-factor engine
  const mpRisk = calculateMPRisk(mp);
  const riskBadge = getMPRiskBadgeConfig(mpRisk.level);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back to list */}
      <button
        onClick={() => navigate('/mps')}
        className="inline-flex items-center gap-1.5 text-xs text-[#504F47] hover:text-[#44312A] font-semibold transition cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Return to MP Directory</span>
      </button>

      {/* Executive Profile Header Banner */}
      <div className="p-6 rounded-3xl border border-[#D8CBB6] bg-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-center text-xl font-bold text-[#44312A] font-mono shadow-xs">
              {mp.mp_name ? mp.mp_name.substring(0, 2).toUpperCase() : 'MP'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={mp.house === 'Rajya Sabha' ? 'outline' : 'primary'} size="sm">
                  {mp.house || 'Lok Sabha'}
                </Badge>
                <span className="text-xs font-mono text-[#8C7769]">ID #{mp.id}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#44312A] mt-1 font-display">
                {mp.mp_name}
              </h1>
              <div className="text-xs text-[#504F47] flex items-center gap-2 mt-0.5">
                <span className="font-semibold text-[#44312A]">{mp.constituency || 'Constituency Unspecified'}</span>
                <span>•</span>
                <span>{mp.state || 'State'}</span>
              </div>
            </div>
          </div>

          {/* Quick link to itemized works available for this MP / constituency */}
          {mp.constituency && (
            <Link
              to={
                mp.state
                  ? `/works?state=${encodeURIComponent(mp.state.trim())}&constituency=${encodeURIComponent(mp.constituency.trim())}&mp_name=${encodeURIComponent(mp.mp_name ? mp.mp_name.trim() : '')}`
                  : `/works?constituency=${encodeURIComponent(mp.constituency.trim())}&mp_name=${encodeURIComponent(mp.mp_name ? mp.mp_name.trim() : '')}`
              }
              className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] text-xs font-bold flex items-center gap-2 transition w-fit shadow-xs"
            >
              <Briefcase className="h-3.5 w-3.5 text-[#44312A]" />
              <span>Itemized works currently available for this MP</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Row 1: Financial Ledger Overview & Works Execution Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Financial Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Financial Ledger Overview</CardTitle>
              <IndianRupee className="h-4 w-4 text-[#44312A]" />
            </div>
            <CardDescription>
              Government allocated entitlement and audited expenditure disbursements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                  Allocated Limit
                </span>
                <span className="text-base font-bold font-mono text-[#44312A]">
                  {allocated.compact}
                </span>
                <span className="text-[10px] text-[#8C7769] block mt-0.5 font-mono">
                  {allocated.exact}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                  Total Expenditure
                </span>
                <span className="text-base font-bold font-mono text-[#44312A]">
                  {expenditure.compact}
                </span>
                <span className="text-[10px] text-[#8C7769] block mt-0.5 font-mono">
                  {expenditure.exact}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#D8CBB6]">
              <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                <div>
                  <span className="text-[#44312A] font-bold block">Expenditure Utilization</span>
                  <span className="text-[10px] text-[#8C7769]">Disbursed expenditure / Allocation</span>
                </div>
                <span className="font-mono font-bold text-sm text-[#44312A]">
                  {expUtil.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                <div>
                  <span className="text-[#504F47] font-semibold block">Recommendation Utilization</span>
                  <span className="text-[10px] text-[#8C7769]">Recommended works value / Allocation</span>
                </div>
                <span className="font-mono font-bold text-[#504F47]">
                  {recUtil.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                <span className="text-[#504F47]">Unspent Parliamentary Balance</span>
                <span className="font-mono font-bold text-[#504F47]">
                  {unspent.compact}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <div>
                  <span className="text-[#504F47] block">In-Progress Outlays Ratio</span>
                  <span className="text-[10px] text-[#8C7769]">Disbursements tied to active uncompleted works</span>
                </div>
                <span className="font-mono text-[#44312A]">
                  {mp.payment_gap_percentage ? `${Number(mp.payment_gap_percentage).toFixed(1)}%` : 'Standard'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Works Overview & Completion Rate */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sanction & Completion Statistics</CardTitle>
              <Briefcase className="h-4 w-4 text-[#44312A]" />
            </div>
            <CardDescription>
              Volume of recommended, completed, and pending infrastructure projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">Recommended</span>
                <span className="text-lg font-black font-mono text-[#44312A] mt-1 block">
                  {mp.recommended_works_count || 0}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">Completed</span>
                <span className="text-lg font-black font-mono text-[#44312A] mt-1 block">
                  {mp.completed_works_count || 0}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">Pending</span>
                <span className="text-lg font-black font-mono text-[#6B5145] mt-1 block">
                  {pendingWorksCount}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#44312A] font-bold">Physical Completion Rate</span>
                <span className="font-mono font-bold text-[#44312A]">
                  {completionRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#E7DDCA] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#44312A] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-[11px] text-[#504F47] leading-relaxed">
              <strong>Reporting Notice: </strong> Recommended count indicates sanctioned proposals submitted to District Nodal Authorities; completed works reflects verified completion certificates.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Indicative MP Portfolio Risk Card (5-Factor Engine) */}
      <Card className="border-2 border-[#D8CBB6]">
        <CardHeader className="bg-[#FAF7F2] border-b border-[#D8CBB6]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#44312A]" />
              <div>
                <CardTitle className="text-base text-[#44312A]">Indicative MP Portfolio Risk</CardTitle>
                <CardDescription className="text-xs text-[#504F47]">
                  Composite multi-factor risk index computed from legislative financial and execution records
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-[#8C7769] block font-bold">Portfolio Score</span>
                <span className="text-2xl font-black font-mono text-[#44312A]">
                  {mpRisk.score !== null ? `${mpRisk.score}` : 'N/A'}
                  <span className="text-xs font-normal text-[#8C7769]"> / 100</span>
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-xl text-xs font-bold border ${riskBadge.bgClass}`}
              >
                {mpRisk.level} Risk
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Top Contributing Signals Chips */}
          {mpRisk.topSignals && mpRisk.topSignals.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
                Key Analytical Indicators
              </span>
              <div className="flex flex-wrap gap-2">
                {mpRisk.topSignals.map((sig, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-xs font-medium text-[#44312A]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#44312A]" />
                    {sig}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5-Factor Detailed Risk Breakdown */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
              Multi-Factor Risk Breakdown (5 Core Signals — 20% Each)
            </span>
            <div className="grid grid-cols-1 gap-3">
              {mpRisk.breakdown && mpRisk.breakdown.map((item) => (
                <div
                  key={item.key}
                  className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-[#44312A]">{item.title}</strong>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#504F47] border border-[#D8CBB6]">
                        Weight: {item.weight}%
                      </span>
                    </div>
                    <p className="text-[#504F47] text-[11px] leading-relaxed">
                      {item.explanation}
                    </p>
                    <span className="text-[10px] text-[#8C7769] font-mono block">
                      Metric: {item.sourceMetric}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 sm:border-l sm:border-[#D8CBB6] sm:pl-4">
                    <div className="text-right">
                      <span className="text-[10px] text-[#8C7769] block font-mono">Reported Value</span>
                      <span className="font-mono font-bold text-[#44312A] block">{item.valueDisplay}</span>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <span className="text-[10px] text-[#8C7769] block font-mono">Factor Score</span>
                      <span className={`font-mono font-bold text-sm ${
                        item.score >= 70 ? 'text-[#44312A]' : item.score >= 40 ? 'text-[#6B5145]' : 'text-[#8C7769]'
                      }`}>
                        {item.score} / 100
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory Analytical Disclaimer */}
          <div className="p-3.5 rounded-2xl bg-[#F4EFE6] border border-[#D8CBB6] text-xs text-[#504F47] flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-[#44312A]">Methodology Notice: </strong>
              {MP_RISK_DISCLAIMER}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Trend Intelligence Context Card (Supplementary Temporal Evidence) */}
      <Card className="bg-white">
        <CardHeader className="bg-[#FAF7F2] border-b border-[#D8CBB6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#44312A]" />
              <CardTitle className="text-sm text-[#44312A]">Trend Intelligence (Supplementary Temporal Context)</CardTitle>
            </div>
            <Badge variant="outline" size="sm">
              TEMPORAL CONTEXT
            </Badge>
          </div>
          <CardDescription className="text-xs text-[#504F47]">
            Historical velocity analysis (evaluated separately from canonical risk scores)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Completion Velocity Context */}
            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#44312A]">Project Completion Velocity</span>
                <Badge variant="primary" size="sm">GRANULAR SAMPLE</Badge>
              </div>
              <p className="text-[#504F47] text-[11px] leading-relaxed">
                Completion activity is derived from source-reported dates on itemized works in the registry. Evaluates quarterly project completion velocity across available records.
              </p>
            </div>

            {/* Financial Velocity Context */}
            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#44312A]">Financial Cashflow Trajectory</span>
                <Badge variant="outline" size="sm">SINGLE SNAPSHOT</Badge>
              </div>
              <p className="text-[#504F47] text-[11px] leading-relaxed">
                Status: <strong>Insufficient Historical Data</strong>. Current public records provide a cumulative snapshot of total allocations and expenditures without periodic disbursement ledgers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
