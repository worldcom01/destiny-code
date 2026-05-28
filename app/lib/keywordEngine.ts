import type { SajuOutput, ZodiacResult, MbtiResult, BloodTypeResult, TarotResult, CoreTag } from './analysis';

export interface KeywordStrength {
  keyword: string;
  coreTag: CoreTag;
  percentage: number;
  sources: string[];
}

const TAG_LABELS: Record<CoreTag, string> = {
  창의적: '창의적 사고',
  분석적: '분석적 사고',
  감성적: '감성적 공감',
  실용적: '실용적 실행',
  사교적: '뛰어난 사교성',
  독립적: '강한 독립심',
  직관적: '예리한 직관력',
  체계적: '체계적 사고',
  열정적: '넘치는 열정',
  포용적: '따뜻한 포용력',
};

export function computeKeywordStrengths(
  saju: SajuOutput,
  zodiac: ZodiacResult,
  mbti: MbtiResult,
  bloodType: BloodTypeResult,
  tarot: TarotResult,
): KeywordStrength[] {
  const systems: Array<{ label: string; tags: CoreTag[] }> = [
    { label: '사주',         tags: saju.coreTags },
    { label: '별자리',       tags: zodiac.coreTags },
    { label: mbti.type,     tags: mbti.coreTags },
    { label: `${bloodType.type}형`, tags: bloodType.coreTags },
    { label: tarot.name,    tags: tarot.coreTags },
  ];

  const activeSystems = systems.filter((s) => s.tags.length > 0);
  const allTags = new Set<CoreTag>(activeSystems.flatMap((s) => s.tags));
  const results: KeywordStrength[] = [];

  allTags.forEach((tag) => {
    const sources = activeSystems.filter((s) => s.tags.includes(tag)).map((s) => s.label);
    results.push({
      keyword: TAG_LABELS[tag],
      coreTag: tag,
      percentage: Math.round((sources.length / activeSystems.length) * 100),
      sources,
    });
  });

  return results.sort((a, b) => b.percentage - a.percentage).slice(0, 5);
}
