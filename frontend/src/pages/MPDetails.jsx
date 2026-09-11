import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  IndianRupee,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import { fetchMPById } from '../services/mps';
import { formatCroresLakhs } from '../utils/formatting';
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

  const allocated = formatCroresLakhs(mp.allocated_amount || 0);
  const expenditure = formatCroresLakhs(mp.total_expenditure || 0);
  const unspent = formatCroresLakhs(mp.unspent_amount || 0);
  const util = Number(mp.utilization_percentage || 0);
  const completionRate = Number(mp.completion_rate || (mp.recommended_works_count ? ((mp.completed_works_count || 0) / mp.recommended_works_count) * 100 : 0));

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

          {/* Quick link to works in this constituency */}
          {mp.constituency && (
            <Link
              to={`/works?constituency=${encodeURIComponent(mp.constituency)}`}
              className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] text-xs font-bold flex items-center gap-2 transition w-fit shadow-xs"
            >
              <Briefcase className="h-3.5 w-3.5 text-[#44312A]" />
              <span>View Constituency Works</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid: Financial Overview & Works Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Financial Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Financial Ledger Overview</CardTitle>
              <IndianRupee className="h-4 w-4 text-[#44312A]" />
            </div>
            <CardDescription>
              Government allocated entitlement and verified expenditure disbursements
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
                <span className="text-[#504F47]">Expenditure Utilization</span>
                <span className="font-mono font-bold text-[#44312A]">
                  {util.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                <span className="text-[#504F47]">Unspent Parliamentary Balance</span>
                <span className="font-mono font-bold text-[#504F47]">
                  {unspent.compact}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#504F47]">Payment Gap / In-Progress</span>
                <span className="font-mono text-[#44312A]">
                  {mp.payment_gap_percentage ? `${mp.payment_gap_percentage.toFixed(1)}%` : 'Standard'}
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
                  {mp.pending_works || Math.max(0, (mp.recommended_works_count || 0) - (mp.completed_works_count || 0))}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
