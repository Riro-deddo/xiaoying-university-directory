export interface JsonResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export type JsonFetcher = (url: string) => Promise<JsonResponse>;

export async function fetchInstitutionSearchData(
  fetcher: JsonFetcher,
  institutionRegistryUrl: string,
  reverseIndexUrl: string,
): Promise<{ institutions: unknown[]; reverseIndex: unknown[] }> {
  const [institutionsResponse, reverseIndexResponse] = await Promise.all([
    fetcher(institutionRegistryUrl),
    fetcher(reverseIndexUrl),
  ]);
  if (!institutionsResponse.ok || !reverseIndexResponse.ok) {
    throw new Error('Chinese institution data request failed');
  }
  const [institutions, reverseIndex] = await Promise.all([
    institutionsResponse.json(),
    reverseIndexResponse.json(),
  ]);
  if (!Array.isArray(institutions) || !Array.isArray(reverseIndex)) {
    throw new Error('Chinese institution data payload is invalid');
  }
  return { institutions, reverseIndex };
}
