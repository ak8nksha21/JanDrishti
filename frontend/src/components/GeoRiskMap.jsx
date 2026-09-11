import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as MapTooltip } from 'react-leaflet';
import { MapPin, Sparkles, AlertTriangle, Info } from 'lucide-react';

export default function GeoRiskMap({ works, onInvestigate }) {
  const geoWorks = works.filter(w => w.latitude !== null && w.longitude !== null && !isNaN(w.latitude) && !isNaN(w.longitude));
  const missingGeoWorks = works.filter(w => w.latitude === null || w.longitude === null);

  const getMarkerColor = (level) => {
    switch (level) {
      case 'Critical': return '#8A2616';
      case 'High': return '#9C4E15';
      case 'Medium': return '#D4A373';
      default: return '#3E5C38';
    }
  };

  // Center of India
  const defaultCenter = [22.9734, 78.6569];

  return (
    <div className="space-y-4">
      {/* Missing Data Policy Alert */}
      <div className="bg-[#FAF7F2] border border-[#EAE3D8] text-[#5C4A3E] p-3 rounded-xl text-xs flex items-start space-x-2">
        <Info className="w-4 h-4 text-[#8B5A2B] mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-[#231815]">Geographic Data Transparency: </span>
          <span>
            {geoWorks.length} works with verified GPS coordinates are rendered below. Works without coordinates are <strong>never</strong> fabricated with fake locations; they are flagged solely for documentation verification.
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#EAE3D8] shadow-xs overflow-hidden p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-[#231815] text-sm flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-[#8B5A2B]" />
              <span>Spatial Risk & Proximity Clustering Map</span>
            </h3>
            <p className="text-xs text-[#7A685D]">
              Interactive OpenStreetMap view. Terracotta/Rust rings represent works with elevated proximity or cost risk.
            </p>
          </div>

          {/* Map Legend */}
          <div className="flex items-center space-x-3 text-xs bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#EAE3D8]">
            <span className="font-medium text-[#7A685D]">Risk Severity:</span>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8A2616]" />
              <span className="text-[#5C4A3E]">Critical</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9C4E15]" />
              <span className="text-[#5C4A3E]">High</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4A373]" />
              <span className="text-[#5C4A3E]">Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3E5C38]" />
              <span className="text-[#5C4A3E]">Low</span>
            </div>
          </div>
        </div>

        <div className="h-[550px] w-full rounded-lg border border-[#EAE3D8] overflow-hidden relative">
          <MapContainer
            center={defaultCenter}
            zoom={5}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geoWorks.map((w) => {
              const color = getMarkerColor(w.risk_level);
              return (
                <CircleMarker
                  key={w.work_id}
                  center={[w.latitude, w.longitude]}
                  radius={w.risk_level === 'Critical' ? 12 : w.risk_level === 'High' ? 10 : 7}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.7,
                    weight: 2,
                  }}
                >
                  <MapTooltip direction="top" offset={[0, -10]} opacity={0.9}>
                    <div className="font-bold text-xs font-mono">{w.work_id}</div>
                    <div className="text-[11px]">{w.description.substring(0, 45)}...</div>
                    <div className="text-[10px] text-[#7A685D]">Risk: {w.overall_score} ({w.risk_level})</div>
                  </MapTooltip>
                  <Popup>
                    <div className="p-1 space-y-2 max-w-xs text-xs">
                      <div className="flex items-center justify-between border-b border-[#EAE3D8] pb-1">
                        <span className="font-mono font-bold text-[#8B5A2B]">{w.work_id}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: color }}>
                          {w.risk_level} ({w.overall_score})
                        </span>
                      </div>
                      <p className="font-medium text-[#231815] leading-snug">{w.description}</p>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-[#5C4A3E] bg-[#FAF7F2] p-2 rounded border border-[#EAE3D8]">
                        <div><strong>Category:</strong> {w.category}</div>
                        <div><strong>Cost:</strong> ₹{w.cost} Lakhs</div>
                        <div><strong>Constituency:</strong> {w.constituency}</div>
                        <div><strong>MP:</strong> {w.mp_name}</div>
                      </div>
                      {w.flags && w.flags.length > 0 && (
                        <div className="text-[10px] text-[#8A2616] font-medium">
                          Alerts: {w.flags.join(', ')}
                        </div>
                      )}
                      <button
                        onClick={() => onInvestigate(w.work_id)}
                        className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-[#3E2723] hover:bg-[#2A1A17] text-white rounded font-medium text-xs shadow-xs transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        <span>Run AI Investigation</span>
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
