import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RegionalCluster } from '../types/operations';
import { MapPin, Navigation, Compass, Layers, ShieldCheck, Zap } from 'lucide-react';

interface RegionalGeoMapProps {
  clusters: RegionalCluster[];
  selectedClusterId: string;
  onSelectCluster: (clusterId: string) => void;
}

// Real geographic coordinates for the 12 banking corridors across Bangladesh
export const CORRIDOR_GEO_COORDS: Record<
  string,
  { lat: number; lng: number; name: string; highway: string; roadKmFromDhaka: number }
> = {
  DHA_CORE: {
    lat: 23.7289,
    lng: 90.4175,
    name: 'Dhaka Motijheel Banking Core',
    highway: 'National Banking Hub',
    roadKmFromDhaka: 0,
  },
  DHA_NORTH: {
    lat: 23.7925,
    lng: 90.4078,
    name: 'Dhaka North (Gulshan/Uttara)',
    highway: 'Dhaka Arterial Ring',
    roadKmFromDhaka: 12,
  },
  DHA_DIPLO: {
    lat: 23.7937,
    lng: 90.4253,
    name: 'Dhaka Diplomatic (Baridhara)',
    highway: 'Pragoti Sarani',
    roadKmFromDhaka: 14,
  },
  DHA_WEST: {
    lat: 23.7538,
    lng: 90.3667,
    name: 'Dhaka West (Dhanmondi/Mirpur)',
    highway: 'Mirpur Road Corridor',
    roadKmFromDhaka: 9,
  },
  CTG_PORT: {
    lat: 22.3384,
    lng: 91.8317,
    name: 'Chittagong Port & Agrabad Commercial',
    highway: 'N1 Highway',
    roadKmFromDhaka: 242,
  },
  COX_COAST: {
    lat: 21.4272,
    lng: 92.0058,
    name: "Cox's Bazar Coastal Resort Hub",
    highway: 'N1 Extension',
    roadKmFromDhaka: 396,
  },
  SYL_VALLEY: {
    lat: 24.8949,
    lng: 91.8687,
    name: 'Sylhet Valley & Tea Belt',
    highway: 'N2 Highway',
    roadKmFromDhaka: 240,
  },
  RAJ_BOGRA: {
    lat: 24.3745,
    lng: 88.6042,
    name: 'Rajshahi & Bogra Agro-Industrial Hub',
    highway: 'N5 Highway / Jamuna Bridge',
    roadKmFromDhaka: 256,
  },
  KHU_JESSORE: {
    lat: 22.8456,
    lng: 89.5403,
    name: 'Khulna & Jessore Industrial Port',
    highway: 'N7 Highway',
    roadKmFromDhaka: 228,
  },
  BAR_PADMA: {
    lat: 22.701,
    lng: 90.3535,
    name: 'Barisal Riverine Hub',
    highway: 'N8 Padma Bridge Expressway',
    roadKmFromDhaka: 180,
  },
  MYM_TANGAIL: {
    lat: 24.7471,
    lng: 90.4203,
    name: 'Mymensingh & Tangail Agro Belt',
    highway: 'N3 Highway',
    roadKmFromDhaka: 122,
  },
  COM_FENI: {
    lat: 23.4607,
    lng: 91.1809,
    name: 'Comilla & Feni Transit Corridor',
    highway: 'N1 Highway Midpoint',
    roadKmFromDhaka: 98,
  },
};

// Highway route paths
const HIGHWAY_ROUTES: Array<{ from: string; to: string; label: string; color: string; weight: number }> = [
  { from: 'DHA_CORE', to: 'DHA_NORTH', label: 'Dhaka Arterial', color: '#3b82f6', weight: 4 },
  { from: 'DHA_CORE', to: 'DHA_WEST', label: 'Mirpur Road', color: '#3b82f6', weight: 4 },
  { from: 'DHA_NORTH', to: 'DHA_DIPLO', label: 'Gulshan Link', color: '#3b82f6', weight: 4 },
  { from: 'DHA_CORE', to: 'COM_FENI', label: 'N1 Highway', color: '#2563eb', weight: 3.5 },
  { from: 'COM_FENI', to: 'CTG_PORT', label: 'N1 Highway', color: '#2563eb', weight: 3.5 },
  { from: 'CTG_PORT', to: 'COX_COAST', label: 'N1 Marine', color: '#2563eb', weight: 3 },
  { from: 'DHA_DIPLO', to: 'SYL_VALLEY', label: 'N2 Highway', color: '#6366f1', weight: 3 },
  { from: 'COM_FENI', to: 'SYL_VALLEY', label: 'R140 Connector', color: '#94a3b8', weight: 2 },
  { from: 'DHA_NORTH', to: 'MYM_TANGAIL', label: 'N3 Highway', color: '#0ea5e9', weight: 3 },
  { from: 'DHA_NORTH', to: 'RAJ_BOGRA', label: 'N5 Northwest', color: '#64748b', weight: 3 },
  { from: 'DHA_CORE', to: 'BAR_PADMA', label: 'N8 Padma Expressway', color: '#10b981', weight: 4 },
  { from: 'BAR_PADMA', to: 'KHU_JESSORE', label: 'N7 Highway', color: '#10b981', weight: 3 },
  { from: 'KHU_JESSORE', to: 'DHA_WEST', label: 'N804 Transit', color: '#64748b', weight: 2 },
  { from: 'RAJ_BOGRA', to: 'KHU_JESSORE', label: 'West Inter-Link', color: '#94a3b8', weight: 2 },
];

export type MapTileStyle = 'street' | 'dark' | 'osm';

export const RegionalGeoMap: React.FC<RegionalGeoMapProps> = ({
  clusters,
  selectedClusterId,
  onSelectCluster,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileGroupRef = useRef<L.LayerGroup | null>(null);
  const polylinesGroupRef = useRef<L.LayerGroup | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapTileStyle, setMapTileStyle] = useState<MapTileStyle>('street');

  // Initialize Map Once on Mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [23.75, 90.35],
      zoom: 7,
      minZoom: 6,
      maxZoom: 16,
      zoomControl: true,
      attributionControl: false,
    });

    // Create persistent layer groups
    const tileGroup = L.layerGroup().addTo(map);
    const polylinesGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    tileGroupRef.current = tileGroup;
    polylinesGroupRef.current = polylinesGroup;
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Trigger invalidateSize after initial render
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    // Watch for container resizes
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
      polylinesGroupRef.current = null;
      markersGroupRef.current = null;
    };
  }, []);

  // Update Base Map Tiles when mapTileStyle changes
  useEffect(() => {
    const tileGroup = tileGroupRef.current;
    if (!tileGroup) return;

    tileGroup.clearLayers();

    if (mapTileStyle === 'dark') {
      // High-performance Dark Mode Map Layer using reliable OpenStreetMap base tiles with hardware-accelerated dark styling
      const darkLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        className: 'map-tiles-dark',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      darkLayer.addTo(tileGroup);
    } else if (mapTileStyle === 'osm') {
      // OpenStreetMap Community Tile Layer
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      osmLayer.addTo(tileGroup);
    } else {
      // High-detail Street Map Layer (Humanitarian OpenStreetMap / Street Infrastructure style)
      // Optimized for arterial highways and city street networks with automatic fallback to standard OSM
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">HOT</a>',
      });

      let errorCount = 0;
      streetLayer.on('tileerror', (e: any) => {
        errorCount++;
        // If the mirror is unreachable or blocked by proxy, automatically fallback to primary OSM server
        if (errorCount > 2 && tileGroupRef.current) {
          tileGroupRef.current.clearLayers();
          const fallbackOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abc',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          });
          fallbackOsm.addTo(tileGroupRef.current);
          return;
        }

        if (e.tile && !e.tile.dataset?.fallback) {
          if (!e.tile.dataset) e.tile.dataset = {};
          e.tile.dataset.fallback = 'true';
          const coords = e.coords;
          if (coords) {
            e.tile.src = `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
          }
        }
      });

      streetLayer.addTo(tileGroup);
    }

    // Ensure map redraws tiles cleanly when switching modes
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 50);

    return () => clearTimeout(timer);
  }, [mapTileStyle]);

  // Update Highway Polylines when mapTileStyle changes
  useEffect(() => {
    const polylinesGroup = polylinesGroupRef.current;
    if (!polylinesGroup) return;

    polylinesGroup.clearLayers();

    HIGHWAY_ROUTES.forEach((route) => {
      const fromCoord = CORRIDOR_GEO_COORDS[route.from];
      const toCoord = CORRIDOR_GEO_COORDS[route.to];
      if (fromCoord && toCoord) {
        L.polyline(
          [
            [fromCoord.lat, fromCoord.lng],
            [toCoord.lat, toCoord.lng],
          ],
          {
            color: mapTileStyle === 'dark' ? '#38bdf8' : route.color,
            weight: route.weight,
            opacity: mapTileStyle === 'dark' ? 0.75 : 0.85,
            dashArray: route.weight <= 2 ? '4, 6' : undefined,
          }
        ).addTo(polylinesGroup);
      }
    });
  }, [mapTileStyle]);

  // Update Corridor Markers when clusters or selection changes
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();

    clusters.forEach((cluster) => {
      const geo = CORRIDOR_GEO_COORDS[cluster.codePrefix];
      if (!geo) return;

      const isSelected = cluster.id === selectedClusterId;
      const statusColor =
        cluster.criticalCount >= 2
          ? '#dc2626'
          : cluster.criticalCount === 1 || cluster.urgentCount > 0
          ? '#d97706'
          : '#2563eb';

      const customHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="
            background: ${statusColor};
            color: #ffffff;
            border: ${isSelected ? '3px solid #60a5fa' : '2px solid #ffffff'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 13px;
            font-family: 'IBM Plex Mono', monospace;
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: all 0.2s ease;
          ">
            ${cluster.atmCount}
          </div>
          <div style="
            margin-top: 4px;
            background: rgba(15, 23, 42, 0.9);
            color: ${isSelected ? '#93c5fd' : '#f8fafc'};
            border: 1px solid ${isSelected ? '#3b82f6' : '#334155'};
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          ">
            ${cluster.shortName || cluster.name}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-geo-marker',
        html: customHtml,
        iconSize: [40, 56],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([geo.lat, geo.lng], { icon });

      marker.on('click', () => {
        onSelectCluster(cluster.id);
      });

      // Bind rich popup
      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
          <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${cluster.name}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            ${geo.highway} • ${geo.roadKmFromDhaka > 0 ? `${geo.roadKmFromDhaka} km from Dhaka` : 'National Hub'}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Network ATMs</span>
              <strong style="color: #0f172a; font-size: 13px;">${cluster.atmCount} Terminals</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Vault Cash Held</span>
              <strong style="color: #059669; font-size: 13px;">৳${(cluster.totalRemainingCash / 1000000).toFixed(1)}M</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Fill Level</span>
              <strong style="color: #0f172a;">${cluster.utilizationPct.toFixed(0)}%</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Replenish Needed</span>
              <strong style="color: #dc2626;">${cluster.criticalCount} Critical</strong>
            </div>
          </div>
        </div>
      `);

      marker.addTo(markersGroup);
    });
  }, [clusters, selectedClusterId, onSelectCluster]);

  const handleFocusDhaka = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([23.76, 90.41], 11, { duration: 1.2 });
    }
  };

  const handleFitNational = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([23.75, 90.35], 7, { duration: 1.2 });
    }
  };

  const activeCluster = clusters.find((c) => c.id === selectedClusterId);
  const activeGeo = activeCluster ? CORRIDOR_GEO_COORDS[activeCluster.codePrefix] : null;

  return (
    <div className="space-y-3">
      {/* Map Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Compass className="w-4 h-4 text-blue-400" />
            <span>Interactive GPS Geospatial Map</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Safe</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ml-1"></span>
            <span>Warning</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ml-1"></span>
            <span>Refill Priority</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tile Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setMapTileStyle('street')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                mapTileStyle === 'street' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Street
            </button>
            <button
              onClick={() => setMapTileStyle('dark')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                mapTileStyle === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setMapTileStyle('osm')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                mapTileStyle === 'osm' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              OSM
            </button>
          </div>

          <button
            onClick={handleFocusDhaka}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium flex items-center gap-1 transition-all"
            title="Focus Greater Dhaka metropolitan corridors"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span>Dhaka Metro</span>
          </button>

          <button
            onClick={handleFitNational}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium flex items-center gap-1 transition-all"
            title="Fit national 12-corridor network"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>National Grid</span>
          </button>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div
        className={`relative rounded-xl overflow-hidden border shadow-sm transition-colors ${
          mapTileStyle === 'dark'
            ? 'border-slate-800 bg-slate-950 dark-map-mode'
            : 'border-slate-200 bg-slate-100'
        }`}
      >
        <div ref={mapContainerRef} className="w-full h-[460px] z-10" />

        {/* Selected Corridor Live Floating Status Badge */}
        {activeCluster && activeGeo && (
          <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/90 backdrop-blur-md text-white p-3.5 rounded-xl border border-slate-700 shadow-xl max-w-sm pointer-events-auto">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                <span className="font-bold text-xs text-white truncate">{activeCluster.name}</span>
              </div>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {activeGeo.highway}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Terminals</span>
                <span className="font-bold text-white font-mono">{activeCluster.atmCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Vault Liquidity</span>
                <span className="font-bold text-emerald-400 font-mono">
                  ৳{(activeCluster.totalRemainingCash / 1000000).toFixed(1)}M
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Distance</span>
                <span className="font-bold text-slate-200 font-mono">
                  {activeGeo.roadKmFromDhaka > 0 ? `${activeGeo.roadKmFromDhaka} km` : '0 km (Core)'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
