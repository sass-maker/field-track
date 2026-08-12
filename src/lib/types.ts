export type EmployeeStatus = 'active' | 'stale' | 'offline';
export type RetentionState = 'retaining' | 'ignored';
export type EnrollmentState = 'not-enrolled' | 'never-seen' | 'reporting';
export type { SimHealth, SimSnapshot } from './onboarding.ts';

export interface LocationPoint {
  id: string;
  employeeId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  recordedAt: string;
  receivedAt?: string;
  batteryPercentage: number | null;
  source: 'android' | 'demo';
  policyId: string;
}

export interface EmployeeLocation {
  employeeId: string;
  employeeCode: string;
  name: string;
  team: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  batteryPercentage: number | null;
  recordedAt: string | null;
  policyId: string | null;
  policyName: string | null;
  lastSeenAt: string | null;
  retentionState: RetentionState;
  windowStartedAt: string | null;
  windowEndsAt: string | null;
  status: EmployeeStatus;
  phoneNumber: string | null;
  deviceId: string | null;
  enrolledAt: string | null;
  enrollmentState: EnrollmentState;
  simHealth: import('./onboarding.ts').SimHealth;
  simPresent: boolean | null;
  simPhoneNumber: string | null;
  simCarrierName: string | null;
  simSlotIndex: number | null;
  simLastReportedAt: string | null;
}

export interface TeamOption { id: string; name: string; region: string }

export interface OnboardingOptionsResponse {
  demoMode: boolean;
  teams: TeamOption[];
  policies: TrackingPolicy[];
}

export interface OnboardingResult {
  demoMode: boolean;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  phoneNumber: string;
  enrollmentCode: string;
  expiresAt: string;
}

export interface RouteSummary {
  employee: Pick<EmployeeLocation, 'employeeId' | 'employeeCode' | 'name' | 'team' | 'region'>;
  date: string;
  windowStartedAt: string | null;
  windowEndedAt: string | null;
  pointCount: number;
  approximateDistanceMeters: number;
  movingMinutes: number;
  stationaryMinutes: number;
  gaps: Array<{ from: string; to: string; minutes: number }>;
  points: LocationPoint[];
}

export interface TrackingPolicy {
  id: string;
  name: string;
  mode: 'always' | 'schedule';
  timeZone: string;
  daysOfWeek: string;
  startMinute: number;
  endMinute: number;
}

export interface LiveRosterResponse {
  generatedAt: string;
  demoMode: boolean;
  employees: EmployeeLocation[];
}
