import type { BloodType } from '../types';

/** Display helpers shared by list screens, detail screens and the provider console. */

export const BLOOD_TYPES: Array<{ value: BloodType; label: string }> = [
  { value: 'A_POSITIVE', label: 'A+' },
  { value: 'A_NEGATIVE', label: 'A−' },
  { value: 'B_POSITIVE', label: 'B+' },
  { value: 'B_NEGATIVE', label: 'B−' },
  { value: 'AB_POSITIVE', label: 'AB+' },
  { value: 'AB_NEGATIVE', label: 'AB−' },
  { value: 'O_POSITIVE', label: 'O+' },
  { value: 'O_NEGATIVE', label: 'O−' },
];

export const BLOOD_LABEL: Record<BloodType, string> = Object.fromEntries(
  BLOOD_TYPES.map((t) => [t.value, t.label]),
) as Record<BloodType, string>;

export const ORG_TYPE_LABEL: Record<string, string> = {
  HOSPITAL: 'Hospital',
  BLOOD_BANK: 'Blood bank',
  PHARMACY: 'Pharmacy',
  AMBULANCE_PROVIDER: 'Ambulance provider',
  NGO: 'NGO',
};

/** Beyond this, a capacity figure is flagged as possibly out of date. */
const STALE_AFTER_HOURS = 24;

/**
 * Human-readable age of an availability timestamp.
 *
 * `stale` matters more than the text: a bed count with no visible age reads as
 * current, and an emergency decision made on a two-day-old number is worse than
 * one made on no number at all.
 */
export function updatedLabel(iso?: string | null): { text: string; stale: boolean } {
  if (!iso) return { text: 'never updated', stale: true };
  const ageMs = Date.now() - new Date(iso).getTime();
  const hours = ageMs / 3_600_000;
  const text =
    hours < 1
      ? `${Math.max(1, Math.round(ageMs / 60_000))} min ago`
      : hours < 48
        ? `${Math.round(hours)} h ago`
        : `${Math.round(hours / 24)} d ago`;
  return { text, stale: hours > STALE_AFTER_HOURS };
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}
