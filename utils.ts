export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDistance(km: number): string {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}min`;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function calcularValorTotal(
  diaria: number,
  distanciaKm: number,
  valorPorKm: number
): number {
  return diaria + distanciaKm * valorPorKm;
}

export function buildGoogleMapsUrl(
  origin: string,
  waypoints: string[],
  destination: string
): string {
  const base = 'https://www.google.com/maps/dir/';
  const all = [origin, ...waypoints, destination]
    .map((a) => encodeURIComponent(a))
    .join('/');
  return `${base}${all}`;
}
