const sourceIdPattern = /^[a-z0-9][a-z0-9._-]*$/u;
const contentHashPattern = /^[a-f0-9]{64}$/u;

function validateAnomaly(anomaly) {
  if (!anomaly || typeof anomaly !== 'object') throw new TypeError('anomaly must be an object');
  if (!sourceIdPattern.test(anomaly.sourceId ?? '')) throw new TypeError('sourceId must be a safe stable identifier');
  if (!sourceIdPattern.test(anomaly.universityId ?? '')) throw new TypeError('universityId must be a safe stable identifier');
  if (!sourceIdPattern.test(anomaly.reason ?? '')) throw new TypeError('reason must be a safe stable identifier');
  if (anomaly.retainedTrustedFacts !== true) throw new TypeError('retainedTrustedFacts must be true');
  for (const fingerprint of ['acceptedContentHash', 'attemptObservedContentHash']) {
    if (anomaly[fingerprint] !== undefined && (typeof anomaly[fingerprint] !== 'string' || !contentHashPattern.test(anomaly[fingerprint]))) {
      throw new TypeError(`${fingerprint} must be a lowercase SHA-256 hash`);
    }
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(anomaly.sourceUrl);
  } catch {
    throw new TypeError('sourceUrl must be a valid public HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
    throw new TypeError('sourceUrl must be a valid public HTTP(S) URL');
  }
}

export function renderAnomalyIssue(anomaly) {
  validateAnomaly(anomaly);
  return `<!-- source-anomaly:${anomaly.sourceId} -->
## 官方来源自动同步异常

| 项目 | 内容 |
| --- | --- |
| 来源 ID | \`${anomaly.sourceId}\` |
| 大学 ID | \`${anomaly.universityId}\` |
| 官方页面 | ${anomaly.sourceUrl} |
| 异常原因 | \`${anomaly.reason}\` |
| 检测时间 | ${anomaly.detectedAt ?? '未记录'} |
| 已接受内容指纹 | \`${anomaly.acceptedContentHash ?? '未建立'}\` |
| 本次观察指纹 | ${anomaly.attemptObservedContentHash ? `\`${anomaly.attemptObservedContentHash}\`` : '本次未捕获'} |

本次自动更新已拒绝异常提取结果，上一版可信数据已保留。

请人工检查官方页面结构或解析规则；确认原因并通过测试后再更新数据。本 Issue 只报告来源异常，不代表任何申请资格结论。
`;
}

export function anomalyIssuePayload(anomaly) {
  validateAnomaly(anomaly);
  return {
    key: `source-anomaly:${anomaly.sourceId}`,
    title: `[数据异常] ${anomaly.sourceId}`,
    body: renderAnomalyIssue(anomaly),
  };
}
