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
  Sparkles,
  Briefcase,
  MapPin,
  Building,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import InvestigationModal from '../components/InvestigationModal';
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

  // Query state initialized from URL
  const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(() => Number(searchParams.get('limit')) || 20);
  const [constituency, setConstituency] = useState(() => searchParams.get('constituency') || '');
  const [state, setState] = useState(() => searchParams.get('state') || '');
  const [mpName, setMpName] = useState(() => searchParams.get('mp_name') || searchParams.get('mp') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [riskFilter, setRiskFilter] = useState(() => searchParams.get('risk') || 'ALL');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || searchParams.get('q') || '');

  const [worksData, setWorksData] = useState({ items: [], total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Full dataset registry for populating autocomplete and filter options (591 works)
  const [allWorksRegistry, setAllWorksRegistry] = useState([]);

  // Selected work for slide-over detail panel
  const [selectedWork, setSelectedWork] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Active AI Investigation Target
  const [investigatingWorkId, setInvestigatingWorkId] = useState(null);

  // Load all works once to compute available state/constituency/MP filter options
  useEffect(() => {
    let isMounted = true;
    async function fetchAllWorksForFilters() {
      try {
        const full = await getWorks({ limit: 1000 });
        if (isMounted && full && Array.isArray(full.items)) {
          setAllWorksRegistry(full.items);
        }
      } catch (e) {
        console.warn('Could not load full works registry for filter options:', e);
      }
    }
    fetchAllWorksForFilters();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute distinct states present in the works dataset
  const availableStates = useMemo(() => {
    const statesSet = new Set();
    allWorksRegistry.forEach((w) => {
      if (w.state && w.state.trim()) {
        statesSet.add(w.state.trim());
      }
    });
    return Array.from(statesSet).sort((a, b) => a.localeCompare(b));
  }, [allWorksRegistry]);

  // Compute distinct MPs present in the works dataset
  const availableMPs = useMemo(() => {
    let items = allWorksRegistry;
    if (state && state.trim()) {
      items = items.filter(
        (w) => w.state && w.state.toLowerCase() === state.toLowerCase().trim()
      );
    }
    if (constituency && constituency.trim()) {
      items = items.filter(
        (w) => w.constituency && w.constituency.toLowerCase() === constituency.toLowerCase().trim()
      );
    }
    const mpSet = new Set();
    items.forEach((w) => {
      if (w.mp_name && w.mp_name.trim()) {
        mpSet.add(w.mp_name.trim());
      }
    });
    return Array.from(mpSet).sort((a, b) => a.localeCompare(b));
  }, [allWorksRegistry, state, constituency]);

  // Compute distinct constituencies present in the works dataset
  const availableConstituencies = useMemo(() => {
    let items = allWorksRegistry;
    if (state && state.trim()) {
      items = items.filter(
        (w) => w.state && w.state.toLowerCase() === state.toLowerCase().trim()
      );
    }
    const constSet = new Set();
    items.forEach((w) => {
      if (w.constituency && w.constituency.trim()) {
        constSet.add(w.constituency.trim());
      }
    });
    return Array.from(constSet).sort((a, b) => a.localeCompare(b));
  }, [allWorksRegistry, state]);

  // Reactive URL query parameter synchronization
  useEffect(() => {
    const urlConstituency = searchParams.get('constituency') || '';
    const urlState = searchParams.get('state') || '';
    const urlMp = searchParams.get('mp_name') || searchParams.get('mp') || '';
    const urlCategory = searchParams.get('category') || '';
    const urlPage = Number(searchParams.get('page')) || 1;
    const urlLimit = Number(searchParams.get('limit')) || 20;
    const urlRisk = searchParams.get('risk') || 'ALL';
    const urlSearch = searchParams.get('search') || searchParams.get('q') || '';

    setConstituency(urlConstituency);
    setState(urlState);
    setMpName(urlMp);
    setCategory(urlCategory);
    setPage(urlPage);
    setLimit(urlLimit);
    setRiskFilter(urlRisk);
    if (urlSearch) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        constituency: constituency.trim() || undefined,
        state: state.trim() || undefined,
        mp_name: mpName.trim() || undefined,
        category: category.trim() || undefined,
        search: searchTerm.trim() || undefined,
      };
      const data = await getWorks(params);
      setWorksData(data || { items: [], total: 0, total_pages: 0 });
    } catch (err) {
      console.error('Error fetching works registry:', err);
      setError('Unable to fetch works registry from the JanDrishti backend.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, constituency, state, mpName, category, searchTerm]);

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
    if (constituency.trim()) params.set('constituency', constituency.trim());
    if (state.trim()) params.set('state', state.trim());
    if (mpName.trim()) params.set('mp_name', mpName.trim());
    if (category && category !== 'All') params.set('category', category.trim());
    if (riskFilter && riskFilter !== 'ALL') params.set('risk', riskFilter);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (limit !== 20) params.set('limit', String(limit));
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setConstituency('');
    setState('');
    setMpName('');
    setCategory('');
    setRiskFilter('ALL');
    setSearchTerm('');
    setPage(1);
    setSearchParams({});
  };

  // Client-side risk band filter
  const displayedItems = useMemo(() => {
    return (worksData.items || []).filter((w) => {
      if (riskFilter === 'ALL') return true;

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

      return true;
    });
  }, [worksData.items, riskFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#44312A] tracking-tight font-display">
              MPLADS Works Registry
            </h1>
            <Badge variant="primary" size="sm">
              REGISTRY
            </Badge>
          </div>
          <p className="text-xs text-[#504F47] mt-0.5">
            Granular repository of completed parliamentary development projects across constituencies. Click any work to inspect details or run an autonomous AI investigation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setInvestigatingWorkId('278726')}
            className="px-4 py-2 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E7DDCA]" />
            <span>Investigate Demo Work #278726</span>
          </button>
        </div>
      </div>

      {/* 2. Active Constituency / State / MP Filter Results Banner */}
      {(constituency || state || mpName) && (
        <div className="bg-[#FAF7F2] border border-[#D8CBB6] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#E7DDCA] border border-[#D8CBB6] flex items-center justify-center text-[#44312A] shrink-0 font-bold">
              <Briefcase className="h-4 w-4 text-[#44312A]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {mpName && (
                  <span className="text-[#504F47] font-medium">
                    MP: <strong className="text-[#44312A] bg-white px-2 py-0.5 rounded-lg border border-[#D8CBB6]">{mpName}</strong>
                  </span>
                )}
                {constituency && (
                  <span className="text-[#504F47] font-medium">
                    Constituency: <strong className="text-[#44312A] bg-white px-2 py-0.5 rounded-lg border border-[#D8CBB6]">{constituency}</strong>
                  </span>
                )}
                {state && (
                  <span className="text-[#504F47] font-medium">
                    State: <strong className="text-[#44312A] bg-white px-2 py-0.5 rounded-lg border border-[#D8CBB6]">{state}</strong>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#504F47] mt-1">
                {loading ? (
                  'Searching records...'
                ) : worksData.total > 0 ? (
                  <span>
                    <strong className="text-[#44312A] font-mono font-bold">{worksData.total}</strong> works found in active sample registry.
                  </span>
                ) : (
                  <span className="text-[#8C7769] font-semibold">
                    No works found for this filter in the current itemized sample.
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs w-fit"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* 3. Filter Bar & Search Controls */}
      <Card className="p-4 bg-white">
        <form onSubmit={handleFilterApply} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8C7769]" />
              <input
                type="text"
                placeholder="Search description, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
            </div>

            {/* MP Filter */}
            <div className="relative">
              <input
                type="text"
                list="mp-options"
                placeholder="Filter by MP..."
                value={mpName}
                onChange={(e) => setMpName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
              <datalist id="mp-options">
                {availableMPs.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            {/* Constituency Filter */}
            <div className="relative">
              <input
                type="text"
                list="constituency-options"
                placeholder="Filter by constituency..."
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
              <datalist id="constituency-options">
                {availableConstituencies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* State Filter */}
            <div className="relative">
              <input
                type="text"
                list="state-options"
                placeholder="Filter by state..."
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
              />
              <datalist id="state-options">
                {availableStates.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] text-[#44312A] focus:outline-none focus:border-[#44312A]"
              >
                <option value="">All Categories</option>
                <option value="Normal/Others">Normal/Others</option>
                <option value="Repair and Renovation">Repair and Renovation</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Apply
              </button>
              {(constituency || state || mpName || category || searchTerm) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="p-1.5 rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#504F47] transition cursor-pointer"
                  title="Clear all filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </form>
      </Card>

      {/* 4. Works Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadWorks} />
      ) : displayedItems.length === 0 ? (
        <EmptyState
          title={constituency || mpName ? 'No Works Found' : 'No Works Match Query'}
          description={
            constituency || mpName
              ? 'The MP financial dataset contains 774 MP records nationwide, while the current itemized work registry contains 591 works across 21 constituencies in 4 states.'
              : 'Try adjusting your MP, constituency, state, or category filter parameters.'
          }
          onAction={handleClearFilters}
          actionLabel="Reset Filters"
        />
      ) : (
        <Card className="overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF7F2] text-[#504F47] border-b border-[#D8CBB6] uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Work ID</th>
                  <th className="py-3 px-4">Work Description</th>
                  <th className="py-3 px-4">Member of Parliament</th>
                  <th className="py-3 px-4">Constituency / State</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Reported Cost</th>
                  <th className="py-3 px-4 text-center">Completion</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CBB6]">
                {displayedItems.map((w) => {
                  const costFormatted = formatCroresLakhs(w.cost || 0);
                  const isSelected = selectedWork?.id === w.id;

                  return (
                    <tr
                      key={w.id}
                      onClick={() => handleRowClick(w)}
                      className={`hover:bg-[#FAF7F2] cursor-pointer transition-colors group ${
                        isSelected ? 'bg-[#E7DDCA]/40' : ''
                      }`}
                    >
                      {/* Work ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#44312A] whitespace-nowrap">
                        #{w.work_id || w.id}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="text-[#44312A] font-semibold line-clamp-2 leading-snug group-hover:text-[#6B5145] transition-colors">
                          {w.work_description || 'Completed MPLADS Infrastructure Project'}
                        </div>
                        {w.location && (
                          <div className="text-[10px] text-[#8C7769] mt-0.5 truncate">
                            {w.location}
                          </div>
                        )}
                      </td>

                      {/* MP Name */}
                      <td className="py-3 px-4 text-[#44312A] font-medium whitespace-nowrap">
                        {w.mp_name || 'N/A'}
                      </td>

                      {/* Constituency / State */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-[#44312A] font-semibold">{w.constituency || 'N/A'}</div>
                        <div className="text-[10px] text-[#504F47]">{w.state || 'N/A'}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant="outline" size="sm">
                          {w.category || 'General'}
                        </Badge>
                      </td>

                      {/* Executed Cost */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#44312A] whitespace-nowrap">
                        {costFormatted.compact}
                      </td>

                      {/* Completion Date */}
                      <td className="py-3 px-4 text-center text-[#504F47] font-mono text-[11px] whitespace-nowrap">
                        {formatDate(w.completion_date || w.completion_year)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setInvestigatingWorkId(String(w.work_id || w.id))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] font-bold text-[11px] transition shadow-2xs cursor-pointer"
                            title="Run AI Investigation"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Investigate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowClick(w)}
                            className="p-1 rounded-lg bg-[#FAF7F2] text-[#504F47] hover:text-[#44312A] hover:bg-[#E7DDCA] border border-[#D8CBB6] transition cursor-pointer"
                            title="Open Slide-Over Audit Panel"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  const params = new URLSearchParams(searchParams);
                  params.set('page', String(newPage));
                  setSearchParams(params);
                }}
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
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  const params = new URLSearchParams(searchParams);
                  params.set('page', String(newPage));
                  setSearchParams(params);
                }}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed text-[#44312A] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* 5. Slide-Over Work Detail Panel (Drawer) */}
      {selectedWork && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white border-l border-[#D8CBB6] shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#44312A] bg-[#E7DDCA] px-2 py-0.5 rounded border border-[#D8CBB6]">
                WORK #{selectedWork.work_id || selectedWork.id}
              </span>
              <Badge variant="outline" size="sm">
                {selectedWork.category || 'General'}
              </Badge>
            </div>
            <button
              onClick={() => setSelectedWork(null)}
              className="p-1.5 rounded-xl bg-white border border-[#D8CBB6] text-[#504F47] hover:text-[#44312A] transition cursor-pointer shadow-xs"
              title="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-[#504F47]">
            {/* Title & Cost */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#44312A] leading-snug">
                {selectedWork.work_description || 'Completed MPLADS Infrastructure Project'}
              </h3>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                    Reported Completed Cost
                  </span>
                  <span className="text-xl font-black font-mono text-[#44312A]">
                    {formatCroresLakhs(selectedWork.cost).compact}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8C7769] font-mono block">Exact Outlay:</span>
                  <span className="text-xs font-mono font-bold text-[#44312A]">
                    {formatCroresLakhs(selectedWork.cost).exact}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Investigation Trigger Hero Button */}
            <div className="p-4 rounded-2xl bg-[#44312A] text-white space-y-2 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-1.5 text-[#E7DDCA]">
                  <Sparkles className="h-4 w-4 text-[#E7DDCA]" />
                  <span>Autonomous AI Investigation</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
                  8 Tools
                </span>
              </div>
              <p className="text-[11px] text-[#FAF7F2]/80 leading-relaxed">
                Execute multi-signal cost benchmarking, duplicate verification, MP financials check, and data-quality audit on this work item.
              </p>
              <button
                onClick={() => setInvestigatingWorkId(String(selectedWork.work_id || selectedWork.id))}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FAF7F2] hover:bg-white text-[#44312A] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs mt-1"
              >
                <span>Launch AI Investigation</span>
                <Sparkles className="h-3.5 w-3.5 text-[#44312A]" />
              </button>
            </div>

            {/* Administrative Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
                Administrative Scope
              </span>
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                <div className="flex justify-between items-center py-1 border-b border-[#D8CBB6]">
                  <span>Member of Parliament:</span>
                  {selectedWork.mp_name ? (
                    <Link
                      to={`/mps?search=${encodeURIComponent(selectedWork.mp_name)}`}
                      className="text-[#44312A] hover:underline font-bold inline-flex items-center gap-1 group"
                      title="View MP Performance Dossier"
                    >
                      <span>{selectedWork.mp_name}</span>
                      <ExternalLink className="h-3 w-3 text-[#8C7769] group-hover:text-[#44312A]" />
                    </Link>
                  ) : (
                    <strong className="text-[#44312A]">N/A</strong>
                  )}
                </div>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <span>Parliamentary House:</span>
                  <span className="text-[#44312A]">{selectedWork.house || 'Lok Sabha'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <span>Constituency & State:</span>
                  <span className="text-[#44312A] font-semibold">{selectedWork.constituency || 'N/A'}, {selectedWork.state || ''}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <span>Implementing Agency:</span>
                  <span className="text-[#44312A] font-mono text-[11px]">
                    {selectedWork.implementing_agency || 'Unspecified in Feed'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                  <span>Location Details:</span>
                  <span className="text-[#44312A] text-right max-w-[60%] truncate">
                    {selectedWork.location || 'General Area'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>GPS Geotagging:</span>
                  <span className="text-[#8C7769] font-mono text-[11px]">
                    {selectedWork.latitude && selectedWork.longitude
                      ? `${selectedWork.latitude}, ${selectedWork.longitude}`
                      : 'Unverified (0 GPS Points)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Full Dossier Navigation Link */}
            <div className="pt-2">
              <Link
                to={`/works/${selectedWork.work_id || selectedWork.id}`}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <span>Open Full Work Dossier</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#504F47]" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* AI Investigation Modal */}
      {investigatingWorkId && (
        <InvestigationModal
          workId={investigatingWorkId}
          onClose={() => setInvestigatingWorkId(null)}
        />
      )}
    </div>
  );
}
