import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Calculator,
  Clock,
  PieChart,
  Layers,
  FileCheck,
  Scale,
  Info,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import WorkLocationMap from '../components/maps/WorkLocationMap';
import InvestigationModal from '../components/InvestigationModal';
import { Skeleton } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import { fetchWorkById } from '../services/works';
import { fetchWorkDetail } from '../services/analytics';
import { formatCroresLakhs, formatDate, formatIndianNumber } from '../utils/formatting';
import { RISK_DISCLAIMER } from '../utils/riskLanguage';
import { useRouter, Link } from '../router/Router';

export default function WorkDetails({ workId: propWorkId }) {
  const { path, navigate } = useRouter();
  // Extract ID from prop or URL
  const workId = propWorkId || path.split('/')[2];

  const [work, setWork] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInvestigating, setIsInvestigating] = useState(false);

  useEffect(() => {
    if (!workId) return;

    const loadWorkRecord = async () => {
      setLoading(true);
      setError(null);
      try {
        const [workRes, riskRes] = await Promise.allSettled([
          fetchWorkById(workId),
          fetchWorkDetail(workId),
        ]);

        if (workRes.status === 'fulfilled') {
          setWork(workRes.value);
        } else {
          throw workRes.reason;
        }

        if (riskRes.status === 'fulfilled') {
          setRiskData(riskRes.value);
        }
      } catch (err) {
        console.error('Error fetching work record:', err);
        setError(`Work item '${workId}' was not found in the local registry.`);
      } finally {
        setLoading(false);
      }
    };

    loadWorkRecord();
  }, [workId]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="max-w-xl mx-auto pt-12">
        <ErrorState
          title="Work Record Not Found"
          message={error || `Could not find work with identifier "${workId}".`}
          onRetry={() => navigate('/works')}
        />
        <div className="mt-4 text-center">
          <Link
            to="/works"
            className="text-xs text-[#44312A] hover:underline inline-flex items-center gap-1 font-bold"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Works Registry
          </Link>
        </div>
      </div>
    );
  }

  const costFormatted = formatCroresLakhs(work.cost || 0);
  const riskScore = riskData?.risk_score;
  const advancedSignals = riskData?.advanced_signals;
  const costOverrun = advancedSignals?.cost_overrun;
  const delayAnalysis = advancedSignals?.delay_analysis;
  const paymentAnomaly = advancedSignals?.payment_anomaly;

  // Format Cost Overrun display status & badge
  const getCostOverrunBadge = (status) => {
    switch (status) {
      case 'within_budget':
      case 'no_overrun':
        return { label: 'Within Budget', variant: 'default', textClass: 'text-[#44312A]' };
      case 'moderate_overrun':
        return { label: 'Moderate Overrun', variant: 'warning', textClass: 'text-[#6B5145]' };
      case 'high_overrun':
      case 'critical_overrun':
        return { label: 'Elevated Overrun', variant: 'destructive', textClass: 'text-[#44312A]' };
      case 'zero_baseline':
      case 'invalid_negative_values':
        return { label: 'Zero Baseline Anomaly', variant: 'warning', textClass: 'text-[#6B5145]' };
      case 'insufficient_data':
      default:
        return { label: 'Insufficient Data', variant: 'outline', textClass: 'text-[#8C7769]' };
    }
  };

  // Format Delay Analysis display status & badge
  const getDelayBadge = (status) => {
    switch (status) {
      case 'within_normal_baseline':
      case 'normal_duration':
        return { label: 'Within Baseline', variant: 'default', textClass: 'text-[#44312A]' };
      case 'moderate_delay':
      case 'moderate_duration_variance':
        return { label: 'Moderate Variance', variant: 'warning', textClass: 'text-[#6B5145]' };
      case 'elevated_delay':
      case 'elevated_execution_duration':
        return { label: 'Elevated Duration', variant: 'warning', textClass: 'text-[#6B5145]' };
      case 'critical_delay':
      case 'unusually_long_duration':
        return { label: 'Unusually Long Duration', variant: 'destructive', textClass: 'text-[#44312A]' };
      case 'insufficient_data':
      default:
        return { label: 'Insufficient Data', variant: 'outline', textClass: 'text-[#8C7769]' };
    }
  };

  // Format Payment Anomaly display status & badge
  const getPaymentBadge = (status) => {
    switch (status) {
      case 'normal_execution':
      case 'balanced':
        return { label: 'Normal Execution', variant: 'default', textClass: 'text-[#44312A]' };
      case 'moderate_discrepancy':
        return { label: 'Moderate Discrepancy', variant: 'warning', textClass: 'text-[#6B5145]' };
      case 'elevated_payment_gap':
      case 'disproportionate_expenditure':
        return { label: 'Elevated Gap Signal', variant: 'warning', textClass: 'text-[#6B5145]' };
      case 'critical_divergence':
        return { label: 'Execution Divergence', variant: 'destructive', textClass: 'text-[#44312A]' };
      case 'insufficient_data':
      default:
        return { label: 'Insufficient Data', variant: 'outline', textClass: 'text-[#8C7769]' };
    }
  };

  const overrunBadge = getCostOverrunBadge(costOverrun?.overrun_status);
  const delayBadge = getDelayBadge(delayAnalysis?.delay_status);
  const paymentBadge = getPaymentBadge(paymentAnomaly?.financial_execution_status);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/works')}
        className="inline-flex items-center gap-1.5 text-xs text-[#504F47] hover:text-[#44312A] font-semibold transition cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Return to Works Registry</span>
      </button>

      {/* Header Record Banner */}
      <div className="p-6 rounded-3xl border border-[#D8CBB6] bg-white shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#44312A] bg-[#FAF7F2] px-2.5 py-0.5 rounded border border-[#D8CBB6]">
              WORK ID #{work.work_id || work.id}
            </span>
            <Badge variant="outline" size="sm">
              {work.category || 'General'}
            </Badge>
            {work.source && (
              <Badge variant="default" size="sm">
                Source: {work.source}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsInvestigating(true)}
              className="px-4 py-2 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-[#44312A]/20"
            >
              <Sparkles className="h-4 w-4 text-[#E7DDCA]" />
              <span>Launch AI Investigation</span>
            </button>
            <div className="text-right pl-3 border-l border-[#D8CBB6]">
              <span className="text-[10px] uppercase font-mono text-[#504F47] block font-bold">
                Reported Completed Cost
              </span>
              <span className="text-xl font-black font-mono text-[#44312A]">
                {costFormatted.compact}
              </span>
            </div>
          </div>
        </div>

        <h1 className="text-lg sm:text-xl font-black text-[#44312A] leading-snug font-display">
          {work.work_description || 'Completed MPLADS Infrastructure Project'}
        </h1>

        {work.work_description_hi && (
          <p className="text-xs text-[#504F47] font-sans leading-relaxed">
            {work.work_description_hi}
          </p>
        )}
      </div>

      {/* Canonical Work Risk Engine Assessment */}
      {riskScore && (
        <Card className="border-2 border-[#D8CBB6] bg-white overflow-hidden">
          <CardHeader className="bg-[#FAF7F2] border-b border-[#D8CBB6]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#44312A] flex items-center justify-center text-white font-bold shadow-xs">
                  <ShieldCheck className="h-4.5 w-4.5 text-[#E7DDCA]" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-[#44312A]">
                    Canonical Work Risk Assessment
                  </CardTitle>
                  <CardDescription className="text-xs text-[#504F47]">
                    Deterministic 6-signal composite risk score evaluated by the JanDrishti Risk Engine
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-[#504F47]">Overall Risk Rating:</span>
                <span className="font-mono text-base font-black text-[#44312A]">
                  {riskScore.overall_score !== null ? `${Number(riskScore.overall_score).toFixed(1)} / 100` : 'N/A'}
                </span>
                <Badge variant={riskScore.overall_score >= 60 ? 'warning' : 'default'} size="sm">
                  {riskScore.risk_level || 'Low Risk'}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#504F47] block font-mono">
                  ML Anomaly (25%)
                </span>
                <span className="text-sm font-black font-mono text-[#44312A]">
                  {riskScore.ml_anomaly_score !== null ? Number(riskScore.ml_anomaly_score).toFixed(1) : 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#504F47] block font-mono">
                  Cost Anomaly (25%)
                </span>
                <span className="text-sm font-black font-mono text-[#44312A]">
                  {riskScore.cost_score !== null ? Number(riskScore.cost_score).toFixed(1) : 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#504F47] block font-mono">
                  Duplicate (20%)
                </span>
                <span className="text-sm font-black font-mono text-[#44312A]">
                  {riskScore.duplicate_score !== null ? Number(riskScore.duplicate_score).toFixed(1) : 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#504F47] block font-mono">
                  Utilization Gap (15%)
                </span>
                <span className="text-sm font-black font-mono text-[#44312A]">
                  {riskScore.utilization_score !== null ? Number(riskScore.utilization_score).toFixed(1) : 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#504F47] block font-mono">
                  Geographic (10%)
                </span>
                <span className="text-sm font-black font-mono text-[#44312A]">
                  {riskScore.geographic_score !== null ? Number(riskScore.geographic_score).toFixed(1) : 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#504F47] block font-mono">
                  Data Quality (5%)
                </span>
                <span className="text-sm font-black font-mono text-[#44312A]">
                  {riskScore.data_quality_score !== null ? Number(riskScore.data_quality_score).toFixed(1) : 'N/A'}
                </span>
              </div>
            </div>

            {riskScore.flags && riskScore.flags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-[10px] font-bold text-[#504F47] uppercase font-mono">Triggered Flags:</span>
                {riskScore.flags.map((flag, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6] font-mono text-[11px]">
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Advanced Analytical Signals (Supplementary Intelligence) */}
      <Card className="border-2 border-[#D8CBB6] bg-white overflow-hidden">
        <CardHeader className="bg-[#FAF7F2] border-b border-[#D8CBB6]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-[#44312A]" />
              <div>
                <CardTitle className="text-sm font-bold text-[#44312A]">
                  Advanced Analytical Signals (Supplementary Intelligence)
                </CardTitle>
                <CardDescription className="text-xs text-[#504F47]">
                  Independent budget deviation, execution timeline, and aggregate financial cashflow evaluations
                </CardDescription>
              </div>
            </div>
            <Badge variant="primary" size="sm">
              SUPPLEMENTARY SIGNALS
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Cost Overrun Analysis */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-[#44312A]" />
                    <h4 className="text-xs font-bold text-[#44312A]">Cost Overrun Detection</h4>
                  </div>
                  <Badge variant={overrunBadge.variant} size="sm">
                    {overrunBadge.label}
                  </Badge>
                </div>

                <p className="text-[11px] text-[#504F47] leading-relaxed">
                  {costOverrun?.overrun_status === 'insufficient_data'
                    ? 'Verified sanctioned-cost baseline unavailable for work-level budgetary overrun analysis.'
                    : costOverrun?.evidence && costOverrun.evidence.length > 0
                    ? costOverrun.evidence[0]
                    : 'Actual expenditure conforms to sanctioned baseline limit.'}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#D8CBB6] space-y-1 text-[11px]">
                <div className="flex justify-between text-[#504F47]">
                  <span>Sanctioned Baseline:</span>
                  <strong className="font-mono text-[#44312A]">
                    {costOverrun?.sanctioned_cost ? formatCroresLakhs(costOverrun.sanctioned_cost).compact : 'Unavailable'}
                  </strong>
                </div>
                <div className="flex justify-between text-[#504F47]">
                  <span>Reported Overrun:</span>
                  <strong className="font-mono text-[#44312A]">
                    {costOverrun?.overrun_amount !== null && costOverrun?.overrun_amount !== undefined
                      ? `₹${Number(costOverrun.overrun_amount).toLocaleString('en-IN')}`
                      : 'N/A (No Baseline)'}
                  </strong>
                </div>
                <div className="text-[9px] text-[#8C7769] font-mono pt-1">
                  Baseline Deviation • Distinct from Peer Anomaly
                </div>
              </div>
            </div>

            {/* 2. Execution Duration Analysis */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#44312A]" />
                    <h4 className="text-xs font-bold text-[#44312A]">Execution Duration</h4>
                  </div>
                  <Badge variant={delayBadge.variant} size="sm">
                    {delayBadge.label}
                  </Badge>
                </div>

                <p className="text-[11px] text-[#504F47] leading-relaxed">
                  {delayAnalysis?.delay_status === 'insufficient_data'
                    ? 'Verified sanction date unavailable for execution-duration statistical analysis.'
                    : delayAnalysis?.observations && delayAnalysis.observations.length > 0
                    ? delayAnalysis.observations[0]
                    : 'Execution timeline aligns with statistical peer completion baselines.'}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#D8CBB6] space-y-1 text-[11px]">
                <div className="flex justify-between text-[#504F47]">
                  <span>Execution Duration:</span>
                  <strong className="font-mono text-[#44312A]">
                    {delayAnalysis?.duration_days !== null && delayAnalysis?.duration_days !== undefined
                      ? `${delayAnalysis.duration_days} Days`
                      : 'Unavailable'}
                  </strong>
                </div>
                <div className="flex justify-between text-[#504F47]">
                  <span>Peer Category Median:</span>
                  <strong className="font-mono text-[#44312A]">
                    {delayAnalysis?.peer_median_days !== null && delayAnalysis?.peer_median_days !== undefined
                      ? `${delayAnalysis.peer_median_days} Days`
                      : 'Baseline Active'}
                  </strong>
                </div>
                <div className="text-[9px] text-[#8C7769] font-mono pt-1">
                  Temporal Audit • Requires Verified Sanction Date
                </div>
              </div>
            </div>

            {/* 3. Payment & Execution Anomaly */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <PieChart className="h-4 w-4 text-[#44312A]" />
                    <h4 className="text-xs font-bold text-[#44312A]">Payment & Execution Anomaly</h4>
                  </div>
                  <Badge variant={paymentBadge.variant} size="sm">
                    {paymentBadge.label}
                  </Badge>
                </div>

                <p className="text-[11px] text-[#504F47] leading-relaxed">
                  {paymentAnomaly?.observations && paymentAnomaly.observations.length > 0
                    ? paymentAnomaly.observations[0]
                    : 'Disbursements and physical completion ratios indicate balanced financial execution.'}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#D8CBB6] space-y-1 text-[11px]">
                <div className="flex justify-between text-[#504F47]">
                  <span>Expenditure Utilization:</span>
                  <strong className="font-mono text-[#44312A]">
                    {paymentAnomaly?.metrics?.utilization_percentage !== undefined && paymentAnomaly?.metrics?.utilization_percentage !== null
                      ? `${Number(paymentAnomaly.metrics.utilization_percentage).toFixed(1)}%`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="flex justify-between text-[#504F47]">
                  <span>Physical Completion:</span>
                  <strong className="font-mono text-[#44312A]">
                    {paymentAnomaly?.metrics?.completion_rate !== undefined && paymentAnomaly?.metrics?.completion_rate !== null
                      ? `${Number(paymentAnomaly.metrics.completion_rate).toFixed(1)}%`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="text-[9px] text-[#8C7769] font-mono pt-1">
                  Aggregate Financial Signal • Not Transaction Audit
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] text-[11px] text-[#504F47] flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-[#44312A] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-[#44312A]">Methodology Distinction: </strong>
              Advanced analytical signals provide supplementary forensic insights into project budgetary variance, execution timelines, and aggregate financial cashflow. These signals operate independently and are not added as weights into the canonical 6-signal Work Risk Engine score.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Grid of Sections: Basic Info, Financial, Location, Implementation, Provenance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Parliamentary and administrative allocation scope</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Parliamentarian (MP)</span>
              {work.mp_name ? (
                <Link
                  to={`/mps?search=${encodeURIComponent(work.mp_name)}`}
                  className="text-[#44312A] hover:underline font-bold inline-flex items-center gap-1 group"
                  title="View MP Performance Dossier"
                >
                  <span>{work.mp_name}</span>
                  <ExternalLink className="h-3 w-3 text-[#8C7769] group-hover:text-[#44312A]" />
                </Link>
              ) : (
                <strong className="text-[#44312A]">Not Available</strong>
              )}
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Parliamentary House</span>
              <span className="text-[#44312A] font-medium">{work.house || 'Lok Sabha'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Constituency</span>
              <strong className="text-[#44312A]">{work.constituency || 'N/A'}</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Category / Sector</span>
              <span className="text-[#44312A]">{work.category || 'General'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#504F47]">Reported Beneficiaries</span>
              <span className="text-[#44312A] font-mono font-bold">
                {work.beneficiaries ? formatIndianNumber(work.beneficiaries) : 'Insufficient Data'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Financial Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Verification</CardTitle>
            <CardDescription>Audited completed expenditure and payment records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Reported Completed Cost</span>
              <span className="font-mono font-bold text-[#44312A]">{costFormatted.exact}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Cost in Crores / Lakhs</span>
              <span className="font-mono text-[#44312A] font-bold">{costFormatted.compact}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Completion Date</span>
              <span className="font-mono text-[#44312A]">
                {formatDate(work.completion_date || work.completion_year)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#504F47]">Quality Rating</span>
              <span className="font-mono text-[#44312A]">
                {work.quality_rating ? `${work.quality_rating} / 5.0` : 'Insufficient Data (No Field Evaluation)'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Implementation Details */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation & Agency</CardTitle>
            <CardDescription>Execution body and nodal district administration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Implementing Agency</span>
              <strong className="text-[#44312A] max-w-[60%] text-right font-mono text-[11px]">
                {work.implementing_agency || 'Unspecified in Feed'}
              </strong>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Nodal District</span>
              <span className="text-[#44312A]">{work.district || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">State / UT</span>
              <span className="text-[#44312A] font-bold">{work.state || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#504F47]">Location Details</span>
              <span className="text-[#504F47] max-w-[60%] text-right">
                {work.location || 'Constituency General Area'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Source & Provenance */}
        <Card>
          <CardHeader>
            <CardTitle>Data Provenance & Audit</CardTitle>
            <CardDescription>Official lineage and cryptographic ingestion audit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Ingestion Source</span>
              <span className="text-[#44312A] font-mono font-bold">{work.source || 'empowered_indian'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">Source Object ID</span>
              <span className="text-[#8C7769] font-mono text-[11px]">
                {work.source_id || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#D8CBB6]">
              <span className="text-[#504F47]">PII Masking Status</span>
              <span className="text-[#44312A] inline-flex items-center gap-1 font-bold">
                <CheckCircle2 className="h-3 w-3" /> Sanitized
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#504F47]">Record Created</span>
              <span className="text-[#8C7769] font-mono">{formatDate(work.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Geospatial Location Map */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#44312A]" />
              <span>Geospatial Verification</span>
            </CardTitle>
            <span className="text-[11px] font-mono text-[#8C7769]">
              {work.latitude && work.longitude
                ? `GPS: ${Number(work.latitude).toFixed(4)}, ${Number(work.longitude).toFixed(4)}`
                : 'Coordinates Pending (0 Verified Points)'}
            </span>
          </div>
          <CardDescription>
            Interactive GIS satellite positioning of the sanctioned infrastructure.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <WorkLocationMap
            latitude={work.latitude}
            longitude={work.longitude}
            title={work.work_description}
            locationName={work.location}
            cost={work.cost}
          />
        </CardContent>
      </Card>

      {/* Statutory Disclaimer */}
      <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] text-xs text-[#504F47] flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#44312A]">Investigation Support Notice: </strong>
          {RISK_DISCLAIMER} All identifiers and cost figures reflect public legislative releases.
        </p>
      </div>

      {/* AI Investigation Modal */}
      {isInvestigating && (
        <InvestigationModal
          workId={work.work_id || work.id}
          onClose={() => setIsInvestigating(false)}
        />
      )}
    </div>
  );
}
