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
      <div className="h-64 w-full rounded-2xl bg-[#FAF7F2] border border-[#EAE3D8] flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="h-8 w-8 text-[#8C7A70] mb-2" />
        <p className="text-xs font-bold text-[#231815]">
          Geographic Coordinates Not Specified in Official Feed
        </p>
        <p className="text-[11px] text-[#7A685D] max-w-sm mt-1">
          {locationName ? `Reported Location: "${locationName}"` : 'GPS coordinates pending field audit verification.'}
        </p>
      </div>
    );
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  const position = [lat, lng];

  return (
    <div className="h-72 w-full rounded-2xl overflow-hidden border border-[#EAE3D8] relative z-10 shadow-xs">
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
            <div className="text-[#231815] text-xs p-1 space-y-1">
              <strong className="font-bold block text-[#231815]">{title}</strong>
              {locationName && <div className="text-[#6E5A4E] text-[11px]">{locationName}</div>}
              <div className="text-[10px] text-[#8B5A2B] font-mono mt-1 font-semibold">
                GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
