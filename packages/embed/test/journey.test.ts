import { describe, it, expect } from 'vitest';
import { readJourney } from '../src/journey.js';

function fakeStorage(value: string | null): Storage {
  return { getItem: () => value } as unknown as Storage;
}

describe('readJourney', () => {
  it('returns parsed entries when present', () => {
    const arr = [{ url: '/a', title: 'A', ts: 1 }, { url: '/b', ts: 2 }];
    expect(readJourney(fakeStorage(JSON.stringify(arr)))).toEqual(arr);
  });

  it('returns undefined when key absent', () => {
    expect(readJourney(fakeStorage(null))).toBeUndefined();
  });

  it('returns undefined on malformed JSON', () => {
    expect(readJourney(fakeStorage('{not json'))).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(readJourney(fakeStorage('[]'))).toBeUndefined();
  });

  it('caps to last 50 entries', () => {
    const big = Array.from({ length: 60 }, (_, i) => ({ url: '/p' + i, ts: i }));
    const got = readJourney(fakeStorage(JSON.stringify(big)))!;
    expect(got.length).toBe(50);
    expect(got[0]!.url).toBe('/p10');
  });
});
