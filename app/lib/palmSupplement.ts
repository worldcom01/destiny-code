import type { CoreTag } from './analysis';
import {
  PALM_LINE_KEYS,
  parsePalmObservationBundle,
  type PalmLineKey,
  type PalmObservationBundle,
} from './palmObservation';

// ── Palm Phase 1C: 기본 분석과 분리된 보조 기록 계약 ─────────────────────────
// (docs/ai/CODEX_REVIEW.md "Palm Phase 1C", DECISIONS AD-007)
// 관찰(bundle) → 결정적 상징적 해석(interpretation) → 저장된 coreTags와의 보조 비교(comparison).
// AnalysisSnapshot에 넣지 않고, 기존 CoreTags/trace/convergence/Identity를 바꾸지 않는다.
// CoreTag는 비교용 어휘로만 쓴다 — Palm이 result.coreTags에 추가되는 일은 없다.
// 사진·미리보기·파일·해시·EXIF는 이 계약에 담지 않는다.

export const PALM_SUPPLEMENT_VERSION = 1 as const;
export const PALM_INTERPRETATION_RULE_VERSION = 'palm-symbolic-1' as const;
export const PALM_COMPARISON_RULE_VERSION = 'palm-comparison-1' as const;
export const PALM_PROCESSING_NOTICE_VERSION = 'palm-processing-1' as const;

export type PalmSignalAttribute = 'curvature' | 'continuity';
export type PalmSignalValue = 'straight' | 'curved' | 'continuous' | 'interrupted';

export type PalmInterpretationSignal = {
  id: string;                    // ruleId에서 결정적으로 생성 — 난수/시각 없음
  line: PalmLineKey;
  observedFeature: { attribute: PalmSignalAttribute; value: PalmSignalValue };
  interpretationKey: string;
  ruleId: string;                // 예: palm.symbolic.head-straight@1
  basis: 'symbolic';
  trait?: CoreTag;               // 비교용 어휘. 실제 result.coreTags에 추가 금지
  text: string;                  // 고정 저작 문장. GPT 생성 금지
  evidenceIds: string[];         // 같은 supplement 안 buildPalmEvidence ID (palm:line:<line>:<attribute>)
};

export type PalmInterpretation = {
  version: 1;
  ruleVersion: typeof PALM_INTERPRETATION_RULE_VERSION;
  signals: PalmInterpretationSignal[];
};

export type PalmComparisonKind = 'MATCH' | 'TENSION' | 'UNIQUE';

export type PalmComparisonItem = {
  id: string;
  signalId: string;
  kind: PalmComparisonKind;
  counterpart?: CoreTag;
  ruleId: string;
  text: string;                  // 당시 표시한 완성 문장을 그대로 보존
};

export type SupplementaryComparison = {
  version: 1;
  ruleVersion: typeof PALM_COMPARISON_RULE_VERSION;
  basis: 'snapshot-coreTags' | 'unavailable';
  baseTraits: CoreTag[];         // 비교 당시 저장된 coreTags의 복사본
  items: PalmComparisonItem[];
};

// 연결 키: snapshot은 analysisId, legacy 저장 결과는 savedId. Destiny Code·닉네임·입력 폼은 쓰지 않는다.
export type PalmBaseRef = { kind: 'snapshot' | 'legacy'; id: string };

export type PalmSupplement = {
  version: typeof PALM_SUPPLEMENT_VERSION;
  id: string;                    // 완료한 시도 ID (crypto UUID)
  baseRef: PalmBaseRef;
  createdAt: string;
  bundle: PalmObservationBundle;
  interpretation: PalmInterpretation;
  comparison: SupplementaryComparison;
  processingNotice: { version: typeof PALM_PROCESSING_NOTICE_VERSION; acceptedAt: string };
  retention: 'derived-local-only';
};

export function sameBaseRef(a: PalmBaseRef | null | undefined, b: PalmBaseRef | null | undefined): boolean {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

// ── 저장된 supplement 검증 (localStorage는 신뢰하지 않는다) ─────────────────
// 정확한 key 집합, 알려진 버전만 허용. 모르는 버전·손상은 예외 — 호출부가 보조 결과만 숨긴다.

export class PalmSupplementContractError extends Error {
  constructor(message: string) {
    super(`palm supplement contract: ${message}`);
    this.name = 'PalmSupplementContractError';
  }
}

const fail = (message: string): never => {
  throw new PalmSupplementContractError(message);
};

const CORE_TAGS: readonly CoreTag[] = ['창의적', '분석적', '감성적', '실용적', '사교적', '독립적', '직관적', '체계적', '열정적', '포용적'];

function obj(input: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail(`${path} must be an object`);
  const o = input as Record<string, unknown>;
  for (const k of required) if (!(k in o)) fail(`${path}.${k} is required`);
  for (const k of Object.keys(o)) if (!required.includes(k) && !optional.includes(k)) fail(`${path} has unknown field ${k}`);
  return o;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 400) fail(`${path} must be a non-empty string`);
  return v as string;
}

function isoDate(v: unknown, path: string): string {
  const s = str(v, path);
  if (Number.isNaN(Date.parse(s))) fail(`${path} must be an ISO date`);
  return s;
}

function tag(v: unknown, path: string): CoreTag {
  if (!CORE_TAGS.includes(v as CoreTag)) fail(`${path} must be a CoreTag`);
  return v as CoreTag;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(v as T)) fail(`${path} has invalid value`);
  return v as T;
}

function arr(v: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) fail(`${path} must be an array (≤ ${max})`);
  return v as unknown[];
}

export function parsePalmBaseRef(input: unknown, path = 'baseRef'): PalmBaseRef {
  const r = obj(input, path, ['kind', 'id']);
  return { kind: oneOf(r.kind, ['snapshot', 'legacy'] as const, `${path}.kind`), id: str(r.id, `${path}.id`) };
}

function parseSignal(input: unknown, path: string): PalmInterpretationSignal {
  const s = obj(input, path, ['id', 'line', 'observedFeature', 'interpretationKey', 'ruleId', 'basis', 'text', 'evidenceIds'], ['trait']);
  const f = obj(s.observedFeature, `${path}.observedFeature`, ['attribute', 'value']);
  const signal: PalmInterpretationSignal = {
    id: str(s.id, `${path}.id`),
    line: oneOf(s.line, PALM_LINE_KEYS, `${path}.line`),
    observedFeature: {
      attribute: oneOf(f.attribute, ['curvature', 'continuity'] as const, `${path}.observedFeature.attribute`),
      value: oneOf(f.value, ['straight', 'curved', 'continuous', 'interrupted'] as const, `${path}.observedFeature.value`),
    },
    interpretationKey: str(s.interpretationKey, `${path}.interpretationKey`),
    ruleId: str(s.ruleId, `${path}.ruleId`),
    basis: oneOf(s.basis, ['symbolic'] as const, `${path}.basis`),
    text: str(s.text, `${path}.text`),
    evidenceIds: arr(s.evidenceIds, `${path}.evidenceIds`, 4).map((e, i) => str(e, `${path}.evidenceIds[${i}]`)),
  };
  if (s.trait !== undefined) signal.trait = tag(s.trait, `${path}.trait`);
  return signal;
}

function parseInterpretation(input: unknown): PalmInterpretation {
  const i = obj(input, 'interpretation', ['version', 'ruleVersion', 'signals']);
  if (i.version !== 1) fail('interpretation.version must be 1');
  return {
    version: 1,
    ruleVersion: oneOf(i.ruleVersion, [PALM_INTERPRETATION_RULE_VERSION] as const, 'interpretation.ruleVersion'),
    signals: arr(i.signals, 'interpretation.signals', PALM_LINE_KEYS.length).map((s, k) => parseSignal(s, `interpretation.signals[${k}]`)),
  };
}

function parseComparison(input: unknown): SupplementaryComparison {
  const c = obj(input, 'comparison', ['version', 'ruleVersion', 'basis', 'baseTraits', 'items']);
  if (c.version !== 1) fail('comparison.version must be 1');
  const basis = oneOf(c.basis, ['snapshot-coreTags', 'unavailable'] as const, 'comparison.basis');
  const items = arr(c.items, 'comparison.items', 16).map((raw, k) => {
    const path = `comparison.items[${k}]`;
    const it = obj(raw, path, ['id', 'signalId', 'kind', 'ruleId', 'text'], ['counterpart']);
    const item: PalmComparisonItem = {
      id: str(it.id, `${path}.id`),
      signalId: str(it.signalId, `${path}.signalId`),
      kind: oneOf(it.kind, ['MATCH', 'TENSION', 'UNIQUE'] as const, `${path}.kind`),
      ruleId: str(it.ruleId, `${path}.ruleId`),
      text: str(it.text, `${path}.text`),
    };
    if (it.counterpart !== undefined) item.counterpart = tag(it.counterpart, `${path}.counterpart`);
    return item;
  });
  if (basis === 'unavailable' && items.length > 0) fail('comparison without basis cannot have items');
  return {
    version: 1,
    ruleVersion: oneOf(c.ruleVersion, [PALM_COMPARISON_RULE_VERSION] as const, 'comparison.ruleVersion'),
    basis,
    baseTraits: arr(c.baseTraits, 'comparison.baseTraits', CORE_TAGS.length).map((t, k) => tag(t, `comparison.baseTraits[${k}]`)),
    items,
  };
}

export function parsePalmSupplement(input: unknown): PalmSupplement {
  const s = obj(input, 'supplement', ['version', 'id', 'baseRef', 'createdAt', 'bundle', 'interpretation', 'comparison', 'processingNotice', 'retention']);
  if (s.version !== PALM_SUPPLEMENT_VERSION) fail('supplement.version is not supported');
  let bundle: PalmObservationBundle;
  try {
    bundle = parsePalmObservationBundle(s.bundle);
  } catch {
    return fail('supplement.bundle is invalid');
  }
  const n = obj(s.processingNotice, 'processingNotice', ['version', 'acceptedAt']);
  return {
    version: PALM_SUPPLEMENT_VERSION,
    id: str(s.id, 'supplement.id'),
    baseRef: parsePalmBaseRef(s.baseRef),
    createdAt: isoDate(s.createdAt, 'supplement.createdAt'),
    bundle,
    interpretation: parseInterpretation(s.interpretation),
    comparison: parseComparison(s.comparison),
    processingNotice: {
      version: oneOf(n.version, [PALM_PROCESSING_NOTICE_VERSION] as const, 'processingNotice.version'),
      acceptedAt: isoDate(n.acceptedAt, 'processingNotice.acceptedAt'),
    },
    retention: oneOf(s.retention, ['derived-local-only'] as const, 'supplement.retention'),
  };
}
