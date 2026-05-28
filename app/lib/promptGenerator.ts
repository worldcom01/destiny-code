import type { AnalysisOutput } from './analysis';

/**
 * Generates a structured prompt for OpenAI API.
 * Drop-in ready: pass the return value to messages[0].content in the chat endpoint.
 */
export function generateAnalysisPrompt(result: AnalysisOutput, name: string): string {
  const missing =
    result.saju.missingElements.length > 0
      ? result.saju.missingElements.join(', ')
      : '없음';

  return `당신은 심리 상담과 동양 철학을 통합한 AI 운명 분석가입니다.
아래 사용자 데이터를 바탕으로 깊이 있는 운명 해석을 제공하세요.

[사용자 데이터]
이름: ${name}
사주 일간: ${result.saju.dayStemKo}(${result.saju.dayStem})
사주 지배 오행: ${result.saju.dominantElement} / 부재 오행: ${missing}
별자리: ${result.zodiac.sign} (${result.zodiac.element} 원소, ${result.zodiac.rulingPlanet} 지배)
MBTI: ${result.mbtiTraits.type} (${result.mbtiTraits.groupLabel})
혈액형: ${result.bloodType.type}형
타로 카드: ${result.tarot.name} (${result.tarot.nameEn})
교집합 키워드: ${result.commonKeywords.join(', ')}

[요청]
아래 5가지 섹션에 대해 각 3~5문장으로 작성하세요.
단정적 예언보다는 반복되는 패턴과 내면 흐름 중심으로 서술하고,
강점과 그림자(약점·갈등·반복 문제)를 균형 있게 포함하세요.

1. 핵심 성향 — 여러 체계에서 공통적으로 나타나는 심리 패턴
2. 감정 흐름 — 감정 처리 방식의 강점과 취약점
3. 인간관계 패턴 — 관계에서 반복되는 흐름과 피로 패턴
4. 현재 인생 흐름 — 현재 삶의 에너지 방향과 맹점
5. 운명 키워드 해석 — 교집합 키워드의 심층 의미

[문체 규칙]
- "당신은 ~입니다" 대신 "여러 체계에서 나타나는 흐름은 ~입니다" 형식
- "반복되는 패턴", "내면 흐름", "운명 코드" 표현 적극 활용
- 과장된 미래 예언 금지
- 심리 상담 느낌의 자연스러운 문체`;
}

/**
 * Generates the system message for OpenAI chat completions.
 */
export function getSystemPrompt(): string {
  return `당신은 사주, 타로, 별자리, MBTI, 혈액형을 통합하여 분석하는 AI 운명 상담가입니다.
분석은 심리학적 통찰과 동양 철학을 결합하며, 사용자가 자신의 반복 패턴을 이해하도록 돕습니다.
단정적 예언보다는 경향과 패턴을 중심으로 서술하고, 강점과 그림자를 균형 있게 다룹니다.`;
}
