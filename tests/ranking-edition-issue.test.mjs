import { describe, expect, it } from 'vitest';
import {
  rankingEditionIssuePayload,
  renderRankingEditionIssue,
} from '../scripts/render-ranking-edition-issue.mjs';

const candidate = {
  provider: 'qs',
  sourceUrl: 'https://www.topuniversities.com/world-university-rankings?countries=gb',
  reviewedEdition: 2027,
  detectedEdition: 2028,
  status: 'new-edition',
  checkedAt: '2026-08-10T12:34:56.000Z',
};

describe('ranking edition review Issue renderer', () => {
  it('produces a deterministic payload with the complete review evidence', () => {
    const payload = rankingEditionIssuePayload(candidate);

    expect(payload).toMatchObject({
      key: 'ranking-edition:qs:2028',
      title: '[排名待复核] QS 2028',
    });
    expect(payload.body).toBe(renderRankingEditionIssue(candidate));
    expect(payload.body).toContain('<!-- ranking-edition:qs:2028 -->');
    expect(payload.body).toContain(candidate.sourceUrl);
    expect(payload.body).toContain('2027');
    expect(payload.body).toContain('2028');
    expect(payload.body).toContain(candidate.checkedAt);
    expect(payload.body).toMatch(/英国院校身份/u);
    expect(payload.body).toMatch(/精确名次、并列名次或排名区间/u);
    expect(payload.body).toMatch(/新增院校/u);
    expect(payload.body).toMatch(/移除院校/u);
    expect(payload.body).toMatch(/来源与出处/u);
    expect(payload.body).toMatch(/测试与构建/u);
    expect(payload.body).toMatch(/未修改任何排名数据/u);
    expect(payload.body).toMatch(/经复核的 PR/u);
  });

  it.each([
    ['unknown provider', { provider: 'other' }, /provider/u],
    ['unsafe marker provider', { provider: 'qs -->' }, /provider/u],
    ['non-integer reviewed edition', { reviewedEdition: 2027.5 }, /reviewedEdition/u],
    ['non-integer detected edition', { detectedEdition: '2028' }, /detectedEdition/u],
    ['unchanged edition', { detectedEdition: 2027 }, /detectedEdition/u],
    ['older edition', { detectedEdition: 2026 }, /detectedEdition/u],
    ['non-HTTPS source URL', { sourceUrl: 'http://example.com/rankings' }, /sourceUrl/u],
  ])('rejects an invalid candidate with %s', (_label, override, message) => {
    expect(() => rankingEditionIssuePayload({ ...candidate, ...override })).toThrow(message);
  });
});
