import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as MapTooltip } from 'react-leaflet';
import { MapPin, Sparkles, AlertTriangle, Info } from 'lucide-react';

export default function GeoRiskMap({ works, onInvestigate }) {
  const geoWorks = works.filter(w => w.latitude !== null && w.longitude !== null && !isNaN(w.latitude) && !isNaN(w.longitude));
  const missingGeoWorks = works.filter(w => w.latitude === null || w.longitude === null);

  const getMarkerColor = (level) => {
    switch (level) {
      case 'Critical': return '#44312A';
      case 'High': return '#6B5145';
      case 'Medium': return '#8C7769';
      default: return '#504F47';
    }
  };

  // Center of India
  const defaultCenter = [22.9734, 78.6569];

  return (
    <div className="space-y-4">
      {/* Missing Data Policy Alert */}
      <div className="bg-[#FAF7F2] border border-[#D8CBB6] text-[#504F47] p-3 rounded-2xl text-xs flex items-start space-x-2">
        <Info className="w-4 h-4 text-[#44312A] mt-0.5 shrink-0" />
        <div>
          <span className="font-bold text-[#44312A]">Geographic Data Transparency: </span>
          <span>
            {geoWorks.length} works with verified GPS coordinates are rendered below. Works without coordinates are <strong>never</strong> fabricated with fake locations; they are flagged solely for documentation verification.
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#D8CBB6] shadow-xs overflow-hidden p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <div>
            <h3 className="font-bold text-[#44312A] text-sm flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-[#44312A]" />
              <span>Spatial Risk & Proximity Clustering Map</span>
            </h3>
            <p className="text-xs text-[#504F47]">
              Interactive OpenStreetMap view. Dark cocoa and taupe rings represent works with elevated proximity or cost risk.
            </p>
          </div>

          {/* Map Legend */}
          <div className="flex items-center space-x-3 text-xs bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#D8CBB6]">
            <span className="font-bold text-[#504F47]">Risk Band:</span>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#44312A]" />
              <span className="text-[#504F47]">Critical</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6B5145]" />
              <span className="text-[#504F47]">High</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8C7769]" />
              <span className="text-[#504F47]">Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#504F47]" />
              <span className="text-[#504F47]">Low</span>
            </div>
          </div>
        </div>

        <div className="h-[550px] w-full rounded-xl border border-[#D8CBB6] overflow-hidden relative">
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
                    <div className="text-[10px] text-[#504F47]">Risk: {w.overall_score} ({w.risk_level})</div>
                  </MapTooltip>
                  <Popup>
                    <div className="p-1 space-y-2 max-w-xs text-xs">
                      <div className="flex items-center justify-between border-b border-[#D8CBB6] pb-1">
                        <span className="font-mono font-bold text-[#44312A]">{w.work_id}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#E7DDCA]" style={{ backgroundColor: color }}>
                          {w.risk_level} ({w.overall_score})
                        </span>
                      </div>
                      <p className="font-semibold text-[#44312A] leading-snug">{w.description}</p>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-[#504F47] bg-[#FAF7F2] p-2 rounded-xl border border-[#D8CBB6]">
                        <div><strong>Category:</strong> {w.category}</div>
                        <div><strong>Cost:</strong> ₹{w.cost} Lakhs</div>
                        <div><strong>Constituency:</strong> {w.constituency}</div>
                        <div><strong>MP:</strong> {w.mp_name}</div>
                      </div>
                      {w.flags && w.flags.length > 0 && (
                        <div className="text-[10px] text-[#6B5145] font-bold">
                          Alerts: {w.flags.join(', ')}
                        </div>
                      )}
                      <button
                        onClick={() => onInvestigate(w.work_id)}
                        className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-[#44312A] hover:bg-[#34241E] text-[#E7DDCA] rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#E7DDCA]" />
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
