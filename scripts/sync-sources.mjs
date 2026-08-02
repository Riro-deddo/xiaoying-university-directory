import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseHTML } from 'linkedom';
import { extractHtmlFacts } from './extractors/html.mjs';
import { extractPdfFacts, extractPdfText } from './extractors/pdf.mjs';
import { normalizeExtractedFact } from './extractors/normalize.mjs';
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

function applyReviewedInstitutionMigrations(requirements) {
  return requirements.map((fact) => {
    const institutionId = reviewedInstitutionIdMigrations.get(fact.institutionId);
    return institutionId ? { ...fact, institutionId } : fact;
  });
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
  return {
    sourceId: source.id,
    checkedAt: timestamp(now),
    lastSuccessfulAt: previous?.lastSuccessfulAt,
    ...patch,
  };
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
      if (conflictingEnglishMatches.length === 0) appendAlias(ChineseMatch, rawFact.institutionOfficial);
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

async function extractRegisteredFacts(source, response, { institutions, now }) {
  let rawFacts;
  let contentHash;
  if (['html-table', 'html-list', 'html-grouped-items'].includes(source.parser.mode)) {
    const html = await response.text();
    rawFacts = await extractHtmlFacts(source.parser, html);
    contentHash = createHash('sha256').update(html).digest('hex');
  } else if (source.parser.mode === 'pdf-text') {
    const bytes = new Uint8Array(await response.arrayBuffer());
    contentHash = createHash('sha256').update(bytes).digest('hex');
    rawFacts = await extractPdfFacts(source.parser, bytes);
  } else {
    return [];
  }

  const rawFactsForSource = source.parser.dedupeExactRows
    ? rawFacts.filter((fact, index) => index === rawFacts.findIndex((candidate) => (
      candidate.institutionOfficial === fact.institutionOfficial
      && candidate.institutionNameZh === fact.institutionNameZh
      && candidate.tierOfficial === fact.tierOfficial
      && candidate.scoreOfficial === fact.scoreOfficial
    )))
    : rawFacts;
  const completedFacts = rawFactsForSource.map((fact) => completeRequirementFact(fact, source, institutions, now, contentHash));
  return completedFacts.filter((fact, index) => index === completedFacts.findIndex((candidate) => candidate.id === fact.id));
}

function fetchHealth(response) {
  return temporaryHttpStatuses.has(response.status) ? 'temporary-error' : 'unavailable';
}

export async function syncRegisteredSources(options = {}) {
  const paths = sourcePaths(options);
  const sources = options.sources ?? await readJson(paths.sourcesPath);
  let institutions = options.institutions ?? await readJson(paths.institutionsPath);
  let requirements = applyReviewedInstitutionMigrations(options.requirements ?? await readJson(paths.requirementsPath));
  const status = { ...(options.status ?? await readJson(paths.statusPath)) };
  const anomalies = [];
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const extractFacts = options.extractFacts ?? extractRegisteredFacts;
  const wait = options.wait ?? defaultWait;
  const minimumGapMs = options.minimumGapMs ?? 600;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 12_000;
  let acceptedUpdate = false;
  let acceptedInstitutionUpdate = false;

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
          ...(ruleDecision.error ? { error: ruleDecision.error } : {}),
          ...(ruleDecision.httpStatus ? { httpStatus: ruleDecision.httpStatus } : {}),
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
      status[source.id] = await checkSource(source, fetchImpl, previousStatus, typeof now === 'function' ? now() : now);
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
      const candidateInstitutions = [...institutions];
      const nextFacts = await extractFacts(source, response, { institutions: candidateInstitutions, now });
      const guard = { ...source.parser.guard, sourceId: source.id, universityId: source.universityId };
      const previousFacts = requirements.filter((fact) => fact.sourceId === source.id);
      const decision = decideSourceUpdate(previousFacts, nextFacts, guard);
      if (!decision.accepted) {
        status[source.id] = sourceStatus(source, previousStatus, now, { health: 'changed', finalUrl: response.url || source.url });
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
        status[source.id] = sourceStatus(source, previousStatus, now, { health: 'changed', finalUrl: response.url || source.url });
        anomalies.push(anomaly(source, 'candidate-institution-validation-failed', now, { validationErrors: candidateInstitutionErrors }));
        continue;
      }
      if (new Set(candidateRequirements.map((fact) => fact.id)).size !== candidateRequirements.length) {
        status[source.id] = sourceStatus(source, previousStatus, now, { health: 'changed', finalUrl: response.url || source.url });
        anomalies.push(anomaly(source, 'duplicate-fact-ids', now));
        continue;
      }
      if (!validateRequirements(candidateRequirements)) {
        status[source.id] = sourceStatus(source, previousStatus, now, { health: 'changed', finalUrl: response.url || source.url });
        anomalies.push(anomaly(source, 'candidate-validation-failed', now, { validationErrors: validateRequirements.errors }));
        continue;
      }

      requirements = candidateRequirements;
      if (candidateInstitutions.length !== institutions.length) acceptedInstitutionUpdate = true;
      institutions = candidateInstitutions;
      acceptedUpdate = true;
      status[source.id] = sourceStatus(source, previousStatus, now, {
        health: response.redirected ? 'redirected' : 'ok',
        finalUrl: response.url || source.url,
        lastSuccessfulAt: timestamp(now),
      });
    } catch (error) {
      const parserCode = error && typeof error === 'object' ? error.code : undefined;
      if (parserCode === 'UNKNOWN_ENGLISH_ONLY_INSTITUTION' || parserCode === 'AMBIGUOUS_ENGLISH_ONLY_INSTITUTION') {
        status[source.id] = sourceStatus(source, previousStatus, now, {
          health: 'changed',
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
          error: error instanceof Error ? error.message : 'parser error',
        });
        anomalies.push(anomaly(source, 'parser-error', now, { parserCode }));
        continue;
      }
      status[source.id] = sourceStatus(source, previousStatus, now, {
        health: 'changed',
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
