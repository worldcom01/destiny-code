// Local UI compatibility checks. No providers, network or storage migration.
// node --import tsx scripts/regression-result-first.tsx [--fixtures=/tmp/destiny-result-fixtures.json]
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { analyzeDestiny, TAROT_DATA, type AnalysisOutput, type AnalysisSnapshot } from '../app/lib/analysis';
import { parsePalmReading } from '../app/lib/palmReading';
import { resultPresentation, splitSentences } from '../app/lib/resultPresentation';
import ResultFirst from '../app/components/ResultFirst';

const base = analyzeDestiny('1990-05-15', '14:30', 'INTJ', 'female', 'A', TAROT_DATA[0], 37.5665, 126.978);
const noMbti = analyzeDestiny('1985-12-01', '', '', 'female', 'B', TAROT_DATA[5]);
const unreadable = { status: 'unreadable', limitations: ['판독 어려움'] };
const palm = parsePalmReading({ version: 2, quality: { usability: 'usable', summary: '로컬 검증용 합성 판독' }, extraction: { adapterVersion: 'test', modelRevision: 'test', promptVersion: 'test' }, areas: {
  life: unreadable, head: { status: 'observed', observedFeatures: ['선이 길고 선명함'], interpretation: '전통 손금에서는 독립적인 사고로 읽기도 합니다.', confidence: 'high', limitations: [], traitCandidates: ['독립적', '분석적'] }, heart: unreadable, fate: unreadable, palmShape: unreadable, minorLines: unreadable,
} });
const withPalm = analyzeDestiny('1990-05-15', '14:30', 'INTJ', 'female', 'A', TAROT_DATA[0], 37.5665, 126.978, 'solar', false, palm);
const unusable = parsePalmReading({ ...palm, quality: { usability: 'unusable', summary: '로컬 검증용 판독 불가' }, areas: Object.fromEntries(Object.keys(palm.areas).map(k => [k, unreadable])) });
const withUnusable = analyzeDestiny('1990-05-15', '14:30', 'INTJ', 'female', 'A', TAROT_DATA[0], 37.5665, 126.978, 'solar', false, unusable);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const v2 = clone(base); v2.engineVersion = '2'; delete v2.identityNarrative; delete v2.intersection;
const oldIntersection = clone(base); oldIntersection.engineVersion = '3'; delete oldIntersection.identityNarrative;
for (const p of [...oldIntersection.intersection!.common, ...oldIntersection.intersection!.complements]) { delete p.score; delete p.distinctiveness; }
const { saju, zodiac, westernAstrology, mbtiTraits, bloodType, tarot, commonKeywords, detailedReading, identityStatement, archetype, tarotFlow } = base;
const legacy: AnalysisOutput = { saju, zodiac, westernAstrology, mbtiTraits, bloodType, tarot, commonKeywords, detailedReading, identityStatement, archetype, tarotFlow };
const empty = clone(base); empty.intersection = { version: 1, palmIncluded: false, sourceCount: 0, common: [], complements: [], tensions: [], palmExcludedAreas: [] };
const long = clone(base); long.archetype = '여러 관점의 근거를 차분하게 연결해 스스로의 방향을 찾아가는 독립적인 탐구자'; long.commonKeywords = [...long.commonKeywords, '아주길게이어지는키워드도화면너비안에서읽을수있어야합니다'];
const noReading = clone(base); noReading.detailedReading = { ...noReading.detailedReading, sections: [] };
const longReading = clone(base); longReading.detailedReading.sections[0] = { ...longReading.detailedReading.sections[0], content: Array.from({ length: 9 }, (_, i) => `아주 긴 검증 문장 ${i + 1}은 여러 체계의 근거를 길게 이어 붙여 줄바꿈과 레이아웃이 깨지지 않는지 확인하기 위한 합성 문장이며 "따옴표"와 금(金) 같은 표기도 포함합니다.`).join(' ') };
const cases: Record<string, AnalysisOutput> = { v4: base, noMbti, palm: withPalm, unusable: withUnusable, v2, oldIntersection, legacy, empty, long, noReading, longReading };
for (const [name, result] of Object.entries(cases)) {
  const before = JSON.stringify(result);
  const view = resultPresentation(result);
  const html = renderToStaticMarkup(<ResultFirst result={result} nickname="로컬 검증" code="DC-TEST" saveStatus="idle" shareStatus="idle" onSave={() => {}} onShare={() => {}} onReset={() => {}} />);
  assert.equal(JSON.stringify(result), before, `${name}: stored result must remain unchanged`);
  assert(html.indexOf('identity-hero') < html.indexOf('result-details'), `${name}: Identity first`);
  assert(!html.includes('<details class="result-detail" open'), `${name}: collapsed by default`);
  assert.equal((html.match(/<details class="result-detail"/g) ?? []).length, 8, `${name}: all detail sections present`);
  assert(!/\d+%/.test(html), `${name}: no percentage claims`);
  assert(!view.sources.some(s => s.source === 'tarot'), `${name}: tarot not counted`);
  assert.equal(new Set(view.sources.map(s => s.source)).size, view.sources.length);
  if (name === 'noMbti') assert(!view.sources.some(s => s.source === 'mbti'));
  if (name === 'palm') assert(view.sources.some(s => s.source === 'palm'));
  if (name === 'unusable') assert(!view.sources.some(s => s.source === 'palm'));
  if (name === 'legacy' || name === 'v2') assert(html.includes('상세 교집합 근거는 소급 생성하지 않습니다.'));
  if (['legacy', 'v2', 'empty'].includes(name)) assert.equal(view.intersectionSummary, null, `${name}: no invented summary`);
  if (view.intersectionSummary) {
    const supported = view.evidence.filter(p => new Set(p.sources.map(s => s.source)).size >= 2).slice(0, 2);
    assert(supported.length > 0);
    for (const p of supported) assert(view.intersectionSummary.includes(`‘${p.trait}’(${new Set(p.sources.map(s => s.source)).size}개 체계)`));
    assert(html.includes('class="identity-summary"'));
  }
  const heroBlock = html.split('class="identity-hero"')[1].split('id="result-convergence"')[0];
  assert((heroBlock.match(/class="result-tags"/g) ?? []).length === 1);
  const core = html.split('class="core-evidence"')[1].split('</section>')[0];
  assert.equal((core.match(/class="evidence-item"/g) ?? []).length, Math.min(view.evidence.length, 2));
  assert.equal(html.includes('data-source="palm"'), view.sources.some(s => s.source === 'palm'));
  // V1.1: 저장된 종합 분석을 첫 화면에 먼저 보여주고, 문장을 잃거나 바꾸거나 반복하지 않는다.
  const reading = view.reading;
  const sections = result.detailedReading?.sections?.filter(x => x.content?.trim()) ?? [];
  if (!sections.length) assert.equal(reading, null, `${name}: no reading → nothing invented`);
  else {
    assert(reading);
    assert.equal(`${reading.lead} ${reading.continuation}`.trim(), sections[0].content.trim().replace(/\s+/g, ' '), `${name}: lead + continuation = stored first section`);
    assert(/[.!?]$/.test(reading.lead), `${name}: lead ends on a sentence boundary`);
    const leadCount = splitSentences(reading.lead).length;
    assert(leadCount >= Math.min(3, splitSentences(sections[0].content).length) && leadCount <= 5, `${name}: lead is 3–5 sentences`);
    const esc = (t: string) => renderToStaticMarkup(<p>{t}</p>).slice(3, -4);
    const hero = html.split('class="identity-hero"')[1].split('id="result-convergence"')[0];
    assert(hero.includes(esc(reading.lead)), `${name}: AI reading in the first screen`);
    assert(html.indexOf('hero-reading') < html.indexOf('result-convergence'), `${name}: reading before the diagram`);
    assert.equal(html.split(esc(reading.lead)).length - 1, 1, `${name}: lead not repeated below`);
    for (const x of sections.slice(1)) assert.equal(html.split(esc(x.content)).length - 1, 1, `${name}: section "${x.title}" shown exactly once`);
  }
  assert(html.indexOf('save-share-section') > html.indexOf('전체 분석 보고서'));
  assert(html.indexOf('class="quick-actions"') < html.indexOf('identity-hero'), `${name}: save/share reachable above the Identity`);
  assert(html.includes('/birth-design') && html.includes('href="/compatibility"'), `${name}: next-step links retained`);
  assert((html.match(/손금 상세 해석/g) ?? []).length <= 1, `${name}: palm reading rendered once`);
  const facts = html.split('class="code-facts"')[1]?.split('</dl>')[0] ?? '';
  assert(facts.includes(result.saju.dayStem) && facts.includes(result.zodiac.sign) && facts.includes(result.tarot.name), `${name}: code summary from stored result`);
  assert.equal(facts.includes('<dt>MBTI</dt>'), !!result.mbtiTraits.type, `${name}: MBTI shown only when entered`);
  assert((html.match(/C · 교집합 패턴과 근거/g) ?? []).length === (view.model ? 1 : 0), `${name}: intersection detail rendered once`);
  console.log(`PASS: ${name}: render, immutable snapshot, source provenance, disclosure, no percentage`);
}
const unsupported = clone(base);
unsupported.intersection!.common = [{ trait: '분석적', sources: [{ source: 'saju', label: '사주', detail: '' }] }];
assert.equal(resultPresentation(unsupported).intersectionSummary, null, 'single-source stored trait does not produce intersection summary');
assert.equal(resultPresentation(base).sources.length, base.intersection!.sourceCount);
// 변경하지 않은 golden baseline을 저장 스키마 형태로 복원해 당시 결과를 그대로 그린다.
for (const version of [1, 2, 3, 4]) {
  const rows = JSON.parse(readFileSync(join(__dirname, `golden-baseline.v${version}.json`), 'utf8'));
  for (const row of rows) {
    const { output, destinyCode, ...stored } = row.result;
    const historical: AnalysisOutput = version === 1 ? output : { ...output, ...stored, schemaVersion: 2, analysisId: 'historical-fixture', createdAt: '2026-01-01T00:00:00Z' };
    const before = JSON.stringify(historical);
    const html = renderToStaticMarkup(<ResultFirst result={historical} nickname="이전 결과" code={destinyCode} saveStatus="idle" shareStatus="idle" onSave={() => {}} onShare={() => {}} onReset={() => {}} />);
    assert(html.includes(output.archetype));
    const rv = resultPresentation(historical).reading;
    assert(rv && `${rv.lead} ${rv.continuation}`.trim() === output.detailedReading.sections[0].content.trim().replace(/\s+/g, ' '), 'historical: stored reading shown without loss');
    assert.equal(JSON.stringify(historical), before);
  }
  console.log(`PASS: historical engine v${version}: ${rows.length} baseline results render without mutation`);
}
const target = process.argv.find(s => s.startsWith('--fixtures='))?.split('=')[1];
if (target) writeFileSync(target, JSON.stringify(Object.entries(cases).map(([name, result], i) => ({ id: `local-fixture-${name}`, createdAt: '2026-11-03T12:00:00Z', nickname: `검증 ${name}`, birthdate: '1990-05-15', mbti: result.mbtiTraits.type, bloodtype: result.bloodType.type, keywords: result.commonKeywords, tarotName: result.tarot.name, zodiacSign: result.zodiac.sign, resultData: 'schemaVersion' in result ? { ...result, analysisId: `local-fixture-${name}` } as AnalysisSnapshot : result, order: i }))));
console.log('PASS: Result First compatibility checks');

// 공유 API의 성공·취소 후 복사·실패를 실제 외부 전송 없이 검증한다.
async function checkSharing() {
  const { shareResult, generateShareText } = await import('../app/lib/shareEngine');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const text = generateShareText(base, '검증 v4');
  let copied = '';
  const clipboard = { writeText: async (value: string) => { copied = value; } };
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: async ({ text: value }: { text: string }) => { assert.equal(value, text); }, clipboard } });
    assert.equal(await shareResult(text), 'shared');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: async () => { throw new Error('cancel'); }, clipboard } });
    assert.equal(await shareResult(text), 'copied'); assert.equal(copied, text);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => { throw new Error('denied'); } } } });
    assert.equal(await shareResult(text), 'failed');
    console.log('PASS: share success, cancellation clipboard fallback, failure outcome');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
}
checkSharing().catch(error => { console.error(error); process.exitCode = 1; });
