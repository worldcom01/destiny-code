# Palm Phase 1C — Finding Closure 재검수 완료 / I-1 보완 대기

Status: **C. BLOCKER REMAINS — DO NOT MIGRATE** / public OFF 유지

- 검수 HEAD `fceda61`, 수정 `f6fb6ce`/`8e413e2`/`fceda61`을 이전 `63e1750`과 대조했다.
- 잔여 CRITICAL 0 / IMPORTANT 1 / MINOR 1 / NOTE 1. 새 CRITICAL/IMPORTANT 없음.
- I-1 OPEN: 토큰이 실제 지원 배포/ingress 구성 변경을 구분하지 못한다. 외부 spoof probe가 증명하는 범위와 토큰 무효화 계약 보완 필요.
- I-2 및 기존 M-1/M-2/M-3 CLOSED. 새 운영 문서 MINOR: 준비 env의 public=true를 OFF 순서와 일치시키고 실제 DB smoke 단계를 명시한다.
- public 140 / supplement 117 및 기존 회귀·golden 전부 PASS. digest selection `25ab43b8`, full `dab19aab`. TypeScript/build/diff-check PASS. 실제 OpenAI·Supabase 호출 0.
- 다음: Claude 한정 수정 → 재검수 → 승인 후 OFF 상태 migration/cleanup/ingress → DB-only 다중 연결 smoke → 실기기 mock → 별도 승인 live 1회. NOTE 자체는 migration 차단 사유가 아니다.
- 이번에는 검수 문서만 수정·commit. production 코드/SQL/baseline 변경, migration, merge/push 없음. 상세 근거는 CODEX_REVIEW 최상단.

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1C — Codex 지적 수정 완료

Status: **PHASE 1C CODEX FINDINGS FIXED — AWAITING FOCUSED RE-REVIEW** (승인 아님 · 공개 OFF · Supabase migration 미실행)

- Codex `63e1750`(C, IMPORTANT 2 / MINOR 3 / NOTE 1)의 지적 5개를 수정했다(`f6fb6ce`, `8e413e2`). 상세는 `CLAUDE_REPORT.md` 최상단.
  - I-1: 검증된 ingress 전략 + probe 토큰 없이는 공개 OFF
  - I-2: 모든 DB·analytics 대기에 상한, 확인 불가 시 uncertain·재호출 없음
  - M-1: 스트리밍 본문 한도
  - M-2: 활성 결과 삭제 시 Palm 무효화
  - M-3: base 저장 실패 처리
- N-1(실제 다중 연결 Postgres smoke)은 migration 후, live 전에 수행할 운영 단계로 남긴다.
- 회귀: supplement 117 / public 140 / 기존 전부 PASS, digest 불변, build·tsc OK, lint baseline 9. 유료 호출 0, merge/push 없음.
- 다음 단계:
  1. Codex focused re-review
  2. 운영 순서(CODEX_REVIEW 63e1750 §운영 순서): migration → cleanup cron → env → **ingress probe(docs/palm-phase1c-operations.md 1-A)** → DB 다중 연결 smoke → 실기기 mock → 승인된 live 1회

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1C — Production Readiness 검수 완료 / 수정 대기

Status: **C. BLOCKED — SECURITY / DATA ISOLATION / COST CONTROL ISSUE** / public OFF 유지

- 독립 검수 HEAD `4e7924d`, 브랜치 `feature/palm-supplement-phase1c`. CRITICAL 0 / IMPORTANT 2 / MINOR 3 / NOTE 1.
- 차단: I-1 실제 ingress의 신뢰 IP overwrite/우회 차단 계약 미확정; I-2 완료 후 finalize/analytics RPC에 시간 제한이 없어 관찰 응답을 막을 수 있음.
- MINOR: events bounded body/deadline, 활성 결과 삭제 시 Palm attempt/fresh/pending 무효화, 기본 저장 실패 안내. 구체 위치·재현·최소 수정은 CODEX_REVIEW 최상단.
- Identity/base/정상 A-B 격리/관찰·해석 경계는 적절하다. supplement 104/public 93 및 기존 회귀·golden PASS, digest selection 25ab43b8/full dab19aab 일치. TypeScript/build/변경 Palm lint/diff-check PASS. 전체 lint는 기존 8 errors + 1 warning.
- 다음 단계: Claude가 지정 항목 수정·회귀 보완 → 한정 재검수 → 승인 시 SQL/cleanup/ingress 구성 → 실제 다중 연결 DB-only smoke → 실기기 mock → 별도 승인 live 1회 → 배포 검수.
- 실제 DB migration/OpenAI 호출/merge/push 없음. production 공개 승인 아님. CV 실험 이력·기존 engine '3'/schema 2/baseline 불변.

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1C — Production Supplementary Analysis

Status: **PHASE 1C IMPLEMENTATION COMPLETE — AWAITING CODEX REVIEW / LIVE SMOKE** / 배포 아님 · `PALM_PUBLIC_ENABLED=false` 기본

- 브랜치 `feature/palm-supplement-phase1c`: 설계 문서 `57bb8f2`, Stage 1 `fe54e7f`, Stage 2 `db200a9`, Stage 3 `6182771`, 문서·운영. 상세는 `CLAUDE_REPORT.md` 최상단.
- 흐름: 결과 화면의 선택 카드 → 사진 → 기존 GPT 관찰(관찰만) → 결정적 8개 상징 규칙 → 저장된 coreTags와 MATCH/TENSION/UNIQUE → 별도 UI/보조 저장.
- engine '3'/schema 2/Identity/CoreTags/convergence/trace/golden 불변. Identity 불변과 A/B 격리 release blocker 테스트가 PASS다.
- 공개 경로: 익명 서명 세션, Origin/CSRF, 공유 DB atomic 한도·중복·동시성, fail closed, kill switch. 원본 사진은 저장하지 않는다.
- 유료 호출 0, merge/push 없음, CV production 통합 없음. PALM-CV-EVAL-v1 기록은 보존한다.
- 다음 단계:
  1. Codex 리뷰
  2. 운영 DB에 SQL 적용, cleanup 예약, env·신뢰 IP 헤더·APM 설정
  3. 실기기 mock smoke
  4. 별도 승인된 live smoke 1회
  5. 공개 여부 결정

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1C — Production Supplementary Analysis

Status: **A. PHASE 1C ARCHITECTURE READY — CLAUDE MAY IMPLEMENT** / 설계 완료·구현 미착수

- 사용자 지시로 즉시 로드맵을 변경한다. production 선택형 Palm 보조 분석을 먼저 구현하고 CV 평가는 별도로 유지한다. 평가 완료/정확도 승인을 의미하지 않는다.
- 결과 화면 선택 카드: 사진 → 기존 GPT 관찰/parser → 결정적 8개 상징 규칙 → 저장된 CoreTags와 보조 MATCH/TENSION/UNIQUE → 별도 UI.
- engine '3'/snapshot schema 2/Identity/CoreTags/convergence/trace/기존 저장 결과 불변. Palm은 snapshot 밖 supplement v1, snapshot analysisId 또는 legacy savedId에 연결한다. legacy 비교 기준은 재구성하지 않는다.
- 원본 저장/개선용 수집과 활성 opt-in은 보류. 외부 AI 처리 안내와 명시적 분석 동작, 지원 형식 안내는 필수. HEIC은 이번에는 안내 후 거부한다.
- 공개 endpoint는 secret 노출 없이 익명 서명 세션·Origin/CSRF·Supabase atomic quota/중복 ledger를 구현한다. public flag off 기본값, 인프라 실패 시 fail closed. 공개 전에 분산 gate·비저장·회귀·별도 승인 smoke 확인.
- 구체 계약/8개 문구/파일 계획/3단계 구현/테스트는 CODEX_REVIEW 최상단. Claude는 production main의 별도 feature branch에서 설계 문서만 가져와 구현하며 CV 브랜치를 통째로 합치지 않는다.
- 이번 작업: 문서만, 유료 호출 0, merge/push 없음. 다음 단계는 Claude 구현이다.
- PALM-CV-EVAL-v1 동결 및 공개 데이터 조사 이력은 아래와 CODEX_REVIEW에 보존한다. 실험 데이터 수집·calibration을 이번 설계가 대신하지 않는다.

---

## 이전 상태 기록 (원문 보존)

# PALM-CV-EVAL-v1 — 데이터 출처 결정

Status: **STOP PUBLIC DATASET SEARCH — CONSENTED SMARTPHONE CAPTURE IS THE CORRECT NEXT STEP** / DATASET NOT FROZEN / CALIBRATION NOT STARTED

- 공개 후보는 모두 탈락했다.
  - 11K Hands: 촬영 구도가 맞지 않는다.
  - HaGRID: 손바닥 해상도가 낮다.
  - PolyU-IITD v3, X-Palm: 기술적으로는 적합하지만 권리가 막는다.
  - IITD v1, MSU: 연구 전용이다.
  - BMPD: 권리가 모호하고 기하 조건을 확인하지 못했다.
  - 상세는 `evaluation/PUBLIC_DATASET_SCREENING.md`.
- 다음 단계:
  1. 동의받은 스마트폰 사진 8장을 수집한다. 동의서에 로컬 CV 처리와 승인된 GPT 호출을 명시한다.
  2. PROTOCOL §2 적격성을 사전 기록한다.
  3. R1/R2가 blind GT를 기록한다.
  4. P01–P02 calibration을 한다.
  5. 승인 후 GPT를 호출한다.
- PALM-CV-EVAL-v1 불변, 곡률 임계값은 PENDING CALIBRATION, P01–P08 미배정, 모델 실행 0, production 불변, merge/push 없음.

---

## 이전 상태 기록 (원문 보존)

# PALM-CV-EVAL-v1 — 데이터 출처 탐색

Status: DATASET NOT FROZEN — 11K Hands REJECTED FOR PALM-CV-EVAL-v1 INPUT FRAMING / HaGRID **C. NOT SUITABLE FOR PALM-LINE EVALUATION** / CALIBRATION NOT STARTED

- 11K Hands: 결정적 제안 5장이 모두 조건 3에서 탈락해 이 실험에서 제외했다. 증거는 보존했다(`DATASET_PROVENANCE.md`, `selection-audit.csv`).
- HaGRID: 손이 작고(손바닥 약 150–180 px) 얼굴이 담긴 제스처 사진이다. 라이선스는 프라이버시·초상권을 제외하는 비-CC BY-SA 변형이다. 판정 C(`HAGRID_SUITABILITY.md`).
- 프로토콜(PALM-CV-EVAL-v1) 불변, 곡률 임계값은 PENDING CALIBRATION, 모델 실행 0, OpenAI 0, production 불변, merge/push 없음.
- 다음 단계(오너 결정): 손바닥 근접 촬영을 목적으로 한 공개 데이터셋을 찾는다(권리 조건 포함). 그런 데이터셋이 없으면 동의받은 직접 촬영 사진 8장으로 돌아간다.

---

## 이전 상태 기록 (원문 보존)

# PALM-CV-EVAL-v1 — 데이터셋 준비 (11K Hands)

Status: PALM-CV-EVAL-v1 DATASET PREPARATION — **BLOCKED: DATASET NOT FROZEN (0/8 accepted)** / CALIBRATION NOT STARTED

- 11K Hands 공식 이미지와 metadata를 `~/palm-eval-data/11k-hands/`에 확보했다. 출처·hash·이용 조건("reasonable academic fair use", 명시적 라이선스 없음)은 `evaluation/DATASET_PROVENANCE.md`에 기록했다.
- 결정적 선택(`select-dataset.ts`, `ca58b00`)을 거친 처음 5개 제안이 모두 동결된 촬영 조건 3(손목/손바닥 경계)에서 탈락했다. 데이터셋 구도가 체계적으로 맞지 않는 것으로 보여 중단했다. 감사 기록은 `a8ab6b6`이다.
- 프로젝트 오너가 결정해야 한다.
  - (1) 11K를 포기하고 다른 공식 데이터셋이나 동의 사진을 쓴다.
  - (2) 조건 3을 사전에 수정하고 Codex 재승인을 받는다(PALM-CV-EVAL-v1 수정 또는 v2). `hand-truncated` 위험이 있다.
  - (3) 11K의 academic-fair-use 조건이 이 프로젝트의 평가 용도에 맞는지 먼저 판단한다.
- 모델 실행 0, 유료 호출 0, 곡률 임계값은 PENDING CALIBRATION이다. production 불변, Phase 1C 미착수, merge/push 없음.

---

## 이전 상태 기록 (원문 보존)

# PALM-CV-EVAL-v1 — 동결 재검수 완료 / 데이터 수집 준비 완료

Status: **A. PALM-CV-EVAL-v1 FROZEN — READY FOR DATA COLLECTION**

- Codex 한정 재검수: `79fdb62` 기준, 수정 `399e9c8` 확인. 이전 MINOR 1/2/3 및 NOTE 1 모두 CLOSED. 남은 차단 항목 없음.
- FROZEN_CONFIG·공정성·continuity/Fate·production isolation PASS. 문서/빈 템플릿만 변경됐으며 코드/lockfile hash·CSV/JSON 구조를 확인했다. 상세는 CODEX_REVIEW 최상단.
- 유일한 동결 예외: P01–P02로 결정할 최종 곡률 임계값과 calibration 근거. 후보 0.05/0.08/0.12, 사전 규칙으로 한 번 결정해 P03 전에 commit한다. 나머지 설정은 고정이며 held-out 재조정은 v2다.
- 다음 단계: 동의 사진 8장 수집·사전 적격성 기록 → 블라인드 R1/R2 및 별도 ADJ/hash → P01–P02 calibration과 결과 동결 → 별도 GPT 호출 승인 후 비교. P03–P08은 held-out이다.
- 데이터 수집/평가 미실행, 유료 호출 0, production 불변, Phase 1C 미착수, merge/push 없음. RESEARCH / EVALUATION ONLY — COMMERCIAL RIGHTS NOT YET CLEARED.

---

## 이전 상태 기록 (원문 보존)

# PALM-CV-EVAL-v1 — 평가 프로토콜 준비 완료

Status: PALM-CV-EVAL-v1 PROTOCOL PREPARATION COMPLETE — CALIBRATION AND HELD-OUT EVALUATION NOT EXECUTED

- Codex MINOR 3건을 문서와 템플릿에 반영했다(`399e9c8`, 브랜치 `experiment/palm-cv-poc`). 반영 항목:
  - handedness/mirror 개념 분리와 `canonical_orientation_correct` 채점
  - 모델 출력 전 사람 2명의 선 위치 polyline 기록, adjudication은 별도 파일
  - 선별 identity/coverage/false extension/overlay alignment 기록
  - 촬영 적격성·거절 조건
- `evaluation/FROZEN_CONFIG.md`로 설정을 동결했다. letterbox는 고정했고, **최종 곡률 임계값만 PENDING CALIBRATION**이다(P01–P02, 사전 규칙). P03–P08 held-out은 재조정을 금지한다.
- Continuity는 사람-GPT만 비교한다. CV는 연구 지표만 낸다. Fate는 별도 표로 다루며 CV는 `unsupported-by-model`이다.
- 코드·모델·production 변경 없음, 유료 호출 0, Phase 1C 미착수, merge/push 없음. RESEARCH / EVALUATION ONLY — COMMERCIAL RIGHTS NOT YET CLEARED.
- 다음 단계:
  1. 동의 사진 8장을 수집하고 적격성을 기록한다.
  2. R1/R2가 blind GT와 위치를 기록하고 hash를 남긴다.
  3. CV로 P01–P02 calibration을 하고 FROZEN_CONFIG를 commit한다.
  4. 별도 승인을 받아 GPT 8회를 호출한다.
  5. held-out 6장을 채점한다.

---

## 이전 상태 기록 (원문 보존)

# Palm CV — 자동 ROI 최종 검수 완료 / 비교 프로토콜 보완 대기

Status: AUTOMATIC PALM ROI REVIEWED — B. READY AFTER SMALL FIXES / 8장 비교 NOT EXECUTED

- 검수 HEAD `27a12b9`, 브랜치 `experiment/palm-cv-poc`. CRITICAL 0 / IMPORTANT 0 / MINOR 3 / NOTE 1.
- 자동 ROI·기하 mirror·실제 전처리/overlay 변환은 탐색 실험에 적합하다. PoC 77개 검사와 기존 golden/7개 회귀 스크립트, TypeScript·PoC lint 통과. build도 네트워크 제한 해제 후 통과했다. 상세는 CODEX_REVIEW의 최종 검증 기록을 따른다.
- 실험 전 필수 문서 보완: (1) 해부학적 손과 저장 반전을 구분하는 채점, (2) 블라인드 선 위치 주석·false extension/partial/registration 분리 기록, (3) 촬영 최소 조건과 사전 적격성 기록. 상세·동결 manifest 명세는 CODEX_REVIEW 최상단.
- 현재 평가 프로토콜은 아직 동결 완료가 아니다. M-1~M-3 수정 후 calibration 2장/held-out 6장으로 분리한다. 0.08은 미검증, CV continuity 판정 없음, Fate 미지원 유지.
- HT01의 검출과 GPT/CV 곡률 불일치는 정확도 근거가 아니다. 사람 ground truth 확인 전 승자를 정하지 않는다. n=8은 모집단 정확도 검증이 아니다.
- RESEARCH / EVALUATION ONLY — COMMERCIAL RIGHTS NOT YET CLEARED. production·baseline 불변, Phase 1C 미착수, 유료 호출 0, merge/push 없음.
- 다음 단계: Claude의 프로토콜/빈 템플릿 보완 → 동결·재확인 → 동의 사진·블라인드 GT → 별도 유료 호출 승인 후 비교.

---

## 이전 상태 기록 (원문 보존)

# Palm CV — Automatic Palm ROI Normalization PoC

Status: AUTOMATIC PALM ROI NORMALIZATION POC — IMPLEMENTED ON `experiment/palm-cv-poc` (evaluation only, NOT production) / 8장 비교 NOT EXECUTED

- Codex B 판정 후속. 로컬 MediaPipe Hands(TF.js port, WASM) landmark를 입력 정규화에만 쓴다. wrist→middle MCP 수직 회전, 21점 bbox ± 0.12L ROI, 기하 chirality mirror(index MCP가 pinky MCP 오른쪽이면 반전), letterbox 512² 순서다. perspective warp는 쓰지 않는다. 변환은 정확히 역산 가능해서 overlay와 geometry를 원본 좌표로 되돌린다. 실패 코드는 명시적으로 남기고 fallback은 없다. 상세는 `CLAUDE_REPORT.md` 최상단.
- hand.jpg 로컬 1회(HT01): 정규화 ok(−3.46°, mirror false), Life/Head/Heart 모두 non-zero. 선 identity와 시각 정확도는 미검증이며 사용자 확인이 필요하다.
- 테스트 77 PASS, 기존 회귀·build 불변. 유료 호출 0.
- 프로토콜 v2(stage A–H, 같은 원본, 자동 CV 주 비교, 수동 crop은 별도 진단)를 준비만 했다.
- RESEARCH / EVALUATION ONLY — COMMERCIAL RIGHTS NOT YET CLEARED. production 계약·API·engine '3'/schema 2 불변. Phase 1C 미착수. merge/push 없음.
- 다음 단계: Codex 리뷰 → 사용자 HT01 overlay 시각 확인 → 동의 8장·사람 GT 수집 → 승인 시 GPT 8회와 비교.

---

## 이전 상태 기록 (원문 보존)

# Palm CV Comparison PoC — Codex 검수 완료

Status: PALM CV COMPARISON POC — REVIEWED / AUTOMATIC ROI POC RECOMMENDED BEFORE COMPARISON

**B. POC APPROVED — ADD MINIMAL AUTOMATIC PALM ROI NORMALIZATION BEFORE 8-IMAGE COMPARISON** (2026-09-30, 검수 HEAD `6e4e927`). CRITICAL 0 / IMPORTANT 0 / MINOR 2 / NOTE 2.

- 격리된 추론·연구용 기하 기반 승인. 38개 테스트·실모델 합성 추론·SHA-256·ORT 1.23.2 확인. TypeScript/변경 TS lint/diff-check 통과.
- tensor 계약은 upstream과 일치하지만 framing은 미확정이다. 보고된 full-hand 예시의 0-pixel을 모든 전체 손 사진의 한계로 일반화하지 않는다. upstream은 21 landmark bbox+margin·회전·canonical handedness를 사용하며 pseudo-label 생성의 padding도 별도 확인 대상이다.
- 다음 작업: MediaPipe 기반 최소 자동 ROI/회전/선택 mirror PoC. perspective warp는 제외. inverse overlay 검증 후 프로토콜을 동결해 8장 비교한다. 수동 crop은 출력 전에 동결한 진단 대조군으로만 유지한다.
- MINOR: framing/좌우 단정 문서(M-1), unreadable·ROI 실패·latency 범위를 혼합한 비교 프로토콜(M-2)을 다음 PoC에서 보완한다. 상세는 `CODEX_REVIEW.md` 최상단.
- curvature 0.08 미검증 유지, continuity 판정 없음, Fate `unsupported-by-model`. RESEARCH / EVALUATION ONLY / COMMERCIAL RIGHTS NOT YET CLEARED.
- production Palm 계약·API·해석·저장·engine '3'/schema 2 변경 없음. 유료 호출 0, 8장 실험 미실행, Phase 1C 미착수. 이번에는 검수 문서만 commit하고 merge/push하지 않는다.

---

## 이전 상태 기록 (원문 보존)

# Palm CV Comparison PoC

Status: PALM CV COMPARISON POC — IMPLEMENTED ON `experiment/palm-cv-poc` (evaluation only, NOT production) / 8장 비교 NOT EXECUTED

- `scripts/palm-cv-poc/`에 samuel `student_fp32.onnx`(bc48939f, SHA-256 `3c02b88b…`)의 로컬 Life/Head/Heart segmentation PoC를 격리 구현했다. Fate 미지원, continuity 미판정, curvature는 잠정 raw metric. 상세는 `CLAUDE_REPORT.md` 최상단.
- License: **RESEARCH / EVALUATION ONLY — COMMERCIAL RIGHTS NOT YET CLEARED.**
- 핵심 발견: palm crop이 없으면 검출 0. 수동 `--crop`/`--mirror` 필요.
- 8장 비교 harness(`evaluation/`)는 준비만 했다. 실행에는 동의 사진 8장, 사람 2명 ground truth, GPT 8회 유료 호출 승인이 필요하다.
- 불변: production Palm 경로, PalmObservation 계약, Evidence/Claim/Identity/CoreTag/convergence, engine `'3'` / schema `2`. Phase 1C 미착수. 진단 브랜치 미병합 유지. Palm Visual Accuracy Evaluation(아래)은 여전히 시작 전이며 이 비교 프로토콜로 함께 수행할 수 있다.
- 다음 단계: Codex 리뷰 → 사람 ground truth 수집 → 승인 시 비교 실행.

---

## 이전 상태 기록 (원문 보존)

# Palm CV 오픈소스 평가 — 아키텍처 검토

Status: PALM CV OPEN-SOURCE EVALUATION — ARCHITECTURE REVIEW

**검토 완료 / 권고 D — 통제된 비교 실험 우선.** 기준 `main` / `6d4fbd5` (2026-09-30). Phase 1B 기술 통합·운영자 live smoke #1 PASS는 유지한다. 시각 정확도는 아직 평가하지 않았다.

- 실제 코드 검토: `samuelwbarber/palm-line-reader` (`bc48939f`), `yeonsumia/palmistry` (`17610c3f`), `parthmax2/palm-reader` (`2500fdb0`).
- 첫 실험 후보는 samuel의 ONNX 3선 segmentation. Heart/Head/Life mask·browser 추론·overlay는 있지만 Fate 클래스가 없고, 단일 연결선을 유도한 학습은 continuity 관찰과 차이가 있다.
- yeonsumia는 binary segmentation + 세 선 기하 분류, parth의 Fate는 남은 중앙 세로 후보 선택 휴리스틱이다. 상업 사용은 code/weight/dataset 권리를 분리해 확인해야 한다.
- GPT-4.1은 유지한다. primary 교체·hybrid·자동 fallback 역할은 실험 전 확정하지 않는다.
- 가장 작은 후속 실험: 동의받은 동일 사진 8장, 사람 2명 기준 관찰, 현 GPT와 CV paired 비교. 두 장 calibration 후 나머지 평가; Fate 미지원·continuity 오류·overlay·cold/warm latency를 분리 기록한다. 상세는 `CODEX_REVIEW.md` 최상단에 있다.
- 이번 작업: 문서만 변경. 유료 호출·weight 다운로드·대형 dependency 설치·실험 실행·Phase 1C 착수 없음. 기존 PalmObservation/Evidence/Claim/Identity/CoreTag/convergence/engine '3'/schema 2와 비저장 정책 불변.
- 다음 단계: 데이터·모델 권리 확인과 비교 프로토콜 확정. 별도 진단 브랜치는 미병합 유지한다.

---

## 이전 상태 기록 (원문 보존)

# Palm Visual Accuracy Evaluation

Status: PALM VISUAL ACCURACY EVALUATION — NOT STARTED

## 직전 결과

**PALM LIVE SMOKE #1 — PASS (technical integration).** 모델 `gpt-4.1-2025-04-14`, 4,132 ms, 준비 이미지 1536×2048, provider 호출과 `parsePalmObservationBundle` 검증 모두 SUCCESS. **Visual accuracy는 NOT YET EVALUATED**다. 앞선 `provider-error` 1건(약 600 ms)은 로컬 API 자격 증명·입력 문제였을 가능성이 높으나 입증되지 않았다. 상세는 `CLAUDE_REPORT.md` 상단에 있다. 진단 브랜치 `fix/palm-smoke-diagnostics`는 미병합 상태로 검토를 기다린다.

## 다음 활동 (시작하지 않음)

동의받은 손바닥 사진 **8~12장**으로, 사람이 관찰한 정답(ground truth)과 AI 관찰을 비교한다.

- 선: life, head, heart, fate
- 속성: visibility, curvature, continuity

평가 전에는 Palm Phase 1C를 시작하지 않는다. Palm Evidence를 Destiny Code 엔진에 연결하지 않는다. engineVersion(`'3'`)·schemaVersion(`2`)·Identity·CoreTag·convergence·해석 규칙·PalmObservation 계약·production API를 변경하지 않는다. 추가 유료 호출은 별도 승인 후에만 한다.

---

## 이전 기록

# Palm Phase 1B — Vision Extraction Boundary

Status: PALM PHASE 1B — COMPLETED / MERGED

Codex 최종 판정 **A — MINOR CLOSED — PHASE 1B APPROVED / READY FOR MERGE**(0/0/0/0, 승인 문서 `210cee6`) 후 `feat/palm-vision-phase1b`를 `main`에 fast-forward로 병합했다.

- 운영자 전용 `POST /api/palm/analyze`: 이미지 한 장 → 서버 검증·준비 → OpenAI `gpt-4.1-2025-04-14` → `parsePalmObservationBundle()` → 검증된 `PalmObservationBundle`에서 끝난다. 기본 비활성이다.
- Palm InterpretationClaim·CoreTag·convergence·Identity·저장·UI 연결은 없다. 기존 Destiny Code 분석은 변경되지 않았다. engine `'3'` / schema `2`.
- 검증: Palm 1B 146 / 1A 76 / Pattern 74 / Identity v2 97 / v3 23 / saved-context 14 / evidence-trace 218, golden v1/v2/v3, digest `25ab43b8` / `dab19aab`, TypeScript·build·diff-check.
- 유료 API 호출은 0건이다. live smoke는 실행하지 않았으므로 **실제 손금 판독 정확도는 아직 검증되지 않았다.**

## Next

**PALM LIVE EVALUATION — NOT STARTED**

---

## 이전 기록

# Palm Phase 1B — Codex 최종 승인

Status: PALM PHASE 1B — CODEX APPROVED / READY FOR MERGE

**A. MINOR CLOSED — PHASE 1B APPROVED / READY FOR MERGE** (2026-09-30, 검수 HEAD `66e0a7b`, 최종 수정 `b547907`). BLOCKER 0 / IMPORTANT 0 / MINOR 0 / OBSERVATION 0.

- 기존 업로드 취소·reader/slot 수명 문제 I-1은 종료 유지. 마지막 `..hand.jpg` 경로 오판 M-1도 종료했다. 경로 요소·lexical/realpath·양방향 symlink·외부 sibling 판정을 확인했다.
- 독립 회귀: Palm 1B 146, Palm 1A 76, Pattern 74, Identity v2 97/v3 23, saved-context 14, evidence-trace 218 PASS. golden v1/v2/v3 및 digest `25ab43b8`/`dab19aab` 보존.
- TypeScript/build/diff-check 통과. 변경 파일 lint 신규 0. engine '3' / schema 2 및 기존 분석 동작 유지.
- 병합·후속 push·별도 명시적 live smoke와 8~12장 평가를 위한 기술 준비 완료. 실제 모델 계정 접근과 시각 판독 정확도는 미검증이다.
- 이번 작업은 검수 문서만 커밋한다. production/test/golden 수정·유료 호출·merge/push·Phase 1C 착수 없음. local main `d57b9a7` 유지.

상세 검수는 `CODEX_REVIEW.md` 최상단을 따른다.

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1B — 마지막 MINOR 수정

Status: PALM PHASE 1B — FINAL MINOR FIX IMPLEMENTED / AWAITING CODEX APPROVAL

Codex focused re-review(`0ee954c` 보존)는 **B — IMPORTANT CLOSED / MINOR 1**이었다. 남은 MINOR(smoke 경로에서 `..hand.jpg`를 밖으로 오판)를 `b547907`에서 경로 구성요소 기준으로 수정했다. Palm 1B 회귀 146 PASS, 기존 회귀·golden·digest 불변, 유료 호출 0건. 승인은 Codex 최종 검수 후에 한다.

---

## 이전 기록

# Palm Phase 1B — Codex 집중 재검수

Status: PALM PHASE 1B — IMPORTANT CLOSED / MINOR CLEANUP REMAINS

**B. IMPORTANT CLOSED — READY FOR MERGE / MINOR CLEANUP REMAINS** (2026-09-30, 검수 HEAD `28d59c4`). BLOCKER 0 / IMPORTANT 0 / MINOR 1 / OBSERVATION 0.

- I-1 종료: 업로드 deadline·req.signal이 reader를 취소하고, 읽기 종료·lock 해제 뒤 gate slot을 반환함을 독립 확인했다.
- M-1 잔여: `scripts/palmSmokePaths.ts:13`의 `startsWith('..')`가 저장소 내부 `..hand.jpg`를 외부로 잘못 분류한다. 부모 경로 요소 비교로 바꾸고 해당 회귀를 보완해야 전체 지적 종료로 표시할 수 있다. 병합 차단 수준은 아니다.
- Palm 1B 132 및 모든 기존 회귀·golden·digest 통과. TypeScript/build/diff-check 통과. lint 기존 9건, 신규 0.
- 기술적 live 평가 준비는 됐지만 실제 계정 가용성·시각 정확도는 미검증이다. 유료 호출 0건, Phase 1C 미착수.
- 상세 재현과 정확한 cleanup은 `CODEX_REVIEW.md` 최상단을 따른다. 이번에는 문서만 수정했으며 commit/merge/push하지 않았다. Phase 1B 전체 지적 종료로 표시하지 않는다.

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1B — Codex 지적 수정

Status: PALM PHASE 1B — IMPORTANT FIX IMPLEMENTED / AWAITING CODEX RE-REVIEW

Codex 검수(`ad68239`)는 **C — NOT READY**(IMPORTANT 1 / MINOR 1)였다. 검수 원문은 `9a104a2`로 보존했다. 수정 커밋은 `898dac4`다.

- **I-1:** 업로드 deadline·요청 취소 시 본문 reader를 실제로 취소·정리한 뒤에만 반환한다. concurrency slot은 읽기가 끝난 뒤 `finally`에서 해제된다. 30초 전체·20초 provider 예산과 4,000,000 bytes 실제 상한은 유지된다.
- **M-1:** smoke 사진 경로를 `resolve` + `realpath`로 저장소 root와 비교한다(상대경로·`..`·symlink 모두 거부).
- Palm 1B 회귀 132 PASS. 기존 회귀·golden·digest는 불변이다. 유료 호출은 0건이다.

상세는 `CLAUDE_REPORT.md` 상단에 있다. Phase 1C는 시작하지 않았다.

---

## 이전 기록

# Palm Phase 1B — Vision Extraction Boundary

Status: PALM PHASE 1B — CODEX REVIEW C / REVISION REQUIRED

최종 독립 검수(2026-09-30, HEAD `ad68239`): **C. NOT READY — IMPORTANT ISSUE**. BLOCKER 0 / IMPORTANT 1 / MINOR 1 / OBSERVATION 0. 업로드 timeout 후 reader가 계속 살아 있고 gate가 해제되는 I-1은 병합 전 필수 수정이다. 수동 smoke의 저장소 내부 상대경로 차단 M-1은 보완 권고다. 상세 재현·수정 조건은 `CODEX_REVIEW.md` 최상단을 따른다. 코드·테스트 수정, 유료 호출, commit/merge/push 없이 검수 문서만 기록했다. 승인·live 평가·Phase 1C 진행은 보류한다.

Codex 설계(판정 A, 커밋 `d57b9a7`)대로 브랜치 `feat/palm-vision-phase1b`에 구현했다. 병합·push하지 않았다.

- 운영자 전용 `POST /api/palm/analyze`: 이미지 한 장 → 서버 검증·준비(sharp) → OpenAI `gpt-4.1-2025-04-14`(Responses API, strict schema, store false, retry 0) → `parsePalmObservationBundle()` → 검증된 bundle
- 기본 비활성이며, env 3개와 운영자 secret이 있어야 한다. 원본 이미지·응답은 저장하지 않는다. 기본 오류 로그에는 code만 남긴다. SDK debug 설정에서는 부가 로그가 생기지만 이번 mock 검사에서 이미지·응답 원문 노출은 재현되지 않았다.
- Evidence·Claim·CoreTag·Identity·분석·저장·UI는 연결하지 않았다. engine `'3'` / schema `2`.
- mock 회귀 105 PASS(유료 호출 0). 기존 회귀·golden·digest는 불변이다.
- **live 호출은 하지 않았다. 실제 손금 판독 정확도는 아직 검증되지 않았다**(수동 8~12장 평가 필요).

상세는 `CLAUDE_REPORT.md` 상단에 있다. Phase 1C는 시작하지 않았다.

---

## 이전 기록: Palm Phase 1B 설계

# Palm Phase 1B — Vision Extraction Design

Status: PALM PHASE 1B — VISION EXTRACTION DESIGN

**설계 완료 / 구현 미시작.** 기준 main `0c21092`, engine '3' / schema 2. Phase 1A는 완료·병합되었으며 의미와 parser를 변경하지 않는다.

## 권고

- **A. PHASE 1B CAN BE IMPLEMENTED DIRECTLY** — 별도 선행 리팩터링 없음.
- Primary: OpenAI `gpt-4.1-2025-04-14`. Fallback: 유료 Gemini `gemini-3.8-flash` 수동 대체 후보만, 자동 전환 없음.
- 서버 이미지 검증·준비 → 한 provider → unknown 관찰 → 서버 metadata 조립 → 기존 `parsePalmObservationBundle()` → bundle 반환에서 종료.
- POST `/api/palm/analyze`, Node runtime. Phase 1B는 비공개 운영자 시험용으로 보호하며 UI/익명 공개는 후속 단계다.
- Vercel 4.5 MB 제약에 맞춰 이전 8 MiB 초안을 **raw body 4,000,000 bytes**로 수정한다. JPEG/PNG/정적 WebP, 짧은 변 640px 이상, 20MP/변 8000px 이하, 준비 JPEG 긴 변 2048px 이하를 권장한다.
- raw image·bundle 저장 없음. Evidence/Claim/CoreTag/convergence/Identity 연결 없음. engine/schema 불변.

## 다음 단계

상세 provider 비교·공식 출처·prompt/schema·오류·비용/보관·파일/테스트 계획은 `CODEX_REVIEW.md` 최상단에 있다. 구현 착수 전 사용자 설계 확인과 계정/보관 조건 확인이 필요하다. live 사진의 실제 선 판독 성능은 아직 검증하지 않았다.

이후 Phase 1C는 선택적 UI·동의·품질/재촬영 경험을 먼저 검토한다. 상징 규칙·합성은 별도 후속 승인 대상이다. 이번 작업은 문서만 커밋하며 구현/merge/push하지 않는다.

---

## 이전 단계 기록 (원문 보존)

# Palm Phase 1A — Observation Contract + Evidence Adapter

Status: PALM PHASE 1A — COMPLETED / MERGED

Codex 최종 판정 **A — IMPORTANT CLOSED — READY FOR MERGE / PHASE 1B READY**(0/0/0/0, 승인 커밋 `19bf3fd`)을 받은 뒤 `refactor/palm-observation-phase1a`를 `main`에 fast-forward로 병합했다.

- **PalmObservation 계약:** 네 선(life/head/heart/fate) × visibility·curvature·continuity. 판독 상태는 observed / unreadable / not-detected다. provider 중립적인 시각 관찰만 담고, 숫자 confidence는 없다. 품질(usability·palmCoverage·issues)은 관찰과 분리되어 Evidence가 아니다.
- **공개 런타임 경계:** `parsePalmObservationBundle(input: unknown)` → 검증된 `PalmObservationBundle`, 실패 시 `PalmObservationContractError`. 정확한 필드 집합, 판별 상태 불변식, 품질·관찰 모순 거부를 적용한다. 유일한 검증 정의다.
- **결정적 Palm Evidence adapter:** `buildPalmEvidence()`가 같은 검증을 거친 뒤 `source = 'palm'`, `kind = 'image-observation'`, `palm:line:<key>:<attr>` 12행(unusable·이미지 없음은 0행)을 만든다.
- InterpretationClaim과 CoreTag 매핑은 아직 없다. convergence·Identity·storage·UI·provider에 연결하지 않았다.
- `ANALYSIS_ENGINE_VERSION = '3'`, `schemaVersion = 2`. 운영 출력 변경은 0이다(golden v1/v2/v3, digest `25ab43b8` / `dab19aab` 보존).
- Palm 회귀 76 PASS / Pattern 74 / Identity v2 97 / Identity v3 23.
- Phase 1B는 준비가 됐지만 **시작하지 않았다**.

## Next

**PALM PHASE 1B — VISION EXTRACTION BOUNDARY** (시작·설계하지 않음)

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1A — Codex 최종 재검수 완료

Status: PALM PHASE 1A — CODEX APPROVED / READY FOR MERGE

**A. IMPORTANT CLOSED — READY FOR MERGE / PHASE 1B READY**

Codex가 `refactor/palm-observation-phase1a`의 `011bda4`를 검수했다. 이전 `9f99383`의 IMPORTANT 1건은 수정 `f1456eb`로 종료되었다. BLOCKER / IMPORTANT / MINOR / OBSERVATION은 **0 / 0 / 0 / 0**이며 병합 전 필수 수정은 없다.

- 공개 `parsePalmObservationBundle(unknown)`가 유일한 관찰 검증 경계다. adapter가 이를 재사용하며 모순 상태·마지막 선 오류를 원자적으로 거부한다.
- Palm 76 / Pattern 74 / Identity v2 97 / v3 23 PASS. golden v1/v2/v3, saved-context, evidence-trace, diagnostic, TypeScript, build, diff-check 통과.
- selection `25ab43b8`, full `dab19aab` 보존. engine '3' / schema 2 유지. 기존 사용자 출력·저장 의미 변경 없음.
- 이번 재검수는 문서만 커밋한다. 코드/테스트/golden 수정과 merge/push는 하지 않는다.

## 다음 단계

사용자 지시에 따른 Phase 1A 병합이 가능하다. Phase 1B는 계약 의미 변경 없이 공개 parser를 재사용할 수 있다. 서버 업로드·provider·개인정보/비용 정책은 기존 설계의 구현 전 검토 대상이며 아직 구현을 시작하지 않았다. 상세 종료 근거와 이전 C 판정 이력은 `CODEX_REVIEW.md` 최상단에 보존했다.

---

## 이전 상태 기록 (원문 보존)

# Palm Phase 1A — Observation Contract + Evidence Adapter

Status: PALM PHASE 1A — IMPORTANT FIX IMPLEMENTED / AWAITING CODEX RE-REVIEW

Codex 검수(`9f99383`)는 **C — NOT READY**(BLOCKER 0 / IMPORTANT 1)였다. 지적 내용은 모순 상태를 허용하는 런타임 검증과, 재사용 가능한 검증 경계의 부재다. Claude가 새 커밋 `f1456eb`로 수정했다.
- 공개 검증 함수 `parsePalmObservationBundle(unknown)`와 `PalmObservationContractError`를 `app/lib/palmObservation.ts`에 두었다.
- 모든 단계에서 정확한 필드 집합과 판별 상태 불변식을 요구한다. 품질과 관찰의 모순도 거부한다.
- adapter는 같은 검증 함수를 거쳐 원자적으로 거부한다.
- Palm 회귀는 76 PASS다. 기존 회귀·golden·digest는 불변이다.

Palm 아키텍처 설계(Codex 판정 A, 커밋 `f2db08c`)의 **P1-A만** 구현했다. 브랜치는 `refactor/palm-observation-phase1a`(from main `f2db08c`)이며, 병합·push하지 않았다.

- 신규 파일: `app/lib/palmObservation.ts`(관찰 계약), `app/lib/palmEvidence.ts`(순수 adapter), `scripts/regression-palm-evidence.ts`
- PalmObservationBundle → EvidenceRecord[]만 구현했다. 이미지·provider·API·UI·Claim·CoreTag 매핑·`analyzeDestiny`/trace 통합·저장은 **없음**.
- engine `'3'`, schema `2`, trace `1` 모두 그대로다. 운영 출력 변경 0이며, golden v1/v2/v3과 진단 digest(`25ab43b8`/`dab19aab`)가 그대로다.

상세 결과는 `CLAUDE_REPORT.md` 상단에 있다.

## 다음 단계

Codex가 `git diff main...refactor/palm-observation-phase1a`로 P1-A를 검수한다. P1-B(서버 추출) 이후 단계는 설계 문서의 구현 전 검토 절차를 따르며 이번에 시작하지 않았다.

---

## 이전 기록: Palm Phase 1 아키텍처 설계

# Palm Phase 1 — Architecture Design

Status: PALM PHASE 1 — ARCHITECTURE DESIGN

**설계 검토 완료 / 구현 미시작 / 구현 범위 승인 대기.**

기준 production main `70bc9da`, engineVersion `'3'`, schemaVersion `2`. Identity Catalog v3는 완료·병합되었으며 최적화를 재개하지 않는다.

## 현재 설계 결과

- 판정 **A. EXISTING ARCHITECTURE CAN ACCEPT PALM WITH SMALL EXTENSIONS**.
- 이미지 → 별도 품질/관찰 → 순수 Evidence adapter → 추후 승인된 symbolic Claim → 기존 패턴/Identity 순서를 유지한다.
- 관찰 전용 도입과 실제 합성 활성화는 분리한다. `palm` source 추가만으로 합성되지 않으며 target allowlist와 commonKeywords를 함께 맞춰야 한다.
- 원본 이미지는 일시 처리만 하고 저장하지 않는다. 새 snapshot에 optional 구조화 관찰/trace만 보존하며 과거 결과 backfill은 없다.
- 기존 엔진·schema·catalog·golden은 이번 설계에서 변경하지 않았다.

## 다음 단계

상세 타입, source counting, 서버/provider 경계, 보안·저장 정책 및 단계별 검증은 `CODEX_REVIEW.md` 최상단에 있다.

사용자 설계 확인 후 첫 구현은 **P1-A 관찰 계약·순수 Evidence adapter**만 제안한다. 예상 파일은 `app/lib/palmObservation.ts`, `app/lib/palmEvidence.ts`, `scripts/regression-palm-evidence.ts`와 단계 보고 문서다. API/provider/UI/snapshot 통합/Claim/합성/버전 변경은 이 첫 구현에 포함하지 않는다. 아직 구현을 시작하지 않았다.

이후 순서는 서버 관찰 추출 → 선택적 관찰 UI·저장 → 별도 제품 승인된 상징 규칙·합성 활성화다. 마지막 단계 전에는 기존 분석 결과가 바뀌지 않아야 한다.

---

## 이전 단계 기록 (원문 보존)

# Identity Catalog v3 — Implementation

Status: IDENTITY CATALOG V3 — COMPLETED / MERGED

사용자가 Identity Catalog Pair Revision(Option A)을 **제품 승인**했다. Claude Code가 브랜치 `refactor/identity-catalog-v3`(from main `74a039a`)에 구현했고, Codex 최종 검수(**A — READY FOR MERGE**, BLOCKER/IMPORTANT/MINOR/OBSERVATION 0/0/0/0, 검수 커밋 `ac578ab`) 후 `main`에 fast-forward로 병합했다. 수동 배포는 하지 않았다.

## 승인된 제품 결정

- Pair: **창의적 + 독립적**
- Identity 이름: **고집스러운 실험가**
- 결과 문장(정확히): "주어진 방식을 따르기보다 자기 방법을 새로 만들지만, 이미 잘 돌아가는 것까지 다시 손대는 사람입니다."
- 이전 제안 "정답 밖의 설계자"('납득할 수 있는 답' 중심 문장)는 **승인되지 않았다**.

## 구현 요약

- catalog 끝(pairIndex **10**)에 추가했다. 기존 pairIndex 0–9는 유지된다. Option B 선택 규칙·대표 convergence·provenance·패턴 로직은 변경하지 않았다(파일 blob이 main과 동일).
- `ANALYSIS_ENGINE_VERSION = '3'`, `schemaVersion = 2`. 엔진별 catalog 범위는 `IDENTITY_PAIR_COUNT_BY_ENGINE`에 기록한다(v1 10, v2 10, v3 11).
- 기존 v1·v2 저장 결과는 동결되어 있다. 재선택·backfill을 하지 않는다.
- golden: v1·v2 기준 파일은 그대로(blob 동일), 신규 `golden-baseline.v3.json`을 추가했다.
- 진단(고유 19,983): 불일치 34.72%→**17.57%**, v2→v3 Identity 변경 **6,188건(30.97%)**, 관측 유형 **10/22**, single→pair **115**, 신규 불일치 **20**. 설계 기대값과 정확히 일치한다.

상세 결과는 `CLAUDE_REPORT.md` 상단에 있다.

### 완료 (병합)

- **승인된 Identity:** 창의적 + 독립적 → **고집스러운 실험가** — "주어진 방식을 따르기보다 자기 방법을 새로 만들지만, 이미 잘 돌아가는 것까지 다시 손대는 사람입니다." (pairIndex 10)
- `ANALYSIS_ENGINE_VERSION = '3'`, `schemaVersion = 2`. 기존 v1·v2 저장 결과는 동결되어 있고, golden v1·v2는 그대로 보존했으며 v3 기준을 추가했다.
- 병합 전후 검증:
  - golden v1/v2/v3(엄격한 v2→v3 허용 변경 포함), saved-context, evidence-trace: PASS
  - Pattern 74 / Identity v2 97 / Identity v3 23: PASS
  - TypeScript, build, diff-check: 통과
- **v3 진단(고유 19,983):**
  - 불일치 3,512 / **17.57%** (v2 34.72%)
  - v2→v3 Identity 변경 6,188 / **30.97%**(전부 고집스러운 실험가)
  - single→pair 115, 신규 불일치 20, 관측 유형 10/22
- **v3 digests:** selection `25ab43b8`, full `dab19aab`. 과거 digest: v1 `94fe72c7`, v2 `ed598f84` / `93a95fcd`.

## Next

**NEXT PRODUCT REVIEW:** Identity Catalog / Narrative evolution, 또는 다음에 승인되는 Destiny Code phase. 아직 정의하거나 시작하지 않았다.

---

## 이전 기록: Identity Catalog Pair Revision 설계 검토

# Identity Catalog Pair Revision — Design Review

Status: IDENTITY CATALOG PAIR REVISION — DESIGN REVIEW COMPLETE / AWAITING PRODUCT APPROVAL

기준 production main `74a039a`, engineVersion `2`, schemaVersion `2`. Identity Selection v2는 완료 상태이며 재설계하지 않는다.

## 권장안

Option A: **창의적+독립적 신규 authored pair 1개만** 기존 catalog 끝에 추가하는 설계다. 기존 21개는 유지하여 정의 22개·고유 pair 10개가 된다. 아직 catalog를 수정하지 않았다.

- 이름 후보: **고집 있는 실험가 / 자기 길의 편집자 / 남의 답이 불편한 사람**. 제품 검토용이며 미확정이다.
- 개념: 새로운 방법을 실험하면서 그 방법의 결정권도 스스로 갖고 싶어 하는 패턴.
- 합성 진단 예상: mismatch 34.72%→17.57%, Identity 변경 6,188건(30.97%), 기존 불일치 3,407건 해소, 신규 불일치 20건.
- 관측 archetype은 13/21→10/22로 줄고 single 115건이 pair로 전환된다. 이 부작용을 승인 없이 숨기거나 selector로 보정하지 않는다.
- 중복 안전한 탐험가와 도달 불가 single 6개는 유지한다. 나머지 top5 pair는 보류한다.
- 창의적 편중은 적은 catalog 이웃과 넓은 upstream 매핑이 함께 기여한다. 매핑이 의미적으로 부적절하다는 결론은 이번 측정으로 입증되지 않았다.

## 다음 단계

사용자가 개념·이름·최종 문구와 전환 부작용을 승인한 뒤에만 구현한다. 승인되면 engineVersion `3`, schemaVersion `2` 유지, 과거 v1/v2 저장 및 golden 보존, 별도 v3 golden 검토가 필요하다. 아직 구현 승인 상태가 아니다.

상세 21개 개념 지도, 5개 pair 의미 분석, A/B/C/D 실측, 재사용/중복/single 검토, 서사 시제품과 이전 전략은 `CODEX_REVIEW.md` 최상단에 있다. 기존 회귀·TypeScript·build·diff-check와 두 생산 digest 유지 검증이 통과했다. 이번 작업은 문서 두 개와 /tmp 임시 측정뿐이며 생산 코드·catalog·버전·golden은 변경하지 않았다.

---

## 이전 단계 이력

# Identity Catalog Coverage Analysis

Status: IDENTITY CATALOG COVERAGE ANALYSIS — COMPLETE / AWAITING PRODUCT DECISION

기준 main `74a039a`, engineVersion `2`, schemaVersion `2`. Identity Selection v2는 구현·검수·병합 완료 상태이며 이번 조사에서 재설계하지 않았다.

## 분석 결과

- 고유 19,983건에서 mismatch 6,899/19,868 pair = 34.72%다.
- 상호 배타적 원인: catalog 호환 조합 부재 4,569(66.23%), candidate/provenance 범위 차이 2,317(33.58%), no-convergence fallback 13(0.19%). 유효 대표 후보가 순위에서 밀린 사례는 0이다.
- 분석 분류 **A. Catalog coverage is the primary remaining limitation**.
- raw demand top1/3/5 pair의 임시 추가 시 mismatch는 17.57% / 12.19% / 4.87%다. 분모·새 불일치·기존 정합 결과 변경이 있으므로 content 추가 승인으로 해석하지 않는다.
- 13/21 관측은 중복 shadowing 1개, 현재 매핑/pair-first에서 도달하지 못하는 single 6개, 정상 입력에서 도달하지 않는 generic 1개로 설명된다.
- 원래 선택과 golden은 보존됐고 모든 요청된 검증이 통과했다. 상세 근거·표·반사실 조건과 이전 이력은 `CODEX_REVIEW.md`에 있다.

## 다음 제품 결정

권장 단일 다음 단계는 **Identity Catalog Pair Revision — DESIGN**이다. 의미적 일관성과 서사의 구별 가능성을 실제 coverage 수요와 함께 평가한다. 새 pair 추가·catalog 수정·selector 변경은 아직 승인하거나 구현하지 않았다.

이번 조사에서는 문서 두 개만 변경했다. 임시 스크립트는 /tmp에 두었고 production·engineVersion·golden 변경 및 merge/push는 없다. 수치는 합성 엔진 구조 진단이며 실제 사용자 분포 추정이 아니다.

---

## 이전 단계 이력

# Identity Selection v2 — Implementation

Status: IDENTITY SELECTION V2 — COMPLETED / MERGED

사용자가 Codex Option B를 승인했다. 이는 **의도된 사용자 출력 변경**이다. Claude Code가 브랜치 `refactor/identity-selection-v2`(from main `2746b5e`)에 구현했고, Codex 최종 검수(A) 후 `main`에 fast-forward로 병합했다.

## 구현 요약

- **순위:** (대표 convergence 태그 포함, 양쪽 중 작은 distinct-source 수, 양쪽 source 합집합 크기) 사전식 내림차순. 동률은 기존 authored 순서다. convergence가 없으면 v1 선택을 유지한다.
- **버전:** `ANALYSIS_ENGINE_VERSION = '2'`, `schemaVersion = 2` 유지. 새 분석에는 `identitySelection`(선택 이유)이 기록되고, 과거 저장 결과는 재계산하지 않는다.
- **Golden:** v1 기준은 `golden-baseline.v1.json`(바이트 동일)으로 보존했다. v2 기준을 신규로 추가했고, v1 대비 허용 diff는 Identity 문구·archetype·Destiny Code다. 7개 케이스 중 3개가 바뀌었다.
- **진단** (고유 19,983): 불일치 84.60%→34.72%, 양쪽 교차 출처 22.60%→45.12%, Identity 변경 67.18%, selection digest `ed598f84`. Codex 설계 측정과 정확히 일치한다.
- **유지:** catalog 21개(중복·도달 불가 포함), CoreTag, 사주 보완 의미, conflictEngine 미사용, 서술·UI.

상세 결과는 `CLAUDE_REPORT.md`, 설계는 `CODEX_REVIEW.md` 상단에 있다.

## 다음 단계

Codex가 `75fd9c5`를 main `2746b5e` 대비 최종 독립 검수했다. 판정은 **A. Ready for merge**, BLOCKER / IMPORTANT / MINOR / OBSERVATION 모두 **0**이다.

- Option B 구현·v1 저장 보존·버전·golden 이전이 적합하다.
- 전체 요청 검증이 통과했다(pattern 74, Identity 97 assertions). 고유 19,983건과 digest `ed598f84` / `93a95fcd`를 재현했다.
- 실제 main 엔진과 고유 입력 전건 차등 비교에서 승인 밖 snapshot 변경 및 기존 패턴 변경은 0건이다. 수렴 없는 15건도 v1 Identity를 유지했다.
- 상세 최종 검수와 이전 설계 이력은 `CODEX_REVIEW.md`에 보존했다.

다음 단계는 **사용자 승인 후 main 병합 및 검증**이다. 이번 검수에서는 문서 두 개만 수정했으며 애플리케이션·golden 변경, commit/merge/push를 하지 않았다.

### 완료 (병합)

- Option B를 구현했다. 순위는 (대표 convergence 포함, min distinct-source, source 합집합)이고, 동률은 authored 순서, convergence가 없으면 v1이다.
- `ANALYSIS_ENGINE_VERSION = '2'`, `schemaVersion = 2`.
- 기존 v1 저장 결과는 동결되어 있다. 조회·공유·재저장 시 재계산하거나 backfill하지 않는다.
- v1 golden 이력은 `scripts/golden-baseline.v1.json`(main 시절과 같은 blob `d79d1fa`)으로 보존했다. v2 기준은 `scripts/golden-baseline.v2.json`이다.
- 병합 전후 검증:
  - golden 이전 검사(7개 중 3개 Identity 변경, 허용 범위 밖 변경 0), saved-context, evidence-trace, pattern 74, Identity v2 97: PASS
  - 진단(고유 19,983): 불일치 84.60%→34.72%, 양쪽 교차 출처 22.60%→45.12%, Identity 변경 67.18%, selection digest `ed598f84`, 전체 진단 digest `93a95fcd`
  - TypeScript, build, diff-check: 통과
- Identity catalog(21개, 중복 #8=#3, 도달 불가 '안전한 탐험가' 포함), CoreTag, 사주 보완 의미, conflict 미사용은 그대로다.

## Next

다음 작업은 Identity 선택 규칙의 추가 수정이 **아니다**.

다음 조사는 **Identity Catalog Coverage Analysis**다. 남은 대표 교집합 불일치 34.72% 중 얼마가 선택 알고리즘이 아니라 기존 21개 authored Identity catalog의 한계(대표 태그를 포함하는 쌍이 catalog에 없음 등)에서 오는지 판단하는 것이 목적이다. 아직 시작하지 않았다.

---

## 이전 Phase 2B 완료 기록

# Phase 2B — Foundation (observational)

Status: PHASE 2B FOUNDATION — COMPLETED / MERGED

Identity Selection v2 is NOT implemented. Next phase: **Identity Selection v2 DESIGN** (not started).

Previous phase: Phase 2A — Evidence Traceability is complete and merged (`main` `5758350`).

## Objective

Understand what the current engine actually means by "intersection", identify the structural causes of results that feel too similar, and determine the smallest useful abstraction on top of the Phase 2A trace.

Only the observational foundation (diversity baseline + derived patterns) is approved. Any change to user-visible output, including Identity selection, still requires approval.

## Out of scope

- Pattern Engine / Relationship Engine
- Palm
- LLM interpretation, embeddings, vector DB, graph DB
- probabilistic scoring, new confidence model
- new trait ontology
- user feedback learning
- UI changes
- any change to user-visible analysis output without explicit approval

## Constraints

- Existing golden baseline stays unchanged unless an approved phase intentionally changes output (then: engine version bump + explicit baseline reset with reviewed diff).
- Saved historical results are never reinterpreted (AD-002).
- Cross-source convergence of symbolic mappings is not empirical validation (AD-004).

## Current next action

Codex가 `refactor/pattern-foundation-phase2b`의 수정 커밋 `106ea99`를 이전 구현 `38834e8` 및 main `5758350` 대비 독립 재검수했다. 최종 판정은 **A. Ready for merge**다.

- 이전 IMPORTANT 1(생성기 반복)과 MINOR 1(missing Evidence fixture)이 모두 해소됐다. BLOCKER 0 / IMPORTANT 0 / MINOR 0 / OBSERVATION 1이다.
- 20,000행 중 고유 유효 입력 **19,983개**, 중복 17개, digest **`ca1e44df`**를 재현했다. 합성 표집 수치는 실제 사용자 모집단의 빈도 추정이 아니다.
- golden·saved-context·evidence-trace·pattern(개별 74 assertions)·diversity diagnostic·TypeScript·build·diff-check가 통과했다. golden baseline과 기존 사용자 출력·저장 의미는 보존됐다.
- 상세 재검수와 이전 C 판정 이력은 `CODEX_REVIEW.md`에 보존했다.

다음 단계는 사용자 승인에 따른 foundation 병합이다. 이번 재검수에서는 merge/push하지 않았다. 이후 별도 Identity Selection v2 설계에 진입할 준비가 됐다. 실제 Identity 선택·사용자 출력 변경은 여전히 별도 승인 사항이며 이번 검수에서 설계하거나 구현하지 않았다. 목표는 cross-source intersection/provenance의 대표성 개선이며 archetype 빈도의 인위적 균등화가 아니다.

### 완료 (병합)

Codex 재검수(A) 후 `refactor/pattern-foundation-phase2b`를 `main`에 fast-forward로 병합했다. 병합 전후 검증 결과는 다음과 같다.

- golden, saved-context, evidence-trace, pattern(74 assertions): 모두 PASS
- diversity diagnostic: 20,000 / 고유 19,983 / digest `ca1e44df`
- TypeScript, build, diff-check: 통과

Phase 2B **foundation**만 완료되었다. 완료된 것은 관찰용 패턴 파생과 다양성 기준선이다. Identity 선택 알고리즘, 사용자 출력, `ANALYSIS_ENGINE_VERSION`, golden baseline, AnalysisSnapshot 구조는 변경되지 않았다.

다음 단계는 **Identity Selection v2 DESIGN**이다. 설계는 아직 시작하지 않았다. 실제 Identity 변경은 설계 검토와 사용자 승인 뒤, 엔진 버전 증가와 golden 명시적 재설정을 거쳐서만 진행한다.
