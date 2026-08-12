import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveStatus, routeMetrics, shouldRetainAt } from './status.ts';
import type { LocationPoint } from './types.ts';

test('derives employee freshness states', () => {
  const now = Date.parse('2026-08-12T10:00:00.000Z');
  assert.equal(deriveStatus('2026-08-12T09:58:00.000Z', now), 'active');
  assert.equal(deriveStatus('2026-08-12T09:57:59.000Z', now), 'stale');
  assert.equal(deriveStatus('2026-08-12T09:49:59.000Z', now), 'offline');
});

test('reports route gaps without counting them as stationary time', () => {
  const base: Omit<LocationPoint, 'id' | 'latitude' | 'longitude' | 'recordedAt'> = {
    employeeId: 'emp-001', deviceId: 'device-001', accuracyMeters: 12,
    batteryPercentage: 70, source: 'demo', policyId: 'policy-001',
  };
  const points: LocationPoint[] = [
    { ...base, id: '1', latitude: 28.6139, longitude: 77.209, recordedAt: '2026-08-12T09:00:00.000Z' },
    { ...base, id: '2', latitude: 28.6144, longitude: 77.21, recordedAt: '2026-08-12T09:02:00.000Z' },
    { ...base, id: '3', latitude: 28.615, longitude: 77.211, recordedAt: '2026-08-12T09:14:00.000Z' },
  ];
  const metrics = routeMetrics(points);
  assert.equal(metrics.gaps.length, 1);
  assert.equal(metrics.gaps[0]?.minutes, 12);
  assert.ok(metrics.approximateDistanceMeters > 100);
});

test('applies an India weekday retention schedule at the server', () => {
  const policy = { id: 'p1', name: 'Day duty', mode: 'schedule' as const, timeZone: 'Asia/Kolkata', daysOfWeek: '1,2,3,4,5,6', startMinute: 8 * 60, endMinute: 18 * 60 };
  assert.equal(shouldRetainAt(policy, '2026-08-12T04:00:00.000Z'), true);
  assert.equal(shouldRetainAt(policy, '2026-08-12T14:00:00.000Z'), false);
});
