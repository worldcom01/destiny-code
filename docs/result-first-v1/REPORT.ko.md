> 이전 검토본 — 디자인 미승인. 완료 표현은 철회하며, 최신 상태는 result-first-revision/REPORT.ko.md의 사용자 승인 대기 상태입니다.

# Destiny Code — Result First UX V1 로컬 구현 보고

2026-11-03 · 로컬 구현 완료 / 사용자 검토 및 승인 대기

## 구현

- 다크 퍼플 Identity 히어로 → 저장된 키워드 → 실제 참여 소스 → 핵심 교집합 근거 순서로 표시합니다.
- 라이트 퍼플 상세 카드 8개: 사주, 서양점성술, MBTI, 혈액형, 손금, 교집합, Narrative, 타로·현재 흐름. 기본 접힘, 마우스·터치·키보드 탐색 지원.
- Identity가 선택된 성향의 저장된 근거를 먼저 표시합니다. 나머지는 기존 엔진 순서를 유지합니다.
- 참여 소스는 intersection의 common/complements/tensions에 저장된 출처를 중복 없이 집계합니다. 고정된 4개/5개 체계 문구를 제거했습니다.
- 타로는 현재 흐름으로 분리합니다. MBTI 미입력과 손금 판독 불가·낮은 신뢰도 제외를 기존 엔진 결과대로 반영합니다.
- 결과 화면의 장식용 아이콘과 다색 강조를 없애고, 단색 펼침 표시와 텍스트 중심으로 정리했습니다. 내비게이션의 컬러 이모지도 제거했습니다.
- 운명 코드 강도 퍼센트와 진행 막대를 결과 화면에서 제거했습니다. 근거 없는 적성·직업 추천을 추가하지 않았습니다. 오행은 계산된 구성 개수로 표시합니다.
- 저장·공유·코드 복사·궁합 연결을 유지했습니다. 저장된 분석 기록은 결과 아래로 옮겼습니다. 저장 결과를 전환할 때 이전 공유 상태를 초기화합니다.
- 기존 손금 보조 기록은 기본 분석에 합치지 않고 손금 상세 안에서 기존 연결 키와 표시 로직을 유지합니다.
- 과거 결과에는 없는 intersection/Narrative를 소급 계산하지 않습니다. 당시 저장된 Identity와 키워드를 그대로 표시하고 근거 미저장을 안내합니다.

## 유지한 핵심 동작

V4 분석 엔진·Identity 선택·저장 형식·공유 로직·Palm V3 서버 보안·API·SQL·환경 설정은 변경하지 않았습니다. 해당 경로의 Git diff가 비어 있음을 확인했습니다. 실제 사진·개인 데이터·유료 provider를 사용하지 않았습니다.

## 검증 결과

| 검증 | 결과 |
|---|---|
| 최종 production build | PASS |
| TypeScript | PASS |
| 신규 컴포넌트·보조 함수·스크립트 및 관련 소규모 변경 파일 lint | PASS |
| 전체 lint | 기존 오류 8개·경고 8개로 실패. 관리자/궁합/기존 effect 및 기존 코드 경고 포함. 이번 UX 범위 밖의 기존 문제는 변경하지 않음 |
| golden v1/v2/v3/v4 | 기존 7개 golden 사례 일치 |
| 저장 컨텍스트 | 14개 PASS: 재열기·공유 텍스트·중복 방지·legacy 재저장 |
| 손금 통합 | 18개 PASS |
| 손금 보조 기록 | 118개 PASS |
| Palm 공개 보안 | 178개 PASS |
| Palm 추출 | 148개 PASS |
| Identity selection | 106개 PASS |
| Identity catalog v3 | 25개 PASS |
| 신규 Result First 호환성 | 9개 합성 사례 PASS + 기존 golden 4세대 × 7개 = 28개 결과 렌더·원본 불변 PASS |
| 공유 outcome | mock Web Share 성공·취소 후 clipboard fallback·실패 처리 PASS |
| Git diff 공백 검사 | PASS |

브라우저에서 375×844 / 390×844 / 430×844 / 1440×1000 화면을 검증했습니다. 각 화면에서 document scrollWidth가 viewport 폭과 같아 가로 넘침이 없었습니다. 8개 상세 기본 접힘, 전체 펼침, Enter로 접기 및 모바일 펼침 시 가로 넘침 없음도 확인했습니다. 저장 버튼의 저장 완료 상태와 브라우저 오류 로그 0건을 확인했습니다.

375px 추가 사례: MBTI 미입력(참여 소스 3개), 손금 참여(5개), 판독 불가(손금 제외), legacy(근거 미저장), 긴 Identity와 키워드 모두 가로 넘침이 없었습니다.

검증 한계: 브라우저 viewport 검증이며 실제 iPhone/Android 기기 검증은 아닙니다. OS 공유창에서 외부 앱으로 보내는 최종 동작은 실행하지 않았고 공유 반환값은 mock으로 검증했습니다. Palm 보안 회귀는 가짜 provider와 로컬 PGlite 등을 사용하며 실제 다중 연결 운영 DB 검증·공개 ON 승인을 대체하지 않습니다.

## 로컬 미리보기와 이미지

- 실제 앱: http://127.0.0.1:3100
- 합성 결과 선택: http://127.0.0.1:3101/__fixtures
- 합성 결과에서 `검증 v4 열기` → `저장된 분석 기록` → `보기`를 선택합니다. 다른 사례도 같은 방식으로 볼 수 있습니다.
- 별도 로컬 origin(3101)에 합성 결과만 저장하므로 실제 서비스 저장 결과와 분리됩니다.
- 이 폴더의 result-375.jpg / result-390.jpg / result-430.jpg / result-1440.jpg: 폭별 전체 화면.
- palm-detail-375.jpg: 펼친 손금 상세. legacy-375.jpg / noMbti-375.jpg / unusable-375.jpg / long-375.jpg: 예외 상태.
- preview.jpg: 검토용 미리보기.

서버 종료 후 재현하려면 프로젝트에서 다음 명령을 사용합니다(각 서버는 별도 터미널).

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
npx tsx scripts/regression-result-first.tsx --fixtures=/tmp/destiny-result-fixtures.json
node scripts/preview-result-first.mjs
```

## 변경 위치와 승인 상태

- app/components/ResultFirst.tsx: 결과 중심 화면 및 상세.
- app/lib/resultPresentation.ts: 저장된 근거의 표시용 집계.
- app/page.tsx: 결과 화면 연결, 기록 위치 이동.
- app/globals.css: 결과 화면 전용 색상·레이아웃·반응형 스타일.
- app/components/IntegratedResult.tsx / SiteHeader.tsx: 장식 아이콘 제거.
- app/layout.tsx: 한국어 lang와 서비스 메타데이터.
- scripts/regression-result-first.tsx / preview-result-first.mjs: 로컬 호환성 검사와 합성 결과 미리보기.

Git push·Vercel 배포·커밋·외부 서비스 설정 변경을 하지 않았습니다. 변경 사항은 로컬 작업 트리에 있으며 검토 및 승인 대기 상태입니다.
