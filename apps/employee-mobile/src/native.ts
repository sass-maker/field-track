import { NativeModules } from 'react-native';

export interface SimSnapshot {
  subscriptionId: number;
  slotIndex: number;
  displayName: string | null;
  carrierName: string | null;
  phoneNumber: string | null;
  countryIso: string | null;
  mccMnc: string | null;
  present: boolean;
}

export interface Enrollment {
  employeeId: string;
  employeeName: string;
  deviceId: string;
  deviceToken: string;
  policyId: string;
  apiBaseUrl: string;
  selectedSim: SimSnapshot;
  expectedPhoneNumber?: string;
  simHealth?: 'ok' | 'number-unavailable' | 'mismatch';
}

export interface TrackingStatus {
  enrolled: boolean;
  employeeName?: string;
  deviceId?: string;
  policyId?: string;
  queuedPoints: number;
  lastRecordedAt?: string;
  lastUploadedAt?: string;
  serviceConfigured: boolean;
  simCarrierName?: string;
  simSlotIndex?: number;
  simPresent: boolean;
}

type FieldTrackingModule = {
  configure(enrollment: Enrollment): Promise<void>;
  start(): Promise<void>;
  getStatus(): Promise<TrackingStatus>;
  getInstallId(): Promise<string>;
  getActiveSims(): Promise<SimSnapshot[]>;
};

export const FieldTracking = NativeModules.FieldTracking as FieldTrackingModule;
