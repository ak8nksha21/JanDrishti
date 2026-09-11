import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

// Self-contained custom marker icon using JanDrishti Cream #E7DDCA & Dark Brown #44312A
const customLocationIcon = L.divIcon({
  className: 'custom-leaflet-location-pin',
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background-color: rgba(68, 49, 42, 0.25); animation: pulse 2s infinite;"></div>
      <div style="width: 16px; height: 16px; border-radius: 50%; background-color: #44312A; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 8px rgba(68,49,42,0.4);"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

export default function WorkLocationMap({
  latitude,
  longitude,
  title = 'Work Location',
  locationName = '',
  cost = null,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const isValidGeo =
    latitude !== null &&
    longitude !== null &&
    latitude !== undefined &&
    longitude !== undefined &&
    latitude !== '' &&
    longitude !== '' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0);

  if (!isValidGeo) {
    return (
      <div className="h-64 w-full rounded-3xl bg-[#FAF7F2] border border-[#D8CBB6] flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="h-8 w-8 text-[#504F47] mb-2" />
        <p className="text-xs font-bold text-[#44312A]">
          Geographic Coordinates Not Specified in Official Feed
        </p>
        <p className="text-[11px] text-[#504F47] max-w-sm mt-1">
          {locationName ? `Reported Location: "${locationName}"` : 'GPS coordinates pending field audit verification.'}
        </p>
      </div>
    );
  }

  const position = [lat, lng];

  return (
    <div className="h-72 w-full rounded-3xl overflow-hidden border border-[#D8CBB6] relative z-10 shadow-xs">
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={customLocationIcon}>
          <Popup className="custom-jandrishti-popup">
            <div className="text-[#44312A] text-xs p-1 space-y-1">
              <strong className="font-bold block text-[#44312A]">{title}</strong>
              {locationName && <div className="text-[#504F47] text-[11px]">{locationName}</div>}
              <div className="text-[10px] text-[#44312A] font-mono mt-1 font-bold">
                GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

