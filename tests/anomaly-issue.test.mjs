import { describe, expect, it } from 'vitest';
import { anomalyIssuePayload, renderAnomalyIssue } from '../scripts/render-anomaly-issue.mjs';

const anomaly = {
  sourceId: 'ucl-china-list',
  universityId: 'ucl',
  sourceUrl: 'https://www.ucl.ac.uk/prospective-students/international/china',
  reason: 'removal-ratio-exceeded',
  detectedAt: '2026-08-01T03:17:00.000Z',
  retainedTrustedFacts: true,
};

describe('source anomaly Issue renderer', () => {
  it('renders stable source evidence and retained-data language', () => {
    const body = renderAnomalyIssue(anomaly);

    expect(body).toContain('<!-- source-anomaly:ucl-china-list -->');
    expect(body).toContain('removal-ratio-exceeded');
    expect(body).toContain(anomaly.sourceUrl);
    expect(body).toContain('上一版可信数据已保留');
  });

  it('produces a deterministic title and body for GitHub issue upserts', () => {
    expect(anomalyIssuePayload(anomaly)).toEqual({
      key: 'source-anomaly:ucl-china-list',
      title: '[数据异常] ucl-china-list',
      body: renderAnomalyIssue(anomaly),
    });
  });

  it('rejects malformed source identifiers before rendering an Issue marker', () => {
    expect(() => renderAnomalyIssue({ ...anomaly, sourceId: 'bad --> marker' })).toThrow(/sourceId/);
  });
});
