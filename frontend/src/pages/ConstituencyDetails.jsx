import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Landmark,
  MapPin,
  Users,
  Briefcase,
  IndianRupee,
  Activity,
  TrendingUp,
  AlertTriangle,
  Info,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  X,
  Layers,
  Search,
  Building2,
  HelpCircle,
  BarChart2,
  Compass,
} from 'lucide-react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import {
  fetchConstituencyById,
  fetchConstituencyWorks,
  fetchConstituencySignals,
} from '../services/constituencies';
import { formatCroresLakhs, formatIndianCurrency, formatIndianNumber, formatDate } from '../utils/formatting';
import { RISK_DISCLAIMER } from '../utils/riskLanguage';
import { useRouter, Link } from '../router/Router';

// Custom Marker for Work Pins
const workMarkerIcon = L.divIcon({
  className: 'custom-work-marker',
  html: `
    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background-color: rgba(68, 49, 42, 0.25); animation: pulse 2s infinite;"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #44312A; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

export default function ConstituencyDetails({ constituencyId: propId }) {
  const { path, navigate } = useRouter();
  const constituencyId = propId || path.split('/')[2];

  // Primary Digital Twin State
  const [twin, setTwin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sector Breakdown toggle: "expenditure" | "works"
  const [sectorViewMode, setSectorViewMode] = useState('expenditure');

  // "Why?" Drawer State
  const [activeSignalForDrawer, setActiveSignalForDrawer] = useState(null);

  // Snapshot / Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Works Table State inside the Digital Twin
  const [worksData, setWorksData] = useState({ items: [], total: 0, page: 1, limit: 10, total_pages: 0 });
  const [worksLoading, setWorksLoading] = useState(false);
  const [worksPage, setWorksPage] = useState(1);
  const [worksCategory, setWorksCategory] = useState('ALL');
  const [worksSearch, setWorksSearch] = useState('');
  const [debouncedWorksSearch, setDebouncedWorksSearch] = useState('');

  // Debounce works search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWorksSearch(worksSearch);
      setWorksPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [worksSearch]);

  // Load Digital Twin Profile
  const loadDigitalTwin = useCallback(async () => {
    if (!constituencyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConstituencyById(constituencyId);
      setTwin(data);
    } catch (err) {
      console.error('Error fetching constituency digital twin:', err);
      setError(`Constituency intelligence dossier for '${constituencyId}' was not found.`);
    } finally {
      setLoading(false);
    }
  }, [constituencyId]);

  useEffect(() => {
    loadDigitalTwin();
  }, [loadDigitalTwin]);

  // Load Works Table for this constituency
  const loadConstituencyWorks = useCallback(async () => {
    if (!constituencyId) return;
    setWorksLoading(true);
    try {
      const res = await fetchConstituencyWorks(constituencyId, {
        page: worksPage,
        limit: 10,
        category: worksCategory !== 'ALL' ? worksCategory : undefined,
        search: debouncedWorksSearch || undefined,
        sort_by: 'date_desc',
      });
      setWorksData(res);
    } catch (err) {
      console.warn('Error fetching constituency works table:', err);
    } finally {
      setWorksLoading(false);
    }
  }, [constituencyId, worksPage, worksCategory, debouncedWorksSearch]);

  useEffect(() => {
    loadConstituencyWorks();
  }, [loadConstituencyWorks]);

  // Works with valid GPS coordinates for the map
  const mapWorks = useMemo(() => {
    if (!worksData?.items) return [];
    return worksData.items.filter((w) => w.latitude !== null && w.longitude !== null);
  }, [worksData]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !twin) {
    return (
      <div className="max-w-xl mx-auto pt-16">
        <ErrorState
          title="Constituency Record Not Found"
          message={error || `Could not resolve digital twin profile for '${constituencyId}'.`}
          onRetry={() => navigate('/constituencies')}
        />
        <div className="mt-4 text-center">
          <Link
            to="/constituencies"
            className="text-xs text-[#44312A] hover:underline inline-flex items-center gap-1 font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Constituency Explorer
          </Link>
        </div>
      </div>
    );
  }

  // Financial Formattings
  const alloc = formatCroresLakhs(twin.allocated_amount);
  const exp = formatCroresLakhs(twin.total_expenditure);
  const unspent = formatCroresLakhs(twin.unspent_amount);
  const util = twin.utilization_percentage !== null ? Number(twin.utilization_percentage).toFixed(1) : null;

  // Center coordinate for map
  const mapCenter = twin.latitude && twin.longitude ? [twin.latitude, twin.longitude] : [22.8, 79.5];

  // Chart data for "Where is the money going?"
  const chartData = (twin.categories || []).map((c) => ({
    name: c.category,
    value: sectorViewMode === 'expenditure' ? roundToCrore(c.total_cost) : c.works_count,
    costFormatted: formatCroresLakhs(c.total_cost).compact,
    worksCount: c.works_count,
    percentage: sectorViewMode === 'expenditure' ? c.percentage_cost : c.percentage_works,
  }));

  function roundToCrore(amount) {
    return amount ? Number((amount / 10000000).toFixed(2)) : 0;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto antialiased">
      {/* 1. Header Navigation & Title Banner */}
      <div className="space-y-3 border-b border-[#D8CBB6] pb-6">
        <div className="flex items-center justify-between">
          <Link
            to="/constituencies"
            className="text-xs font-bold text-[#504F47] hover:text-[#44312A] inline-flex items-center gap-1.5 transition group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Constituency Intelligence Explorer</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#FAF7F2] text-[#44312A] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Export Snapshot"
            >
              <Download className="h-3.5 w-3.5 text-[#44312A]" />
              <span>Export Snapshot</span>
            </button>
            {twin.mp?.mp_id && (
              <Link
                to={`/mps/${twin.mp.mp_id}`}
                className="px-3 py-1.5 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Users className="h-3.5 w-3.5 text-[#E7DDCA]" />
                <span>MP Dossier</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge variant="primary" size="sm">
                {twin.house}
              </Badge>
              <span className="text-xs font-semibold text-[#8C7769]">•</span>
              <span className="text-xs font-bold text-[#44312A]">{twin.state}</span>
              <span className="text-xs font-semibold text-[#8C7769]">•</span>
              <span className="text-xs font-mono text-[#8C7769]">
                Last updated: {twin.last_updated}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-[#44312A] tracking-tight font-display flex items-center gap-3">
              <Landmark className="h-8 w-8 text-[#44312A] shrink-0" />
              <span>{twin.constituency}</span>
              <span className="text-sm sm:text-base font-normal text-[#8C7769] font-sans">
                Constituency Digital Twin
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {twin.data_sources.map((src, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#D8CBB6] text-[11px] font-mono text-[#504F47] shadow-xs"
              >
                {src}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Hero Intelligence Overview Panel */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[#44312A]" />
            <span>Parliamentary Key Metrics</span>
          </h2>
          <span className="text-[11px] text-[#8C7769] font-mono">
            eSAKSHI & MoSPI Aggregates
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* 1. Allocation */}
          <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-1">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Funding Allocation</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#44312A]">{alloc.compact}</div>
            <span className="text-[10px] text-[#8C7769] block">Total Sanctioned</span>
          </div>

          {/* 2. Expenditure */}
          <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-1">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Total Expenditure</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#44312A]">{exp.compact}</div>
            <span className="text-[10px] text-[#8C7769] block">Disbursed Funds</span>
          </div>

          {/* 3. Utilization */}
          <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-1">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Fund Absorption</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#44312A]">
              {util !== null ? `${util}%` : 'N/A'}
            </div>
            <span className="text-[10px] text-[#8C7769] block">Expenditure Ratio</span>
          </div>

          {/* 4. Total Works */}
          <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-1">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Documented Works</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#44312A]">
              {formatIndianNumber(twin.total_works_count)}
            </div>
            <span className="text-[10px] text-[#8C7769] block">Registered Works</span>
          </div>

          {/* 5. Completed */}
          <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-1">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Completed Works</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#15803D]">
              {twin.completed_works_count !== null ? formatIndianNumber(twin.completed_works_count) : 'N/A'}
            </div>
            <span className="text-[10px] text-[#8C7769] block">Execution Finished</span>
          </div>

          {/* 6. Pending */}
          <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-1">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Pending / Ongoing</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#B91C1C]">
              {twin.pending_works_count !== null ? formatIndianNumber(twin.pending_works_count) : 'N/A'}
            </div>
            <span className="text-[10px] text-[#8C7769] block">In Progress</span>
          </div>

          {/* 7. Unspent / Beneficiaries */}
          <div className="p-4 rounded-3xl bg-white border border-[#D8CBB6] shadow-xs space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-[#8C7769] uppercase font-mono block font-bold">Unspent Balance</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#44312A]">{unspent.compact}</div>
            <span className="text-[10px] text-[#8C7769] block">Available Funds</span>
          </div>
        </div>
      </section>

      {/* 3. "Constituency Health" Panel (4 Dimensions) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#44312A] font-display flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#44312A]" />
              <span>Constituency Health Assessment</span>
            </h2>
            <p className="text-xs text-[#504F47]">
              Multidimensional evaluation of financial execution, portfolio balance, and transparency.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#D8CBB6] text-[#44312A]">
            Overall: {twin.health.overall_status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Dimension 1: Financial */}
          <Card className="p-4 space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#44312A]">1. Financial Health</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  twin.health.financial.status === 'Strong'
                    ? 'bg-[#22C55E]/10 text-[#15803D] border-[#22C55E]/30'
                    : twin.health.financial.status === 'Moderate'
                    ? 'bg-[#FACC15]/20 text-[#854D0E] border-[#FACC15]/40'
                    : 'bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/30'
                }`}
              >
                {twin.health.financial.status}
              </span>
            </div>
            <p className="text-[11px] text-[#504F47] leading-relaxed">
              {twin.health.financial.summary}
            </p>
            <div className="pt-2 border-t border-[#D8CBB6]/60 flex justify-between text-[11px] font-mono">
              <span className="text-[#8C7769]">Utilization:</span>
              <strong className="text-[#44312A]">{twin.health.financial.metrics.utilization}</strong>
            </div>
          </Card>

          {/* Dimension 2: Execution Velocity */}
          <Card className="p-4 space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#44312A]">2. Execution Velocity</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  twin.health.execution.status === 'Strong'
                    ? 'bg-[#22C55E]/10 text-[#15803D] border-[#22C55E]/30'
                    : twin.health.execution.status === 'Moderate'
                    ? 'bg-[#FACC15]/20 text-[#854D0E] border-[#FACC15]/40'
                    : 'bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/30'
                }`}
              >
                {twin.health.execution.status}
              </span>
            </div>
            <p className="text-[11px] text-[#504F47] leading-relaxed">
              {twin.health.execution.summary}
            </p>
            <div className="pt-2 border-t border-[#D8CBB6]/60 flex justify-between text-[11px] font-mono">
              <span className="text-[#8C7769]">Completed Works:</span>
              <strong className="text-[#44312A]">
                {twin.health.execution.metrics.completed_works ?? 'N/A'}
              </strong>
            </div>
          </Card>

          {/* Dimension 3: Development Mix */}
          <Card className="p-4 space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#44312A]">3. Development Mix</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  twin.health.development_mix.status === 'Strong'
                    ? 'bg-[#22C55E]/10 text-[#15803D] border-[#22C55E]/30'
                    : twin.health.development_mix.status === 'Moderate'
                    ? 'bg-[#FACC15]/20 text-[#854D0E] border-[#FACC15]/40'
                    : 'bg-[#8C7769]/10 text-[#504F47] border-[#D8CBB6]'
                }`}
              >
                {twin.health.development_mix.status}
              </span>
            </div>
            <p className="text-[11px] text-[#504F47] leading-relaxed">
              {twin.health.development_mix.summary}
            </p>
            <div className="pt-2 border-t border-[#D8CBB6]/60 flex justify-between text-[11px] font-mono">
              <span className="text-[#8C7769]">Distinct Sectors:</span>
              <strong className="text-[#44312A]">
                {twin.health.development_mix.metrics.distinct_sectors}
              </strong>
            </div>
          </Card>

          {/* Dimension 4: Data Quality */}
          <Card className="p-4 space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#44312A]">4. Data Quality & Audit</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  twin.health.data_quality.status === 'Strong'
                    ? 'bg-[#22C55E]/10 text-[#15803D] border-[#22C55E]/30'
                    : twin.health.data_quality.status === 'Moderate'
                    ? 'bg-[#FACC15]/20 text-[#854D0E] border-[#FACC15]/40'
                    : 'bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/30'
                }`}
              >
                {twin.health.data_quality.status}
              </span>
            </div>
            <p className="text-[11px] text-[#504F47] leading-relaxed">
              {twin.health.data_quality.summary}
            </p>
            <div className="pt-2 border-t border-[#D8CBB6]/60 flex justify-between text-[11px] font-mono">
              <span className="text-[#8C7769]">GPS Coverage:</span>
              <strong className="text-[#44312A]">
                {twin.health.data_quality.metrics.coordinate_completeness}
              </strong>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. "Where is the Money Going?" (Category Distribution) */}
      <section className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D8CBB6] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#44312A] font-display flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-[#44312A]" />
                <span>Where is the Money Going?</span>
              </h2>
              <p className="text-xs text-[#504F47] mt-0.5">
                Sector-wise breakdown of MPLADS capital deployment across community infrastructure.
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-xs font-semibold self-start">
              <button
                onClick={() => setSectorViewMode('expenditure')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  sectorViewMode === 'expenditure'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                By Expenditure (₹ Cr)
              </button>
              <button
                onClick={() => setSectorViewMode('works')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  sectorViewMode === 'works'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                By Number of Works
              </button>
            </div>
          </div>

          <div className="pt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Recharts Horizontal Bar Chart */}
            <div className="lg:col-span-7 h-[300px] w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#8C7769]">
                  No itemized category records in current snapshot.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: '#8C7769', fontSize: 11 }}
                      unit={sectorViewMode === 'expenditure' ? ' Cr' : ''}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#44312A', fontSize: 11, fontWeight: 600 }}
                      width={120}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const itm = payload[0].payload;
                          return (
                            <div className="p-3 bg-white border border-[#D8CBB6] rounded-xl shadow-xl text-xs space-y-1">
                              <strong className="text-[#44312A] block font-bold">{itm.name}</strong>
                              <div className="text-[#504F47] flex justify-between gap-4">
                                <span>Expenditure:</span>
                                <strong className="font-mono text-[#44312A]">{itm.costFormatted}</strong>
                              </div>
                              <div className="text-[#504F47] flex justify-between gap-4">
                                <span>Works Count:</span>
                                <strong className="font-mono text-[#44312A]">{itm.worksCount}</strong>
                              </div>
                              <div className="text-[#504F47] flex justify-between gap-4">
                                <span>Share:</span>
                                <strong className="font-mono text-[#44312A]">{itm.percentage}%</strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? '#44312A' : index === 1 ? '#6B5145' : '#8C7769'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category Leaderboard Table */}
            <div className="lg:col-span-5 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47] block">
                Top Sector Allocations
              </span>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {twin.categories.map((c, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <strong className="text-[#44312A] block">{c.category}</strong>
                      <span className="text-[10px] text-[#8C7769]">
                        {c.works_count} Works ({c.percentage_works}%)
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <strong className="text-[#44312A] block">{formatCroresLakhs(c.total_cost).compact}</strong>
                      <span className="text-[10px] text-[#8C7769]">{c.percentage_cost}% of spend</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 5. Geographic Development Footprint (Interactive GIS Map) */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#44312A] font-display flex items-center gap-2">
              <Compass className="h-5 w-5 text-[#44312A]" />
              <span>Geographic Development Footprint</span>
            </h2>
            <p className="text-xs text-[#504F47]">
              Spatial distribution of verified project interventions across blocks and subdivisions.
            </p>
          </div>
          <span className="text-xs font-mono text-[#8C7769]">
            {mapWorks.length > 0 ? `${mapWorks.length} Verified GPS Pins` : 'Constituency Center Geocoded'}
          </span>
        </div>

        <div className="h-[420px] w-full rounded-3xl overflow-hidden border border-[#D8CBB6] relative z-0 shadow-xs">
          <MapContainer
            center={mapCenter}
            zoom={twin.latitude ? 10 : 6}
            scrollWheelZoom={false}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Constituency Center Marker */}
            {twin.latitude && twin.longitude && (
              <Marker position={[twin.latitude, twin.longitude]}>
                <Popup className="custom-jandrishti-popup">
                  <div className="p-2 space-y-1 text-xs text-[#44312A]">
                    <strong className="font-bold block text-sm">{twin.constituency} Center</strong>
                    <p className="text-[#504F47] text-[11px]">{twin.state} • {twin.house}</p>
                    <div className="text-[10px] font-mono text-[#8C7769]">
                      GPS: {twin.latitude.toFixed(4)}, {twin.longitude.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Itemized Work Markers */}
            {mapWorks.map((work) => (
              <Marker
                key={work.id}
                position={[work.latitude, work.longitude]}
                icon={workMarkerIcon}
              >
                <Popup className="custom-jandrishti-popup" minWidth={260}>
                  <div className="p-2 space-y-2 text-[#44312A] text-xs">
                    <div className="border-b border-[#D8CBB6] pb-1">
                      <span className="text-[9px] uppercase font-mono text-[#8C7769] block font-bold">
                        Work #{work.work_id || work.id}
                      </span>
                      <strong className="text-xs text-[#44312A] line-clamp-2">{work.work_description}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] font-mono bg-[#FAF7F2] p-1.5 rounded-lg border border-[#D8CBB6]">
                      <div>
                        <span className="text-[#8C7769] block text-[9px]">Budget</span>
                        <strong>{formatCroresLakhs(work.cost).compact}</strong>
                      </div>
                      <div>
                        <span className="text-[#8C7769] block text-[9px]">Sector</span>
                        <strong className="truncate block">{work.category || 'General'}</strong>
                      </div>
                    </div>
                    {work.implementing_agency && (
                      <div className="text-[10px] text-[#504F47]">
                        <span className="text-[#8C7769]">Agency: </span>
                        {work.implementing_agency}
                      </div>
                    )}
                    <Link
                      to={`/works/${work.work_id || work.id}`}
                      className="w-full py-1.5 rounded-lg bg-[#44312A] text-white font-bold text-[11px] flex items-center justify-center gap-1 hover:bg-[#34241E] transition"
                    >
                      <span>Inspect Project Detail</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>

      {/* 6. Development Footprint Details: Agencies & Geography */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Top Implementing Agencies */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D8CBB6] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#44312A] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#44312A]" />
                <span>Executing Implementing Agencies</span>
              </h3>
              <p className="text-[11px] text-[#504F47]">Ranked by capital allocation and project count.</p>
            </div>
            <span className="text-xs font-mono text-[#8C7769]">{twin.agencies.length} Agencies</span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {twin.agencies.length === 0 ? (
              <div className="text-xs text-[#8C7769] py-4 text-center">No agency records in current dataset.</div>
            ) : (
              twin.agencies.map((ag, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 max-w-[240px]">
                    <strong className="text-[#44312A] block truncate">{ag.agency}</strong>
                    <span className="text-[10px] text-[#8C7769]">{ag.works_count} Projects Executed</span>
                  </div>
                  <div className="text-right font-mono">
                    <strong className="text-[#44312A] block">{formatCroresLakhs(ag.total_cost).compact}</strong>
                    <span className="text-[10px] text-[#8C7769]">{ag.percentage_cost}% of spend</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Geographic Concentration */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D8CBB6] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#44312A] flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#44312A]" />
                <span>Sub-Regional Distribution</span>
              </h3>
              <p className="text-[11px] text-[#504F47]">Geographic footprint across administrative blocks.</p>
            </div>
            <span className="text-xs font-mono text-[#8C7769]">{twin.geography.length} Locations</span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {twin.geography.length === 0 ? (
              <div className="text-xs text-[#8C7769] py-4 text-center">No sub-regional breakdown recorded.</div>
            ) : (
              twin.geography.map((g, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <strong className="text-[#44312A] block">{g.location_name}</strong>
                    <span className="text-[10px] text-[#8C7769]">{g.works_count} Works Documented</span>
                  </div>
                  <div className="text-right font-mono">
                    <strong className="text-[#44312A] block">{formatCroresLakhs(g.total_cost).compact}</strong>
                    <span className="text-[10px] text-[#8C7769]">{g.percentage_works}% of works</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      {/* 7. Parliamentary Representation & MP Dossier */}
      {twin.mp && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-[#44312A]" />
              <span>Parliamentary Representation</span>
            </h2>
            <Link
              to={`/mps/${twin.mp.mp_id}`}
              className="text-xs font-bold text-[#44312A] hover:underline inline-flex items-center gap-1"
            >
              <span>View Complete MP Dossier</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Card className="p-5 bg-white border border-[#D8CBB6]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-[#44312A] text-[#E7DDCA] flex items-center justify-center font-bold font-mono text-lg shrink-0 shadow-md">
                  {twin.mp.mp_name ? twin.mp.mp_name.substring(0, 2).toUpperCase() : 'MP'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#44312A] leading-snug">{twin.mp.mp_name}</h3>
                  <p className="text-xs text-[#504F47]">
                    Member of Parliament ({twin.mp.house}) • {twin.mp.state}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-mono bg-[#FAF7F2] p-3 rounded-2xl border border-[#D8CBB6]">
                <div>
                  <span className="text-[10px] text-[#8C7769] block">Allocated</span>
                  <strong className="text-[#44312A]">{alloc.compact}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#8C7769] block">Expended</span>
                  <strong className="text-[#44312A]">{exp.compact}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#8C7769] block">Utilization</span>
                  <strong className="text-[#15803D]">{util !== null ? `${util}%` : 'N/A'}</strong>
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* 8. "How Does This Constituency Compare?" (State & National Benchmarks) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#44312A] font-display flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#44312A]" />
            <span>How Does This Constituency Compare?</span>
          </h2>
          <p className="text-xs text-[#504F47]">
            Comparative benchmarking against {twin.comparison.state_name} state averages and national baselines.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {twin.comparison.benchmarks.map((bench, idx) => (
            <Card key={idx} className="p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between border-b border-[#D8CBB6]/60 pb-2">
                <span className="text-xs font-bold text-[#44312A]">{bench.name}</span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    bench.status === 'Above Average'
                      ? 'bg-[#22C55E]/10 text-[#15803D] border-[#22C55E]/30'
                      : bench.status === 'Below Average'
                      ? 'bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/30'
                      : 'bg-[#FAF7F2] text-[#504F47] border-[#D8CBB6]'
                  }`}
                >
                  {bench.status}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-[#504F47] font-sans text-[11px]">This Constituency:</span>
                  <strong className="text-sm text-[#44312A]">
                    {bench.constituency_value !== null ? `${bench.constituency_value} ${bench.unit}` : 'N/A'}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-[#8C7769]">
                  <span className="font-sans text-[11px]">State Average:</span>
                  <span>{bench.state_average !== null ? `${bench.state_average} ${bench.unit}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-[#8C7769]">
                  <span className="font-sans text-[11px]">National Average:</span>
                  <span>{bench.national_average !== null ? `${bench.national_average} ${bench.unit}` : 'N/A'}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 9. Analytical Review Signals & "Why?" Explanation Drawer */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#44312A] font-display flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#44312A]" />
            <span>Analytical Signals Requiring Review</span>
          </h2>
          <p className="text-xs text-[#504F47]">
            Deterministic review indicators identifying concentration risks or data completeness gaps for oversight teams.
          </p>
        </div>

        {twin.signals.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] text-xs text-[#504F47] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
            <span>No anomalous concentration flags detected. Expenditures and executing agencies align with regional baselines.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {twin.signals.map((sig) => (
              <Card
                key={sig.signal_id}
                className="p-4 flex flex-col justify-between space-y-3 bg-white border border-[#D8CBB6] hover:border-[#44312A] transition shadow-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-[#8C7769]">
                      {sig.signal_type}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        sig.severity === 'High'
                          ? 'bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/30'
                          : 'bg-[#FACC15]/20 text-[#854D0E] border-[#FACC15]/40'
                      }`}
                    >
                      {sig.severity} Priority
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#44312A] leading-snug">{sig.title}</h4>
                  <p className="text-[11px] text-[#504F47] leading-relaxed">{sig.short_explanation}</p>
                </div>

                <div className="pt-2 border-t border-[#D8CBB6]/60 flex items-center justify-between">
                  <span className="text-[10px] text-[#8C7769]">
                    {sig.affected_records_count > 0 ? `${sig.affected_records_count} records affected` : 'Macro ledger signal'}
                  </span>
                  <button
                    onClick={() => setActiveSignalForDrawer(sig)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] font-bold text-[11px] flex items-center gap-1 border border-[#D8CBB6] transition cursor-pointer"
                  >
                    <HelpCircle className="h-3 w-3 text-[#44312A]" />
                    <span>Why?</span>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 10. "What Changed?" Historical Snapshot Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[#44312A]" />
          <span>What Changed? (Audit Cycle Velocity)</span>
        </h2>
        <Card className="p-4 bg-[#FAF7F2] border border-[#D8CBB6] text-xs text-[#504F47] space-y-1">
          <p className="font-bold text-[#44312A]">
            Current Snapshot Verified: {twin.last_updated}
          </p>
          <p className="text-[11px]">
            Comparative delta timelines and historical audit snapshot metrics will automatically expand as additional eSAKSHI data cycles are synchronized into JanDrishti.
          </p>
        </Card>
      </section>

      {/* 11. Works in this Constituency (Server-Side Filtered & Paginated Table) */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#44312A] font-display flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-[#44312A]" />
              <span>Works in this Constituency</span>
            </h2>
            <p className="text-xs text-[#504F47]">
              Granular project registry with server-side category and keyword filtering.
            </p>
          </div>
          <span className="text-xs font-mono text-[#8C7769] bg-white px-3 py-1.5 rounded-xl border border-[#D8CBB6]">
            {worksData.total} Projects Recorded
          </span>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3.5 rounded-2xl bg-white border border-[#D8CBB6] shadow-xs flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8C7769]" />
            <input
              type="text"
              value={worksSearch}
              onChange={(e) => setWorksSearch(e.target.value)}
              placeholder="Search description, location, or implementing agency..."
              className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs text-[#44312A] placeholder-[#8C7769] focus:outline-none focus:border-[#44312A]"
            />
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={worksCategory}
              onChange={(e) => {
                setWorksCategory(e.target.value);
                setWorksPage(1);
              }}
              className="w-full sm:w-auto px-3 py-2 bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-xs text-[#44312A] font-medium focus:outline-none focus:border-[#44312A]"
            >
              <option value="ALL">All Categories</option>
              {twin.categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Works Table */}
        <Card className="overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#504F47]">
              <thead className="bg-[#FAF7F2] border-b border-[#D8CBB6] text-[10px] uppercase font-mono text-[#8C7769]">
                <tr>
                  <th className="py-3 px-4">Work ID</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Cost (INR)</th>
                  <th className="py-3 px-4">Agency</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CBB6]/60">
                {worksLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : worksData.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#8C7769]">
                      No developmental projects matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  worksData.items.map((w) => (
                    <tr key={w.id} className="hover:bg-[#FAF7F2]/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#44312A]">
                        #{w.work_id || w.id}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate font-medium text-[#44312A]" title={w.work_description}>
                        {w.work_description}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#D8CBB6] text-[10px] font-medium text-[#6B5145]">
                          {w.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#44312A]">
                        {formatCroresLakhs(w.cost).compact}
                      </td>
                      <td className="py-3 px-4 text-[11px] truncate max-w-[140px]" title={w.implementing_agency}>
                        {w.implementing_agency || 'District Admin'}
                      </td>
                      <td className="py-3 px-4 text-[11px] truncate max-w-[120px]">
                        {w.location || w.district || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/works/${w.work_id || w.id}`}
                          className="px-2.5 py-1 rounded-lg bg-[#44312A] text-white font-bold text-[10px] hover:bg-[#34241E] transition inline-flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {!worksLoading && worksData.total_pages > 1 && (
            <div className="p-3.5 bg-[#FAF7F2] border-t border-[#D8CBB6] flex items-center justify-between text-xs text-[#504F47]">
              <span>
                Page {worksPage} of {worksData.total_pages} ({worksData.total} Works)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWorksPage((p) => Math.max(1, p - 1))}
                  disabled={worksPage === 1}
                  className="px-3 py-1 rounded-lg border border-[#D8CBB6] bg-white disabled:opacity-40 font-medium cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setWorksPage((p) => Math.min(worksData.total_pages, p + 1))}
                  disabled={worksPage === worksData.total_pages}
                  className="px-3 py-1 rounded-lg border border-[#D8CBB6] bg-white disabled:opacity-40 font-medium cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* 12. "Why?" Signal Explanation Slide-Over Drawer */}
      {activeSignalForDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full sm:w-[460px] bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#D8CBB6] animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#44312A]" />
                <span className="font-bold text-sm text-[#44312A]">Investigation Signal Rationale</span>
              </div>
              <button
                onClick={() => setActiveSignalForDrawer(null)}
                className="p-1 rounded-lg bg-white border border-[#D8CBB6] text-[#504F47] hover:text-[#44312A] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-[#504F47] flex-1">
              <div>
                <span className="text-[10px] font-mono text-[#8C7769] uppercase font-bold block">
                  Signal Classification
                </span>
                <h3 className="text-base font-bold text-[#44312A] mt-0.5">{activeSignalForDrawer.title}</h3>
                <p className="text-xs text-[#504F47] mt-1">{activeSignalForDrawer.short_explanation}</p>
              </div>

              {/* Observed vs Baseline */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2">
                <span className="text-[10px] font-mono text-[#8C7769] uppercase font-bold block">
                  Quantitative Rationale
                </span>
                <div className="flex justify-between py-1 border-b border-[#D8CBB6]/60">
                  <span>Observed Pattern:</span>
                  <strong className="text-[#44312A] font-mono">{activeSignalForDrawer.observed_value}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span>Comparison Baseline:</span>
                  <span className="text-[#504F47] font-mono">{activeSignalForDrawer.baseline_value}</span>
                </div>
              </div>

              {/* Methodology */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-1.5">
                <span className="text-[10px] font-mono text-[#8C7769] uppercase font-bold block">
                  Calculation Methodology
                </span>
                <p className="text-[11px] text-[#504F47] leading-relaxed">
                  {activeSignalForDrawer.calculation_methodology}
                </p>
                <div className="text-[10px] text-[#8C7769] pt-1">
                  Source: <strong>{activeSignalForDrawer.data_source}</strong>
                </div>
              </div>

              {/* Affected Work IDs if present */}
              {activeSignalForDrawer.affected_work_ids && activeSignalForDrawer.affected_work_ids.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#8C7769] uppercase font-bold block">
                    Associated Work Records ({activeSignalForDrawer.affected_work_ids.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSignalForDrawer.affected_work_ids.map((wid) => (
                      <Link
                        key={wid}
                        to={`/works/${wid}`}
                        className="px-2 py-1 rounded bg-[#FAF7F2] hover:bg-[#E7DDCA] border border-[#D8CBB6] text-[10px] font-mono text-[#44312A] transition"
                      >
                        #{wid}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-Accusatory Disclaimer */}
              <p className="text-[10px] text-[#8C7769] italic pt-2 border-t border-[#D8CBB6]">
                {RISK_DISCLAIMER}
              </p>
            </div>

            <div className="p-4 border-t border-[#D8CBB6] bg-[#FAF7F2]">
              <button
                onClick={() => setActiveSignalForDrawer(null)}
                className="w-full py-2.5 rounded-xl bg-[#44312A] text-white font-bold text-xs hover:bg-[#34241E] transition cursor-pointer"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. Export Snapshot Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#D8CBB6] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CBB6] pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[#44312A]" />
                <h3 className="text-base font-bold text-[#44312A]">Constituency Intelligence Snapshot</h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-[#504F47] hover:text-[#44312A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] space-y-2 text-xs text-[#44312A]">
              <div className="font-bold text-sm">{twin.constituency} — {twin.state} ({twin.house})</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2">
                <div>Funding Allocation: <strong>{alloc.compact}</strong></div>
                <div>Total Expenditure: <strong>{exp.compact}</strong></div>
                <div>Utilization Rate: <strong>{util}%</strong></div>
                <div>Total Projects: <strong>{twin.total_works_count}</strong></div>
                <div>Representative MP: <strong>{twin.mp?.mp_name || 'N/A'}</strong></div>
                <div>Review Signals: <strong>{twin.signals.length} flagged</strong></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E7DDCA] text-[#44312A] font-bold text-xs border border-[#D8CBB6] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Dossier</span>
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(twin.snapshot, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${twin.id}-intelligence-snapshot.json`;
                  a.click();
                  setIsExportModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Download className="h-3.5 w-3.5 text-[#E7DDCA]" />
                <span>Download JSON Payload</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
