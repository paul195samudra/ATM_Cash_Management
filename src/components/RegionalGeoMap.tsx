import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { RegionalCluster } from '../types/operations';
import { ATMRecord } from '../data/atmData';
import { getAtmGeoPosition, AtmGeoPosition } from '../utils/atmCoordinates';
import {
  Compass,
  Layers,
  Navigation,
  ShieldAlert,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  Crosshair,
  Sparkles,
  Truck,
  Building2,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Zap,
  MapPin,
  ExternalLink
} from 'lucide-react';

export interface RegionalGeoMapProps {
  clusters: RegionalCluster[];
  selectedClusterId: string;
  onSelectCluster: (clusterId: string) => void;
  atms?: ATMRecord[];
  onSelectAtm?: (atmId: string) => void;
  onAddToManifest?: (atm: ATMRecord) => void;
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
    lat: 23.8759,
    lng: 90.3961,
    name: 'Dhaka North (Uttara/Mirpur)',
    highway: 'Dhaka Arterial Ring',
    roadKmFromDhaka: 12,
  },
  DHA_DIPLO: {
    lat: 23.7937,
    lng: 90.4152,
    name: 'Dhaka Diplomatic (Gulshan/Banani)',
    highway: 'Pragoti Sarani',
    roadKmFromDhaka: 14,
  },
  DHA_WEST: {
    lat: 23.7516,
    lng: 90.3752,
    name: 'Dhaka West (Dhanmondi/Mohammadpur)',
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
    lat: 22.7010,
    lng: 90.3535,
    name: 'Barisal Riverine & Padma Transit',
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

// Strategic Inter-District Arterial Highways
const HIGHWAY_ROUTES: Array<{ from: string; to: string; label: string; color: string; weight: number }> = [
  { from: 'DHA_CORE', to: 'DHA_NORTH', label: 'Dhaka Arterial Ring', color: '#38bdf8', weight: 4 },
  { from: 'DHA_CORE', to: 'DHA_WEST', label: 'Mirpur Road Express', color: '#38bdf8', weight: 4 },
  { from: 'DHA_NORTH', to: 'DHA_DIPLO', label: 'Gulshan Link Corridor', color: '#38bdf8', weight: 4 },
  { from: 'DHA_CORE', to: 'COM_FENI', label: 'N1 Eastern Arterial', color: '#2563eb', weight: 4 },
  { from: 'COM_FENI', to: 'CTG_PORT', label: 'N1 Chittagong Highway', color: '#2563eb', weight: 4 },
  { from: 'CTG_PORT', to: 'COX_COAST', label: 'N1 Marine Highway', color: '#2563eb', weight: 3 },
  { from: 'DHA_DIPLO', to: 'SYL_VALLEY', label: 'N2 Sylhet Highway', color: '#818cf8', weight: 3.5 },
  { from: 'COM_FENI', to: 'SYL_VALLEY', label: 'R140 Regional Transit', color: '#94a3b8', weight: 2 },
  { from: 'DHA_NORTH', to: 'MYM_TANGAIL', label: 'N3 Northern Highway', color: '#0ea5e9', weight: 3.5 },
  { from: 'DHA_NORTH', to: 'RAJ_BOGRA', label: 'N5 Jamuna Bridge Arterial', color: '#f59e0b', weight: 3.5 },
  { from: 'DHA_CORE', to: 'BAR_PADMA', label: 'N8 Padma Bridge Expressway', color: '#10b981', weight: 4.5 },
  { from: 'BAR_PADMA', to: 'KHU_JESSORE', label: 'N7 Khulna Highway', color: '#10b981', weight: 3.5 },
  { from: 'KHU_JESSORE', to: 'RAJ_BOGRA', label: 'Western Inter-Link', color: '#94a3b8', weight: 2 },
];

export type MapTileStyle = 'dark' | 'satellite' | 'street';

export const RegionalGeoMap: React.FC<RegionalGeoMapProps> = ({
  clusters,
  selectedClusterId,
  onSelectCluster,
  atms = [],
  onSelectAtm,
  onAddToManifest,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileGroupRef = useRef<L.LayerGroup | null>(null);
  const polylinesGroupRef = useRef<L.LayerGroup | null>(null);
  const clusterMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const atmMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const heatRiskGroupRef = useRef<L.LayerGroup | null>(null);

  // Map Controls State
  const [mapTileStyle, setMapTileStyle] = useState<MapTileStyle>('dark');
  const [showAtmPins, setShowAtmPins] = useState<boolean>(true);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState<boolean>(false);
  const [showHighways, setShowHighways] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Refill Now' | 'Refill Soon' | 'OK'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Filtered ATMs for map display
  const filteredAtms = useMemo(() => {
    return atms.filter((a) => {
      if (statusFilter !== 'all' && a.Status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = a.ATMID.toLowerCase().includes(q);
        const matchLoc = a.Location.toLowerCase().includes(q);
        return matchId || matchLoc;
      }
      return true;
    });
  }, [atms, statusFilter, searchQuery]);

  // Active Cluster & Coordinates
  const activeCluster = clusters.find((c) => c.id === selectedClusterId);
  const activeGeo = activeCluster ? CORRIDOR_GEO_COORDS[activeCluster.codePrefix] : null;

  // Initialize Map
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
      maxZoom: 18,
      zoomControl: false, // Custom position
      attributionControl: false,
    });

    // Add zoom control top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Create persistent layer groups
    const tileGroup = L.layerGroup().addTo(map);
    const polylinesGroup = L.layerGroup().addTo(map);
    const heatRiskGroup = L.layerGroup().addTo(map);
    const clusterMarkersGroup = L.layerGroup().addTo(map);
    const atmMarkersGroup = L.layerGroup().addTo(map);

    tileGroupRef.current = tileGroup;
    polylinesGroupRef.current = polylinesGroup;
    heatRiskGroupRef.current = heatRiskGroup;
    clusterMarkersGroupRef.current = clusterMarkersGroup;
    atmMarkersGroupRef.current = atmMarkersGroup;
    mapInstanceRef.current = map;

    // Invalidate size after layout
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

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
      heatRiskGroupRef.current = null;
      clusterMarkersGroupRef.current = null;
      atmMarkersGroupRef.current = null;
    };
  }, []);

  // Update Base Map Tiles (Zero API key required)
  useEffect(() => {
    const tileGroup = tileGroupRef.current;
    if (!tileGroup) return;

    tileGroup.clearLayers();

    if (mapTileStyle === 'satellite') {
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
    } else if (mapTileStyle === 'dark') {
      // Professional Esri Dark Gray Canvas + High-Contrast Reference Labels
      // Zero API key needed, crystal-clear road network and crisp white text labels!
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
      // Street Mode: High-precision Esri World Street Map with clear street geometry, cities, and highway badges
      // Zero API key needed, no rate limits or blocks
      const streetLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap',
        }
      );
      streetLayer.addTo(tileGroup);
    }

    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 60);
    return () => clearTimeout(timer);
  }, [mapTileStyle]);

  // Update Highway Polylines
  useEffect(() => {
    const polylinesGroup = polylinesGroupRef.current;
    if (!polylinesGroup) return;

    polylinesGroup.clearLayers();
    if (!showHighways) return;

    HIGHWAY_ROUTES.forEach((route) => {
      const fromCoord = CORRIDOR_GEO_COORDS[route.from];
      const toCoord = CORRIDOR_GEO_COORDS[route.to];
      if (fromCoord && toCoord) {
        const isDark = mapTileStyle === 'dark' || mapTileStyle === 'satellite';
        const lineColor = isDark ? '#38bdf8' : route.color;

        // Base glow line
        const polyline = L.polyline(
          [
            [fromCoord.lat, fromCoord.lng],
            [toCoord.lat, toCoord.lng],
          ],
          {
            color: lineColor,
            weight: route.weight,
            opacity: isDark ? 0.75 : 0.85,
            dashArray: isDark ? '6, 8' : undefined,
          }
        );

        polyline.bindTooltip(
          `<div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 700;">
            ${route.label}
          </div>`,
          { sticky: true }
        );

        polyline.addTo(polylinesGroup);
      }
    });
  }, [showHighways, mapTileStyle]);

  // Update Risk Heatmap / Density Circles
  useEffect(() => {
    const heatGroup = heatRiskGroupRef.current;
    if (!heatGroup) return;

    heatGroup.clearLayers();
    if (!showRiskHeatmap) return;

    clusters.forEach((cluster) => {
      const geo = CORRIDOR_GEO_COORDS[cluster.codePrefix];
      if (!geo) return;

      const riskWeight = cluster.criticalCount * 2 + cluster.urgentCount;
      if (riskWeight > 0) {
        const radius = Math.min(45000, 15000 + riskWeight * 3500);
        const circle = L.circle([geo.lat, geo.lng], {
          radius,
          color: '#f43f5e',
          weight: 1.5,
          opacity: 0.8,
          fillColor: '#f43f5e',
          fillOpacity: 0.18 + Math.min(0.25, riskWeight * 0.03),
        });

        circle.bindTooltip(`
          <div style="font-size: 11px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <strong style="color: #e11d48;">${cluster.name}</strong><br/>
            <span>${cluster.criticalCount} Critical Refills Needed</span>
          </div>
        `);
        circle.addTo(heatGroup);
      }
    });
  }, [clusters, showRiskHeatmap]);

  // Update Regional Cluster Hub Markers
  useEffect(() => {
    const clusterGroup = clusterMarkersGroupRef.current;
    if (!clusterGroup) return;

    clusterGroup.clearLayers();

    clusters.forEach((cluster) => {
      const geo = CORRIDOR_GEO_COORDS[cluster.codePrefix];
      if (!geo) return;

      const isSelected = cluster.id === selectedClusterId;
      const statusColor =
        cluster.criticalCount >= 2
          ? '#e11d48'
          : cluster.criticalCount === 1 || cluster.urgentCount > 0
          ? '#f59e0b'
          : '#10b981';

      const customHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <!-- Pulsing ring if critical -->
          ${
            cluster.criticalCount > 0
              ? `<div style="
                  position: absolute;
                  top: 0;
                  width: 42px;
                  height: 42px;
                  border-radius: 50%;
                  background: ${statusColor};
                  opacity: 0.35;
                  animation: pulseHub 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                "></div>`
              : ''
          }

          <!-- Outer Hub Badge -->
          <div style="
            position: relative;
            background: ${isSelected ? '#1e293b' : statusColor};
            color: #ffffff;
            border: ${isSelected ? '3px solid #38bdf8' : '2.5px solid #ffffff'};
            box-shadow: 0 4px 14px rgba(0,0,0,0.45);
            border-radius: 50%;
            width: ${isSelected ? '44px' : '38px'};
            height: ${isSelected ? '44px' : '38px'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: ${isSelected ? '14px' : '12px'};
            font-family: 'IBM Plex Mono', monospace;
            transform: ${isSelected ? 'scale(1.12)' : 'scale(1)'};
            transition: all 0.25s ease;
          ">
            ${cluster.atmCount}
          </div>

          <!-- Label Pill -->
          <div style="
            margin-top: 4px;
            background: rgba(15, 23, 42, 0.92);
            color: ${isSelected ? '#38bdf8' : '#f8fafc'};
            border: 1px solid ${isSelected ? '#0284c7' : '#334155'};
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            backdrop-filter: blur(4px);
          ">
            ${cluster.shortName || cluster.name}
          </div>
        </div>
        <style>
          @keyframes pulseHub {
            0% { transform: scale(0.9); opacity: 0.8; }
            70% { transform: scale(1.6); opacity: 0; }
            100% { transform: scale(1.6); opacity: 0; }
          }
        </style>
      `;

      const icon = L.divIcon({
        className: 'custom-hub-marker',
        html: customHtml,
        iconSize: [48, 64],
        iconAnchor: [24, 22],
      });

      const marker = L.marker([geo.lat, geo.lng], { icon });

      marker.on('click', () => {
        onSelectCluster(cluster.id);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([geo.lat, geo.lng], 12, { duration: 1.0 });
        }
      });

      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 220px; padding: 2px;">
          <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${cluster.name}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            ${geo.highway} • ${geo.roadKmFromDhaka > 0 ? `${geo.roadKmFromDhaka} km from Dhaka Core` : 'National Banking Center'}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Fleet Terminals</span>
              <strong style="color: #0f172a; font-size: 13px;">${cluster.atmCount} ATMs</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Vault Cash</span>
              <strong style="color: #059669; font-size: 13px;">৳${(cluster.totalRemainingCash / 1000000).toFixed(1)}M</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Fill Level</span>
              <strong style="color: #0f172a;">${cluster.utilizationPct.toFixed(0)}%</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 10px;">Refill Urgency</span>
              <strong style="color: ${cluster.criticalCount > 0 ? '#dc2626' : '#059669'};">
                ${cluster.criticalCount} Critical
              </strong>
            </div>
          </div>
        </div>
      `);

      marker.addTo(clusterGroup);
    });
  }, [clusters, selectedClusterId, onSelectCluster]);

  // Update Individual Fleet ATM Markers
  useEffect(() => {
    const atmGroup = atmMarkersGroupRef.current;
    if (!atmGroup) return;

    atmGroup.clearLayers();
    if (!showAtmPins) return;

    // Display filtered ATMs on map
    filteredAtms.forEach((atm) => {
      const geo = getAtmGeoPosition(atm);
      const isCritical = atm.Status === 'Refill Now';
      const isUrgent = atm.Status === 'Refill Soon';
      const pinColor = isCritical ? '#e11d48' : isUrgent ? '#f59e0b' : '#0284c7';

      const customHtml = `
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          background: ${pinColor};
          border: 2px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
          <span style="
            transform: rotate(45deg);
            color: #ffffff;
            font-weight: 800;
            font-size: 9px;
            font-family: 'IBM Plex Mono', monospace;
          ">
            ${geo.terminalIndex}
          </span>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-fleet-atm-marker',
        html: customHtml,
        iconSize: [26, 32],
        iconAnchor: [13, 26],
        popupAnchor: [0, -24],
      });

      const marker = L.marker([geo.lat, geo.lng], { icon });

      // Rich interactive terminal popup
      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 210px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #0f172a;">${atm.ATMID}</strong>
            <span style="
              font-size: 10px;
              font-weight: 700;
              padding: 1px 6px;
              border-radius: 9999px;
              background: ${isCritical ? '#ffe4e6' : isUrgent ? '#fef3c7' : '#dbeafe'};
              color: ${pinColor};
            ">${atm.Status}</span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
            ${geo.road}, ${geo.area}
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; font-size: 11px; line-height: 1.4; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Vault Remaining:</span>
              <strong style="color: #0f172a;">৳${Math.round(atm.Estimated_Cash_Remaining).toLocaleString()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Cash Runway:</span>
              <strong style="color: ${isCritical ? '#e11d48' : '#0f172a'};">${Number(atm.Days_of_Cash).toFixed(1)} days</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Daily Demand:</span>
              <strong style="color: #2563eb;">৳${Math.round(atm.Predicted_Demand).toLocaleString()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Capacity:</span>
              <strong style="color: #0f172a;">৳${Math.round(atm.ATM_Capacity).toLocaleString()}</strong>
            </div>
          </div>
          <div style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #64748b; margin-bottom: 6px;">
            GPS: ${geo.formattedGps}
          </div>
          <div style="display: flex; gap: 4px; padding-top: 4px; border-t: 1px solid #f1f5f9;">
            <a href="${geo.navUrl}" target="_blank" rel="noopener noreferrer" style="
              flex: 1;
              text-align: center;
              background: #0f172a;
              color: #ffffff;
              padding: 4px 6px;
              border-radius: 6px;
              text-decoration: none;
              font-size: 10px;
              font-weight: 600;
            ">Navigate ↗</a>
          </div>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectAtm) {
          onSelectAtm(atm.ATMID);
        }
      });

      marker.addTo(atmGroup);
    });
  }, [filteredAtms, showAtmPins, onSelectAtm]);

  // Teleport Navigation Presets
  const handleTeleport = (preset: 'dhaka' | 'chittagong' | 'sylhet' | 'padma' | 'rajshahi' | 'national') => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (preset === 'dhaka') {
      map.flyTo([23.78, 90.41], 12, { duration: 1.2 });
    } else if (preset === 'chittagong') {
      map.flyTo([22.34, 91.83], 12, { duration: 1.2 });
    } else if (preset === 'sylhet') {
      map.flyTo([24.89, 91.87], 12, { duration: 1.2 });
    } else if (preset === 'padma') {
      map.flyTo([23.25, 90.15], 10, { duration: 1.2 });
    } else if (preset === 'rajshahi') {
      map.flyTo([24.37, 88.60], 11, { duration: 1.2 });
    } else {
      map.flyTo([23.75, 90.35], 7, { duration: 1.2 });
    }
  };

  // Toggle map expansion
  const handleToggleExpand = () => {
    setIsExpanded((prev) => !prev);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
  };

  return (
    <div className={`space-y-3 ${isExpanded ? 'fixed inset-4 z-50 bg-slate-950 p-4 rounded-2xl shadow-2xl flex flex-col' : ''}`}>
      {/* Top Tactical Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-800 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-100 tracking-wide">
            <Compass className="w-4 h-4 text-blue-400" />
            <span>GIS Command Center & Fleet Geospatial Radar</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-2 text-slate-400 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Safe</span>
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Warning</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Refill Priority</span>
          </div>
        </div>

        {/* Map Layers & Toggles */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Tile Layer Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 shadow-inner">
            <button
              onClick={() => setMapTileStyle('dark')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                mapTileStyle === 'dark' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setMapTileStyle('satellite')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                mapTileStyle === 'satellite' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapTileStyle('street')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                mapTileStyle === 'street' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Street
            </button>
          </div>

          {/* Individual ATM Pins Toggle */}
          <button
            onClick={() => setShowAtmPins((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              showAtmPins
                ? 'bg-blue-950/70 border-blue-500 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>ATM Pins ({filteredAtms.length})</span>
          </button>

          {/* Risk Heatmap Toggle */}
          <button
            onClick={() => setShowRiskHeatmap((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              showRiskHeatmap
                ? 'bg-rose-950/70 border-rose-500 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Risk Zones</span>
          </button>

          {/* Fullscreen Expand */}
          <button
            onClick={handleToggleExpand}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={isExpanded ? 'Restore Normal View' : 'Full Command Screen'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Sub-Toolbar: Fast Search, Filter & Teleport Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/90 text-white px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
        {/* Quick Search */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ATM or Sector..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Filter:</span>
          {(['all', 'Refill Now', 'Refill Soon', 'OK'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                statusFilter === s
                  ? s === 'Refill Now'
                    ? 'bg-rose-600 text-white'
                    : s === 'Refill Soon'
                    ? 'bg-amber-600 text-white'
                    : s === 'OK'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Teleport Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Jump:</span>
          <button
            onClick={() => handleTeleport('dhaka')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all"
          >
            Dhaka
          </button>
          <button
            onClick={() => handleTeleport('chittagong')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all"
          >
            Chittagong
          </button>
          <button
            onClick={() => handleTeleport('sylhet')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all"
          >
            Sylhet
          </button>
          <button
            onClick={() => handleTeleport('padma')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all"
          >
            Padma/Khulna
          </button>
          <button
            onClick={() => handleTeleport('rajshahi')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-all"
          >
            Rajshahi
          </button>
          <button
            onClick={() => handleTeleport('national')}
            className="px-2 py-0.5 rounded bg-blue-900/60 hover:bg-blue-900 text-blue-200 text-[10px] font-semibold border border-blue-700 transition-all"
          >
            National
          </button>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div
        className={`relative rounded-xl overflow-hidden border border-slate-800 shadow-md ${
          mapTileStyle === 'dark' ? 'bg-slate-950 dark-map-mode' : 'bg-slate-100'
        } ${isExpanded ? 'flex-1 h-full min-h-[500px]' : 'h-[500px]'}`}
      >
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Active Corridor Live HUD Floating Overlay */}
        {activeCluster && activeGeo && (
          <div className="absolute bottom-4 left-4 z-[400] bg-slate-950/90 backdrop-blur-md text-white p-3.5 rounded-xl border border-slate-800 shadow-2xl max-w-sm pointer-events-auto">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="font-bold text-xs text-white truncate">{activeCluster.name}</span>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700 font-semibold">
                {activeGeo.highway}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Active Terminals</span>
                <span className="font-bold text-white font-mono text-xs">{activeCluster.atmCount} ATMs</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Vault Liquidity</span>
                <span className="font-bold text-emerald-400 font-mono text-xs">
                  ৳{(activeCluster.totalRemainingCash / 1000000).toFixed(1)}M
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Refill Alert</span>
                <span className={`font-bold font-mono text-xs ${activeCluster.criticalCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {activeCluster.criticalCount} Critical
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Live Legend Floating Pill */}
        <div className="absolute top-4 left-4 z-[400] bg-slate-950/85 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-[10px] flex items-center gap-3 pointer-events-auto">
          <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-blue-400" />
            <span>Telemetries:</span>
          </span>
          <span className="text-slate-200">
            <strong className="text-white font-mono">{clusters.length}</strong> Corridors
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-200">
            <strong className="text-white font-mono">{atms.length}</strong> Fleet Terminals
          </span>
        </div>
      </div>
    </div>
  );
};
