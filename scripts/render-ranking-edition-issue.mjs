const supportedProviders = new Set(['qs', 'the']);

function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('candidate must be an object');
  }
  if (typeof candidate.provider !== 'string' || !supportedProviders.has(candidate.provider)) {
    throw new TypeError('provider must be a supported safe identifier');
  }
  if (!Number.isInteger(candidate.reviewedEdition)) {
    throw new TypeError('reviewedEdition must be an integer');
  }
  if (!Number.isInteger(candidate.detectedEdition)) {
    throw new TypeError('detectedEdition must be an integer');
  }
  if (candidate.detectedEdition <= candidate.reviewedEdition) {
    throw new TypeError('detectedEdition must be newer than reviewedEdition');
  }
  if (candidate.status !== 'new-edition') {
    throw new TypeError('status must be new-edition');
  }
  if (typeof candidate.sourceUrl !== 'string' || /[\u0000-\u001f\u007f]/u.test(candidate.sourceUrl)) {
    throw new TypeError('sourceUrl must be a valid HTTPS URL');
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(candidate.sourceUrl);
  } catch {
    throw new TypeError('sourceUrl must be a valid HTTPS URL');
  }
  if (sourceUrl.protocol !== 'https:' || !sourceUrl.hostname || sourceUrl.username || sourceUrl.password) {
    throw new TypeError('sourceUrl must be a valid HTTPS URL');
  }
  if (typeof candidate.checkedAt !== 'string'
      || new Date(candidate.checkedAt).toISOString() !== candidate.checkedAt) {
    throw new TypeError('checkedAt must be an ISO 8601 timestamp');
  }
}

export function renderRankingEditionIssue(candidate) {
  validateCandidate(candidate);
  const key = `ranking-edition:${candidate.provider}:${candidate.detectedEdition}`;

  return `<!-- ${key} -->
## 发现新的排名版本，等待人工复核

| 项目 | 检测证据 |
| --- | --- |
| 排名机构 | ${candidate.provider.toUpperCase()} |
| 官方页面 | ${candidate.sourceUrl} |
| 已复核版本 | ${candidate.reviewedEdition} |
| 检测到的版本 | ${candidate.detectedEdition} |
| 检测时间 | ${candidate.checkedAt} |

本次自动检查未修改任何排名数据、生成数据或发布内容。只有经复核的 PR 才能更新排名事实。

### 人工复核清单

- [ ] 核对每所英国院校身份及其目录映射
- [ ] 核对精确名次、并列名次或排名区间
- [ ] 记录新增院校并核实其官方身份
- [ ] 记录移除院校并确认不是页面解析遗漏
- [ ] 更新来源与出处，保留官方页面和版本证据
- [ ] 运行测试与构建，并在经复核的 PR 中提交变更
`;
}

export function rankingEditionIssuePayload(candidate) {
  validateCandidate(candidate);
  return {
    key: `ranking-edition:${candidate.provider}:${candidate.detectedEdition}`,
    title: `[排名待复核] ${candidate.provider.toUpperCase()} ${candidate.detectedEdition}`,
    body: renderRankingEditionIssue(candidate),
  };
}
