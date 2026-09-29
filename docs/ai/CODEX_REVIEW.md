# Phase 2A — 구현 명세 및 독립 설계 검토

상태: 최종 검수 요청 확인 — 구현 산출물 부재로 검수 차단

## 최종 독립 검수 결과 — 구현 대상 확인 실패

**최종 판정: C. Requires revision**

이 판정은 구현 코드의 결함 판정이 아니라, 요청된 구현을 현재 저장소에서 확인할 수 없어 병합 승인을 할 수 없다는 의미다. 아래 승인된 설계와 Claude의 독립 확인 부록은 보존한다. 기존 문서의 미커밋 변경도 삭제하지 않는다.

### BLOCKER — 검수할 Phase 2A 구현이 없음

- 실제 checkout은 `main`, HEAD는 `81b0c90`이다.
- `git branch -a`, `git worktree list`, `git show-ref --verify refs/heads/refactor/evidence-trace-phase2a` 확인 결과, 기대한 구현 브랜치와 별도 worktree가 없다.
- 원격을 읽기 전용으로 확인한 `git ls-remote --heads origin main refactor/evidence-trace-phase2a`에서도 구현 브랜치가 반환되지 않았다. 원격 main은 `89dcbd7563f7259c16d4748a8371aa038eb2f365`였다. fetch·checkout·merge·push는 수행하지 않았다.
- `app/lib/evidenceTrace.ts`와 `scripts/regression-evidence-trace.ts`가 없다.
- 현재 analysis.ts에는 Phase 2A trace 통합이 없다.
- `docs/ai/CLAUDE_REPORT.md`는 구현 내용 없는 `PENDING` 템플릿이다.
- 검수 시작 시 변경된 파일은 CODEX_REVIEW.md와 CURRENT_PHASE.md뿐이며 애플리케이션 구현 diff는 없었다.

문제 수: BLOCKER 1, IMPORTANT 0, MINOR 0, NON-BLOCKING 0. IMPORTANT 0은 구현 안전성을 확인했다는 뜻이 아니다.

### 검증 상태와 한계

기대 브랜치가 없어 `main...refactor/evidence-trace-phase2a` diff를 검토할 수 없다. 타입·결정적 ID·소스별 근거·사주 제한·누락 처리·난수·trace 저장 및 비소급·기존 출력 불변성은 모두 **미검증**이다.

golden, saved-context, evidence-trace, TypeScript, build는 Phase 2A 구현에 대해 실행할 수 없으므로 이번 최종 검수에서는 실행하지 않았다. 현재 main의 통과 결과를 구현 브랜치의 검증 결과로 대신하지 않는다. golden baseline은 수정·재생성하지 않았다. 문서 변경의 `git diff --check`만 수행한다.

### 검수 재개 조건

1. Claude의 실제 구현 브랜치/커밋을 현재 저장소에서 접근 가능하게 하거나, 구현한 정확한 worktree 경로를 제공한다. 새로 구현하라는 요구가 아니다.
2. 실제 구현과 검증 결과가 포함된 CLAUDE_REPORT.md를 제공한다.
3. Codex가 해당 diff 및 요청된 전체 검증을 수행한 뒤 최종 판정을 다시 기록한다.

현재 병합 불가. 애플리케이션 코드·테스트 수정, 자동 수정, 병합 또는 push는 수행하지 않았다.

---

## 보존된 승인 설계

설계 상태: 검토 완료 / 구현 명세 승인. 구현 완료 여부는 위 최종 검수 상태를 따른다.

## 검토 기준과 결론

- 실제 확인한 브랜치·커밋: `main`, `81b0c90` (`docs: add AI collaboration protocol`). Phase 1 수정 `89dcbd7` 포함.
- 검토 시작 시 working tree는 clean이었다.
- 협업 문서 4개와 실제 분석·점성술·저장·활성 결과·golden 검사 코드를 확인했다.
- 기존 설계와 중요한 불일치 없음. 선행 수정이 필요한 blocker 없음.
- 이번 작업은 문서 작성이다. 아래 타입과 절차는 구현 명세이며 구현 완료를 뜻하지 않는다.

## 범위와 불변 조건

목표는 **각 소스의 기존 CoreTag가 어떤 입력 또는 계산 관찰과 매핑에서 나왔는지** 기록하는 것이다.

```text
기존 입력 → 기존 계산·매핑 → 기존 CoreTag / Identity / Narrative
                      └→ EvidenceRecord → InterpretationClaim → Snapshot.trace
```

trace는 기존 결과의 소비자이며 기존 해석을 구동하지 않는다. 모든 Claim을 합쳐 기존 coreTags를 대체하지 않는다. Identity의 첫 일치 규칙 선택, 직접 조건 기반 충돌, Narrative 전체 문장까지 추적하는 단계는 아니다.

변경 금지: CoreTag 매핑·순서, Identity 선택, 충돌 규칙, 키워드 강도, Destiny Code, Narrative, 궁합, UI, 저장 ID·시각·중복 방지·legacy 의미, 공유·프로필·analytics payload. Palm, Pattern/Relationship Engine, NarrativePlan, LLM, 사용자 피드백, 종합 confidence, 범용 소스 프레임워크는 범위 밖이다.

## 정확한 권장 타입

신규 `app/lib/evidenceTrace.ts`에 둔다. 기존 타입은 `import type`으로만 참조한다.

```ts
export type EvidenceRecord = {
  id: string;
  source: string;
  kind: "self-report" | "calculated" | "symbolic" | "image-observation";
  feature: string;
  value: string | number | boolean | null;
  status: "available" | "missing" | "unreadable";
};

export type InterpretationClaim = {
  id: string;
  trait: CoreTag;
  evidenceIds: string[];
  ruleId: string;
  basis: "type-mapping" | "symbolic";
  target: string;
};

export type AnalysisTrace = {
  version: 1;
  evidence: EvidenceRecord[];
  claims: InterpretationClaim[];
};
```

- `available`은 값 확보 상태이며 계산 정확성·성격 해석 타당성을 보증하지 않는다. missing/unreadable은 null로 표현하고 실제 false/0과 구분한다.
- MBTI 유형의 자기보고에서 파생한 태그는 성향 자체의 자기보고가 아니므로 Claim basis는 `type-mapping`이다. 나머지 현재 태그 해석은 `symbolic`이다. 신뢰도 등급이 아니다.
- `target`은 기존 태그 배열 경로 식별자다. 동적 경로 실행기를 만들지 않는다.
- ruleId에 `@1`을 넣어 매핑 버전을 식별한다. 별도 레지스트리는 불필요하다.
- ID는 Snapshot 안에서 유일하고 결정적이어야 한다. 예: Evidence `saju:dominant-element`, Claim `saju:dominant-element:분석적`. target·근거 경로가 다르면 구분한다. 분석 간 식별은 기존 analysisId와 조합한다. 시간·난수를 사용하지 않는다.
- 배열 처리 순서는 사주, MBTI, 혈액형, 기존 zodiac, 점성술 placement(태양·달·상승궁), 타로로 고정하고 각 태그 순서는 원본을 따른다.

## 정확한 통합 지점

`app/lib/analysis.ts`의 `analyzeDestiny()`에서 기존 conflicts·keywordStrengths·merged coreTags 계산 후 최종 return 직전에 순수 함수 `buildAnalysisTrace()`를 호출한다.

입력은 현재 지역 변수인 `saju`, `zodiacKey`, `zodiac`, `westernAstrology`, `mbtiData`, `bloodTypeData`, 최종 `tarot`를 묶는다. 기존 `ELEMENT_CORE_TAGS` 참조를 별도 인자로 전달한다.

builder 내부에서 Evidence를 만든 뒤 실제 반환된 태그와 매핑에 Claim을 붙인다. source 계산·음양력 변환·타로 추출은 다시 실행하지 않는다. 매핑 테이블을 복제하거나 입력 객체·공유 상수 배열을 변경하지 않는다. 사주 외에는 반환된 태그와 조회 키만으로 기록할 수 있다.

analysis.ts는 builder를 런타임 import하고 AnalysisTrace는 type import한다. 반대 방향 런타임 import로 순환 의존성을 만들지 않는다. calcSaju·calcWesternAstrology의 반환 계약과 계산식은 유지한다.

## 소스별 규칙

### Saju

실제 위치: `analysis.ts`의 `ELEMENT_CORE_TAGS`, `calcSaju()`.

현재 지배 오행 태그 + 첫 부족 오행 태그를 중복 제거하여 앞의 3개만 유지한다. 부족 오행이 없으면 지배 오행을 다시 사용한다.

- Evidence: source `saju`, kind `calculated`, feature `dominant-element`, 실제 dominantElement.
- 첫 부족 오행이 있을 때만 feature `first-missing-element`, 값 missingElements[0]을 추가한다. 없으면 가상의 부족 오행·보완 Claim을 만들지 않는다.
- target `saju.coreTags`, basis `symbolic`.
- ruleId: `saju.dominant-element-tags@1`, `saju.missing-element-compensation@1`.
- 기존 ELEMENT_CORE_TAGS에서 경로별 기여를 확인하고 **최종 saju.coreTags에 남은 태그만** Claim으로 기록한다. 지배 경로 다음 보완 경로 순서다.
- 같은 태그가 두 경로에서 나오면 두 Claim을 보존할 수 있다. trait를 순서대로 중복 제거하면 기존 coreTags와 같아야 한다.
- 3개 제한에서 제외된 태그를 출력 Claim으로 남기거나, 모든 태그를 지배 오행에서 나왔다고 기록하지 않는다.
- hasTime은 feature `birth-time-provided`, kind `self-report`, boolean으로 기록한다. 미입력이면 feature `calculation-time-default`, kind `calculated`, value `12:00`도 기록한다. 이는 계산 맥락이며 태그의 직접 근거로 연결하지 않는다. 기존 정오 대체 동작은 유지한다.

### MBTI

실제 위치: `analysis.ts`의 MBTI_DATA 및 `MBTI_DATA[mbti] ?? NULL_MBTI`.

- Evidence: source `mbti`, kind `self-report`, feature `type`, 인식된 mbtiData.type.
- 빈 유형이면 missing/null이고 Claim 없음. 새 입력 검증 정책은 만들지 않는다. 원시 입력의 오류와 미입력을 세분화하는 단계는 아니다.
- 실제 mbtiData.coreTags 순서대로 Claim 생성.
- target `mbtiTraits.coreTags`, ruleId `mbti.type-tags@1`, basis `type-mapping`.

### Blood type

실제 위치: `analysis.ts`의 BLOOD_TYPE_DATA 조회.

- Evidence: source `blood-type`, kind `self-report`, feature `type`, bloodTypeData.type.
- 실제 bloodTypeData.coreTags 순서대로 Claim 생성.
- target `bloodType.coreTags`, ruleId `blood-type.symbolic-tags@1`, basis `symbolic`.
- 새로운 기본 혈액형이나 유효성 정책을 추가하지 않는다.

### Western astrology 및 기존 zodiac

두 실제 경로를 보존한다:

1. analysis.ts의 calcZodiacSign → ZODIAC_DATA[zodiacKey] → zodiac.coreTags.
2. westernAstrology.ts의 calcWesternAstrology → SIGN_DATA의 태양·달·상승궁 태그 → 순서대로 합집합.

- Evidence: source `western-astrology`, kind `calculated`, feature `sun-sign`/`moon-sign`/`ascendant-sign`, 값은 각 signKey.
- 현재 같은 태양궁을 사용하는 두 매핑은 하나의 태양궁 Evidence를 공유한다. 테스트에서 zodiacKey와 westernAstrology.sun.signKey의 일치를 확인한다. 다르면 조용히 합치지 말고 불일치로 보고한다.
- 기존 zodiac Claim: 실제 zodiac.coreTags, target `zodiac.coreTags`, ruleId `zodiac.sign-tags@1`.
- placement Claim: 실제 placement.data.coreTags, target `westernAstrology.sun.data.coreTags` / `westernAstrology.moon.data.coreTags` / `westernAstrology.ascendant.data.coreTags`, ruleId `western-astrology.placement-tags@1`.
- basis는 symbolic. 두 태양궁 매핑을 독립적인 행동 증거 두 개로 취급하지 않는다.
- 달·상승궁 null이면 missing Evidence만 생성한다. Claim 없음.
- isApproximate는 별도 feature `is-approximate`, kind calculated인 boolean Evidence로 기록한다. 성격 신뢰도로 변환하지 않는다.
- 합집합에 새 Claim을 중복 생성하지 않는다. placement 순서로 trait를 합쳐 중복 제거한 값이 westernAstrology.coreTags와 같은지 검증한다.

### Tarot

실제 위치: analysis.ts의 TAROT_DATA, `selectedCard ?? calcTarot()`.

- Evidence: source `tarot`, kind `symbolic`, feature `card-number`, 최종 tarot.number.
- 실제 tarot.coreTags 순서대로 Claim 생성.
- target `tarot.coreTags`, ruleId `tarot.card-tags@1`, basis symbolic.
- 카드를 다시 뽑지 않는다. 최소 범위에는 선택 방식 추적 필드가 필요하지 않다.
- 현재 상세 해석 등에 사용되지만 merged coreTags와 Identity의 직접 태그 합집합에는 제외된다. trace 때문에 이 범위를 변경하지 않는다.

## Snapshot 저장·호환 정책

AnalysisSnapshot에 `trace?: AnalysisTrace`만 추가한다. AnalysisOutput은 유지한다.

새 분석에 trace를 생성·저장한다. 메모리에만 만들면 저장 결과의 출처를 잃으며, 나중에 현재 규칙으로 재생성하면 과거 근거와 달라질 수 있다.

- 기존 v2는 trace 없이도 v2다. legacy도 그대로 읽는다.
- 조회·재저장·삭제 후 재저장 시 과거 trace를 생성·보충하지 않는다.
- schemaVersion 2와 기존 ANALYSIS_ENGINE_VERSION을 유지한다. 선택적 필드 추가이며 해석 규칙 변경이 아니다. trace 구조는 trace.version으로 구분한다.
- 저장 ID·시각·중복·legacy 판정은 수정하지 않는다. 저장 함수는 resultData 전체를 JSON으로 보관하므로 변경 불필요하다.
- UI·공유·프로필·궁합·analytics·Supabase에 trace를 사용·전송하지 않는다.
- 원본 생년월일·좌표·전체 계산 과정·설명 문장·매핑 테이블을 복제하지 않는다. 이번은 계산 관찰에서 시작하는 출처 추적이며 전체 입력 재실행 기록은 아니다.

## Palm 계약 경계

향후 source palm, kind image-observation으로 선의 가시성(boolean), 형태(string), 비율(number), 판독 불가(null/unreadable)를 표현할 수 있다. 이미지 품질도 별도 feature로 표현한다. `image-quality = low`, status available은 품질 등급을 확보했다는 의미다.

품질을 성격 Claim 신뢰도로 자동 전달하지 않는다. 상징적 해석은 별도 ruleId의 Claim으로 연결할 수 있지만 타당성은 별도 문제다. 이번에는 이미지·Vision·Palm 매핑을 구현하지 않는다. 관찰 품질·계산 정확성·해석 타당성·사용자 경험 일치를 하나의 점수로 합치지 않는다.

## 변경 예상 파일

| 파일 | 변경 범위 |
| --- | --- |
| 신규 app/lib/evidenceTrace.ts | 타입, 순수 builder와 소스별 작은 함수 |
| app/lib/analysis.ts | import, 선택적 trace 필드, 최종 조립 호출 |
| 신규 scripts/regression-evidence-trace.ts | 근거·태그 일치·저장 호환성 검사 |

기존 매핑·해석 함수, UI, activeAnalysis, storageEngine, westernAstrology, conflictEngine, keywordEngine, destinyCode, compatibilityEngine, profileStore, analyticsEngine, Supabase schema는 수정 대상이 아니다. 기존 테스트와 golden 기대값을 변경하지 않는다. 구현 보고는 협업 절차에 따라 docs/ai/CLAUDE_REPORT.md에 기록한다.

## 회귀·수용 기준

1. 기존 golden과 saved-context 스크립트를 변경 없이 통과한다. golden-baseline.json 재캡처 금지. golden은 trace 외의 기존 분석·파생 필드를 비교한다.
2. 새 검사는 작은 assertion과 메모리 localStorage stub으로 충분하다. 대형 프레임워크는 불필요하다.
3. Evidence/Claim ID 유일성, 비어 있지 않은 evidenceIds, 모든 참조의 존재와 available 상태를 확인한다.
4. 각 target에서 Claim trait를 순서대로 중복 제거하면 기존 태그와 같아야 한다. value와 ruleId의 기대값도 검사해 태그만 복사한 잘못된 출처를 탐지한다.
5. 사주 지배·보완 경로, 중복 근거, 부족 오행 없음, 3개 제한, 시간 미입력 맥락을 확인한다. 필요한 경우 builder에 작은 명시적 fixture를 사용한다.
6. MBTI·달·상승궁 누락, 태양궁 두 경로, 타로의 기존 합집합 비참여를 확인한다.
7. 동일 source 결과에서 동일 trace가 나오고 입력 객체가 변경되지 않아야 한다. trace에는 난수·시간·I/O가 없다. 선택 카드 없는 경로의 카드 선택·난수 호출도 바꾸지 않는다.
8. trace 포함 Snapshot의 JSON 저장·조회 깊은 동등성과 동일 분석 재저장의 원본 보존을 확인한다.
9. trace 없는 v2와 실제 legacy 형태 fixture를 별도로 만들어 trace가 소급 추가되지 않는지 검사한다. 새 Snapshot에서 schemaVersion만 제거한 fixture로 두 경우를 대신하지 않는다.
10. 대표 trace와 최대 10개 저장 목록의 JSON 크기를 보고한다. 원문·입력 전체 중복으로 불필요하게 커지지 않았는지 확인한다.
11. build, lint, diff 검사를 수행한다. 기존 lint 항목과 신규 항목을 구분한다. golden 불일치는 재생성하지 말고 중단·보고한다.

```sh
npx -y tsx scripts/golden-analysis.ts
npx -y tsx scripts/regression-saved-context.ts
npx -y tsx scripts/regression-evidence-trace.ts
npm run build
npm run lint
git diff --check
```

## Claude 구현 계획 — 3단계

1. **순수 trace 모듈**: 타입과 소스별 생성 규칙을 구현하고 작은 fixture로 출처·태그 일치를 검증한다. 기존 엔진은 변경하지 않는다.
2. **Snapshot 연결**: analyzeDestiny 최종 조립에 trace만 추가한다. 과거 결과는 건드리지 않는다. 기존 golden과 저장 컨텍스트 검사를 통과시킨다.
3. **집중 회귀·보고**: 새 회귀 스크립트와 수용 기준을 완성하고 build·lint·diff·저장 크기를 확인한다. 결과와 한계를 CLAUDE_REPORT에 기록한다.

## 최종 판정

**Phase 2A 구현 진행 가능. 선행 필수 수정 없음.** 기존 설계와 중요한 불일치 없음. 소스별 규칙·ID·저장·회귀 기준을 구체화한 명세다. 구현 범위는 위 내용으로 제한하고 최종 병합 여부는 구현 검수 후 판단한다.

## 부록 — Claude Code 독립 확인 (main `81b0c90` 기준)

위 명세의 사실 주장을 실제 코드와 대조했다. 방향과 충돌하는 불일치는 없다. 구현 시 아래 세부만 명확히 한다.

1. **태양궁 두 경로는 항상 같다.** `calcZodiacSign()`(analysis.ts)과 `calcWesternAstrology()`의 태양궁(westernAstrology.ts)은 모두 같은 양력 날짜로 `calcSunSignKey(month, day)`를 호출한다. 따라서 `zodiacKey === westernAstrology.sun.signKey` 검사는 현재 항상 통과하는 방어용 assertion이다. 하나의 태양궁 Evidence 공유는 타당하다.
2. **"시간 입력" 판정이 두 곳에서 다르다.** 사주는 `birthtime.length > 0`이고 미입력 시 12:00이다. 서양 점성술은 `birthtime.length >= 4`이고 미입력 시 0:00이며, 달·상승궁은 계산하지 않는다. `birth-time-provided`와 `calculation-time-default`는 사주 Evidence(`saju.hasTime`)에서만 만든다. 서양 점성술 쪽 시간 여부는 달·상승궁의 missing 상태로만 표현한다. 두 판정을 하나로 합치거나 고치지 않는다.
3. **`isApproximate`는 원래 값 그대로 기록한다.** 현재 `isApproximate: hasTime`이다. 즉 시간이 있어 달·상승궁을 근사 계산했을 때 true다. Evidence에는 이 값을 그대로 기록하고, 이름에서 짐작되는 의미로 뒤집거나 재해석하지 않는다.
4. **태그 경로를 확인했다.** Identity(`generateIdentity`)의 직접 태그 합집합은 사주·`zodiac`·혈액형·MBTI이며 타로는 제외된다. 상세 해석(`generateDetailedReading`)은 타로를 포함한다. Snapshot의 merged `coreTags`는 `zodiac.coreTags`가 아니라 `westernAstrology.coreTags`를 쓴다. 명세의 두 경로 보존 규칙이 이 구조와 맞다.
5. **혈액형 조회에는 fallback이 없다.** `BLOOD_TYPE_DATA[bloodtype]`에 기본값이 없다. 폼이 혈액형을 필수로 요구하므로 현재 문제는 없다. 명세대로 새 기본값이나 검증을 추가하지 않는다.
