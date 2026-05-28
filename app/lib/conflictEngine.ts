import type { SajuOutput, ZodiacResult, MbtiResult, BloodTypeResult } from './analysis';

export interface ConflictPattern {
  title: string;
  description: string;
}

export function detectConflicts(
  saju: SajuOutput,
  zodiac: ZodiacResult,
  mbti: MbtiResult,
  bloodType: BloodTypeResult,
): ConflictPattern[] {
  const conflicts: ConflictPattern[] = [];

  const isIntro    = mbti.type[0] === 'I';
  const isThinking = mbti.type[2] === 'T';
  const isJudging  = mbti.type[3] === 'J';
  const dom        = saju.dominantElement;

  if (isIntro && zodiac.element === '불') {
    conflicts.push({
      title: '내향 에너지 vs 불 원소',
      description: `${zodiac.sign}의 불 원소가 요구하는 외향적 표출과 ${mbti.type}의 내향적 충전 방식이 충돌합니다. 사교적 상황 뒤 극단적 피로, 또는 열정을 드러내고 싶은 충동과 혼자 있고 싶은 욕구 사이 갈등이 주기적으로 반복됩니다.`,
    });
  }

  if (isThinking && zodiac.element === '물') {
    conflicts.push({
      title: '감성-논리 내면 긴장',
      description: `${zodiac.sign}의 깊은 물 원소 감수성과 ${mbti.type}의 논리 중심 처리 방식이 충돌합니다. 감정적으로 강하게 반응하면서도 이를 논리로 포장하려는 패턴이 자기 소외감과 내면 피로를 만들어냅니다.`,
    });
  }

  if (dom === 'fire' && zodiac.element === '물') {
    conflicts.push({
      title: '수화(水火) 충돌',
      description: `사주의 강한 화(火) 기운과 ${zodiac.sign}의 물 원소 감수성이 상충합니다. 열정적으로 달려나가고 싶은 충동과 깊이 숙고하려는 감수성 사이에서 방향이 자주 흔들리는 에너지 구조입니다.`,
    });
  }

  if (dom === 'water' && zodiac.element === '불') {
    conflicts.push({
      title: '화수(火水) 충돌',
      description: `${zodiac.sign}의 불 원소 추진력과 사주의 강한 수(水) 기운 사이에 대립이 형성됩니다. 즉흥적으로 행동하고 싶은 충동과 깊이 분석하고 싶은 본능이 충돌해 결정 장애 패턴이 반복될 수 있습니다.`,
    });
  }

  if (isJudging && saju.missingElements.includes('earth')) {
    conflicts.push({
      title: '구조화 욕구 vs 기반 부재',
      description: `${mbti.type}의 강한 계획·체계화 성향이 사주의 토(土) 기운 부재와 충돌합니다. 강하게 구조화하려 하지만 현실적 기반이 충분히 갖춰지지 않아 계획이 중도에 흔들리는 경험이 반복됩니다.`,
    });
  }

  if (bloodType.type === 'A' && mbti.typeGroup === 'SP') {
    conflicts.push({
      title: '완벽주의 vs 즉흥성',
      description: `혈액형 A형의 꼼꼼한 완벽주의와 ${mbti.type}의 즉흥적·경험 중심 에너지가 내면에서 충돌합니다. 계획대로 되지 않을 때 과도한 자기비판이 일어나는 패턴이 반복될 수 있습니다.`,
    });
  }

  if (bloodType.type === 'B' && mbti.typeGroup === 'SJ') {
    conflicts.push({
      title: '자유 욕구 vs 책임 지향',
      description: `혈액형 B형의 강한 자유·개인주의 성향이 ${mbti.type}의 안정·책임 지향 패턴과 충돌합니다. 규칙과 자유 사이에서 반복적으로 갈등하며 어느 쪽도 완전히 선택하지 못하는 흐름이 나타납니다.`,
    });
  }

  return conflicts.slice(0, 2);
}
