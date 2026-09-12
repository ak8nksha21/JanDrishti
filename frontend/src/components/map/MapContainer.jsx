import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapContainer as LeafletMap,
  TileLayer,
  Marker,
  Popup,
  Tooltip as LeafletTooltip,
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
  MapPin,
  Building2,
  TrendingUp,
  Layers,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Badge from '../ui/Badge';
import { fetchCityRisks } from '../../services/api';
import { formatCroresLakhs } from '../../utils/formatting';
import { RISK_DISCLAIMER } from '../../utils/riskLanguage';
import { useRouter, Link } from '../../router/Router';

// Geographic bounds of India (strictly mainland + islands)
// Latitude: 8.0°N to 36.5°N, Longitude: 68.0°E to 97.5°E
const INDIA_BOUNDS = [
  [8.0, 68.0],
  [36.5, 97.5],
];

// Component to ensure initial map viewport fits India on load
function InitialIndiaBounds() {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!fittedRef.current && map) {
      fittedRef.current = true;
      try {
        map.fitBounds(INDIA_BOUNDS, {
          padding: [25, 25],
          animate: false,
        });
      } catch (err) {
        console.warn('Initial India bounds fit failed:', err);
      }
    }
  }, [map]);

  return null;
}

// Custom Leaflet DivIcon generator adhering strictly to JanDrishti Cream #E7DDCA & Dark Brown #44312A palette
function createRiskMarkerIcon(category, score) {
  const cat = String(category || '').toLowerCase();
  let fillColor = '#8C7769'; // Standard: Muted Slate Taupe
  let ringColor = 'rgba(140, 119, 105, 0.28)';
  let dotSize = 13;
  let ringSize = 22;
  let pulseAnimation = '';

  if (cat.includes('priority') || score >= 80) {
    fillColor = '#44312A'; // Priority Review: Deep Dark Cocoa
    ringColor = 'rgba(68, 49, 42, 0.45)';
    dotSize = 16;
    ringSize = 28;
    pulseAnimation = 'animation: pulse 1.8s infinite;';
  } else if (cat.includes('flagged') || score >= 60) {
    fillColor = '#504F47'; // Flagged Risk: Charcoal Taupe
    ringColor = 'rgba(80, 79, 71, 0.38)';
    dotSize = 14;
    ringSize = 25;
    pulseAnimation = 'animation: pulse 2.2s infinite;';
  } else if (cat.includes('review') || score >= 30) {
    fillColor = '#6B5145'; // Needs Review: Warm Mocha
    ringColor = 'rgba(107, 81, 69, 0.32)';
    dotSize = 13;
    ringSize = 22;
  }

  const html = `
    <div style="position: relative; width: ${ringSize}px; height: ${ringSize}px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: ${ringSize}px; height: ${ringSize}px; border-radius: 50%; background-color: ${ringColor}; ${pulseAnimation}"></div>
      <div style="width: ${dotSize}px; height: ${dotSize}px; border-radius: 50%; background-color: ${fillColor}; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(68,49,42,0.4);"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-city-risk-pin',
    html: html,
    iconSize: [ringSize, ringSize],
    iconAnchor: [ringSize / 2, ringSize / 2],
    popupAnchor: [0, -(ringSize / 2)],
  });
}

function getRiskCategoryConfig(category, score) {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('priority') || score >= 80) {
    return {
      label: 'Priority Review',
      badgeClass: 'bg-[#44312A] text-white border-[#44312A]',
      dotBg: 'bg-white',
      borderClass: 'border-[#44312A]',
    };
  }
  if (cat.includes('flagged') || score >= 60) {
    return {
      label: 'Flagged Risk',
      badgeClass: 'bg-[#504F47] text-white border-[#504F47]',
      dotBg: 'bg-[#E7DDCA]',
      borderClass: 'border-[#504F47]',
    };
  }
  if (cat.includes('review') || score >= 30) {
    return {
      label: 'Needs Review',
      badgeClass: 'bg-[#F4EFE6] text-[#44312A] border-[#CFC0A7]',
      dotBg: 'bg-[#6B5145]',
      borderClass: 'border-[#CFC0A7]',
    };
  }
  return {
    label: 'Standard',
    badgeClass: 'bg-white text-[#504F47] border-[#D8CBB6]',
    dotBg: 'bg-[#8C7769]',
    borderClass: 'border-[#D8CBB6]',
  };
}

export default function MapContainer({ loading = false }) {
  const [citiesData, setCitiesData] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('ALL');
  const [selectedStateFilter, setSelectedStateFilter] = useState('ALL');
  const [activeCityForDrawer, setActiveCityForDrawer] = useState(null);
  const [metaStats, setMetaStats] = useState({
    total: 0,
    mapped: 0,
    unmapped: 0,
  });
  const { navigate } = useRouter();

  // Load existing city-level risk scores from backend once on mount
  useEffect(() => {
    let isMounted = true;

    const loadCityRiskData = async () => {
      setFetching(true);
      try {
        const response = await fetchCityRisks();
        if (isMounted && response?.cities && Array.isArray(response.cities)) {
          setCitiesData(response.cities);
          setMetaStats({
            total: response.total_cities || response.cities.length,
            mapped: response.mapped_cities_count || response.cities.filter((c) => c.has_coordinates).length,
            unmapped: response.unmapped_cities_count || response.cities.filter((c) => !c.has_coordinates).length,
          });
        }
      } catch (err) {
        console.warn('Failed to fetch city risk intelligence:', err);
      } finally {
        if (isMounted) setFetching(false);
      }
    };

    loadCityRiskData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter valid geographic markers (only cities with verified coordinates)
  const validCityMarkers = useMemo(() => {
    return (citiesData || []).filter(
      (c) => c.has_coordinates && c.latitude !== null && c.longitude !== null
    );
  }, [citiesData]);

  // Extract unique states for optional state filter
  const statesList = useMemo(() => {
    const sSet = new Set();
    validCityMarkers.forEach((c) => {
      if (c.state && c.state !== 'Unknown') sSet.add(c.state);
    });
    return Array.from(sSet).sort();
  }, [validCityMarkers]);

  // Counts for each filter tab
  const filterCounts = useMemo(() => {
    let flagged = 0;
    let review = 0;
    let standard = 0;

    validCityMarkers.forEach((c) => {
      const score = Number(c.risk_score || 0);
      if (score >= 60) flagged++;
      else if (score >= 30) review++;
      else standard++;
    });

    return {
      all: validCityMarkers.length,
      flagged,
      review,
      standard,
    };
  }, [validCityMarkers]);

  // Apply user-selected filters
  const filteredMarkers = useMemo(() => {
    return validCityMarkers.filter((m) => {
      const score = Number(m.risk_score || 0);

      // Risk level filter
      if (selectedRiskFilter === 'FLAGGED') {
        if (score < 60) return false;
      } else if (selectedRiskFilter === 'REVIEW') {
        if (score < 30 || score >= 60) return false;
      } else if (selectedRiskFilter === 'STANDARD') {
        if (score >= 30) return false;
      }

      // State filter
      if (selectedStateFilter !== 'ALL' && m.state !== selectedStateFilter) {
        return false;
      }

      return true;
    });
  }, [validCityMarkers, selectedRiskFilter, selectedStateFilter]);

  // Default geographical center of India
  const indiaCenter = [22.8, 79.5];

  return (
    <Card className="overflow-hidden relative">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#44312A]" />
              <CardTitle>Geospatial Project Intelligence Map</CardTitle>
              <Badge variant="primary" size="sm" dot>
                INDIA GIS LAYER
              </Badge>
            </div>
            <CardDescription>
              Interactive OpenStreetMap GIS visualization plotting verified city-level composite risk scores from the JanDrishti Risk Engine.
            </CardDescription>
          </div>

          {/* Filter Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Risk Category Filter Buttons */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6] text-xs font-semibold">
              <button
                onClick={() => setSelectedRiskFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedRiskFilter === 'ALL'
                    ? 'bg-[#44312A] text-white shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                All ({filterCounts.all})
              </button>
              <button
                onClick={() => setSelectedRiskFilter('FLAGGED')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  selectedRiskFilter === 'FLAGGED'
                    ? 'bg-[#504F47] text-white font-bold shadow-xs'
                    : 'text-[#504F47] hover:text-[#44312A]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#44312A]" />
                <span>Flagged Risk ({filterCounts.flagged})</span>
              </button>
              <button
                onClick={() => setSelectedRiskFilter('REVIEW')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  selectedRiskFilter === 'REVIEW'
                    ? 'bg-[#6B5145] text-white font-bold shadow-xs'
                    : 'text-[#6B5145] hover:text-[#44312A]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#6B5145]" />
                <span>Needs Review ({filterCounts.review})</span>
              </button>
              <button
                onClick={() => setSelectedRiskFilter('STANDARD')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  selectedRiskFilter === 'STANDARD'
                    ? 'bg-[#8C7769] text-white font-bold shadow-xs'
                    : 'text-[#8C7769] hover:text-[#44312A]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#8C7769]" />
                <span>Standard ({filterCounts.standard})</span>
              </button>
            </div>

            {/* State Filter Dropdown */}
            {statesList.length > 0 && (
              <select
                value={selectedStateFilter}
                onChange={(e) => setSelectedStateFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D8CBB6] rounded-xl text-[#44312A] font-medium focus:outline-none focus:border-[#44312A] cursor-pointer"
              >
                <option value="ALL">All States ({statesList.length})</option>
                {statesList.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* Data Quality & Transparency Banner */}
        <div className="bg-[#FAF7F2] border-y border-[#D8CBB6] px-4 py-2.5 text-xs text-[#504F47] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[#44312A] shrink-0" />
            <span>
              Plotting <strong className="text-[#44312A]">{filteredMarkers.length}</strong> cities across India with verified geographic coordinates and multi-signal risk evaluations.
              {metaStats.unmapped > 0 && (
                <span className="text-[#8C7769] ml-1">
                  ({metaStats.unmapped} non-geographic records such as Sitting Rajya Sabha excluded from map plotting per zero-fabrication data policy.)
                </span>
              )}
            </span>
          </div>

          {/* Canonical 4-Band Map Legend */}
          <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#44312A]" />
              <span className="text-[#44312A] font-semibold">Priority 80–100</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#504F47]" />
              <span className="text-[#504F47] font-semibold">Flagged Risk 60–79</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6B5145]" />
              <span className="text-[#6B5145] font-semibold">Needs Review 30–59</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8C7769]" />
              <span className="text-[#8C7769] font-semibold">Standard 0–29</span>
            </span>
          </div>
        </div>

        {/* Leaflet Map Canvas - India Centered */}
        <div className="h-[480px] sm:h-[560px] w-full relative z-0">
          <LeafletMap
            center={indiaCenter}
            zoom={5}
            minZoom={4}
            maxBounds={[
              [5.0, 65.0],
              [38.5, 100.0],
            ]}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Automatically sets initial viewport to India bounds */}
            <InitialIndiaBounds />

            {filteredMarkers.map((cityItem) => {
              const icon = createRiskMarkerIcon(cityItem.risk_category, cityItem.risk_score);
              const badgeCfg = getRiskCategoryConfig(cityItem.risk_category, cityItem.risk_score);

              return (
                <Marker
                  key={`${cityItem.constituency}-${cityItem.state}`}
                  position={[cityItem.latitude, cityItem.longitude]}
                  icon={icon}
                >
                  {/* Compact Hover Tooltip (Requirement 8) */}
                  <LeafletTooltip direction="top" offset={[0, -12]} opacity={0.96}>
                    <div className="text-xs space-y-0.5 text-[#44312A] font-sans">
                      <div className="font-bold text-sm">{cityItem.city}</div>
                      <div className="text-[11px] font-mono text-[#504F47]">
                        Risk Score: <strong className="text-[#44312A]">{cityItem.risk_score}</strong>
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8C7769]">
                        {badgeCfg.label}
                      </div>
                    </div>
                  </LeafletTooltip>

                  {/* Comprehensive Interactive Popup Card (Requirement 4) */}
                  <Popup className="custom-jandrishti-popup" minWidth={280} maxWidth={320}>
                    <div className="p-2.5 space-y-2.5 text-[#44312A]">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#D8CBB6] pb-1.5">
                        <div>
                          <div className="font-bold text-sm text-[#44312A] leading-snug">
                            {cityItem.city}
                          </div>
                          <div className="text-[10px] text-[#8C7769]">
                            {cityItem.constituency}, {cityItem.state}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeCfg.badgeClass}`}>
                          {badgeCfg.label}
                        </span>
                      </div>

                      {/* Risk Score Highlight */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF7F2] border border-[#D8CBB6]">
                        <div>
                          <span className="text-[9px] uppercase font-mono text-[#8C7769] block font-bold">
                            Risk Engine Score
                          </span>
                          <span className="text-lg font-black font-mono text-[#44312A]">
                            {cityItem.risk_score} / 100
                          </span>
                        </div>
                        <div className="text-right text-[10px] text-[#504F47]">
                          <span className="block font-bold">Composite Evaluation</span>
                          <span className="text-[9px] text-[#8C7769]">Multi-Signal Ensembled</span>
                        </div>
                      </div>

                      {/* Available Real Metrics Grid (Zero fabrication of missing values) */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-[#FAF7F2] p-2 rounded-xl border border-[#D8CBB6]">
                        {cityItem.projects_count !== null && cityItem.projects_count !== undefined && (
                          <div>
                            <span className="text-[#8C7769] block text-[9px] uppercase font-semibold">
                              Tracked Projects
                            </span>
                            <strong className="text-[#44312A] font-mono">
                              {cityItem.projects_count}
                            </strong>
                          </div>
                        )}

                        {cityItem.utilization_percentage !== null && cityItem.utilization_percentage !== undefined && (
                          <div>
                            <span className="text-[#8C7769] block text-[9px] uppercase font-semibold">
                              Utilization Rate
                            </span>
                            <strong className="text-[#44312A] font-mono">
                              {cityItem.utilization_percentage}%
                            </strong>
                          </div>
                        )}

                        {cityItem.total_spend !== null && cityItem.total_spend !== undefined && (
                          <div>
                            <span className="text-[#8C7769] block text-[9px] uppercase font-semibold">
                              Project Spend
                            </span>
                            <strong className="text-[#44312A] font-mono text-[10px]">
                              {formatCroresLakhs(cityItem.total_spend).compact}
                            </strong>
                          </div>
                        )}

                        {cityItem.allocated_amount !== null && cityItem.allocated_amount !== undefined && (
                          <div>
                            <span className="text-[#8C7769] block text-[9px] uppercase font-semibold">
                              MP Allocation
                            </span>
                            <strong className="text-[#44312A] font-mono text-[10px]">
                              {formatCroresLakhs(cityItem.allocated_amount).compact}
                            </strong>
                          </div>
                        )}

                        {cityItem.total_expenditure !== null && cityItem.total_expenditure !== undefined && !cityItem.total_spend && (
                          <div className="col-span-2">
                            <span className="text-[#8C7769] block text-[9px] uppercase font-semibold">
                              Reported Expenditure
                            </span>
                            <strong className="text-[#44312A] font-mono text-[10px]">
                              {formatCroresLakhs(cityItem.total_expenditure).compact}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* MP Details if available */}
                      {cityItem.mp_name && (
                        <div className="text-[10px] text-[#504F47] px-1">
                          <span className="text-[#8C7769]">Member of Parliament: </span>
                          <strong className="text-[#44312A]">{cityItem.mp_name}</strong>
                        </div>
                      )}

                      {/* Contributing Signals if available */}
                      {cityItem.signals && cityItem.signals.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-mono text-[#8C7769] font-bold block">
                            Active Audit Signals:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {cityItem.signals.map((sig, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-[#FAF7F2] border border-[#D8CBB6] text-[9px] text-[#6B5145] font-medium"
                              >
                                {sig}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Button for Slide-Over Drawer */}
                      <button
                        onClick={() => setActiveCityForDrawer(cityItem)}
                        className="w-full py-2 px-3 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Sparkles className="h-3 w-3 text-[#E7DDCA]" />
                        <span>Inspect City Dossier</span>
                        <ChevronRight className="h-3 w-3 text-[#E7DDCA]" />
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </LeafletMap>
        </div>

        {/* Slide-Over Drawer Panel for Detailed City Intelligence */}
        {activeCityForDrawer && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-[420px] bg-white border-l border-[#D8CBB6] shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#D8CBB6] bg-[#FAF7F2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#44312A] bg-[#E7DDCA] px-2 py-0.5 rounded border border-[#D8CBB6]">
                  {activeCityForDrawer.city.toUpperCase()}
                </span>
                <Badge variant="outline" size="sm">
                  {activeCityForDrawer.state}
                </Badge>
              </div>
              <button
                onClick={() => setActiveCityForDrawer(null)}
                className="p-1.5 rounded-xl bg-white border border-[#D8CBB6] text-[#504F47] hover:text-[#44312A] transition cursor-pointer shadow-xs"
                title="Close dossier"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-[#504F47]">
              {/* City Title & Risk Score Callout */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[#8C7769] text-xs">
                  <MapPin className="h-3.5 w-3.5 text-[#44312A]" />
                  <span>Constituency: {activeCityForDrawer.constituency}</span>
                </div>
                <h3 className="text-base font-bold text-[#44312A] leading-snug">
                  {activeCityForDrawer.city} Parliamentary Risk Dossier
                </h3>

                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                      Composite Risk Score
                    </span>
                    <span className="text-2xl font-black font-mono text-[#44312A]">
                      {activeCityForDrawer.risk_score} / 100
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#504F47] uppercase font-mono block font-bold">
                      Classification
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md border inline-block mt-0.5 ${
                        getRiskCategoryConfig(
                          activeCityForDrawer.risk_category,
                          activeCityForDrawer.risk_score
                        ).badgeClass
                      }`}
                    >
                      {activeCityForDrawer.risk_category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signals Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47] flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#44312A]" />
                    <span>Active Audit Indicators</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#8C7769]">Risk Engine Signals</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F4EFE6] border border-[#D8CBB6] space-y-2.5 text-[#44312A] leading-relaxed">
                  <div className="font-bold text-[#44312A] text-xs">
                    {activeCityForDrawer.risk_score >= 60
                      ? 'Elevated Variance / Outlier Detected in Peer Analysis'
                      : 'Operational Patterns Within Expected Cohort Distribution'}
                  </div>
                  {activeCityForDrawer.signals && activeCityForDrawer.signals.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside text-[11px] text-[#504F47]">
                      {activeCityForDrawer.signals.map((sig, idx) => (
                        <li key={idx} className="font-medium text-[#44312A]">
                          {sig}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-[#504F47]">
                      No anomalous flags triggered. Projects and financial distributions match regional baselines.
                    </p>
                  )}
                  <p className="text-[10px] text-[#8C7769] pt-1.5 border-t border-[#D8CBB6] italic">
                    {RISK_DISCLAIMER}
                  </p>
                </div>
              </div>

              {/* Administrative & Financial Breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#504F47]">
                  Administrative & Financial Scope
                </span>
                <div className="space-y-2 p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]">
                  {activeCityForDrawer.mp_name && (
                    <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                      <span>Member of Parliament:</span>
                      <strong className="text-[#44312A]">{activeCityForDrawer.mp_name}</strong>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                    <span>State & Territory:</span>
                    <span className="text-[#44312A] font-medium">{activeCityForDrawer.state}</span>
                  </div>
                  {activeCityForDrawer.projects_count !== null && (
                    <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                      <span>Documented Works:</span>
                      <strong className="text-[#44312A] font-mono">{activeCityForDrawer.projects_count}</strong>
                    </div>
                  )}
                  {activeCityForDrawer.allocated_amount !== null && (
                    <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                      <span>MP Allocation:</span>
                      <span className="text-[#44312A] font-mono font-bold">
                        {formatCroresLakhs(activeCityForDrawer.allocated_amount).exact}
                      </span>
                    </div>
                  )}
                  {activeCityForDrawer.total_expenditure !== null && (
                    <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                      <span>Total Expenditure:</span>
                      <span className="text-[#44312A] font-mono font-bold">
                        {formatCroresLakhs(activeCityForDrawer.total_expenditure).exact}
                      </span>
                    </div>
                  )}
                  {activeCityForDrawer.utilization_percentage !== null && (
                    <div className="flex justify-between py-1 border-b border-[#D8CBB6]">
                      <span>Fund Utilization:</span>
                      <span className="text-[#44312A] font-mono font-bold">
                        {activeCityForDrawer.utilization_percentage}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span>GPS Coordinates:</span>
                    <span className="text-[#44312A] font-mono text-[11px]">
                      {activeCityForDrawer.latitude?.toFixed(4)}, {activeCityForDrawer.longitude?.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Navigation to Works List */}
              <div className="pt-2">
                <Link
                  to={`/works?constituency=${encodeURIComponent(activeCityForDrawer.constituency)}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#44312A]/20"
                >
                  <span>Explore Projects in {activeCityForDrawer.city}</span>
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
