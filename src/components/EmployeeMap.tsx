import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { EmployeeLocation, RouteSummary } from '../lib/types.ts';

const statusLabel = { active: 'Active', stale: 'Stale', offline: 'Offline', 'off-duty': 'Off duty' } as const;
const operationalStatus = (employee: EmployeeLocation): keyof typeof statusLabel =>
  employee.enrollmentState !== 'reporting'
    ? 'offline'
    : employee.retentionState === 'ignored'
      ? 'off-duty'
      : employee.status;

maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

export default function EmployeeMap({ employees, selectedId, route, onSelect }: {
  employees: EmployeeLocation[];
  selectedId: string | null;
  route: RouteSummary | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      center: [77.209, 28.6139],
      zoom: 9.5,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = employees.flatMap((employee) => {
      if (employee.latitude === null || employee.longitude === null) return [];
      const element = document.createElement('button');
      element.type = 'button';
      const currentStatus = operationalStatus(employee);
      element.className = `map-marker status-${currentStatus}${selectedId === employee.employeeId ? ' selected' : ''}`;
      element.setAttribute('aria-label', `${employee.name}, ${statusLabel[currentStatus]}`);
      element.addEventListener('click', () => onSelect(employee.employeeId));
      return [new maplibregl.Marker({ element }).setLngLat([employee.longitude, employee.latitude]).addTo(map.current!)];
    });
  }, [employees, onSelect, selectedId]);

  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const update = () => {
      if (current.getLayer('employee-route')) current.removeLayer('employee-route');
      if (current.getSource('employee-route')) current.removeSource('employee-route');
      if (!route || route.points.length < 2) return;
      current.addSource('employee-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.points.map((point) => [point.longitude, point.latitude]),
          },
        },
      });
      current.addLayer({
        id: 'employee-route',
        type: 'line',
        source: 'employee-route',
        paint: { 'line-color': '#146b55', 'line-width': 5, 'line-opacity': 0.85 },
      });
      const bounds = route.points.reduce(
        (value, point) => value.extend([point.longitude, point.latitude]),
        new maplibregl.LngLatBounds(),
      );
      current.fitBounds(bounds, { padding: 70, maxZoom: 14 });
    };
    current.loaded() ? update() : current.once('load', update);
    return () => {
      if (!current.getStyle()) return;
      if (current.getLayer('employee-route')) current.removeLayer('employee-route');
      if (current.getSource('employee-route')) current.removeSource('employee-route');
    };
  }, [route]);

  return <div ref={container} className="map-canvas" aria-label="Employee location map" />;
}
