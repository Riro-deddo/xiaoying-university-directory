import { describe, expect, it } from 'vitest';
import { fetchInstitutionSearchData } from '../src/lib/lazy-institution-data';

describe('fetchInstitutionSearchData', () => {
  it('allows a failed initial request to be retried cleanly', async () => {
    let attempt = 0;
    const fetcher = async (url: string) => {
      attempt += 1;
      if (attempt === 1) return { ok: false, json: async () => [] };
      return { ok: true, json: async () => (url.endsWith('institutions.json') ? [{ id: 'uibe' }] : [{ institutionId: 'uibe' }]) };
    };

    await expect(fetchInstitutionSearchData(fetcher, '/institutions.json', '/reverse-index.json')).rejects.toThrow('request failed');
    await expect(fetchInstitutionSearchData(fetcher, '/institutions.json', '/reverse-index.json')).resolves.toEqual({
      institutions: [{ id: 'uibe' }],
      reverseIndex: [{ institutionId: 'uibe' }],
    });
  });
});
