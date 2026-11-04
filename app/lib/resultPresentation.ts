import { isAnalysisSnapshot, type AnalysisOutput } from './analysis';
import type { IntersectionSource } from './intersection';

// 저장된 근거만 표시한다. 과거 결과를 현재 엔진으로 다시 해석하지 않는다.
export function resultPresentation(result: AnalysisOutput) {
  const snapshot = isAnalysisSnapshot(result) ? result : null;
  const model = snapshot?.intersection;
  const order = ['saju', 'western-astrology', 'mbti', 'blood-type', 'palm'];
  const sources = new Map<string, IntersectionSource>();
  for (const pattern of [...(model?.common ?? []), ...(model?.complements ?? [])]) {
    for (const source of pattern.sources) sources.set(source.source, source);
  }
  for (const tension of model?.tensions ?? []) {
    for (const source of tension.sides.flat()) sources.set(source.source, source);
  }
  const selected = snapshot?.identitySelection?.selectedTraits ?? [];
  const common = model?.common ?? [];
  const identityEvidence = common.filter(p => selected.includes(p.trait));
  const evidence = [...identityEvidence, ...common.filter(p => !selected.includes(p.trait))].slice(0, 3);
  // A short display sentence from stored multi-source patterns only; never infer a missing trait.
  const summaryPatterns = evidence.filter(p => p.trait.trim() && new Set(p.sources.map(s => s.source)).size >= 2).slice(0, 2);
  const intersectionSummary = summaryPatterns.length
    ? `${summaryPatterns.map(p => `‘${p.trait}’(${new Set(p.sources.map(s => s.source)).size}개 체계)`).join(' · ')} 성향이 핵심 교집합으로 나타났습니다.`
    : null;
  return {
    reading: readingPresentation(result),
    snapshot,
    model,
    sources: [...sources.values()].sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source)),
    // Identity 근거가 있으면 우선 표시하고 나머지는 원래 엔진 순서를 유지한다.
    evidence,
    intersectionSummary,
  };
}

// 저장된 종합 분석(detailedReading)을 문장 단위로만 나눈다. 문장을 고치거나 중간에서 자르지 않는다.
export function splitSentences(text: string): string[] {
  return text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
}

// 첫 화면에는 첫 섹션의 앞 3~5문장, 나머지 문장과 섹션은 이어 읽기로 보낸다.
export function readingPresentation(result: AnalysisOutput) {
  const sections = (result.detailedReading?.sections ?? []).filter(s => s.content?.trim());
  const [first, ...others] = sections;
  if (!first) return null;
  const sentences = splitSentences(first.content);
  let count = Math.min(3, sentences.length);
  while (count < Math.min(5, sentences.length) && sentences.slice(0, count).join(' ').length < 200) count++;
  return {
    lead: sentences.slice(0, count).join(' '),
    leadTitle: first.title,
    continuation: sentences.slice(count).join(' '),
    sections: others,
  };
}
