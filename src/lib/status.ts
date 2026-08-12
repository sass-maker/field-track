import type { EmployeeStatus, LocationPoint, TrackingPolicy } from './types.ts';

const ACTIVE_MAX_MS = 2 * 60_000;
const STALE_MAX_MS = 10 * 60_000;

export function deriveStatus(recordedAt: string | null, now = Date.now()): EmployeeStatus {
  if (!recordedAt) return 'offline';

  const age = Math.max(0, now - Date.parse(recordedAt));
  if (age <= ACTIVE_MAX_MS) return 'active';
  if (age <= STALE_MAX_MS) return 'stale';
  return 'offline';
}

export function shouldRetainAt(policy: TrackingPolicy, recordedAt: string) {
  if (policy.mode === 'always') return true;
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: policy.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = weekdays[value.weekday ?? ''];
  if (day === undefined || !policy.daysOfWeek.split(',').map(Number).includes(day)) return false;
  const minute = Number(value.hour) * 60 + Number(value.minute);
  return policy.startMinute <= policy.endMinute
    ? minute >= policy.startMinute && minute < policy.endMinute
    : minute >= policy.startMinute || minute < policy.endMinute;
}

export function haversineMeters(a: Pick<LocationPoint, 'latitude' | 'longitude'>, b: Pick<LocationPoint, 'latitude' | 'longitude'>) {
  const radius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitude1 = radians(a.latitude);
  const latitude2 = radians(b.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function routeMetrics(points: LocationPoint[]) {
  let approximateDistanceMeters = 0;
  let movingMinutes = 0;
  let stationaryMinutes = 0;
  const gaps: Array<{ from: string; to: string; minutes: number }> = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const elapsedMinutes = Math.max(0, (Date.parse(current.recordedAt) - Date.parse(previous.recordedAt)) / 60_000);
    const distance = haversineMeters(previous, current);
    approximateDistanceMeters += distance;
    if (elapsedMinutes > 6) gaps.push({ from: previous.recordedAt, to: current.recordedAt, minutes: Math.round(elapsedMinutes) });
    else if (distance > Math.max(25, current.accuracyMeters)) movingMinutes += elapsedMinutes;
    else stationaryMinutes += elapsedMinutes;
  }

  return {
    approximateDistanceMeters: Math.round(approximateDistanceMeters),
    movingMinutes: Math.round(movingMinutes),
    stationaryMinutes: Math.round(stationaryMinutes),
    gaps,
  };
}
