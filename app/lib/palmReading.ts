import type { CoreTag } from './analysis';

// ── Palm V2: 상세 손금 판독 계약 (palm-reading-2) ─────────────────────────────
// 영역별로 "사진에서 관찰된 특징"과 "전통 손금의 상징적 해석"을 분리해 담는다.
// traitCandidates는 운명교집합의 CoreTag 어휘로만 제한한다 — 교집합 엔진이 다른 소스와 같은 단위로 비교한다.
// 판독하지 못한 영역은 해석·후보를 갖지 않는다. 건강·수명·미래 사건 단정은 금지 문구 검사로 걸러낸다.
// 신뢰할 수 없는 입력(모델 응답·서버 응답)은 parsePalmReading()을 반드시 거친다.

export const PALM_AREA_KEYS = ['life', 'head', 'heart', 'fate', 'palmShape', 'minorLines'] as const;
export type PalmAreaKey = (typeof PALM_AREA_KEYS)[number];

export const PALM_AREA_LABELS: Record<PalmAreaKey, string> = {
  life: '생명선',
  head: '두뇌선',
  heart: '감정선',
  fate: '운명선',
  palmShape: '손바닥 형태',
  minorLines: '보조선',
};

export const PALM_TRAIT_VOCAB: readonly CoreTag[] = [
  '창의적', '분석적', '감성적', '실용적', '사교적', '독립적', '직관적', '체계적', '열정적', '포용적',
];

export type PalmConfidence = 'high' | 'medium' | 'low';
export const PALM_CONFIDENCES: readonly PalmConfidence[] = ['high', 'medium', 'low'];

export type PalmUsability = 'usable' | 'partial' | 'unusable';

export type PalmArea =
  | {
      status: 'observed';
      observedFeatures: string[];   // 사진에서 보이는 사실 (모양·길이·위치·갈래 등)
      interpretation: string;       // 전통 손금의 상징적 해석 (사실 단정 아님)
      confidence: PalmConfidence;   // 관찰 신뢰도
      limitations: string[];        // 판독 한계
      traitCandidates: CoreTag[];   // 교집합 비교용 의미 후보 (최대 2개)
    }
  | { status: 'unreadable'; limitations: string[] };

export type PalmReading = {
  version: 2;
  quality: { usability: PalmUsability; summary: string };
  areas: Record<PalmAreaKey, PalmArea>;
  extraction: { adapterVersion: string; modelRevision: string; promptVersion: string };
};

export const PALM_LIMITS = {
  features: 4, featureChars: 90,
  interpretationChars: 220,
  limitations: 3, limitationChars: 90,
  traits: 2,
  summaryChars: 120,
} as const;

// 사실처럼 단정하면 안 되는 주제. 해석 문장에 나오면 그 해석을 보수적 문구로 바꾼다.
const FORBIDDEN = /수명|단명|장수|사망|죽음|죽을|질병|질환|암에|병에 걸|건강이 나빠|사고를 당|사고가 날|이혼|파산|불임|임신/;
export const PALM_SAFE_INTERPRETATION = '이 영역은 상징적 해석을 생략했습니다. 관찰된 특징만 참고해 주세요.';

export class PalmReadingContractError extends Error {
  constructor(message: string) {
    super(`palm reading contract: ${message}`);
    this.name = 'PalmReadingContractError';
  }
}

const fail = (m: string): never => { throw new PalmReadingContractError(m); };

function exact(input: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail(`${path} must be an object`);
  const obj = input as Record<string, unknown>;
  const actual = Object.keys(obj).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
    fail(`${path} must have exactly [${expected.join(', ')}]`);
  }
  return obj;
}

function text(v: unknown, path: string, max: number, allowEmpty = false): string {
  if (typeof v !== 'string') fail(`${path} must be a string`);
  const s = (v as string).trim();
  if (!allowEmpty && s.length === 0) fail(`${path} must not be empty`);
  if (s.length > max) fail(`${path} is too long`);
  return s;
}

function texts(v: unknown, path: string, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(v)) fail(`${path} must be an array`);
  const arr = v as unknown[];
  if (arr.length > maxItems) fail(`${path} has too many items`);
  return arr.map((x, i) => text(x, `${path}[${i}]`, maxChars));
}

function parseArea(input: unknown, path: string): PalmArea {
  const status = (input as { status?: unknown } | null)?.status;
  if (status === 'unreadable') {
    const r = exact(input, path, ['status', 'limitations']);
    return { status: 'unreadable', limitations: texts(r.limitations, `${path}.limitations`, PALM_LIMITS.limitations, PALM_LIMITS.limitationChars) };
  }
  if (status !== 'observed') return fail(`${path}.status is invalid`);
  const r = exact(input, path, ['status', 'observedFeatures', 'interpretation', 'confidence', 'limitations', 'traitCandidates']);
  const observedFeatures = texts(r.observedFeatures, `${path}.observedFeatures`, PALM_LIMITS.features, PALM_LIMITS.featureChars);
  if (observedFeatures.length === 0) fail(`${path}.observedFeatures must not be empty`);
  if (!PALM_CONFIDENCES.includes(r.confidence as PalmConfidence)) fail(`${path}.confidence is invalid`);
  if (!Array.isArray(r.traitCandidates)) fail(`${path}.traitCandidates must be an array`);
  const traits = (r.traitCandidates as unknown[]).map((t, i) => {
    if (!PALM_TRAIT_VOCAB.includes(t as CoreTag)) fail(`${path}.traitCandidates[${i}] is not a CoreTag`);
    return t as CoreTag;
  });
  if (traits.length > PALM_LIMITS.traits || new Set(traits).size !== traits.length) fail(`${path}.traitCandidates invalid count`);
  let interpretation = text(r.interpretation, `${path}.interpretation`, PALM_LIMITS.interpretationChars);
  let traitCandidates = traits;
  if (FORBIDDEN.test(interpretation) || observedFeatures.some((f) => FORBIDDEN.test(f))) {
    interpretation = PALM_SAFE_INTERPRETATION;
    traitCandidates = [];
  }
  return {
    status: 'observed',
    observedFeatures,
    interpretation,
    confidence: r.confidence as PalmConfidence,
    limitations: texts(r.limitations, `${path}.limitations`, PALM_LIMITS.limitations, PALM_LIMITS.limitationChars),
    traitCandidates,
  };
}

export function parsePalmReading(input: unknown): PalmReading {
  const b = exact(input, 'reading', ['version', 'quality', 'areas', 'extraction']);
  if (b.version !== 2) fail('reading.version must be 2');
  const q = exact(b.quality, 'quality', ['usability', 'summary']);
  if (!['usable', 'partial', 'unusable'].includes(q.usability as string)) fail('quality.usability is invalid');
  const usability = q.usability as PalmUsability;
  const rawAreas = exact(b.areas, 'areas', PALM_AREA_KEYS);
  const areas = {} as Record<PalmAreaKey, PalmArea>;
  for (const k of PALM_AREA_KEYS) areas[k] = parseArea(rawAreas[k], `areas.${k}`);
  if (usability === 'unusable' && PALM_AREA_KEYS.some((k) => areas[k].status !== 'unreadable')) {
    fail('unusable image cannot have observed areas');
  }
  const e = exact(b.extraction, 'extraction', ['adapterVersion', 'modelRevision', 'promptVersion']);
  return {
    version: 2,
    quality: { usability, summary: text(q.summary, 'quality.summary', PALM_LIMITS.summaryChars, true) },
    areas,
    extraction: {
      adapterVersion: text(e.adapterVersion, 'extraction.adapterVersion', 80),
      modelRevision: text(e.modelRevision, 'extraction.modelRevision', 80),
      promptVersion: text(e.promptVersion, 'extraction.promptVersion', 80),
    },
  };
}

// 교집합에 참여시키는 Palm 의미 후보: 판독된 영역 중 confidence가 low가 아닌 것만, 지지 영역 수 → 신뢰도 순으로 최대 3개.
export type PalmTraitSupport = { trait: CoreTag; areas: PalmAreaKey[] };

export function palmTraitSupport(reading: PalmReading): PalmTraitSupport[] {
  if (reading.quality.usability === 'unusable') return [];
  const score = new Map<CoreTag, { areas: PalmAreaKey[]; weight: number }>();
  for (const k of PALM_AREA_KEYS) {
    const a = reading.areas[k];
    if (a.status !== 'observed' || a.confidence === 'low') continue;
    for (const t of a.traitCandidates) {
      const s = score.get(t) ?? { areas: [], weight: 0 };
      s.areas.push(k);
      s.weight += a.confidence === 'high' ? 2 : 1;
      score.set(t, s);
    }
  }
  return [...score.entries()]
    .sort((x, y) => y[1].weight - x[1].weight || PALM_TRAIT_VOCAB.indexOf(x[0]) - PALM_TRAIT_VOCAB.indexOf(y[0]))
    .slice(0, 3)
    .map(([trait, s]) => ({ trait, areas: s.areas }));
}
