import type { AnalysisOutput } from './analysis';

export function generateShareText(result: AnalysisOutput, nickname: string): string {
  const keywords = result.commonKeywords.join(' / ');
  const firstSection = result.detailedReading.sections[0]?.content ?? '';
  // First sentence only
  const summary = firstSection.split('. ')[0] + '.';

  const mbtiPart = result.mbtiTraits.type ? ` · ${result.mbtiTraits.type}` : '';
  return `🔮 AI 운명 교집합 분석 결과

👤 ${nickname}의 운명 코드

✦ 반복 키워드
${keywords}

✦ ${result.zodiac.sign}${mbtiPart} · ${result.bloodType.type}형
✦ 타로: ${result.tarot.name} (${result.tarot.nameEn})

${summary}

→ AI 운명 교집합 분석으로 나의 운명 코드를 확인해보세요`;
}

export type ShareOutcome = 'shared' | 'copied' | 'failed';

export async function shareResult(text: string): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined') return 'failed';

  // Web Share API — works on mobile + some desktop (Chrome, Edge)
  if (navigator.share) {
    try {
      await navigator.share({ title: 'AI 운명 교집합 분석', text });
      return 'shared';
    } catch {
      // User cancelled or API unavailable — fall through to clipboard
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
