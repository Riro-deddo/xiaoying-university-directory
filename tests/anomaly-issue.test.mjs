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

  it('renders accepted and observed fingerprints for a changed source', () => {
    const changed = {
      ...anomaly,
      reason: 'source-changed',
      acceptedContentHash: 'a'.repeat(64),
      observedContentHash: 'b'.repeat(64),
    };

    expect(renderAnomalyIssue(changed)).toContain('`' + 'a'.repeat(64) + '`');
    expect(renderAnomalyIssue(changed)).toContain('`' + 'b'.repeat(64) + '`');
    expect(renderAnomalyIssue({ ...changed, observedContentHash: undefined }))
      .toContain('本次未捕获');
  });

  it('rejects malformed supplied content fingerprints', () => {
    const changed = {
      ...anomaly,
      reason: 'source-changed',
      acceptedContentHash: 'a'.repeat(64),
      observedContentHash: 'b'.repeat(64),
    };

    expect(() => renderAnomalyIssue({ ...changed, acceptedContentHash: 'not-a-hash' }))
      .toThrow(/acceptedContentHash/u);
    expect(() => renderAnomalyIssue({ ...changed, observedContentHash: 'not-a-hash' }))
      .toThrow(/observedContentHash/u);
  });

  it('rejects non-string supplied content fingerprints', () => {
    const changed = {
      ...anomaly,
      reason: 'source-changed',
    };

    expect(() => renderAnomalyIssue({ ...changed, acceptedContentHash: ['a'.repeat(64)] }))
      .toThrow(/acceptedContentHash/u);
    expect(() => renderAnomalyIssue({ ...changed, observedContentHash: ['b'.repeat(64)] }))
      .toThrow(/observedContentHash/u);
  });
});
