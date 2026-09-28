import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink, Layers, LocateFixed } from 'lucide-react';

interface InteractiveMapProps {
  latitude: number;
  longitude: number;
  onLocationChange?: (lat: number, lng: number, addressHint?: string) => void;
  interactive?: boolean;
  height?: string;
  zoom?: number;
  markerTitle?: string;
  nearbyMarkers?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    title: string;
    severity?: string;
  }>;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  latitude,
  longitude,
  onLocationChange,
  interactive = true,
  height = '280px',
  zoom = 15,
  markerTitle = 'Grievance Pin',
  nearbyMarkers = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mainMarkerRef = useRef<L.Marker | null>(null);
  const nearbyLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [currentCoords, setCurrentCoords] = useState({ lat: latitude, lng: longitude });
  const [isLocating, setIsLocating] = useState(false);

  // SVG Pin Icons
  const primaryIcon = L.divIcon({
    className: 'custom-civic-pin',
    html: `
      <div style="
        background-color: #1F4D3A;
        border: 2px solid #FFFFFF;
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background-color: #FFFFFF;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const nearbyIcon = L.divIcon({
    className: 'nearby-civic-pin',
    html: `
      <div style="
        background-color: #B8862E;
        border: 1.5px solid #FFFFFF;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; background-color: #FFFFFF; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Default OpenStreetMap tile layer
      const tileUrl =
        mapType === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
      }).addTo(map);

      // Add Zoom control at top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Main draggable marker
      const marker = L.marker([latitude, longitude], {
        icon: primaryIcon,
        draggable: interactive,
      }).addTo(map);

      if (interactive) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setCurrentCoords({ lat: pos.lat, lng: pos.lng });
          onLocationChange?.(pos.lat, pos.lng);
        });

        // Click on map moves marker
        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          setCurrentCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          onLocationChange?.(e.latlng.lat, e.latlng.lng);
        });
      }

      mainMarkerRef.current = marker;
      mapInstanceRef.current = map;
      nearbyLayerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center when props change
  useEffect(() => {
    if (mapInstanceRef.current && mainMarkerRef.current) {
      mainMarkerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.setView([latitude, longitude], zoom);
      setCurrentCoords({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude, zoom]);

  // Update nearby markers
  useEffect(() => {
    if (nearbyLayerGroupRef.current) {
      nearbyLayerGroupRef.current.clearLayers();
      nearbyMarkers.forEach((m) => {
        const marker = L.marker([m.latitude, m.longitude], { icon: nearbyIcon });
        marker.bindPopup(`<strong>#${m.id}</strong><br/>${m.title}`);
        nearbyLayerGroupRef.current?.addLayer(marker);
      });
    }
  }, [nearbyMarkers]);

  // Handle GPS Locate Me
  const handleLocateMe = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          if (mapInstanceRef.current && mainMarkerRef.current) {
            mainMarkerRef.current.setLatLng([lat, lng]);
            mapInstanceRef.current.setView([lat, lng], 16);
            setCurrentCoords({ lat, lng });
            onLocationChange?.(lat, lng, 'Current GPS Position');
          }
          setIsLocating(false);
        },
        () => setIsLocating(false),
        { timeout: 8000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}`;

  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--line)] shadow-xs">
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      {/* Floating Map Controls & Google Maps Link */}
      <div className="absolute top-2 left-2 z-[400] flex items-center gap-1.5 bg-[var(--card)]/90 backdrop-blur-xs p-1 rounded-lg border border-[var(--line)] shadow-xs text-xs">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg)] hover:bg-[var(--line)] text-[var(--ink)] cursor-pointer font-medium"
          title="Detect my current GPS location"
        >
          <LocateFixed className="w-3.5 h-3.5 text-[var(--green)]" />
          <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'My Location'}</span>
        </button>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg)] hover:bg-[var(--line)] text-[var(--ink)] font-medium cursor-pointer"
          title="Open this location in Google Maps"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Google Maps</span>
        </a>
      </div>

      {/* Coordinate & Pin Information Bar */}
      <div className="bg-[var(--bg2)] px-3 py-1.5 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--ink-soft)] font-mono">
        <span className="flex items-center gap-1 text-[var(--ink)]">
          <MapPin className="w-3 h-3 text-[var(--green)]" />
          {currentCoords.lat.toFixed(5)}° N, {currentCoords.lng.toFixed(5)}° E
        </span>
        {interactive && (
          <span className="text-[10px] text-[var(--ink-soft)]">
            Click map or drag pin to position defect
          </span>
        )}
      </div>
    </div>
  );
};
