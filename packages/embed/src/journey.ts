export interface JourneyEntry {
  url: string;
  title?: string;
  ts: number;
}

const KEY = '_mf_journey';
const MAX = 50;

/**
 * Read the client journey array from sessionStorage. Best-effort only — the
 * server (submit.ts) is authoritative for validation/caps. Returns undefined
 * when absent, malformed, or empty. Never throws.
 */
export function readJourney(storage: Storage): JourneyEntry[] | undefined {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return undefined;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr.slice(-MAX) as JourneyEntry[];
  } catch {
    return undefined;
  }
}
