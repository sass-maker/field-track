export type SimHealth = 'ok' | 'absent' | 'number-unavailable' | 'mismatch' | 'not-reported';

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

export function normalizePhoneNumber(value: string | null | undefined, defaultCountryCode = '91') {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (raw.startsWith('00') && digits.length >= 10 && digits.length <= 17) return `+${digits.slice(2)}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+${defaultCountryCode}${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith(defaultCountryCode)) return `+${digits}`;
  return null;
}

export function simHealth(expectedPhone: string | null, reportedPhone: string | null, present: boolean | null): SimHealth {
  if (present === false) return 'absent';
  if (present === null) return 'not-reported';
  const expected = normalizePhoneNumber(expectedPhone);
  const reported = normalizePhoneNumber(reportedPhone);
  if (!reported) return 'number-unavailable';
  return expected === reported ? 'ok' : 'mismatch';
}
