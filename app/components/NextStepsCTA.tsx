import Link from 'next/link';

interface NextStepCard {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
  accent: 'amber' | 'rose' | 'violet';
}

const ACCENT_CLASSES: Record<NextStepCard['accent'], { hoverBorder: string; button: string }> = {
  amber: {
    hoverBorder: 'hover:border-amber-400/40',
    button: 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/50',
  },
  rose: {
    hoverBorder: 'hover:border-rose-400/40',
    button: 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25 hover:border-rose-400/50',
  },
  violet: {
    hoverBorder: 'hover:border-violet-400/40',
    button: 'bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25 hover:border-violet-400/50',
  },
};

const CARDS: NextStepCard[] = [
  {
    icon: '🎨',
    title: '탄생디자인 만들기',
    description: '당신의 운명코드를\n하나의 작품으로 제작합니다.',
    buttonLabel: '탄생디자인 보기',
    href: 'https://www.destiny-code.kr/birth-design',
    accent: 'amber',
  },
  {
    icon: '💕',
    title: '다른 사람과 궁합 보기',
    description: '두 사람의 운명코드를 기반으로\n관계의 흐름을 분석합니다.',
    buttonLabel: '운명궁합 보기',
    href: '/compatibility',
    accent: 'rose',
  },
  {
    icon: '🏠',
    title: 'Destiny Lab 홈',
    description: '다른 운명 실험과 프로젝트를\n확인해보세요.',
    buttonLabel: '홈으로 이동',
    href: 'https://www.destiny-code.kr',
    accent: 'violet',
  },
];

export function NextStepsCTA() {
  return (
    <section
      className="pt-4 opacity-0 [animation:fadeInUp_0.5s_ease-out_forwards]"
      style={{ animationDelay: '1260ms' }}
      aria-label="다음 단계 추천"
    >
      <div className="text-center mb-5">
        <h2 className="text-lg font-bold text-white mb-1.5">당신의 운명 여정 계속하기</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          운명코드를 발견했다면,
          <br className="sm:hidden" />
          {' '}이제 더 깊은 연결을 경험해보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CARDS.map((card) => {
          const accent = ACCENT_CLASSES[card.accent];
          const isExternal = card.href.startsWith('http');

          const cardBody = (
            <>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
                <span aria-hidden="true" className="text-lg">{card.icon}</span>
                {card.title}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-4 whitespace-pre-line">
                {card.description}
              </p>
              <span
                className={`inline-flex items-center justify-center w-full px-4 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${accent.button}`}
              >
                {card.buttonLabel}
              </span>
            </>
          );

          const className = `block bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl p-5
            shadow-xl hover:shadow-2xl ${accent.hoverBorder} hover:scale-[1.02]
            transition-all duration-300`;

          return isExternal ? (
            <a key={card.title} href={card.href} className={className}>
              {cardBody}
            </a>
          ) : (
            <Link key={card.title} href={card.href} className={className}>
              {cardBody}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
