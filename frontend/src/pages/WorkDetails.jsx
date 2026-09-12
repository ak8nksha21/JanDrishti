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
