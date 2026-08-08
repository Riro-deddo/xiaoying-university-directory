import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseHTML } from 'linkedom';
import { extractHtmlFacts } from './extractors/html.mjs';
import { extractPdfFacts, extractPdfText } from './extractors/pdf.mjs';
import { normalizeExtractedFact } from './extractors/normalize.mjs';
import { readAndHashSourceContent } from './source-content-hash.mjs';
import { checkSource } from './source-checker.mjs';
import { decideSourceUpdate } from './update-guard.mjs';

export { decideSourceUpdate };

const bilingualRegistryProviderIds = new Set([
  'sheffield-china',
  'glasgow-china',
  'nottingham-china',
  'southampton-china',
]);

const reviewedInstitutionIdMigrations = new Map([
  ['cn-2aed343979e0d8a4', 'national-university-of-defense-technology-471f1540'],
  ['cn-24b061299c2b0627', 'cn-0141ce1ecb916d53'],
  ['cn-d5c5b1060c6cb19a', 'cn-59583c392cc9c72b'],
  ['cn-3e8df3d654a710b7', 'cn-992cbbacda23f7e8'],
  ['cn-daf081c02379f0bd', 'cn-cfc7b6e5ea305c78'],
  ['cn-24a4136d3396b70b', 'cn-b0c5ad9361839895'],
  ['cn-0f8a1bf9dbc39920', 'cn-38fe392afb9e622f'],
  ['cn-ac97c4410bc4bf72', 'university-of-international-business-and-economics-2a13872d'],
  ['cn-c3666f26ac904b46', 'cn-fd334bd375069320'],
  ['cn-9c79fa3641a2c89f', 'cn-2a43c086fb3735e8'],
  ['cn-6df0ef9150bd1ff2', 'cn-5e462a0463a6da6f'],
  ['cn-555a8af33ef74196', 'cn-3016ad038539ee1a'],
  ['cn-675dc89119eb7546', 'cn-798a43f1d58b93f6'],
  ['cn-7d594ee83f0ce08b', 'cn-d65eedfa9c42cf79'],
  ['cn-8662abe7b31277c2', 'cn-d2d1c47bd0bdaac2'],
  ['cn-294892d926a099b1', 'cn-3eed51e9f008d2ea'],
  ['cn-eb05e0e2c3858178', 'cn-13a3c963f474ff79'],
  ['cn-228da9869d132d1c', 'cn-9e338bea93785dc4'],
  ['cn-4608925f6f37c011', 'cn-420d922c78eeff4e'],
  ['cn-f31b82d745f6036c', 'cn-e1081944b32c4a84'],
  ['cn-5014762bda41f881', 'cn-c54a8bf9427f90d1'],
  ['cn-e198010d37f04649', 'cn-8e869295f3c945de'],
  ['the-second-military-medical-university-55f6f4f4', 'cn-9f87dd4ea325c693'],
]);

const reviewedHistoricalInstitutionIds = new Set([
  'cn-675dc89119eb7546',
  'cn-7d594ee83f0ce08b',
  'cn-8662abe7b31277c2',
  'cn-294892d926a099b1',
  'cn-eb05e0e2c3858178',
  'cn-228da9869d132d1c',
  'cn-4608925f6f37c011',
  'cn-f31b82d745f6036c',
  'cn-5014762bda41f881',
  'cn-e198010d37f04649',
  'the-second-military-medical-university-55f6f4f4',
]);

const reviewedCanonicalInstitutionNames = new Map([
  ['cn-fd334bd375069320', 'Southern University of Science and Technology'],
  ['cn-6e6aaf892c17a701', 'Nanchang Institute of Engineering'],
  ['cn-5cd7c382c835dda0', 'Beijing Normal University Zhuhai Branch Campus'],
  ['cn-d5e12e3100f1bfb3', 'Beijing Normal University, Zhuhai Campus'],
  ['cn-a384f90b16d88cfa', 'China University of Geosciences (Wuhan)'],
  ['cn-d65eedfa9c42cf79', 'College of Applied Science, Jiangxi University of Science and Technology'],
]);

const reviewedPreservedPreviousCanonicalNames = new Set(['cn-fd334bd375069320']);

const reviewedRequiredInstitutionAliases = new Map([
  ['cn-9f87dd4ea325c693', [
    '第二军医大学',
    'Second Military Medical University',
    'The Second Military Medical University',
    'Naval Medical University',
  ]],
  ['university-of-international-business-and-economics-2a13872d', ['UIBE']],
  ['cn-fd334bd375069320', ['SUSTech']],
]);

const reviewedForbiddenRegistryNames = new Map([
  ['cn-6e6aaf892c17a701', new Set(['nanchang institute of technology'])],
  ['cn-5cd7c382c835dda0', new Set(['beijing normal university zhuhai'])],
  ['cn-d5e12e3100f1bfb3', new Set(['beijing normal university zhuhai'])],
  ['cn-a384f90b16d88cfa', new Set(['china university of geosciences'])],
  ['cn-d65eedfa9c42cf79', new Set(['gannan university of science and technology'])],
]);

const reviewedParserArtifactCorrections = new Map([
  [')北方民族大学', { institutionNameZh: '北方民族大学', institutionOfficial: 'Beifang Minzu University (Northern Minzu University)' }],
  [')对外经济贸易大学', { institutionNameZh: '对外经济贸易大学', institutionOfficial: 'University of International Business and Economics (UIBE)' }],
  [')南方科技大学', { institutionNameZh: '南方科技大学', institutionOfficial: 'Southern University of Science and Technology (SUSTech)' }],
  [')香港科技大学(广州)', { institutionNameZh: '香港科技大学(广州)', institutionOfficial: 'Hong Kong University of Science and Technology (Guangzhou)' }],
  [')浙大宁波理工学院', { institutionNameZh: '浙大宁波理工学院', institutionOfficial: 'NingboTech University (Zhejiang University Ningbo Institute of Technology)' }],
  ['浙江树人学院浙江树人大学', { institutionNameZh: '浙江树人学院', institutionOfficial: 'Zhejiang Shuren University' }],
]);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requirementsSchema = JSON.parse(await readFile(join(root, 'src', 'data', 'requirements.schema.json'), 'utf8'));
const institutionsSchema = JSON.parse(await readFile(join(root, 'src', 'data', 'institutions.schema.json'), 'utf8'));
const validateRequirements = new Ajv2020({ allErrors: true }).compile(requirementsSchema);
const validateInstitutions = new Ajv2020({ allErrors: true }).compile(institutionsSchema);

const temporaryHttpStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizedRegistrySearchName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/\p{P}+/gu, ' ')
    .replace(/[\s\u3000]+/gu, ' ')
    .trim();
}

function correctedReviewedParserArtifactFact(fact) {
  const normalizedChineseName = normalizedChineseInstitutionName(fact.institutionNameZh);
  const correction = reviewedParserArtifactCorrections.get(fact.institutionNameZh)
    ?? [...reviewedParserArtifactCorrections].find(([artifactChineseName]) => (
      normalizedChineseInstitutionName(artifactChineseName) === normalizedChineseName
    ))?.[1];
  return correction ? { ...fact, ...correction } : fact;
}

function canonicalReviewedInstitutionId(institutionId) {
  let canonicalId = institutionId;
  while (reviewedInstitutionIdMigrations.has(canonicalId)) {
    canonicalId = reviewedInstitutionIdMigrations.get(canonicalId);
  }
  return canonicalId;
}

function reconcileReviewedInstitutionRegistry(inputInstitutions, inputRequirements) {
  const institutions = inputInstitutions.map((institution) => ({
    ...institution,
    aliases: [...institution.aliases],
  }));
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));

  for (const [obsoleteId, canonicalId] of reviewedInstitutionIdMigrations) {
    const obsolete = institutionById.get(obsoleteId);
    const canonical = institutionById.get(canonicalId);
    if (!obsolete || !canonical) continue;
    if (reviewedHistoricalInstitutionIds.has(obsoleteId)) {
      appendAlias(canonical, obsolete.nameZh);
      appendAlias(canonical, obsolete.nameEn);
      for (const alias of obsolete.aliases) appendAlias(canonical, alias);
    }
    institutionById.delete(obsoleteId);
  }

  for (const [institutionId, canonicalName] of reviewedCanonicalInstitutionNames) {
    const institution = institutionById.get(institutionId);
    if (!institution || institution.nameEn === canonicalName) continue;
    const previousName = institution.nameEn;
    institution.nameEn = canonicalName;
    if (reviewedPreservedPreviousCanonicalNames.has(institutionId)) appendAlias(institution, previousName);
  }

  for (const [institutionId, aliases] of reviewedRequiredInstitutionAliases) {
    const institution = institutionById.get(institutionId);
    if (!institution) continue;
    for (const alias of aliases) appendAlias(institution, alias);
  }

  for (const institution of institutionById.values()) {
    const forbiddenNames = reviewedForbiddenRegistryNames.get(institution.id) ?? new Set();
    const retainedAliases = [];
    const retainedNormalizedAliases = new Set();
    for (const alias of institution.aliases) {
      const normalized = normalizedRegistrySearchName(alias);
      if (!normalized
        || normalized === normalizedRegistrySearchName(institution.nameZh)
        || normalized === normalizedRegistrySearchName(institution.nameEn)
        || forbiddenNames.has(normalized)
        || retainedNormalizedAliases.has(normalized)) continue;
      retainedAliases.push(alias);
      retainedNormalizedAliases.add(normalized);
    }
    institution.aliases = retainedAliases;
  }

  const requirements = inputRequirements.map((inputFact) => {
    const fact = correctedReviewedParserArtifactFact(inputFact);
    const institutionId = canonicalReviewedInstitutionId(fact.institutionId);
    return institutionId === fact.institutionId ? fact : { ...fact, institutionId };
  });

  return {
    institutions: institutions.filter((institution) => institutionById.has(institution.id)),
    requirements,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJsonAtomically(path, value) {
  const candidatePath = `${path}.next`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(candidatePath, json(value), 'utf8');
  await rename(candidatePath, path);
}

async function writeRequirementsAndInstitutionsAtomically(paths, requirements, institutions, { renameFile = rename } = {}) {
  const requirementsCandidatePath = `${paths.requirementsPath}.next`;
  const institutionsCandidatePath = `${paths.institutionsPath}.next`;
  const previousInstitutions = await readFile(paths.institutionsPath, 'utf8');
  let institutionsPromoted = false;

  try {
    await Promise.all([
      mkdir(dirname(paths.requirementsPath), { recursive: true }),
      mkdir(dirname(paths.institutionsPath), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(requirementsCandidatePath, json(requirements), 'utf8'),
      writeFile(institutionsCandidatePath, json(institutions), 'utf8'),
    ]);
    await renameFile(institutionsCandidatePath, paths.institutionsPath);
    institutionsPromoted = true;
    await renameFile(requirementsCandidatePath, paths.requirementsPath);
  } catch (error) {
    if (institutionsPromoted) {
      await writeFile(institutionsCandidatePath, previousInstitutions, 'utf8');
      await renameFile(institutionsCandidatePath, paths.institutionsPath);
    }
    await Promise.all([
      rm(requirementsCandidatePath, { force: true }),
      rm(institutionsCandidatePath, { force: true }),
    ]);
    throw error;
  }
}

function defaultWait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function normalizeRuleText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

async function verifyInstitutionRuleSource(source, fetchImpl, timeoutMs) {
  const verification = source.institutionRule?.verification;
  if (!verification) {
    return { accepted: false, health: 'changed', reason: 'institution-rule-verification-missing' };
  }

  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, verification.url, {
      headers: { 'user-agent': 'Xiaoying-University-Directory/0.1 (+reviewed institution rule verification)' },
      redirect: 'follow',
    }, timeoutMs);
  } catch (error) {
    return {
      accepted: false,
      health: 'temporary-error',
      reason: 'institution-rule-source-temporary-error',
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }

  if (!response.ok) {
    const health = fetchHealth(response);
    return {
      accepted: false,
      health,
      reason: health === 'temporary-error'
        ? 'institution-rule-source-temporary-error'
        : 'institution-rule-source-unavailable',
      httpStatus: response.status,
      finalUrl: response.url || verification.url,
    };
  }

  const isPdf = response.headers.get('content-type')?.includes('pdf')
    || verification.url.toLocaleLowerCase('en-US').includes('.pdf');
  const pageText = isPdf
    ? normalizeRuleText((await extractPdfText(new Uint8Array(await response.arrayBuffer()))).join(' '))
    : (() => {
      const readHtml = async () => response.text();
      return readHtml().then((html) => {
        const { document } = parseHTML(html);
        return normalizeRuleText(
          document.body?.textContent
          || document.documentElement?.textContent
          || html.replace(/<[^>]*>/gu, ' '),
        );
      });
    })();
  const normalizedPageText = await pageText;
  const missingRequiredText = verification.requiredText.filter((required) =>
    !normalizedPageText.includes(normalizeRuleText(required)));
  if (missingRequiredText.length > 0) {
    return {
      accepted: false,
      health: 'changed',
      reason: 'institution-rule-text-changed',
      httpStatus: response.status,
      finalUrl: response.url || verification.url,
      missingRequiredText,
    };
  }
  return { accepted: true };
}

function sourcePaths(options) {
  return {
    sourcesPath: options.sourcesPath ?? join(root, 'src', 'data', 'sources.json'),
    institutionsPath: options.institutionsPath ?? join(root, 'src', 'data', 'institutions.json'),
    requirementsPath: options.requirementsPath ?? join(root, 'src', 'data', 'generated', 'requirements.json'),
    statusPath: options.statusPath ?? join(root, 'src', 'data', 'status.json'),
    anomaliesPath: options.anomaliesPath ?? join(root, 'artifacts', 'source-anomalies.json'),
  };
}

function timestamp(now) {
  return (typeof now === 'function' ? now() : now).toISOString();
}

function sourceStatus(source, previous, now, patch) {
  const next = {
    sourceId: source.id,
    checkedAt: timestamp(now),
    lastSuccessfulAt: previous?.lastSuccessfulAt,
    etag: previous?.etag,
    lastModified: previous?.lastModified,
    contentHash: previous?.contentHash,
    observedContentHash: previous?.observedContentHash,
    consecutiveFailures: previous?.consecutiveFailures,
    ...patch,
  };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) delete next[key];
  }
  return next;
}

function anomaly(source, reason, now, details = {}) {
  return {
    sourceId: source.id,
    universityId: source.universityId,
    sourceUrl: source.url,
    reason,
    detectedAt: timestamp(now),
    retainedTrustedFacts: true,
    ...details,
  };
}

function normalizedInstitutionName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\u3000]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function normalizedChineseInstitutionName(value) {
  return normalizedInstitutionName(value)
    .replace(/\s*\(\s*/gu, '(')
    .replace(/\s*\)\s*/gu, ')');
}

function normalizedEnglishLookupKeys(value) {
  const source = String(value ?? '').normalize('NFKC').trim();
  const normalize = (candidate) => candidate
    .toLocaleLowerCase('en-US')
    .replace(/&/gu, ' and ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
  const keys = new Set();
  const addCandidate = (candidate) => {
    for (const variant of candidate.split(/\s*\/\s*/u)) {
      const normalized = normalize(variant);
      if (normalized) keys.add(normalized);
      if (/^china\s+/iu.test(variant)) {
        const withoutChina = normalize(variant.replace(/^china\s+/iu, ''));
        if (withoutChina) keys.add(withoutChina);
      }
    }
  };
  addCandidate(source);
  let stripped = source;
  while (true) {
    const match = /\s*\(([^()]*)\)\s*$/u.exec(stripped);
    if (!match || !(/^(?:formerly|also known|specialist institution|for |aka\b|see\b)/iu.test(match[1].trim())
      || /(?:%|\*)/u.test(match[1])
      || /^[A-Z][A-Z0-9.-]{1,9}$/u.test(match[1].trim()))) break;
    stripped = stripped.slice(0, match.index).trim();
    addCandidate(stripped);
  }
  return [...keys];
}

function appendAlias(record, value) {
  const alias = String(value ?? '').trim();
  if (!alias || record.nameEn === alias || record.nameZh === alias || record.aliases.includes(alias)) return;
  record.aliases.push(alias);
}

class InstitutionReconciliationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'InstitutionReconciliationError';
    this.code = code;
  }
}

function findEnglishInstitutionMatches(officialName, institutions) {
  const lookupKeys = normalizedEnglishLookupKeys(officialName);
  return institutions.filter((record) => [record.nameEn, ...record.aliases]
    .some((name) => normalizedEnglishLookupKeys(name).some((key) => lookupKeys.includes(key))));
}

export function reconcileInstitution(rawFact, institutions) {
  const officialName = normalizedInstitutionName(rawFact.institutionOfficial);
  const ChineseName = normalizedChineseInstitutionName(rawFact.institutionNameZh);

  if (ChineseName) {
    const ChineseMatch = institutions.find((record) => (
      normalizedChineseInstitutionName(record.nameZh) === ChineseName
      || record.aliases.some((alias) => normalizedChineseInstitutionName(alias) === ChineseName)
    ));
    if (ChineseMatch) {
      const conflictingEnglishMatches = officialName
        ? findEnglishInstitutionMatches(rawFact.institutionOfficial, institutions)
          .filter((record) => record.id !== ChineseMatch.id)
        : [];
      const forbiddenRegistryNames = reviewedForbiddenRegistryNames.get(ChineseMatch.id) ?? new Set();
      if (conflictingEnglishMatches.length === 0
        && !forbiddenRegistryNames.has(normalizedRegistrySearchName(rawFact.institutionOfficial))) {
        appendAlias(ChineseMatch, rawFact.institutionOfficial);
      }
      return ChineseMatch;
    }
    if (officialName) {
      const id = `cn-${createHash('sha256').update(`${ChineseName}\u0000${officialName}`).digest('hex').slice(0, 16)}`;
      const collision = institutions.find((record) => record.id === id);
      if (collision) return collision;
      return {
        id,
        nameZh: rawFact.institutionNameZh.trim(),
        nameEn: rawFact.institutionOfficial.trim(),
        aliases: [],
      };
    }
  }

  if (officialName) {
    const matches = findEnglishInstitutionMatches(rawFact.institutionOfficial, institutions);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new InstitutionReconciliationError(
        'AMBIGUOUS_ENGLISH_ONLY_INSTITUTION',
        `Ambiguous English-only institution: ${rawFact.institutionOfficial}`,
      );
    }
  }

  throw new InstitutionReconciliationError(
    'UNKNOWN_ENGLISH_ONLY_INSTITUTION',
    `No registered institution matches official source row: ${rawFact.institutionOfficial}`,
  );
}

function candidateInstitutionValidationErrors(institutions, requirements) {
  const errors = [];
  if (!validateInstitutions(institutions)) errors.push('institution-schema-validation-failed');

  const institutionIds = institutions.map((institution) => institution?.id);
  if (new Set(institutionIds).size !== institutionIds.length) errors.push('duplicate-institution-ids');

  const ChineseNames = institutions.map((institution) => normalizedChineseInstitutionName(institution?.nameZh));
  if (new Set(ChineseNames).size !== ChineseNames.length) errors.push('duplicate-institution-chinese-names');

  const registeredIds = new Set(institutionIds);
  if (requirements.some((fact) => !registeredIds.has(fact.institutionId))) {
    errors.push('requirement-institution-reference-missing');
  }
  return errors;
}

function requirementFactId(sourceId, institutionId, discriminator) {
  const suffix = createHash('sha256').update(`${sourceId}\u0000${institutionId}${discriminator ? `\u0000${discriminator}` : ''}`).digest('hex').slice(0, 16);
  return `${sourceId}-${suffix}`;
}

function completeRequirementFact(rawFact, source, institutions, now, contentHash) {
  const fact = normalizeExtractedFact({
    ...rawFact,
    tierOfficial: rawFact.tierOfficial ?? source.parser.defaultTierOfficial,
  });
  if (!fact.tierOfficial) throw new Error(`Official source row has no tier: ${fact.institutionOfficial}`);
  const institution = reconcileInstitution(fact, institutions);
  if (!institutions.some((record) => record.id === institution.id)) institutions.push(institution);
  const discriminator = source.parser.allowMultipleFactsPerInstitution
    ? [fact.tierOfficial, fact.scoreOfficial ?? ''].join('\u0000')
    : undefined;
  const requirement = {
    id: requirementFactId(source.id, institution.id, discriminator),
    universityId: source.universityId,
    sourceId: source.id,
    institutionId: institution.id,
    institutionOfficial: fact.institutionOfficial,
    tierOfficial: fact.tierOfficial,
    scope: source.scope,
    scopeZh: source.scopeZh,
    extractedAt: timestamp(now),
    contentHash,
  };
  if (fact.scoreOfficial) requirement.scoreOfficial = fact.scoreOfficial;
  if (fact.institutionNameZh) requirement.institutionNameZh = fact.institutionNameZh;
  if (source.cycle) requirement.cycle = source.cycle;
  return requirement;
}

const reviewedGlasgowEnglishByChinese = new Map([
  ['鞍山师范学院', 'Anshan Normal University'],
]);
const reviewedGlasgowEnglishCollisions = new Set(['taizhou university', 'wuyi university']);

function normalizedGlasgowEnglishName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/&/gu, ' and ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function isOneWordEnglishName(value) {
  return /^[A-Za-z]+$/u.test(String(value ?? '').trim());
}

export function repairGlasgowBilingualPdfNames(rawFacts, institutions) {
  const ChineseNamesByEnglish = new Map();
  for (const fact of rawFacts) {
    const english = normalizedInstitutionName(fact.institutionOfficial);
    const Chinese = normalizedChineseInstitutionName(fact.institutionNameZh);
    if (!english || !Chinese) continue;
    ChineseNamesByEnglish.set(english, new Set([...(ChineseNamesByEnglish.get(english) ?? []), Chinese]));
  }

  const repairedFacts = rawFacts.map((fact) => {
    const english = normalizedInstitutionName(fact.institutionOfficial);
    const Chinese = normalizedChineseInstitutionName(fact.institutionNameZh);
    if (!Chinese || (ChineseNamesByEnglish.get(english)?.size ?? 0) < 2) return fact;
    const record = institutions.find((institution) => normalizedChineseInstitutionName(institution.nameZh) === Chinese);
    if (!record) return fact;
    const reviewedAlias = record.aliases.find((alias) => (
      normalizedInstitutionName(alias) !== english
      && alias.trim().split(/\s+/u).length > 1
      && !/\sAKA\s/iu.test(alias)
    ));
    const preferredName = reviewedGlasgowEnglishByChinese.get(record.nameZh) ?? reviewedAlias ?? record.nameEn;
    if (preferredName && record.nameEn !== preferredName) {
      const previousNameEn = record.nameEn;
      record.nameEn = preferredName;
      if (reviewedAlias === preferredName) record.aliases = record.aliases.filter((alias) => alias !== reviewedAlias);
      appendAlias(record, previousNameEn);
    }
    return { ...fact, institutionOfficial: preferredName };
  });

  const ChineseNamesByRepairedEnglish = new Map();
  for (const fact of repairedFacts) {
    const english = normalizedGlasgowEnglishName(fact.institutionOfficial);
    const Chinese = normalizedChineseInstitutionName(fact.institutionNameZh);
    if (!english || !Chinese) continue;
    ChineseNamesByRepairedEnglish.set(english, new Set([...(ChineseNamesByRepairedEnglish.get(english) ?? []), Chinese]));
  }

  for (const fact of repairedFacts) {
    const Chinese = normalizedChineseInstitutionName(fact.institutionNameZh);
    if (!Chinese) continue;
    const record = institutions.find((institution) => normalizedChineseInstitutionName(institution.nameZh) === Chinese);
    if (!record) continue;
    const correctName = fact.institutionOfficial.trim();
    const reviewedRequiredAliases = new Set((reviewedRequiredInstitutionAliases.get(record.id) ?? [])
      .map((alias) => normalizedGlasgowEnglishName(alias)));
    const isBrokenHistoricName = (name) => {
      const english = normalizedGlasgowEnglishName(name);
      if (reviewedRequiredAliases.has(english)) return false;
      const ChineseNames = ChineseNamesByRepairedEnglish.get(english) ?? new Set();
      return isOneWordEnglishName(name)
        || (!reviewedGlasgowEnglishCollisions.has(english) && [...ChineseNames].some((nameChinese) => nameChinese !== Chinese));
    };

    if (isBrokenHistoricName(record.nameEn)) record.nameEn = correctName;
    record.aliases = record.aliases.filter((alias) => (
      !isBrokenHistoricName(alias)
      && normalizedGlasgowEnglishName(alias) !== normalizedGlasgowEnglishName(record.nameEn)
    ));
  }

  return repairedFacts;
}

async function extractRegisteredFacts(source, response, { institutions, now }) {
  let rawFacts;
  const expectedKind = source.parser.mode === 'pdf-text' ? 'pdf' : 'html';
  const sourceContent = await readAndHashSourceContent(response, response.url || source.url, expectedKind);
  const { contentHash } = sourceContent;
  if (['html-table', 'html-list', 'html-grouped-items'].includes(source.parser.mode)) {
    rawFacts = await extractHtmlFacts(source.parser, sourceContent.text);
  } else if (source.parser.mode === 'pdf-text') {
    rawFacts = await extractPdfFacts(source.parser, sourceContent.bytes);
  } else {
    return [];
  }

  rawFacts = rawFacts.map(correctedReviewedParserArtifactFact);
  if (source.id === 'glasgow-china') rawFacts = repairGlasgowBilingualPdfNames(rawFacts, institutions);

  const rawFactsForSource = source.parser.dedupeExactRows
    ? rawFacts.filter((fact, index) => index === rawFacts.findIndex((candidate) => (
      candidate.institutionOfficial === fact.institutionOfficial
      && candidate.institutionNameZh === fact.institutionNameZh
      && candidate.tierOfficial === fact.tierOfficial
      && candidate.scoreOfficial === fact.scoreOfficial
    )))
    : rawFacts;
  const completedFacts = rawFactsForSource.map((fact) => completeRequirementFact(fact, source, institutions, now, contentHash));
  const factsByBaseId = new Map();
  for (const fact of completedFacts) {
    factsByBaseId.set(fact.id, [...(factsByBaseId.get(fact.id) ?? []), fact]);
  }
  const factsWithStableRowIds = [...factsByBaseId.values()].flatMap((facts) => {
    if (facts.length === 1) return facts;

    const evidenceGroups = new Map();
    for (const fact of facts) {
      const evidenceKey = [fact.tierOfficial, fact.scoreOfficial ?? ''].join('\u0000');
      evidenceGroups.set(evidenceKey, [...(evidenceGroups.get(evidenceKey) ?? []), fact]);
    }
    const retainedFacts = [...evidenceGroups.values()].flatMap((matchingEvidence) => {
      if (matchingEvidence.length === 1) return matchingEvidence;

      // A provider may repeat one rule with alternate English spellings. That
      // is one piece of evidence, not multiple list rows. Distinct official
      // Chinese names preserve reviewed historical/current rows after their
      // identities have been reconciled to one canonical institution.
      const ChineseNames = new Set(matchingEvidence
        .map((fact) => normalizedChineseInstitutionName(fact.institutionNameZh)));
      return ChineseNames.size <= 1 ? [matchingEvidence[0]] : matchingEvidence;
    });
    if (retainedFacts.length === 1) return retainedFacts;

    return retainedFacts.map((fact) => {
      const rowDiscriminator = [
        fact.institutionOfficial,
        fact.institutionNameZh ?? '',
        fact.tierOfficial,
        fact.scoreOfficial ?? '',
      ].join('\u0000');
      return { ...fact, id: requirementFactId(source.id, fact.institutionId, rowDiscriminator) };
    });
  });
  return factsWithStableRowIds.filter((fact, index) => (
    index === factsWithStableRowIds.findIndex((candidate) => candidate.id === fact.id)
  ));
}

function fetchHealth(response) {
  return temporaryHttpStatuses.has(response.status) ? 'temporary-error' : 'unavailable';
}

export async function syncRegisteredSources(options = {}) {
  const paths = sourcePaths(options);
  const sources = options.sources ?? await readJson(paths.sourcesPath);
  const loadedInstitutions = options.institutions ?? await readJson(paths.institutionsPath);
  const loadedRequirements = options.requirements ?? await readJson(paths.requirementsPath);
  const reviewedRegistry = reconcileReviewedInstitutionRegistry(loadedInstitutions, loadedRequirements);
  let institutions = reviewedRegistry.institutions;
  let requirements = reviewedRegistry.requirements;
  const status = { ...(options.status ?? await readJson(paths.statusPath)) };
  const anomalies = [];
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const extractFacts = options.extractFacts ?? extractRegisteredFacts;
  const wait = options.wait ?? defaultWait;
  const minimumGapMs = options.minimumGapMs ?? 600;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 12_000;
  let acceptedUpdate = false;
  let acceptedInstitutionUpdate = JSON.stringify(institutions) !== JSON.stringify(loadedInstitutions);

  const orderedSources = sources
    .map((source, index) => ({ source, index }))
    .sort((left, right) => (
      Number(bilingualRegistryProviderIds.has(right.source.id)) - Number(bilingualRegistryProviderIds.has(left.source.id))
      || left.index - right.index
    ));

  for (const [index, { source }] of orderedSources.entries()) {
    if (index > 0) await wait(minimumGapMs);
    const previousStatus = status[source.id];

    if (source.institutionRule?.type !== 'none') {
      const ruleDecision = await verifyInstitutionRuleSource(source, fetchImpl, fetchTimeoutMs);
      if (!ruleDecision.accepted) {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: ruleDecision.health,
          error: ruleDecision.error,
          httpStatus: ruleDecision.httpStatus,
          finalUrl: ruleDecision.finalUrl ?? previousStatus?.finalUrl,
        });
        if (ruleDecision.health !== 'temporary-error') {
          anomalies.push(anomaly(source, ruleDecision.reason, now, {
            ruleSourceUrl: source.institutionRule.verification?.url,
            ...(ruleDecision.httpStatus ? { httpStatus: ruleDecision.httpStatus } : {}),
            ...(ruleDecision.missingRequiredText ? { missingRequiredText: ruleDecision.missingRequiredText } : {}),
          }));
        }
        continue;
      }
    }

    if (source.parser.mode === 'link-only') {
      const checked = await checkSource(source, fetchImpl, previousStatus, typeof now === 'function' ? now() : now);
      if (checked.health === 'changed' && checked.observedContentHash) {
        const { observedContentHash, ...accepted } = checked;
        status[source.id] = {
          ...accepted,
          health: checked.finalUrl && checked.finalUrl !== source.url ? 'redirected' : 'ok',
          contentHash: observedContentHash,
          consecutiveFailures: 0,
        };
      } else {
        status[source.id] = checked;
      }
      continue;
    }

    let response;
    try {
      response = await fetchWithTimeout(fetchImpl, source.url, {
        headers: { 'user-agent': 'Xiaoying-University-Directory/0.1 (+guarded official source synchronisation)' },
        redirect: 'follow',
      }, fetchTimeoutMs);
    } catch (error) {
      status[source.id] = sourceStatus(source, previousStatus, now, {
        health: 'temporary-error',
        error: error instanceof Error ? error.message : 'unknown error',
        finalUrl: previousStatus?.finalUrl,
      });
      continue;
    }

    if (!response.ok) {
      const health = fetchHealth(response);
      status[source.id] = sourceStatus(source, previousStatus, now, { health, httpStatus: response.status, finalUrl: response.url || source.url });
      if (health !== 'temporary-error') anomalies.push(anomaly(source, 'fetch-unavailable', now, { httpStatus: response.status }));
      continue;
    }

    try {
      const candidateInstitutions = institutions.map((institution) => ({
        ...institution,
        aliases: [...institution.aliases],
      }));
      const nextFacts = await extractFacts(source, response, { institutions: candidateInstitutions, now });
      const guard = { ...source.parser.guard, sourceId: source.id, universityId: source.universityId };
      const previousFacts = requirements.filter((fact) => fact.sourceId === source.id);
      const decision = decideSourceUpdate(previousFacts, nextFacts, guard);
      if (!decision.accepted) {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: 'changed',
          httpStatus: response.status,
          finalUrl: response.url || source.url,
        });
        anomalies.push(anomaly(source, decision.reason, now));
        continue;
      }

      const firstSourceIndex = requirements.findIndex((fact) => fact.sourceId === source.id);
      const beforeSource = requirements.slice(0, firstSourceIndex === -1 ? requirements.length : firstSourceIndex)
        .filter((fact) => fact.sourceId !== source.id);
      const afterSource = requirements.slice(firstSourceIndex === -1 ? requirements.length : firstSourceIndex)
        .filter((fact) => fact.sourceId !== source.id);
      const candidateRequirements = [...beforeSource, ...nextFacts, ...afterSource];
      const candidateInstitutionErrors = candidateInstitutionValidationErrors(candidateInstitutions, candidateRequirements);
      if (candidateInstitutionErrors.length > 0) {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: 'changed',
          httpStatus: response.status,
          finalUrl: response.url || source.url,
        });
        anomalies.push(anomaly(source, 'candidate-institution-validation-failed', now, { validationErrors: candidateInstitutionErrors }));
        continue;
      }
      if (new Set(candidateRequirements.map((fact) => fact.id)).size !== candidateRequirements.length) {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: 'changed',
          httpStatus: response.status,
          finalUrl: response.url || source.url,
        });
        anomalies.push(anomaly(source, 'duplicate-fact-ids', now));
        continue;
      }
      if (!validateRequirements(candidateRequirements)) {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: 'changed',
          httpStatus: response.status,
          finalUrl: response.url || source.url,
        });
        anomalies.push(anomaly(source, 'candidate-validation-failed', now, { validationErrors: validateRequirements.errors }));
        continue;
      }

      requirements = candidateRequirements;
      if (JSON.stringify(candidateInstitutions) !== JSON.stringify(institutions)) acceptedInstitutionUpdate = true;
      institutions = candidateInstitutions;
      acceptedUpdate = true;
      status[source.id] = sourceStatus(source, previousStatus, now, {
        health: response.redirected ? 'redirected' : 'ok',
        httpStatus: response.status,
        finalUrl: response.url || source.url,
        lastSuccessfulAt: timestamp(now),
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
        contentHash: nextFacts[0]?.contentHash ?? previousStatus?.contentHash,
        observedContentHash: undefined,
        consecutiveFailures: 0,
        lastAttemptError: undefined,
        error: undefined,
      });
    } catch (error) {
      const parserCode = error && typeof error === 'object' ? error.code : undefined;
      if (parserCode === 'UNKNOWN_ENGLISH_ONLY_INSTITUTION' || parserCode === 'AMBIGUOUS_ENGLISH_ONLY_INSTITUTION') {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: 'changed',
          httpStatus: response.status,
          finalUrl: response.url || source.url,
          error: error instanceof Error ? error.message : 'unknown institution',
        });
        anomalies.push(anomaly(source, parserCode === 'AMBIGUOUS_ENGLISH_ONLY_INSTITUTION'
          ? 'ambiguous-english-only-institution'
          : 'unknown-english-only-institution', now));
        continue;
      }
      if (typeof parserCode === 'string' && /^(PARSER|PDF)_/u.test(parserCode)) {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: 'changed',
          httpStatus: response.status,
          finalUrl: response.url || source.url,
          error: error instanceof Error ? error.message : 'parser error',
        });
        anomalies.push(anomaly(source, 'parser-error', now, { parserCode }));
        continue;
      }
      status[source.id] = sourceStatus(source, previousStatus, now, {
        health: 'changed',
        httpStatus: response.status,
        finalUrl: response.url || source.url,
        error: error instanceof Error ? error.message : 'unknown error',
      });
      anomalies.push(anomaly(source, 'extraction-error', now));
    }
  }

  if (acceptedUpdate && acceptedInstitutionUpdate) {
    await writeRequirementsAndInstitutionsAtomically(paths, requirements, institutions, options);
  } else if (acceptedUpdate) {
    await writeJsonAtomically(paths.requirementsPath, requirements);
  }
  await writeJsonAtomically(paths.statusPath, status);
  await writeJsonAtomically(paths.anomaliesPath, anomalies);
  return { institutions, requirements, status, anomalies };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await syncRegisteredSources();
  console.log(`Synchronized ${Object.keys(result.status).length} official source(s).`);
}
