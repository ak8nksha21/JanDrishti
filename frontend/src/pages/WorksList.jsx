import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  X,
  ExternalLink,
  AlertTriangle,
  Info,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { getWorks, getWorkById } from '../services/api';
import {
  formatCroresLakhs,
  formatDate,
  formatIndianNumber,
} from '../utils/formatting';
import { RISK_DISCLAIMER, getRiskBadgeConfig } from '../utils/riskLanguage';
import { useRouter, useSearchParams, Link } from '../router/Router';

export default function WorksList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { navigate } = useRouter();

  // Query state from URL
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialLimit = Number(searchParams.get('limit')) || 20;
  const initialConstituency = searchParams.get('constituency') || '';
  const initialState = searchParams.get('state') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialRiskFilter = searchParams.get('risk') || 'ALL';

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [constituency, setConstituency] = useState(initialConstituency);
  const [state, setState] = useState(initialState);
  const [category, setCategory] = useState(initialCategory);
  const [riskFilter, setRiskFilter] = useState(initialRiskFilter);
  const [searchTerm, setSearchTerm] = useState('');

  const [worksData, setWorksData] = useState({ items: [], total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected work for slide-over detail panel
  const [selectedWork, setSelectedWork] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        constituency: constituency || undefined,
        state: state || undefined,
        category: category || undefined,
      };
      const data = await getWorks(params);
      setWorksData(data || { items: [], total: 0, total_pages: 0 });
    } catch (err) {
      console.error('Error fetching works registry:', err);
      setError('Unable to fetch works registry from the JanDrishti backend.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, constituency, state, category]);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  // Load detailed work record when row is clicked
  const handleRowClick = async (work) => {
    setSelectedWork(work);
    const workId = work.work_id || work.id;
    if (!workId) return;

    setLoadingDetail(true);
    try {
      const fullDetail = await getWorkById(workId);
      if (fullDetail) {
        setSelectedWork((prev) => ({ ...prev, ...fullDetail }));
      }
    } catch (e) {
      console.warn('Could not fetch additional details for work:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Sync state changes to URL
  const handleFilterApply = (e) => {
    e?.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (constituency) params.set('constituency', constituency);
    if (state) params.set('state', state);
    if (category && category !== 'All') params.set('category', category);
    if (riskFilter && riskFilter !== 'ALL') params.set('risk', riskFilter);
    if (limit !== 20) params.set('limit', String(limit));
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setConstituency('');
    setState('');
    setCategory('');
    setRiskFilter('ALL');
    setSearchTerm('');
    setPage(1);
    setSearchParams({});
  };

  // Client-side text & risk filters
  const displayedItems = useMemo(() => {
    return (worksData.items || []).filter((w) => {
      // Risk filter
      const score = Number(w.overall_score || 0);
      let derivedRisk = w.risk_level || 'Low';
      if (!w.risk_level && score > 0) {
        if (score >= 80) derivedRisk = 'Critical';
        else if (score >= 60) derivedRisk = 'High';
        else if (score >= 35) derivedRisk = 'Medium';
        else derivedRisk = 'Low';
      }

      if (riskFilter === 'FLAGGED' && !(derivedRisk === 'Critical' || derivedRisk === 'High')) {
        return false;
      }
      if (riskFilter === 'REVIEW' && derivedRisk !== 'Medium') {
        return false;
      }
      if (riskFilter === 'STANDARD' && derivedRisk !== 'Low') {
        return false;
      }

      // Keyword search
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (w.work_description && w.work_description.toLowerCase().includes(term)) ||
        (w.mp_name && w.mp_name.toLowerCase().includes(term)) ||
        (w.constituency && w.constituency.toLowerCase().includes(term)) ||
        (w.implementing_agency && w.implementing_agency.toLowerCase().includes(term)) ||
        String(w.work_id || w.id).includes(term)
      );
    });
  }, [worksData.items, riskFilter, searchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#44312A] tracking-tight font-display">
              MPLADS Works Registry & Review
            </h1>
            <Badge variant="primary" size="sm">
              REGISTRY
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Search, filter, and inspect verified itemized infrastructure records and anomaly signals across parliamentary constituencies.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#504F47]">
          <span>Total Database Records:</span>
          <strong className="text-[#44312A] font-bold font-mono">
            {formatIndianNumber(worksData.total)}
          </strong>
        </div>
      </div>

      {/* Filter Control Bar */}
      <Card className="p-4">
        <form onSubmit={handleFilterApply} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Quick Text Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                Search in Results
              </label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7769]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by description, MP, agency, ID..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
                />
              </div>
            </div>

            {/* Constituency Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                Constituency
              </label>
              <input
                type="text"
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                placeholder="e.g. SHAHJAHANPUR"
                className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
            </div>

            {/* State Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Uttar Pradesh"
                className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[#504F47] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] focus:outline-none focus:border-[#44312A]"
              >
                <option value="">All Categories</option>
                <option value="Drinking Water">Drinking Water</option>
                <option value="Roads">Roads & Pathways</option>
                <option value="Education">Education</option>
                <option value="Health">Public Health</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Normal/Others">Normal/Others</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#44312A]/20"
              >
                <Filter className="h-3 w-3 text-[#E7DDCA]" />
                <span>Apply</span>
              </button>
              {(constituency || state || category || searchTerm || riskFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="p-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] transition cursor-pointer border border-[#D8CBB6]"
                  title="Clear all filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Risk Status Filter Pill Bar */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#D8CBB6] text-xs">
            <span className="text-[#504F47] text-[11px] font-medium">Risk Status Filter:</span>
            <div className="flex items-center gap-1">
              {[
                { id: 'ALL', label: 'All Records' },
                { id: 'FLAGGED', label: 'Flagged Risk' },
                { id: 'REVIEW', label: 'Needs Review' },
                { id: 'STANDARD', label: 'Standard' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  type="button"
                  onClick={() => setRiskFilter(rf.id)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                    riskFilter === rf.id
                      ? 'bg-[#44312A] text-[#E7DDCA] font-bold shadow-xs'
                      : 'bg-[#FAF7F2] text-[#504F47] hover:text-[#44312A] border border-[#D8CBB6]'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Card>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={loadWorks} />}

      {/* Interactive Works Table */}
      {loading ? (
        <TableSkeleton rows={10} cols={8} />
      ) : displayedItems.length === 0 ? (
        <EmptyState
          title="No completed works match criteria"
          description="Try adjusting your keyword, constituency, state, or category filters to broaden the search."
          action={
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 rounded-xl bg-[#44312A] text-[#E7DDCA] font-bold text-xs"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[#504F47] uppercase font-mono text-[10px] tracking-wider sticky top-0 z-10 font-bold">
                  <th className="py-3.5 px-4">Work ID</th>
                  <th className="py-3.5 px-4 min-w-[240px]">Description</th>
                  <th className="py-3.5 px-4">MP Name</th>
                  <th className="py-3.5 px-4">Constituency / State</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Executed Cost</th>
                  <th className="py-3.5 px-4 text-center">Risk Status</th>
                  <th className="py-3.5 px-4 text-right">Completion</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CBB6]">
                {displayedItems.map((w) => {
                  const rawCost = w.cost;
                  const costFormatted = formatCroresLakhs(rawCost);
                  const riskLevel = w.risk_level || (w.overall_score >= 80 ? 'Critical' : w.overall_score >= 60 ? 'High' : w.overall_score >= 35 ? 'Medium' : 'Low');
                  const riskCfg = getRiskBadgeConfig(riskLevel);

                  return (
                    <tr
                      key={w.id}
                      onClick={() => handleRowClick(w)}
                      className="hover:bg-[#FAF7F2] cursor-pointer transition-colors group"
                    >
                      {/* Work ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#44312A]">
                        {w.work_id || w.id}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#44312A] font-semibold line-clamp-2 leading-snug group-hover:text-[#6B5145] transition-colors">
                          {w.work_description || 'Completed MPLADS Infrastructure Project'}
                        </div>
                        {w.implementing_agency && (
                          <div className="text-[10px] text-[#504F47] mt-0.5 truncate font-mono">
                            Agency: {w.implementing_agency}
                          </div>
                        )}
                      </td>

                      {/* MP Name */}
                      <td className="py-3.5 px-4 text-[#44312A] font-medium">
                        {w.mp_name || 'N/A'}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#44312A] font-medium">{w.constituency || 'N/A'}</div>
                        <div className="text-[10px] text-[#504F47]">{w.state || 'N/A'}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" size="sm">
                          {w.category || 'General'}
                        </Badge>
                      </td>

                      {/* Executed Cost */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#44312A]">
                        {costFormatted.compact}
                      </td>

                      {/* Risk Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskCfg.colorClass}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${riskCfg.dotColor}`} />
                          <span>{riskCfg.label}</span>
                        </span>
                      </td>

                      {/* Completion Date */}
                      <td className="py-3.5 px-4 text-right text-[#504F47] font-mono text-[11px]">
                        {formatDate(w.completion_date || w.completion_year)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(w);
                          }}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-[#FAF7F2] text-[#504F47] group-hover:text-[#44312A] group-hover:bg-[#E7DDCA] border border-[#D8CBB6] transition cursor-pointer"
                          title="Open Slide-Over Audit Panel"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-[#D8CBB6] bg-[#FAF7F2] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#504F47]">
            <div>
              Showing page <strong className="text-[#44312A]">{worksData.page || 1}</strong> of{' '}
              <strong className="text-[#44312A]">{worksData.total_pages || 1}</strong> ({formatIndianNumber(worksData.total)} works total)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed text-[#44312A] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <span className="font-mono text-[#44312A] px-2 font-semibold">
                {page} / {worksData.total_pages || 1}
              </span>
              <button
                disabled={page >= worksData.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed text-[#44312A] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Slide-Over Work Detail Panel (Drawer) in Brown & Cream */}
      {selectedWork && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white border-l border-[#D8CBB6] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#44312A] bg-[#FAF7F2] px-2.5 py-0.5 rounded border border-[#D8CBB6]">
                WORK #{selectedWork.work_id || selectedWork.id}
              </span>
              <Badge variant="outline" size="sm">
                {selectedWork.category || 'General'}
              </Badge>
            </div>
            <button
              onClick={() => setSelectedWork(null)}
              className="p-1.5 rounded-xl bg-white border border-[#D8CBB6] text-[#504F47] hover:text-[#44312A] transition cursor-pointer shadow-xs"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-[#504F47]">
            {/* Title & Cost Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#44312A] leading-snug">
                {selectedWork.work_description || 'Completed MPLADS Infrastructure Project'}
              </h3>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                    Executed Cost
                  </span>
                  <span className="text-xl font-black font-mono text-[#44312A]">
                    {formatCroresLakhs(selectedWork.cost).compact}
                  </span>
                  <span className="text-[10px] text-[#8C7769] font-mono block mt-0.5">
                    {formatCroresLakhs(selectedWork.cost).exact}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                    Risk Classification
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md border inline-block mt-0.5 ${getRiskBadgeConfig(selectedWork.risk_level || 'Low').colorClass}`}>
                    {getRiskBadgeConfig(selectedWork.risk_level || 'Low').label}
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Review Explanations & Anomaly Signals */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#44312A]" />
                  <span>Audit Review Signals</span>
                </span>
                <span className="text-[10px] font-mono text-[#8C7769]">Heuristic Engine</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2 text-[#44312A] leading-relaxed">
                <div className="font-bold text-[#44312A] text-xs">
                  {selectedWork.risk_level === 'Critical' || selectedWork.risk_level === 'High'
                    ? 'Statistical Cost Outlier / Priority Verification Required'
                    : 'Standard Record / Baseline Verification'}
                </div>
                <p className="text-[11px] text-[#504F47]">
                  {selectedWork.flags && selectedWork.flags.length > 0
                    ? `Active indicators: ${selectedWork.flags.join(', ')}.`
                    : 'This work item conforms to standard category cost ranges. Routine administrative verification applies.'}
                </p>
                <div className="text-[10px] text-[#8C7769] pt-1.5 border-t border-[#D8CBB6] flex items-center gap-1">
                  <Info className="h-3 w-3 text-[#44312A] shrink-0" />
                  <span>{RISK_DISCLAIMER}</span>
                </div>
              </div>
            </div>

            {/* Administrative Scope Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
                Administrative & Execution Scope
              </span>
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">Member of Parliament:</span>
                  <strong className="text-[#44312A]">{selectedWork.mp_name || 'N/A'}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">Parliamentary House:</span>
                  <span className="text-[#44312A]">{selectedWork.house || 'Lok Sabha'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">Constituency:</span>
                  <span className="text-[#44312A]">{selectedWork.constituency || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">State / Nodal District:</span>
                  <span className="text-[#44312A]">{selectedWork.state || 'N/A'} {selectedWork.district ? `(${selectedWork.district})` : ''}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">Implementing Agency:</span>
                  <span className="text-[#504F47] font-mono text-[11px]">
                    {selectedWork.implementing_agency || 'Unspecified in Feed'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#D8CBB6]">
                  <span className="text-[#504F47]">Beneficiaries:</span>
                  <span className="text-[#44312A] font-mono font-semibold">
                    {formatIndianNumber(selectedWork.beneficiaries)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#504F47]">GPS Coordinates:</span>
                  <span className="text-[#44312A] font-mono text-[11px] font-semibold">
                    {selectedWork.latitude && selectedWork.longitude
                      ? `${Number(selectedWork.latitude).toFixed(5)}, ${Number(selectedWork.longitude).toFixed(5)}`
                      : 'Coordinates Pending Verification'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ingestion & Provenance Audit */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
                Data Lineage & Provenance
              </span>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#504F47]">Ingestion Source:</span>
                  <span className="text-[#44312A] font-mono font-semibold">{selectedWork.source || 'empowered_indian'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#504F47]">Record Created:</span>
                  <span className="text-[#8C7769] font-mono">{formatDate(selectedWork.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Direct Navigation Button */}
            <div className="pt-2">
              <Link
                to={`/works/${selectedWork.work_id || selectedWork.id}`}
                className="w-full py-2.5 px-4 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#44312A]/20"
              >
                <span>Open Full Investigation Dossier</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#E7DDCA]" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
