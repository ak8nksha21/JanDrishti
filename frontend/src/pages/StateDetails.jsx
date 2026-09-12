import React, { useState, useEffect } from 'react';
import {
  Landmark,
  ArrowLeft,
  Calendar,
  Building2,
  Users,
  Briefcase,
  TrendingUp,
  Layers,
  MapPin,
  HelpCircle,
  X,
  Copy,
  Check,
  Printer,
  Download,
  AlertTriangle,
  Info,
  ChevronRight,
  ShieldAlert,
  BarChart3,
  Scale,
} from 'lucide-react';
import { useRouter } from '../router/Router';
import { fetchStateById, fetchStateExport } from '../services/states';
import { formatCroresLakhs } from '../utils/formatting';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function StateDetails({ stateId }) {
  const { navigate } = useRouter();

  // State Management
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sector breakdown view mode: "expenditure" vs "works"
  const [categoryViewMode, setCategoryViewMode] = useState('expenditure');

  // "Why?" Explanation Modal
  const [activeSignalForWhy, setActiveSignalForWhy] = useState(null);

  // State Snapshot Export Modal
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!stateId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchStateById(stateId);
        setProfile(res);
      } catch (err) {
        console.error('Failed to load state intelligence profile:', err);
        setError('The requested State or Union Territory intelligence profile could not be loaded.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [stateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E7DDCA] text-[#44312A] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
          <div className="h-6 bg-white/60 rounded w-48" />
          <div className="h-16 bg-white/80 rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-white/70 rounded-2xl" />
            ))}
          </div>
          <div className="h-80 bg-white/80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#E7DDCA] text-[#44312A] py-20 px-4">
        <div className="max-w-lg mx-auto bg-white p-8 rounded-2xl border border-[#D8CBB6] text-center space-y-4 shadow-md">
          <AlertTriangle className="h-10 w-10 text-[#A83232] mx-auto" />
          <h2 className="text-xl font-bold font-display text-[#44312A]">State Profile Not Found</h2>
          <p className="text-xs text-[#504F47]">{error || 'No administrative records found for this entity.'}</p>
          <button
            onClick={() => navigate('/states')}
            className="px-5 py-2.5 bg-[#44312A] text-white rounded-xl text-xs font-bold hover:bg-[#34241E] transition cursor-pointer"
          >
            ← Return to State Intelligence
          </button>
        </div>
      </div>
    );
  }

  // Category Chart Data
  const categoryChartData = profile.categories.map((c) => ({
    name: c.category,
    value: categoryViewMode === 'expenditure' ? c.total_cost / 1e7 : c.works_count,
    formatted:
      categoryViewMode === 'expenditure'
        ? `₹${(c.total_cost / 1e7).toFixed(2)} Cr (${c.percentage_cost}%)`
        : `${c.works_count.toLocaleString()} works (${c.percentage_works}%)`,
  }));

  const copySnapshotData = () => {
    const text = `JanDrishti State Intelligence Snapshot\n---------------------------------------\nState: ${profile.state} (${profile.entity_type})\nTotal Allocation: ₹${(profile.allocated_amount / 1e7).toFixed(2)} Cr\nTotal Expenditure: ₹${(profile.total_expenditure / 1e7).toFixed(2)} Cr\nUnspent Balance: ₹${(profile.unspent_amount / 1e7).toFixed(2)} Cr\nUtilization Rate: ${profile.utilization_percentage.toFixed(1)}%\nStatus: ${profile.status}\nTotal MPs: ${profile.mp_count}\nCompleted Works: ${profile.completed_works.toLocaleString()}\nPending Works: ${profile.pending_works.toLocaleString()}\nGenerated: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(text);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#E7DDCA] text-[#44312A] pb-24">
      {/* 1. Profile Header */}
      <div className="border-b border-[#D8CBB6] bg-[#FAF7F2]/90 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb Navigation */}
          <button
            onClick={() => navigate('/states')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#504F47] hover:text-[#44312A] transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All States & Union Territories</span>
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E7DDCA] text-[#44312A] border border-[#D8CBB6]">
                  {profile.entity_type} · India
                </span>
                <span className="text-xs text-[#8C7769]">·</span>
                <span className="text-xs text-[#504F47] font-medium">
                  Last updated: {profile.last_synchronized}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#44312A] uppercase font-display">
                {profile.state}
              </h1>
              <p className="text-xs sm:text-sm text-[#504F47]">
                MPLADS State Intelligence Profile · Aggregated administrative records from MoSPI
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsExportOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#44312A] font-bold text-xs border border-[#D8CBB6] shadow-xs transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#44312A]" />
                <span>Export Snapshot</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 2. State KPI Overview Panel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Allocation */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Allocation</div>
            <div className="text-base font-black text-[#44312A] font-mono mt-1">
              {formatCroresLakhs(profile.allocated_amount).compact}
            </div>
          </div>

          {/* Expenditure */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Expenditure</div>
            <div className="text-base font-black text-[#44312A] font-mono mt-1">
              {formatCroresLakhs(profile.total_expenditure).compact}
            </div>
          </div>

          {/* Utilization % */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Utilization</div>
            <div className="text-base font-black text-[#2D5A27] font-mono mt-1">
              {profile.utilization_percentage.toFixed(1)}%
            </div>
          </div>

          {/* Unspent */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Unspent</div>
            <div className="text-base font-black text-[#8C6D23] font-mono mt-1">
              {formatCroresLakhs(profile.unspent_amount).compact}
            </div>
          </div>

          {/* Works */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Total Works</div>
            <div className="text-base font-black text-[#44312A] font-mono mt-1">
              {profile.total_works.toLocaleString()}
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Completed</div>
            <div className="text-base font-black text-[#44312A] font-mono mt-1">
              {profile.completed_works.toLocaleString()}
            </div>
          </div>

          {/* Pending */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">Pending</div>
            <div className="text-base font-black text-[#44312A] font-mono mt-1">
              {profile.pending_works.toLocaleString()}
            </div>
          </div>

          {/* MPs Count */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#D8CBB6] shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">MPs</div>
            <div className="text-base font-black text-[#44312A] font-mono mt-1">
              {profile.mp_count} MPs
            </div>
          </div>
        </div>

        {/* 3. Financial Overview & Utilization Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Utilization Profile Card */}
          <div className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#44312A] font-display">
                Utilization Profile
              </h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#FAF7F2] text-[#44312A] border border-[#E7DDCA]">
                {profile.status}
              </span>
            </div>

            <div className="py-2 text-center space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-[#44312A] font-mono tracking-tight">
                {profile.utilization_percentage.toFixed(1)}%
              </div>
              <div className="text-xs text-[#504F47]">
                Recorded expenditure against sanctioned allocations
              </div>
            </div>

            <div className="h-3 w-full bg-[#E7DDCA] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  profile.utilization_percentage >= 45.0
                    ? 'bg-[#2D5A27]'
                    : profile.utilization_percentage >= 25.0
                    ? 'bg-[#8C6D23]'
                    : 'bg-[#A83232]'
                }`}
                style={{ width: `${Math.min(100, Math.max(3, profile.utilization_percentage))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E7DDCA] text-xs">
              <div>
                <span className="text-[#8C7769] text-[11px]">Expended:</span>
                <div className="font-mono font-bold text-[#44312A] mt-0.5">
                  {formatCroresLakhs(profile.total_expenditure).compact}
                </div>
              </div>
              <div>
                <span className="text-[#8C7769] text-[11px]">Unspent Balance:</span>
                <div className="font-mono font-bold text-[#8C6D23] mt-0.5">
                  {formatCroresLakhs(profile.unspent_amount).compact}
                </div>
              </div>
            </div>
          </div>

          {/* State Benchmark vs National Average */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7DDCA] pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#44312A]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#44312A] font-display">
                  State Benchmark vs National Average
                </h2>
              </div>
              <span className="text-[11px] text-[#8C7769]">Based on 36 States & UTs</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {profile.benchmarks.benchmarks.map((bm, i) => (
                <div key={i} className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E7DDCA] space-y-2">
                  <div className="text-[11px] font-bold text-[#504F47] uppercase tracking-wider">
                    {bm.metric_name}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-base font-black text-[#44312A] font-mono">
                        {bm.unit === '%' ? `${bm.state_value?.toFixed(1)}%` : bm.unit === '₹ Cr' ? `₹${bm.state_value?.toFixed(1)} Cr` : `${bm.state_value?.toLocaleString()} works`}
                      </div>
                      <div className="text-[10px] text-[#8C7769]">State Value</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-[#504F47]">
                        {bm.unit === '%' ? `${bm.national_average?.toFixed(1)}%` : bm.unit === '₹ Cr' ? `₹${bm.national_average?.toFixed(1)} Cr` : `${bm.national_average?.toLocaleString()} works`}
                      </div>
                      <div className="text-[10px] text-[#8C7769]">National Avg</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#E7DDCA] flex items-center justify-between text-[11px]">
                    <span className="text-[#504F47]">Delta:</span>
                    <span
                      className={`font-mono font-bold ${
                        bm.status === 'Above National Average' ? 'text-[#2D5A27]' : 'text-[#A83232]'
                      }`}
                    >
                      {bm.formatted_diff}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#504F47] bg-[#FAF7F2]/60 p-3 rounded-xl border border-[#E7DDCA]/60">
              {profile.benchmarks.summary}
            </p>
          </div>
        </div>

        {/* 4. Development Footprint ("Where is the Money Going?") */}
        <div className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7DDCA] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#44312A] flex items-center gap-2 font-display">
                <BarChart3 className="h-4 w-4 text-[#44312A]" />
                <span>Development Footprint</span>
              </h2>
              <p className="text-xs text-[#504F47] mt-0.5">
                Distribution of sanctioned MPLADS expenditures and developmental works across sectors.
              </p>
            </div>

            {/* Toggle View Mode */}
            <div className="inline-flex p-1 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
              <button
                onClick={() => setCategoryViewMode('expenditure')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  categoryViewMode === 'expenditure'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                By Expenditure (₹ Cr)
              </button>
              <button
                onClick={() => setCategoryViewMode('works')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  categoryViewMode === 'works'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                By Number of Works
              </button>
            </div>
          </div>

          {/* Chart */}
          {categoryChartData.length > 0 ? (
            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={categoryChartData}
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#44312A', fontSize: 11, fontWeight: 600 }}
                    width={140}
                  />
                  <Tooltip
                    cursor={{ fill: '#FAF7F2' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#44312A] text-white p-2.5 rounded-xl text-xs shadow-xl space-y-0.5">
                            <div className="font-bold">{d.name}</div>
                            <div className="font-mono text-[#E7DDCA]">{d.formatted}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="#44312A" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-[#504F47] text-xs">
              Category level itemization is not itemized in the dataset for this state.
            </div>
          )}
        </div>

        {/* 5. Implementation Landscape & Beneficiaries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Implementing Agencies */}
          <div className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7DDCA] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#44312A]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#44312A] font-display">
                  Implementation Landscape
                </h2>
              </div>
              <span className="text-[11px] text-[#8C7769]">Top Implementing Agencies</span>
            </div>

            {profile.agencies && profile.agencies.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {profile.agencies.map((ag, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E7DDCA] flex items-center justify-between text-xs"
                  >
                    <div className="max-w-[70%]">
                      <div className="font-bold text-[#44312A] truncate">{ag.agency}</div>
                      <div className="text-[11px] text-[#504F47] mt-0.5">
                        {ag.works_count} works recorded ({ag.percentage_works}%)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#44312A]">
                        {formatCroresLakhs(ag.total_cost).compact}
                      </div>
                      <div className="text-[10px] text-[#8C7769] font-mono">{ag.percentage_cost}% share</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-[#504F47] text-xs">
                Implementing agency records are being compiled for this state.
              </div>
            )}
          </div>

          {/* Beneficiary Reach & Data Coverage */}
          <div className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7DDCA] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#44312A]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#44312A] font-display">
                  Beneficiary Reach & Coverage
                </h2>
              </div>
              <span className="text-[11px] text-[#8C7769]">Public Impact</span>
            </div>

            {profile.beneficiaries.is_available ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E7DDCA]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">
                      Total Beneficiaries
                    </div>
                    <div className="text-xl font-black text-[#44312A] font-mono mt-1">
                      {profile.beneficiaries.total_recorded_beneficiaries.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E7DDCA]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">
                      Avg Per Work
                    </div>
                    <div className="text-xl font-black text-[#44312A] font-mono mt-1">
                      {profile.beneficiaries.average_beneficiaries_per_work.toLocaleString()}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[#504F47] bg-[#FAF7F2] p-3 rounded-xl border border-[#E7DDCA]">
                  {profile.beneficiaries.notes}
                </p>
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <Info className="h-6 w-6 text-[#8C7769] mx-auto" />
                <div className="text-xs font-bold text-[#44312A]">Beneficiary Data Not Available</div>
                <p className="text-[11px] text-[#504F47] max-w-sm mx-auto">
                  {profile.beneficiaries.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 6. State-Level Map Activity */}
        <div className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E7DDCA] pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#44312A]" />
              <h2 className="text-base font-bold text-[#44312A] font-display">
                State Geographic Footprint
              </h2>
            </div>
            <span className="text-xs text-[#504F47]">
              {profile.map_points.length > 0 ? `${profile.map_points.length} verified project locations` : 'Pending Coordinates'}
            </span>
          </div>

          {profile.has_coordinates && profile.map_points.length > 0 ? (
            <div className="h-96 rounded-xl overflow-hidden border border-[#D8CBB6] relative z-0">
              <MapContainer
                center={[profile.map_points[0].latitude, profile.map_points[0].longitude]}
                zoom={7}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {profile.map_points.map((pt) => (
                  <Marker key={pt.id} position={[pt.latitude, pt.longitude]}>
                    <Popup>
                      <div className="text-xs space-y-1 p-1">
                        <div className="font-bold text-[#44312A]">{pt.work_description || 'MPLADS Work'}</div>
                        <div className="text-[#504F47]">Cost: {formatCroresLakhs(pt.cost).compact}</div>
                        <div className="text-[10px] text-[#8C7769]">Agency: {pt.implementing_agency || 'N/A'}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <div className="py-16 text-center bg-[#FAF7F2] rounded-xl border border-[#E7DDCA] space-y-2">
              <MapPin className="h-8 w-8 text-[#8C7769] mx-auto" />
              <div className="text-sm font-bold text-[#44312A]">
                Geographic visualization unavailable for this state.
              </div>
              <p className="text-xs text-[#504F47] max-w-md mx-auto">
                Accurate geospatial coordinates for completed works in {profile.state} are pending administrative verification.
              </p>
            </div>
          )}
        </div>

        {/* 7. Analytical Signals Section */}
        <div className="bg-white rounded-2xl border border-[#D8CBB6] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E7DDCA] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#44312A]" />
              <h2 className="text-base font-bold text-[#44312A] font-display">
                Analytical Signals Requiring Review
              </h2>
            </div>
            <span className="text-xs text-[#504F47]">
              {profile.signals.length} review {profile.signals.length === 1 ? 'signal' : 'signals'} generated
            </span>
          </div>

          {profile.signals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.signals.map((sig) => (
                <div
                  key={sig.signal_id}
                  className="p-4 bg-[#FAF7F2] rounded-xl border border-[#D8CBB6] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-bold text-[#44312A]">{sig.title}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          sig.severity === 'High'
                            ? 'bg-[#FCE8E6] text-[#A83232] border-[#A83232]/30'
                            : 'bg-[#FAF3E0] text-[#8C6D23] border-[#8C6D23]/30'
                        }`}
                      >
                        {sig.severity} Severity
                      </span>
                    </div>
                    <p className="text-xs text-[#504F47] leading-relaxed">{sig.short_explanation}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E7DDCA] text-xs">
                    <span className="text-[#8C7769] text-[11px]">
                      Observed: <strong className="text-[#44312A] font-mono">{sig.observed_value}</strong>
                    </span>
                    <button
                      onClick={() => setActiveSignalForWhy(sig)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#44312A] hover:underline cursor-pointer"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Why?</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-[#FAF7F2] rounded-xl border border-[#E7DDCA] space-y-1">
              <div className="text-xs font-bold text-[#2D5A27]">No High-Risk Analytical Signals</div>
              <p className="text-[11px] text-[#504F47]">
                Expenditure velocity, agency balance, and sector distribution are tracking within normal baselines for {profile.state}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 8. "Why?" Explainability Modal */}
      {activeSignalForWhy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#44312A]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveSignalForWhy(null)}
          />
          <div className="relative bg-white border border-[#D8CBB6] rounded-2xl max-w-lg w-full p-6 shadow-2xl z-10 space-y-5">
            <div className="flex items-start justify-between border-b border-[#E7DDCA] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7769]">
                  Explainability Rationale
                </span>
                <h3 className="text-base font-bold text-[#44312A] font-display mt-0.5">
                  {activeSignalForWhy.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveSignalForWhy(null)}
                className="text-[#8C7769] hover:text-[#44312A] p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E7DDCA] space-y-1">
                <div className="font-bold text-[#44312A]">Observed Rationale</div>
                <p className="text-[#504F47]">{activeSignalForWhy.short_explanation}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E7DDCA]">
                  <div className="text-[10px] font-bold text-[#8C7769]">Observed Value</div>
                  <div className="font-mono font-bold text-[#44312A] text-sm mt-0.5">
                    {activeSignalForWhy.observed_value}
                  </div>
                </div>
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E7DDCA]">
                  <div className="text-[10px] font-bold text-[#8C7769]">National Baseline</div>
                  <div className="font-mono font-bold text-[#504F47] text-sm mt-0.5">
                    {activeSignalForWhy.national_baseline}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-[#44312A]">Calculation Methodology</div>
                <p className="text-[#504F47] text-[11px]">{activeSignalForWhy.calculation_methodology}</p>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-[#44312A]">Authoritative Data Source</div>
                <p className="text-[#504F47] text-[11px]">{activeSignalForWhy.data_source}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7DDCA] flex justify-end">
              <button
                onClick={() => setActiveSignalForWhy(null)}
                className="px-4 py-2 bg-[#44312A] text-white rounded-xl text-xs font-bold hover:bg-[#34241E] transition cursor-pointer"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. State Snapshot Export Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#44312A]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsExportOpen(false)}
          />
          <div className="relative bg-white border border-[#D8CBB6] rounded-2xl max-w-lg w-full p-6 shadow-2xl z-10 space-y-5">
            <div className="flex items-start justify-between border-b border-[#E7DDCA] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#44312A] font-display">
                  {profile.state} — State Snapshot
                </h3>
                <p className="text-xs text-[#504F47]">MPLADS Analytical Intelligence Export</p>
              </div>
              <button
                onClick={() => setIsExportOpen(false)}
                className="text-[#8C7769] hover:text-[#44312A] p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7DDCA] space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#504F47]">State / UT:</span>
                <span className="font-bold text-[#44312A]">{profile.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#504F47]">Total Allocation:</span>
                <span className="font-bold text-[#44312A]">{formatCroresLakhs(profile.allocated_amount).full}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#504F47]">Total Expenditure:</span>
                <span className="font-bold text-[#44312A]">{formatCroresLakhs(profile.total_expenditure).full}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#504F47]">Utilization Rate:</span>
                <span className="font-bold text-[#2D5A27]">{profile.utilization_percentage.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#504F47]">Total MPs:</span>
                <span className="font-bold text-[#44312A]">{profile.mp_count} MPs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#504F47]">Completed Works:</span>
                <span className="font-bold text-[#44312A]">{profile.completed_works.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#504F47]">Review Signals:</span>
                <span className="font-bold text-[#A83232]">{profile.signals.length}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E7DDCA]">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D8CBB6] text-xs font-bold text-[#44312A] hover:bg-[#FAF7F2] transition cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={copySnapshotData}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#44312A] text-white text-xs font-bold hover:bg-[#34241E] transition cursor-pointer"
              >
                {exportCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Summary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
