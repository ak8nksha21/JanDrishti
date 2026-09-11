import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapContainer as LeafletMap,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Sparkles,
  AlertTriangle,
  X,
  ExternalLink,
  ChevronRight,
  Info,
  Compass,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Badge from '../ui/Badge';
import { getWorks } from '../../services/api';
import { formatCroresLakhs } from '../../utils/formatting';
import { RISK_DISCLAIMER, getRiskBadgeConfig } from '../../utils/riskLanguage';
import { useRouter, Link } from '../../router/Router';

// Component to dynamically fit map bounds to valid project pins
function FitBoundsToMarkers({ markers }) {
  const map = useMap();
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (markers.length > 0 && markers.length !== prevCountRef.current) {
      prevCountRef.current = markers.length;
      try {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 12,
            animate: true,
          });
        }
      } catch (e) {
        console.warn('Map fitBounds error:', e);
      }
    }
  }, [markers, map]);

  return null;
}

// Custom Leaflet SVG DivIcon generator strictly using Cream #E7DDCA & Dark Brown #44312A
function createCustomMarkerIcon(riskLevel) {
  const norm = String(riskLevel || '').toLowerCase();
  let fillColor = '#8C7769'; // Muted Taupe (Standard)
  let ringColor = 'rgba(140, 119, 105, 0.35)';

  if (norm === 'critical' || norm.includes('anomalous') || norm.includes('priority')) {
    fillColor = '#44312A'; // Deep Dark Brown (Critical)
    ringColor = 'rgba(68, 49, 42, 0.45)';
  } else if (norm === 'high' || norm.includes('flagged')) {
    fillColor = '#504F47'; // Charcoal Taupe (High)
    ringColor = 'rgba(80, 79, 71, 0.4)';
  } else if (norm === 'medium' || norm.includes('review')) {
    fillColor = '#6B5145'; // Warm Mocha (Needs Review)
    ringColor = 'rgba(107, 81, 69, 0.35)';
  }

  const html = `
    <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: ${ringColor}; animation: pulse 2s infinite;"></div>
      <div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${fillColor}; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(68,49,42,0.35);"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-risk-pin',
    html: html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export default function MapContainer({ worksData: propWorks = null, loading = false }) {
  const [works, setWorks] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [activeWorkForDrawer, setActiveWorkForDrawer] = useState(null);
  const { navigate } = useRouter();

  // Load works with geospatial coordinates if not supplied via props
  useEffect(() => {
    if (propWorks && Array.isArray(propWorks) && propWorks.length > 0) {
      setWorks(propWorks);
      return;
    }

    const fetchMapWorks = async () => {
      setFetching(true);
      try {
        const response = await getWorks({ limit: 100 });
        if (response?.items && Array.isArray(response.items)) {
          setWorks(response.items);
        }
      } catch (err) {
        console.warn('Failed to fetch works for map:', err);
      } finally {
        setFetching(false);
      }
    };

    fetchMapWorks();
  }, [propWorks]);

  // Extract and validate numerical coordinates (strict: NO fake coordinates)
  const { validMarkers, missingGeoCount } = useMemo(() => {
    const valid = [];
    let missing = 0;

    (works || []).forEach((w) => {
      const rawLat = w.latitude ?? w.gps_latitude;
      const rawLng = w.longitude ?? w.gps_longitude;

      if (rawLat === null || rawLng === null || rawLat === undefined || rawLng === undefined || rawLat === '' || rawLng === '') {
        missing++;
        return;
      }

      const lat = Number(rawLat);
      const lng = Number(rawLng);

      // Validate realistic coordinate ranges and exclude (0, 0)
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)) {
        let riskLevel = w.risk_level || 'Low';
        const score = Number(w.overall_score || 0);
        if (!w.risk_level && score > 0) {
          if (score >= 80) riskLevel = 'Critical';
          else if (score >= 60) riskLevel = 'High';
          else if (score >= 35) riskLevel = 'Medium';
          else riskLevel = 'Low';
        }

        valid.push({
          id: w.id,
          work_id: w.work_id || w.id,
          lat,
          lng,
          description: w.work_description || 'Completed Infrastructure Work',
          category: w.category || 'General',
          cost: w.cost,
          constituency: w.constituency || 'N/A',
          district: w.district || 'N/A',
          state: w.state || 'N/A',
          mp_name: w.mp_name || 'N/A',
          house: w.house || 'Lok Sabha',
          implementing_agency: w.implementing_agency || null,
          completion_date: w.completion_date,
          beneficiaries: w.beneficiaries,
          risk_level: riskLevel,
          overall_score: score,
          flags: w.flags || [],
          raw: w,
        });
      } else {
        missing++;
      }
    });

    return { validMarkers: valid, missingGeoCount: missing };
  }, [works]);

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set();
    validMarkers.forEach((m) => {
      if (m.category) cats.add(m.category);
    });
    return Array.from(cats);
  }, [validMarkers]);

  // Filter markers based on selected risk and category
  const filteredMarkers = useMemo(() => {
    return validMarkers.filter((m) => {
      if (selectedRiskFilter === 'FLAGGED' && !(m.risk_level === 'Critical' || m.risk_level === 'High')) {
        return false;
      }
      if (selectedRiskFilter === 'REVIEW' && m.risk_level !== 'Medium') {
        return false;
      }
      if (selectedRiskFilter === 'STANDARD' && m.risk_level !== 'Low') {
        return false;
      }
      if (selectedCategoryFilter !== 'ALL' && m.category !== selectedCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [validMarkers, selectedRiskFilter, selectedCategoryFilter]);

  // Default geographical center of India
  const indiaCenter = [22.9734, 78.6569];

  return (
    <Card className="overflow-hidden relative">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#44312A]" />
              <CardTitle>Geospatial Project Intelligence Map</CardTitle>
              <Badge variant="primary" size="sm" dot>
                GIS LAYER
              </Badge>
            </div>
            <CardDescription>
              Interactive OpenStreetMap GIS visualization with verified GPS coordinates and risk-stratified pinpoints.
            </CardDescription>
          </div>

          {/* Filter Bar Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Risk Filter Buttons */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-xs font-semibold">
              <button
                onClick={() => setSelectedRiskFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedRiskFilter === 'ALL'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                All ({validMarkers.length})
              </button>
              <button
                onClick={() => setSelectedRiskFilter('FLAGGED')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                  selectedRiskFilter === 'FLAGGED'
                    ? 'bg-[#504F47] text-white font-bold shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#44312A]" />
                <span>Flagged Risk</span>
              </button>
              <button
                onClick={() => setSelectedRiskFilter('REVIEW')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedRiskFilter === 'REVIEW'
                    ? 'bg-[#6B5145] text-white font-bold shadow-xs'
                    : 'text-[#6B5145] hover:text-[#44312A]'
                }`}
              >
                Needs Review
              </button>
              <button
                onClick={() => setSelectedRiskFilter('STANDARD')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedRiskFilter === 'STANDARD'
                    ? 'bg-[#8C7769] text-white font-bold shadow-xs'
                    : 'text-[#8C7769] hover:text-[#44312A]'
                }`}
              >
                Standard
              </button>
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] focus:outline-none focus:border-[#44312A]"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* Verification & Transparency Banner */}
        <div className="bg-[#FAF7F2] border-y border-[#D8CBB6] px-4 py-2.5 text-xs text-[#504F47] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-[#44312A] shrink-0" />
            <span>
              {validMarkers.length > 0 ? (
                <>
                  Plotting <strong className="text-[#44312A]">{filteredMarkers.length}</strong> works with verified numerical coordinates.
                  {missingGeoCount > 0 && (
                    <span className="text-[#8C7769] ml-1">
                      ({missingGeoCount} works without coordinates are excluded per data integrity rules.)
                    </span>
                  )}
                </>
              ) : (
                <>
                  <strong className="text-[#44312A]">No verified GPS coordinates available:</strong> Current official MPLADS records provide textual administrative locations but no numerical latitude/longitude coordinates. Projects are therefore excluded from map plotting rather than assigned synthetic locations.
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#44312A]" />
              <span className="text-[#44312A] font-medium">Priority Review</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#504F47]" />
              <span className="text-[#504F47] font-medium">Flagged Risk</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#8C7769]" />
              <span className="text-[#8C7769] font-medium">Standard</span>
            </span>
          </div>
        </div>

        {/* Leaflet Map Canvas */}
        <div className="h-[460px] sm:h-[540px] w-full relative z-0">
          <LeafletMap
            center={indiaCenter}
            zoom={5}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBoundsToMarkers markers={filteredMarkers} />

            {filteredMarkers.map((marker) => {
              const icon = createCustomMarkerIcon(marker.risk_level);
              const costFormatted = formatCroresLakhs(marker.cost);
              const badgeCfg = getRiskBadgeConfig(marker.risk_level);

              return (
                <Marker
                  key={marker.id}
                  position={[marker.lat, marker.lng]}
                  icon={icon}
                >
                  <Popup className="custom-jandrishti-popup" minWidth={260}>
                    <div className="p-3 space-y-2 text-[#44312A]">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#D8CBB6] pb-1.5">
                        <span className="font-mono text-xs font-bold text-[#44312A] bg-[#E7DDCA] px-1.5 py-0.5 rounded border border-[#D8CBB6]">
                          WORK ID #{marker.work_id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeCfg.colorClass}`}>
                          {badgeCfg.label}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="font-bold text-xs text-[#44312A] line-clamp-2 leading-tight">
                        {marker.description}
                      </p>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-[#FAF7F2] p-2 rounded-xl border border-[#D8CBB6]">
                        <div>
                          <span className="text-[#504F47] block text-[10px]">Location</span>
                          <strong className="text-[#44312A]">{marker.constituency}</strong>
                          <div className="text-[10px] text-[#504F47]">{marker.state}</div>
                        </div>
                        <div>
                          <span className="text-[#504F47] block text-[10px]">Completed Cost</span>
                          <strong className="text-[#44312A] font-mono text-xs block font-bold">
                            {costFormatted.compact}
                          </strong>
                          <span className="text-[9px] text-[#504F47] font-mono">
                            {costFormatted.exact}
                          </span>
                        </div>
                      </div>

                      {/* Action Button for Slide-Over Drawer */}
                      <button
                        onClick={() => setActiveWorkForDrawer(marker)}
                        className="w-full py-2 px-2.5 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Sparkles className="h-3 w-3 text-[#E7DDCA]" />
                        <span>Inspect Audit Slide-Over</span>
                        <ChevronRight className="h-3 w-3 text-[#E7DDCA]" />
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </LeafletMap>

          {/* Professional Data Integrity Overlay when 0 records contain numerical GPS */}
          {validMarkers.length === 0 && !fetching && (
            <div className="absolute bottom-5 left-5 z-10 bg-white/95 backdrop-blur-md border border-[#D8CBB6] rounded-2xl p-4 shadow-xl text-xs text-[#44312A] max-w-md pointer-events-none space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold flex items-center gap-1.5 text-[#44312A] text-xs">
                  <Compass className="h-4 w-4 text-[#44312A]" />
                  <span>No verified GPS coordinates available</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#FAF7F2] text-[#44312A] border border-[#D8CBB6]">
                  Data Quality Policy
                </span>
              </div>
              <p className="text-[11px] text-[#504F47] leading-relaxed">
                Current official MPLADS records provide textual administrative locations but no numerical latitude/longitude coordinates. Projects are therefore excluded from map plotting rather than assigned synthetic locations.
              </p>
              <div className="pt-1 text-[10px] text-[#8C7769] font-mono">
                OpenStreetMap GIS Base Layer Active • Zero Geocoding Fabrication
              </div>
            </div>
          )}
        </div>

        {/* Slide-Over Drawer Panel in Crisp White & Brown */}
        {activeWorkForDrawer && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-[420px] bg-white border-l border-[#D8CBB6] shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#44312A] bg-[#E7DDCA] px-2 py-0.5 rounded border border-[#D8CBB6]">
                  WORK #{activeWorkForDrawer.work_id}
                </span>
                <Badge variant="outline" size="sm">
                  {activeWorkForDrawer.category}
                </Badge>
              </div>
              <button
                onClick={() => setActiveWorkForDrawer(null)}
                className="p-1.5 rounded-xl bg-white border border-[#D8CBB6] text-[#504F47] hover:text-[#44312A] transition cursor-pointer shadow-xs"
                title="Close slide-over"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-[#504F47]">
              {/* Title & Cost Callout */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-[#44312A] leading-snug">
                  {activeWorkForDrawer.description}
                </h3>
                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                      Actual Executed Cost
                    </span>
                    <span className="text-xl font-black font-mono text-[#44312A]">
                      {formatCroresLakhs(activeWorkForDrawer.cost).compact}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                      Risk Classification
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border inline-block mt-0.5 ${getRiskBadgeConfig(activeWorkForDrawer.risk_level).colorClass}`}>
                      {getRiskBadgeConfig(activeWorkForDrawer.risk_level).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Potential Irregularity Explanations & Review Signals */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#44312A]" />
                    <span>Audit Review Signals</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#504F47]">Heuristic Analysis</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F4EFE6] border border-[#D8CBB6] space-y-2 text-[#44312A] leading-relaxed">
                  <div className="font-bold text-[#44312A] text-xs">
                    {activeWorkForDrawer.risk_level === 'Critical' || activeWorkForDrawer.risk_level === 'High'
                      ? 'Statistical Cost Deviation & Proximity Check'
                      : 'Standard Compliance & Documentation Verification'}
                  </div>
                  <p className="text-[11px] text-[#504F47]">
                    {activeWorkForDrawer.flags && activeWorkForDrawer.flags.length > 0
                      ? `Active system indicators: ${activeWorkForDrawer.flags.join(', ')}.`
                      : 'Project cost and timeline are being monitored against district sector averages.'}
                  </p>
                  <p className="text-[10px] text-[#504F47] pt-1 border-t border-[#D8CBB6] italic">
                    {RISK_DISCLAIMER}
                  </p>
                </div>
              </div>

              {/* Administrative & MP Breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
                  Administrative Scope
                </span>
                <div className="space-y-2 p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                  <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                    <span>Member of Parliament:</span>
                    <strong className="text-[#44312A]">{activeWorkForDrawer.mp_name}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                    <span>House:</span>
                    <span className="text-[#44312A]">{activeWorkForDrawer.house}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                    <span>Constituency & State:</span>
                    <span className="text-[#44312A]">{activeWorkForDrawer.constituency}, {activeWorkForDrawer.state}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                    <span>Implementing Agency:</span>
                    <span className="text-[#44312A] font-mono text-[11px]">
                      {activeWorkForDrawer.implementing_agency || 'Unspecified in Feed'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>GPS Coordinates:</span>
                    <span className="text-[#44312A] font-mono text-[11px] font-semibold">
                      {activeWorkForDrawer.lat.toFixed(5)}, {activeWorkForDrawer.lng.toFixed(5)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Full Dossier Navigation Link */}
              <div className="pt-2">
                <Link
                  to={`/works/${activeWorkForDrawer.work_id}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#44312A]/20"
                >
                  <span>Open Full Investigation Dossier</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#E7DDCA]" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
