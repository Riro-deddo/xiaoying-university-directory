function recordIdentity(records, field) {
  return records.find((record) => record?.[field] !== undefined)?.[field];
}

function hasDuplicateIds(records) {
  const ids = records.map((record) => record?.id);
  return new Set(ids).size !== ids.length;
}

export function decideSourceUpdate(previousFacts, nextFacts, guard) {
  if (nextFacts.length === 0) return { accepted: false, reason: 'empty-output' };
  if (hasDuplicateIds(nextFacts)) return { accepted: false, reason: 'duplicate-fact-ids' };

  const expectedUniversityId = guard.universityId ?? recordIdentity(previousFacts, 'universityId');
  if (expectedUniversityId && nextFacts.some((fact) => fact.universityId !== expectedUniversityId)) {
    return { accepted: false, reason: 'university-mismatch' };
  }

  const expectedSourceId = guard.sourceId ?? recordIdentity(previousFacts, 'sourceId');
  if (expectedSourceId && nextFacts.some((fact) => fact.sourceId !== expectedSourceId)) {
    return { accepted: false, reason: 'source-mismatch' };
  }

  if (previousFacts.length > 0) {
    const removalRatio = (previousFacts.length - nextFacts.length) / previousFacts.length;
    if (removalRatio > guard.maximumRemovalRatio) {
      return { accepted: false, reason: 'removal-ratio-exceeded' };
    }
  }

  if (nextFacts.length < guard.minimumRecords) return { accepted: false, reason: 'below-minimum-records' };
  if (nextFacts.length > guard.maximumRecords) return { accepted: false, reason: 'above-maximum-records' };
  return { accepted: true, reason: 'valid-change' };
}
