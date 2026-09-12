import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  SlidersHorizontal,
  Landmark,
  MapPin,
  Users,
  Briefcase,
  ChevronRight,
  TrendingUp,
  Activity,
  ArrowRight,
  Sparkles,
  Layers,
  Building2,
  Compass,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { fetchConstituencies } from '../services/constituencies';
import { formatCroresLakhs, formatIndianNumber } from '../utils/formatting';
import { Link, useRouter } from '../router/Router';

export default function Constituencies() {
  const { navigate } = useRouter();

  // State
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    limit: 24,
    total_pages: 0,
    available_states: [],
    available_houses: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedState, setSelectedState] = useState('ALL');
  const [selectedHouse, setSelectedHouse] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('utilization_desc');
  const [page, setPage] = useState(1);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load constituencies
  const loadConstituencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchConstituencies({
        page,
        limit: 24,
        search: debouncedSearch || undefined,
        state: selectedState !== 'ALL' ? selectedState : undefined,
        house: selectedHouse !== 'ALL' ? selectedHouse : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        sort_by: sortBy,
      });
      setData(res);
    } catch (err) {
      console.error('Error fetching constituency list:', err);
      setError('Unable to load constituency intelligence records from the backend.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedState, selectedHouse, selectedStatus, sortBy]);

  useEffect(() => {
    loadConstituencies();
  }, [loadConstituencies]);

  // Reset page when filters change
  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#22C55E]/10 text-[#15803D] border border-[#22C55E]/30">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
            Healthy Utilization
          </span>
        );
      case 'Moderate':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FACC15]/20 text-[#854D0E] border border-[#FACC15]/40">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EAB308]" />
            Moderate Pace
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444]/10 text-[#B91C1C] border border-[#EF4444]/30">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
            Requires Attention
          </span>
        );
    }
  };

  const getProgressColor = (util) => {
    if (util === null || util === undefined) return 'bg-[#D8CBB6]';
    if (util >= 70) return 'bg-[#22C55E]';
    if (util >= 40) return 'bg-[#FACC15]';
    return 'bg-[#F97316]';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D8CBB6] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary" size="sm" dot>
              360° DIGITAL TWIN LAYER
            </Badge>
            <span className="text-xs text-[#8C7769] font-mono">
              {data.total > 0 ? `${data.total} Constituencies Profiled` : 'Nationwide Intelligence'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#44312A] tracking-tight font-display flex items-center gap-2.5">
            <Landmark className="h-7 w-7 text-[#44312A]" />
            <span>Constituency Intelligence</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#504F47] mt-1 max-w-2xl leading-relaxed">
            Explore the development footprint, financial utilization, and MPLADS activity of every parliamentary constituency across India.
          </p>
        </div>

        {/* Quick Highlights */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-white border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Total Monitored</span>
            <span className="text-base font-black font-mono text-[#44312A]">{data.total || 539} Seats</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-white border border-[#D8CBB6] shadow-xs">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">National Avg Util</span>
            <span className="text-base font-black font-mono text-[#44312A]">64.3%</span>
          </div>
        </div>
      </div>

      {/* 2. Search & Multi-Filter Control Bar */}
      <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search constituency, MP, state or district..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A] font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7769] hover:text-[#44312A]"
              >
                Clear
              </button>
            )}
          </div>

          {/* State Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedState}
              onChange={handleFilterChange(setSelectedState)}
              className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs text-[#44312A] font-medium focus:outline-none focus:border-[#44312A] cursor-pointer"
            >
              <option value="ALL">All States ({data.available_states.length})</option>
              {data.available_states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedStatus}
              onChange={handleFilterChange(setSelectedStatus)}
              className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs text-[#44312A] font-medium focus:outline-none focus:border-[#44312A] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Healthy">Healthy (≥70%)</option>
              <option value="Moderate">Moderate (40-69%)</option>
              <option value="Requires Attention">Requires Attention (&lt;40%)</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs text-[#44312A] font-medium focus:outline-none focus:border-[#44312A] cursor-pointer"
            >
              <option value="utilization_desc">Sort: Highest Utilization</option>
              <option value="utilization_asc">Sort: Lowest Utilization</option>
              <option value="expenditure_desc">Sort: Highest Expenditure</option>
              <option value="works_desc">Sort: Most Documented Works</option>
              <option value="name_asc">Sort: Constituency Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Error / Loading / Content States */}
      {error && (
        <ErrorState
          title="Failed to Load Constituencies"
          message={error}
          onRetry={loadConstituencies}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No Matching Constituencies"
          description="Try adjusting your search keywords, clearing state filters, or selecting all statuses."
          actionText="Clear All Filters"
          onAction={() => {
            setSearch('');
            setSelectedState('ALL');
            setSelectedHouse('ALL');
            setSelectedStatus('ALL');
            setSortBy('utilization_desc');
            setPage(1);
          }}
        />
      ) : (
        /* 4. Responsive Grid of Constituency Digital Twin Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.items.map((item) => {
            const alloc = formatCroresLakhs(item.allocated_amount);
            const exp = formatCroresLakhs(item.total_expenditure);
            const util = item.utilization_percentage !== null ? Number(item.utilization_percentage).toFixed(1) : null;

            return (
              <Card
                key={item.id}
                className="p-5 flex flex-col justify-between hover:border-[#44312A] hover:shadow-lg transition-all duration-200 group bg-white relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-[#D8CBB6]/60 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#8C7769] font-medium">
                        <MapPin className="h-3 w-3 text-[#44312A]" />
                        <span>{item.state}</span>
                        <span>•</span>
                        <span>{item.house}</span>
                      </div>
                      <h3 className="text-base font-bold text-[#44312A] group-hover:text-[#6B5145] transition-colors leading-snug mt-0.5">
                        {item.constituency}
                      </h3>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  {/* MP Representative */}
                  <div className="flex items-center gap-2 text-xs bg-[#FAF7F2] p-2.5 rounded-xl border border-[#D8CBB6]/60">
                    <Users className="h-3.5 w-3.5 text-[#8C7769] shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] text-[#8C7769] block leading-none">Representative MP:</span>
                      <strong className="text-[#44312A] font-semibold truncate block">
                        {item.mp_name || 'Parliamentary Seat Ledger'}
                      </strong>
                    </div>
                  </div>

                  {/* Financial Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                    <div>
                      <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Allocation</span>
                      <strong className="text-[#44312A] font-mono text-sm">
                        {alloc.compact}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Expenditure</span>
                      <strong className="text-[#44312A] font-mono text-sm">
                        {exp.compact}
                      </strong>
                    </div>
                    <div className="pt-2 border-t border-[#D8CBB6]/60">
                      <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Utilization</span>
                      <strong className="text-[#44312A] font-mono text-sm">
                        {util !== null ? `${util}%` : 'N/A'}
                      </strong>
                    </div>
                    <div className="pt-2 border-t border-[#D8CBB6]/60">
                      <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Completed Works</span>
                      <strong className="text-[#44312A] font-mono text-sm">
                        {item.completed_works_count !== null ? formatIndianNumber(item.completed_works_count) : (item.works_count > 0 ? `${item.works_count} recorded` : 'N/A')}
                      </strong>
                    </div>
                  </div>

                  {/* Compact Utilization Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-[#8C7769]">
                      <span>Fund Absorption</span>
                      <span>{util !== null ? `${util}%` : 'Pending Audit'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#E7DDCA] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                          item.utilization_percentage
                        )}`}
                        style={{ width: `${Math.min(100, Math.max(0, item.utilization_percentage || 0))}%` }}
                      />
                    </div>
                  </div>

                  {/* Additional Work Counter Tag */}
                  {item.works_count > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#504F47] pt-1">
                      <Briefcase className="h-3 w-3 text-[#44312A]" />
                      <span>{item.works_count} Granular eSAKSHI Works Available</span>
                    </div>
                  )}
                </div>

                {/* Card Action Link */}
                <div className="pt-4 mt-2 border-t border-[#D8CBB6]/60">
                  <Link
                    to={`/constituencies/${item.id}`}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs group-hover:shadow-md"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#E7DDCA]" />
                    <span>Explore Digital Twin</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#E7DDCA] group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 5. Pagination Footer */}
      {!loading && data.total_pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#D8CBB6] text-xs text-[#504F47]">
          <span>
            Showing <strong className="text-[#44312A]">{(page - 1) * data.limit + 1}</strong> to{' '}
            <strong className="text-[#44312A]">{Math.min(page * data.limit, data.total)}</strong> of{' '}
            <strong className="text-[#44312A]">{data.total}</strong> constituencies
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] hover:bg-[#E7DDCA] disabled:opacity-40 disabled:cursor-not-allowed font-medium text-[#44312A] transition"
            >
              Previous
            </button>
            <span className="px-3 py-1 font-mono font-bold text-[#44312A]">
              Page {page} of {data.total_pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              disabled={page === data.total_pages}
              className="px-3.5 py-1.5 rounded-xl border border-[#D8CBB6] bg-[#FAF7F2] hover:bg-[#E7DDCA] disabled:opacity-40 disabled:cursor-not-allowed font-medium text-[#44312A] transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
