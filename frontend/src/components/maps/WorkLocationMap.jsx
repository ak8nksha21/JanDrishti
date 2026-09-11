import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

// Custom marker icon for Leaflet
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function WorkLocationMap({
  latitude,
  longitude,
  title = 'Work Location',
  locationName = '',
  cost = null,
}) {
  if (!latitude || !longitude || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
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

  const lat = Number(latitude);
  const lng = Number(longitude);
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
        <Marker position={position} icon={customIcon}>
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

