'use client';

import { useEffect, useRef } from 'react';

interface Ponto {
  lat: number;
  lon: number;
  label: string;
  cor?: 'green' | 'orange' | 'blue';
}

interface MapaRotaProps {
  pontos: Ponto[];          // [origem, ...destinos em ordem]
  distancia?: number;
  tempo?: number;
}

export default function MapaRota({ pontos }: MapaRotaProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || pontos.length === 0) return;

    // Importação dinâmica para evitar SSR
    import('leaflet').then((L) => {
      // Corrige ícones do leaflet no Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Destroi instância anterior
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current!);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const cores: Record<string, string> = {
        green: '#22c55e',
        orange: '#f97316',
        blue: '#3b82f6',
      };

      // Adiciona marcadores
      pontos.forEach((p, i) => {
        const cor = p.cor === 'green' ? cores.green : i === pontos.length - 1 ? cores.blue : cores.orange;
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px;height:28px;border-radius:50%;background:${cor};
            border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:bold;font-size:11px;font-family:sans-serif;
          ">${p.cor === 'green' ? '🏠' : i}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([p.lat, p.lon], { icon })
          .addTo(map)
          .bindPopup(`<b>${p.label}</b>`);
      });

      // Desenha linha da rota
      const latlngs = pontos.map((p) => [p.lat, p.lon] as [number, number]);
      L.polyline(latlngs, {
        color: '#f97316',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 4',
      }).addTo(map);

      // Ajusta zoom para caber todos os pontos
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40] });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pontos)]);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapRef} className="w-full h-full" />
    </>
  );
}
