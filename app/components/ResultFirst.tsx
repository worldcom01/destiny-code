'use client';

import { useId, useState, type ReactNode } from 'react';
import { ELEMENT_META, type AnalysisOutput } from '@/app/lib/analysis';
import { resultPresentation } from '@/app/lib/resultPresentation';
import type { IntersectionPattern, IntersectionSource } from '@/app/lib/intersection';
import type { ShareOutcome } from '@/app/lib/shareEngine';
import { CorePatternSummary, IntersectionDetail, PalmReadingCard } from './IntegratedResult';

export function ResultDetail({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <details className="result-detail">
    <summary><span><span className="detail-title">{title}</span>{note && <span className="detail-note">{note}</span>}</span><span className="detail-toggle" aria-hidden="true" /></summary>
    <div className="detail-body">{children}</div>
  </details>;
}

function Tags({ values }: { values: string[] }) {
  return <div className="result-tags">{values.map(value => <span key={value}>{value}</span>)}</div>;
}

// Diagram geometry is conceptual; only saved provenance determines participation and links.
function ConvergenceMap({ sources, common, evidence }: {
  sources: IntersectionSource[]; common: IntersectionPattern[]; evidence: IntersectionPattern[];
}) {
  const id = useId().replace(/:/g, '');
  const shared = new Set(common.flatMap(p => p.sources.map(s => s.source)));
  return <figure className="convergence-map" aria-label="실제 참여한 분석 체계의 교집합 시각화">
    <svg viewBox="0 0 340 310" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`${sources.map(s => s.label).join(' · ')}의 교집합`}</title>
      <desc id={`${id}-desc`}>실선은 공통 성향을 지지하는 소스, 점선은 단독 관점만 있는 소스입니다. 원의 면적과 거리는 점수나 확률이 아닙니다.</desc>
      <defs>
        <radialGradient id={`${id}-glow`}><stop stopColor="#b89be0" stopOpacity=".3"/><stop offset="1" stopColor="#8864b2" stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-ring`} x2="1" y2="1"><stop stopColor="#d5bbed" stopOpacity=".6"/><stop offset="1" stopColor="#8c66b4" stopOpacity=".14"/></linearGradient>
        <linearGradient id={`${id}-node`} x2="1" y2="1"><stop stopColor="#49335e"/><stop offset="1" stopColor="#2e203e"/></linearGradient>
      </defs>
      <circle cx="170" cy="155" r="140" fill={`url(#${id}-glow)`}/>
      <g fill="#ab86ce" fillOpacity=".07" stroke={`url(#${id}-ring)`} strokeWidth="1">
        <circle cx="145" cy="145" r="76"/><circle cx="195" cy="145" r="76"/><circle cx="170" cy="183" r="76"/>
      </g>
      {sources.map((source, i) => {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / sources.length;
        const x = 170 + Math.cos(angle) * 119;
        const y = 155 + Math.sin(angle) * 113;
        return <g key={source.source} data-source={source.source}>
          <line x1={x} y1={y} x2="170" y2="155" stroke="#d5b8ef" strokeOpacity=".88" strokeWidth="1.6" strokeDasharray={shared.has(source.source) ? undefined : '3 5'}/>
          <rect x={x - 43} y={y - 19} width="86" height="38" rx="19" fill={`url(#${id}-node)`} stroke="#ba99d0" strokeOpacity=".85" strokeWidth="1.2"/>
          <text x={x} y={y + 4} textAnchor="middle" fill="#faf3ff" fontSize="14" fontWeight="600">{source.source === 'western-astrology' ? '별자리' : source.label}</text>
        </g>;
      })}
      <circle cx="170" cy="155" r="53" fill="#251331" stroke="#d6b4ef" strokeOpacity=".95" strokeWidth="1.5"/>
      <text x="170" y="136" textAnchor="middle" fill="#dec6ef" fontSize="13" letterSpacing=".5">공통 성향</text>
      {evidence.length ? evidence.slice(0, 2).map((p, i) => <text key={p.trait} x="170" y={161 + i * 23} textAnchor="middle" fill="#fff8ff" fontSize="18" fontWeight="700">{p.trait}</text>) : <text x="170" y="165" textAnchor="middle" fill="#f4e8fd" fontSize="14">공통 성향 없음</text>}
    </svg>
    <p className="map-note">실선 · 공통 성향 지지 / 점선 · 단독 관점<br/>원의 크기와 겹침은 점수나 확률을 뜻하지 않습니다.</p>
  </figure>;
}

export default function ResultFirst({ result, nickname, code, saveStatus, shareStatus, onSave, onShare, onReset, children }: {
  result: AnalysisOutput; nickname: string; code: string;
  saveStatus: 'idle' | 'saved'; shareStatus: ShareOutcome | 'idle';
  onSave: () => void; onShare: () => void; onReset: () => void; children?: ReactNode;
}) {
  const { reading, snapshot, model, sources, evidence, intersectionSummary } = resultPresentation(result);
  const [copyStatus, setCopyStatus] = useState('');
  const shareLabel = shareStatus === 'shared' ? '공유됨' : shareStatus === 'copied' ? '텍스트 복사됨' : '공유하기';
  return <article className="result-first" aria-label="운명 분석 결과">
    <div className="result-eyebrow"><span>나의 운명 교집합</span><span className="quick-actions"><button onClick={onSave}>{saveStatus === 'saved' ? '저장됨' : '저장'}</button><button onClick={onShare}>{shareLabel === '공유하기' ? '공유' : shareLabel}</button></span></div>
    <section className="identity-hero" aria-labelledby="identity-title">
      <div className="hero-eyebrow"><span>DESTINY CODE</span><span>IDENTITY</span></div>
      <p className="identity-for">{nickname ? `${nickname}님의 패턴을 읽다` : '당신의 패턴을 읽다'}</p>
      <h1 id="identity-title">{result.archetype}</h1>
      <p className="identity-statement">{result.identityStatement}</p>
      {reading && <section className="hero-reading" aria-labelledby="hero-reading-title">
        <h2 id="hero-reading-title">AI 종합 분석<span>{reading.leadTitle}</span></h2>
        <p className="hero-reading-lead">{reading.lead}</p>
        {(reading.continuation || reading.sections.length > 0) && <details className="hero-reading-more">
          <summary>종합 분석 이어 읽기</summary>
          {reading.continuation && <p>{reading.continuation}</p>}
          {reading.sections.map(s => <section key={s.title}><h3>{s.title}</h3><p>{s.content}</p></section>)}
        </details>}
      </section>}
      <Tags values={result.commonKeywords.slice(0, 3)} />
      <p className="identity-summary"><span>핵심 교집합</span>{intersectionSummary ?? (model ? '두 개 이상 체계에서 겹친 성향이 없어 요약을 표시하지 않습니다.' : '저장된 교집합 근거가 없어 요약을 표시하지 않습니다.')}</p>
      <a className="hero-jump" href="#result-convergence">나를 이루는 교집합 살펴보기 <span aria-hidden="true">↓</span></a>
    </section>

    <section id="result-convergence" className="convergence-panel" aria-labelledby="convergence-title">
      <p className="section-kicker">01 / CONVERGENCE</p>
      <h2 id="convergence-title">서로 다른 관점이<br/>하나의 나로 이어집니다</h2>
      <p className="convergence-intro">{model ? `이 결과에 실제 참여한 ${sources.length}개 분석 체계` : '이전 결과에 저장된 해석을 그대로 보여드립니다.'}</p>
      {sources.length ? <ConvergenceMap sources={sources} common={model?.common ?? []} evidence={evidence} /> : <p className="map-empty">{model ? '참여 소스 기록이 없습니다.' : '이전 결과에는 참여 소스 근거가 저장되지 않았습니다.'}</p>}
      <p className="convergence-footer">타로는 현재 흐름을 읽는 별도 해석입니다.<br/>{model?.palmIncluded ? '손금은 판독 가능한 근거만 교집합에 반영했습니다.' : '이 결과의 교집합에는 손금이 참여하지 않았습니다.'}</p>
    </section>

    <section className="core-evidence" aria-labelledby="evidence-title">
      <p className="section-kicker">02 / EVIDENCE</p><div className="section-heading"><h2 id="evidence-title">이렇게 연결되었습니다</h2><span>핵심 교집합 근거</span></div>
      {evidence.length ? <div className="evidence-grid">{evidence.slice(0, 2).map((p, i) => <div className="evidence-item" key={p.trait}><span className="evidence-index">0{i + 1}</span><div>
        <h3>{p.trait}<span>{new Set(p.sources.map(s => s.source)).size}개 체계</span></h3>
        <p>{p.sources.map(s => s.detail ? `${s.label} · ${s.detail}` : s.label).join(' / ')}</p>
      </div></div>)}</div> : <p className="result-muted">{model ? '두 개 이상 소스에서 겹친 패턴이 없습니다. 소스별 해석을 살펴보세요.' : '당시 저장된 Identity와 키워드를 그대로 보여드립니다. 상세 교집합 근거는 소급 생성하지 않습니다.'}</p>}
      <p className="result-footnote">체계 간 의미가 겹친다는 뜻이며, 성격의 정확도나 확률을 뜻하지 않습니다.</p>
    </section>

    <div className="detail-heading"><p className="section-kicker">03 / DETAILS</p><h2>상세 분석 펼치기</h2><p>각 체계가 읽어낸 당신의 다른 면들.</p></div>
    <div className="result-details">
      <ResultDetail title="사주" note={`${result.saju.dayStemKo} 일간 · ${result.saju.hasTime ? '출생시간 반영' : '출생시간 미입력'}`}>
        <div className="pillar-grid">{(['year', 'month', 'day', 'hour'] as const).map((p, i) => <div key={p}><span>{['연주', '월주', '일주', '시주'][i]}</span><strong>{result.saju.pillars[p]}</strong></div>)}</div>
        <p>{result.saju.description}</p><h3>오행 구성</h3>
        <div className="element-grid">{Object.entries(ELEMENT_META).map(([key, meta]) => <div key={key}><span>{meta.label}</span><strong>{result.saju.elements[key as keyof typeof result.saju.elements]}</strong></div>)}</div>
        {!result.saju.hasTime && <p className="result-muted">출생시간 미입력으로 시간 관련 계산은 정오를 기준으로 합니다.</p>}
        {result.saju.missingElements.length > 0 && <p className="result-muted">부족한 오행: {result.saju.missingElements.map(el => ELEMENT_META[el].label).join(" · ")}</p>}
        <Tags values={result.saju.traits} />
      </ResultDetail>
      <ResultDetail title="서양점성술" note="태양 · 달 · 상승궁">
        {[result.westernAstrology.sun, result.westernAstrology.moon, result.westernAstrology.ascendant].filter(p => p != null).map(p => <section key={p.planet}><h3>{p.planetLabel} · {p.data.sign}</h3><p>{p.description}</p></section>)}
        <Tags values={result.westernAstrology.keywords} />
        <div className="reading-columns"><section><h3>강점</h3><p>{result.westernAstrology.sun.data.strengths.join(' · ')}</p></section><section><h3>과제</h3><p>{result.westernAstrology.sun.data.weaknesses.join(' · ')}</p></section></div>
        {result.westernAstrology.isApproximate && <p className="result-muted">달궁·상승궁은 천문 근사 계산입니다. 경계일에는 실제 배치와 차이가 날 수 있습니다.</p>}
      </ResultDetail>
      <ResultDetail title="MBTI" note={result.mbtiTraits.type || '미입력 · 교집합 참여 없음'}>
        {result.mbtiTraits.type ? <><h3>{result.mbtiTraits.type} · {result.mbtiTraits.groupLabel}</h3><p>{result.mbtiTraits.description}</p><Tags values={result.mbtiTraits.strengths} /></> : <p>MBTI를 입력하지 않아 분석 및 교집합에서 제외했습니다.</p>}
      </ResultDetail>
      <ResultDetail title="혈액형" note={`${result.bloodType.type}형 · 상징적 유형 해석`}>
        <p>{result.bloodType.description}</p><Tags values={result.bloodType.traits} />
      </ResultDetail>
      <ResultDetail title="교집합" note={model ? `${sources.length}개 체계의 공통점과 차이` : '상세 근거 미저장'}>
        {model ? <IntersectionDetail model={model} /> : <p>이전 버전 결과에는 상세 근거가 없습니다. 저장된 키워드만 유지합니다.</p>}
        {!!snapshot?.conflicts?.length && <section><h3>함께 살펴볼 다른 방향</h3>{snapshot.conflicts.map(c => <div key={c.title}><h4>{c.title}</h4><p>{c.description}</p></div>)}</section>}
      </ResultDetail>
      <ResultDetail title="타로 · 현재 흐름" note={`${result.tarot.name} · 교집합과 별도`}>
        <h3>{result.tarot.name} / {result.tarot.nameEn}</h3><Tags values={result.tarot.keywords} />
        <p>{result.tarotFlow.contextualNote}</p>
        {result.tarotFlow.currentMood && <section><h3>지금 에너지</h3><p>{result.tarotFlow.currentMood}</p></section>}
        {result.tarotFlow.currentRelation && <section><h3>관계 흐름</h3><p>{result.tarotFlow.currentRelation}</p></section>}
        {result.tarotFlow.todayAttitude && <section><h3>지금 필요한 태도</h3><p>{result.tarotFlow.todayAttitude}</p></section>}
      </ResultDetail>
    </div>
    <section className="report-section" aria-label="손금과 전체 보고서">
      <div className="detail-heading"><p className="section-kicker">04 / DEEP READING</p><h2>조금 더 깊이 읽기</h2></div>
      <ResultDetail title="손금 상세 분석" note={snapshot?.palmReading ? model?.palmIncluded ? '판독 근거 반영' : '교집합 미참여' : '선택 분석 · 기본 결과와 구분'}>
        {snapshot?.palmReading ? <PalmReadingCard reading={snapshot.palmReading} /> : <><p>이 기본 결과에 통합된 손금 판독은 없습니다. 별도로 저장한 손바닥 보조 기록은 아래에서 확인할 수 있습니다.</p>{children}</>}
      </ResultDetail>
      <ResultDetail title="전체 분석 보고서" note="핵심 패턴 · 키워드 · Identity 설명">
        <section><h3>저장된 전체 키워드</h3><Tags values={result.commonKeywords} /></section>
        {model && <CorePatternSummary model={model} />}
        {/* B·C·D는 위 '손금 상세 분석'·'교집합' 카드와 같은 내용이라 반복하지 않고 위치만 안내한다. */}
        {snapshot?.palmReading && <p className="result-muted">B · 손금 판독 전체는 위 ‘손금 상세 분석’에서 볼 수 있습니다.</p>}
        {model && <p className="result-muted">C · D 교집합 근거와 보완·대비 해석은 위 상세 분석의 ‘교집합’에서 볼 수 있습니다.</p>}
        {!!snapshot?.identityNarrative?.length && <section><h3>E · 왜 이 Identity인가요</h3>{snapshot.identityNarrative.map((line, i) => <p key={i}>{line}</p>)}</section>}
        {!snapshot?.identityNarrative?.length && <p className="result-muted">이 결과에는 Identity Narrative가 저장되지 않았습니다.</p>}
        {!!snapshot?.keywordStrengths?.length && <section><h3>성향별 지지 소스</h3><p className="result-muted">기존 지지 소스 정보를 표시합니다. 강도는 확률로 표시하지 않습니다.</p>{snapshot.keywordStrengths.map(k => <p key={k.coreTag}><strong>{k.keyword}</strong> · {k.sources.join(' · ')}</p>)}</section>}
        {/* 종합 분석 본문은 첫 화면과 이어 읽기에 있으므로 반복하지 않는다. 저장 데이터는 그대로 둔다. */}
        {reading && <p className="result-muted">AI 종합 분석 전체는 맨 위 ‘종합 분석 이어 읽기’에서 볼 수 있습니다.</p>}
      </ResultDetail>
    </section>
    <section className="save-share-section" aria-labelledby="save-share-title">
      <p className="section-kicker">05 / KEEP YOUR CODE</p>
      <h2 id="save-share-title">오늘 발견한 나를<br/>다시 꺼내볼 수 있도록</h2>
      <p className="save-share-description">분석을 저장하거나, 나를 설명하는 문장을 공유하세요.</p>
      <div className="save-share-actions"><button className="save-primary" onClick={onSave}>{saveStatus === 'saved' ? '저장됨' : '결과 저장하기'}</button><button onClick={onShare}>{shareLabel}</button></div>
      <div role="status" className="result-status">{shareStatus === 'failed' ? '공유하지 못했습니다. 다시 시도해 주세요.' : saveStatus === 'saved' ? '이 기기에 결과를 저장했습니다.' : shareStatus === 'copied' ? '결과 텍스트를 복사했습니다.' : shareStatus === 'shared' ? '결과를 공유했습니다.' : ''}</div>
    {code && <section className="result-code"><div><p>나의 운명 코드</p><strong>{code}</strong></div>
      <dl className="code-facts">
        {result.mbtiTraits.type && <div><dt>MBTI</dt><dd>{result.mbtiTraits.type}</dd></div>}
        <div><dt>일간</dt><dd>{result.saju.dayStemKo}({result.saju.dayStem})</dd></div>
        <div><dt>별자리</dt><dd>{result.zodiac.sign}</dd></div>
        <div><dt>타로</dt><dd>{result.tarot.name}</dd></div>
      </dl><button onClick={async () => { try { await navigator.clipboard.writeText(code); setCopyStatus('복사했습니다.'); } catch { setCopyStatus('복사하지 못했습니다. 다시 시도해 주세요.'); } }}>코드 복사</button><p role="status">{copyStatus}</p><a href="/compatibility">교집합 궁합 보기 <span aria-hidden="true">→</span></a></section>}
      <nav className="next-links" aria-label="다음 단계">
        <a href="https://www.destiny-code.kr/birth-design">탄생디자인 만들기 <span aria-hidden="true">→</span></a>
        <a href="https://www.destiny-code.kr">Destiny Lab 홈 <span aria-hidden="true">→</span></a>
      </nav>
    </section>
    <div className="result-bottom"><button onClick={onReset}>다시 분석하기</button></div>
    <p className="result-footnote">자기 이해를 위한 상징적 해석입니다. 적성·직업을 판정하거나 실제 운명을 보장하지 않습니다.</p>
  </article>;
}
