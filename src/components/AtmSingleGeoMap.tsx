import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ATMRecord } from '../data/atmData';
import { getAtmGeoPosition, AtmGeoPosition } from '../utils/atmCoordinates';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Layers,
  Copy,
  Check,
  Maximize2,
  Compass,
  Eye,
  EyeOff,
  Crosshair,
  Satellite
} from 'lucide-react';

interface AtmSingleGeoMapProps {
  atm: ATMRecord;
  nearbyAtms?: ATMRecord[];
  onNavigateToFullGis?: (corridorCode: string, atmId: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}

export type SingleMapLayer = 'street' | 'satellite' | 'dark';

export const AtmSingleGeoMap: React.FC<AtmSingleGeoMapProps> = ({
  atm,
  nearbyAtms = [],
  onNavigateToFullGis,
  className = '',
  defaultExpanded = true,
}) => {
  const [isMapVisible, setIsMapVisible] = useState(defaultExpanded);
  const [mapLayer, setMapLayer] = useState<SingleMapLayer>('street');
  const [copiedGps, setCopiedGps] = useState(false);
  const [showNearby, setShowNearby] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileGroupRef = useRef<L.LayerGroup | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const geo: AtmGeoPosition = getAtmGeoPosition(atm);

  // Initialize and update Leaflet map
  useEffect(() => {
    if (!isMapVisible || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [geo.lat, geo.lng],
      zoom: 15,
      minZoom: 5,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;
    tileGroupRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Initial tile layer setup
    updateTileLayer(map, mapLayer);

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    const container = mapContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      tileGroupRef.current = null;
      markersGroupRef.current = null;
    };
  }, [isMapVisible, geo.lat, geo.lng, atm.ATMID]);

  // Function to switch tile layer safely without API keys
  const updateTileLayer = (_map: L.Map, style: SingleMapLayer) => {
    const tileGroup = tileGroupRef.current;
    if (!tileGroup) return;

    tileGroup.clearLayers();

    if (style === 'satellite') {
      // 100% Free Public Esri World Imagery + Location Labels (No API key needed)
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        }
      );
      const labelLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          pane: 'overlayPane',
          opacity: 0.95,
        }
      );
      satLayer.addTo(tileGroup);
      labelLayer.addTo(tileGroup);
    } else if (style === 'dark') {
      // Professional Esri Dark Gray Canvas + High-Contrast Reference Labels
      // Zero API key needed, crystal-clear road geometry and crisp white text labels!
      const darkBase = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 16,
          maxZoom: 19,
          attribution: '&copy; Esri, HERE, Garmin',
        }
      );
      const darkLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 16,
          maxZoom: 19,
          pane: 'overlayPane',
          opacity: 0.95,
        }
      );
      darkBase.addTo(tileGroup);
      darkLabels.addTo(tileGroup);
    } else {
      // Street Mode: High-precision Esri World Street Map with crisp street geometry, neighborhood names, and highway badges
      // Zero API key needed, no rate-limiting or blocking
      const streetLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap',
        }
      );
      streetLayer.addTo(tileGroup);
    }
  };

  // Update tile layer on mapLayer change
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateTileLayer(mapInstanceRef.current, mapLayer);
    }
  }, [mapLayer]);

  // Render Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // Determine status badge color
    const isCritical = atm.Status === 'Refill Now';
    const isUrgent = atm.Status === 'Refill Soon';
    const primaryPinColor = isCritical ? '#e11d48' : isUrgent ? '#d97706' : '#2563eb';

    // Main Terminal Marker styled exactly like user's screenshot
    const customHtml = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
        <!-- Pulsing radar wave behind marker -->
        <div style="
          position: absolute;
          top: -2px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: ${primaryPinColor};
          opacity: 0.35;
          animation: pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>

        <!-- Custom Teardrop Pin Marker -->
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
          background: ${primaryPinColor};
          border: 2px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Terminal Number Inside Pin -->
          <span style="
            transform: rotate(45deg);
            color: #ffffff;
            font-weight: 800;
            font-size: 11px;
            font-family: 'IBM Plex Mono', monospace;
            letter-spacing: -0.5px;
          ">
            ${geo.terminalIndex}
          </span>
        </div>
      </div>
      <style>
        @keyframes pulseRing {
          0% { transform: scale(0.85); opacity: 0.7; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      </style>
    `;

    const icon = L.divIcon({
      className: 'custom-single-marker',
      html: customHtml,
      iconSize: [36, 44],
      iconAnchor: [18, 36],
      popupAnchor: [0, -32],
    });

    const marker = L.marker([geo.lat, geo.lng], { icon });

    marker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 200px; padding: 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #0f172a;">${atm.ATMID}</strong>
          <span style="
            font-size: 10px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 9999px;
            background: ${isCritical ? '#ffe4e6' : isUrgent ? '#fef3c7' : '#dbeafe'};
            color: ${primaryPinColor};
          ">${atm.Status}</span>
        </div>
        <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
          ${geo.road}, ${geo.area}
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; font-size: 11px; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Vault Cash:</span>
            <strong style="color: #0f172a;">৳${Math.round(atm.Estimated_Cash_Remaining).toLocaleString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Runway:</span>
            <strong style="color: ${isCritical ? '#e11d48' : '#0f172a'};">${Number(atm.Days_of_Cash).toFixed(1)} days</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Daily Demand:</span>
            <strong style="color: #2563eb;">৳${Math.round(atm.Predicted_Demand).toLocaleString()}</strong>
          </div>
        </div>
      </div>
    `);

    marker.addTo(markersGroup);

    // Optionally render nearby sister ATMs in the same corridor
    if (showNearby && nearbyAtms.length > 0) {
      nearbyAtms.forEach((sister) => {
        if (sister.ATMID === atm.ATMID) return;
        const sisterGeo = getAtmGeoPosition(sister);
        const sisterCritical = sister.Status === 'Refill Now';
        const sisterColor = sisterCritical ? '#ef4444' : '#64748b';

        const sisterHtml = `
          <div style="
            background: ${sisterColor};
            color: #ffffff;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border-radius: 50%;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 800;
            font-family: 'IBM Plex Mono', monospace;
            cursor: pointer;
          ">
            ${sisterGeo.terminalIndex}
          </div>
        `;

        const sisterIcon = L.divIcon({
          className: 'sister-geo-marker',
          html: sisterHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const sisterMarker = L.marker([sisterGeo.lat, sisterGeo.lng], { icon: sisterIcon });
        sisterMarker.bindPopup(`
          <div style="font-size: 11px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <strong style="font-family: 'IBM Plex Mono', monospace;">${sister.ATMID}</strong>
            <span style="margin-left: 6px; font-size: 10px; color: ${sisterColor}; font-weight: 700;">${sister.Status}</span>
            <div style="color: #64748b; font-size: 10px; margin-top: 2px;">৳${Math.round(sister.Estimated_Cash_Remaining).toLocaleString()} remaining</div>
          </div>
        `);
        sisterMarker.addTo(markersGroup);
      });
    }
  }, [atm, geo, showNearby, nearbyAtms]);

  const handleCopyGps = () => {
    navigator.clipboard.writeText(geo.formattedGps);
    setCopiedGps(true);
    setTimeout(() => setCopiedGps(false), 2000);
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([geo.lat, geo.lng], 15, { duration: 0.8 });
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header Bar with Show/Hide toggle button */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 font-semibold truncate">
          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="truncate">{geo.road}, {geo.city}</span>
        </div>
        <button
          onClick={() => setIsMapVisible((prev) => !prev)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shrink-0"
        >
          {isMapVisible ? (
            <>
              <EyeOff className="w-3 h-3" />
              <span>Hide Map</span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              <span>Show Map</span>
            </>
          )}
        </button>
      </div>

      {/* Embedded Map Visual Canvas */}
      {isMapVisible && (
        <div className={`relative rounded-xl overflow-hidden border border-slate-300 shadow-sm ${mapLayer === 'dark' ? 'bg-slate-950 dark-map-mode' : 'bg-slate-100'}`}>
          {/* Top Floating Badge & Layer Switcher */}
          <div className="absolute top-2.5 left-2.5 right-2.5 z-[400] flex items-center justify-between pointer-events-none">
            {/* Location Title Pill */}
            <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md text-white px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-medium flex items-center gap-1.5 shadow-md max-w-[70%] truncate">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="font-semibold truncate">{geo.road.split(',')[0]}</span>
              <span className="text-[10px] text-slate-400 font-mono">({geo.corridorCode})</span>
            </div>

            {/* Layer Toggles (Street / Satellite / Dark) */}
            <div className="pointer-events-auto flex items-center bg-slate-950/85 backdrop-blur-md rounded-lg p-0.5 border border-slate-800 shadow-md">
              <button
                onClick={() => setMapLayer('street')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  mapLayer === 'street'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Street
              </button>
              <button
                onClick={() => setMapLayer('satellite')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  mapLayer === 'satellite'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Satellite
              </button>
              <button
                onClick={() => setMapLayer('dark')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  mapLayer === 'dark'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Map Viewport Element */}
          <div ref={mapContainerRef} className="w-full h-[180px] z-10" />

          {/* Recenter Button Overlay */}
          <button
            onClick={handleRecenter}
            className="absolute right-2.5 bottom-11 z-[400] p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700 shadow-md transition-all cursor-pointer"
            title="Recenter Map on ATM"
          >
            <Crosshair className="w-3.5 h-3.5 text-blue-400" />
          </button>

          {/* Bottom GPS Bar & Navigation Links */}
          <div className="bg-slate-950 text-white px-3 py-2 flex items-center justify-between text-[11px] border-t border-slate-800">
            <div className="flex items-center gap-1.5 font-mono text-slate-300">
              <span className="text-slate-500 font-semibold text-[10px]">GPS:</span>
              <span className="font-bold text-slate-100">{geo.formattedGps}</span>
              <button
                onClick={handleCopyGps}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copy GPS coordinates"
              >
                {copiedGps ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* External Navigation Link (Google Maps / GPS) */}
              <a
                href={geo.navUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-medium hover:underline transition-colors cursor-pointer"
                title="Open live turn-by-turn navigation in Google Maps"
              >
                <span>Navigate</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              {/* Full GIS tab navigator */}
              {onNavigateToFullGis && (
                <button
                  onClick={() => onNavigateToFullGis(geo.corridorCode, atm.ATMID)}
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold transition-colors cursor-pointer"
                  title="View this terminal on the National Geospatial GIS Map"
                >
                  <span>Full GIS</span>
                  <Navigation className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
