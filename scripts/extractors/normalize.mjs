function normalizeOfficialText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\u3000]+/gu, ' ')
    .trim();
}

export function normalizeExtractedFact(raw, context = {}) {
  const fact = {
    ...context,
    institutionOfficial: normalizeOfficialText(raw.institutionOfficial),
  };

  if (raw.tierOfficial !== undefined) fact.tierOfficial = normalizeOfficialText(raw.tierOfficial);
  if (raw.scoreOfficial !== undefined) fact.scoreOfficial = normalizeOfficialText(raw.scoreOfficial);
  if (raw.institutionNameZh !== undefined) fact.institutionNameZh = normalizeOfficialText(raw.institutionNameZh);

  return fact;
}
