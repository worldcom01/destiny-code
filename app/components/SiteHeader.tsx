'use client';

import { useState } from 'react';
import Link from 'next/link';

export type SiteNavKey = 'intersection' | 'birthdesign' | 'compatibility' | 'home';

interface NavItem {
  key: SiteNavKey;
  label: string;
  icon: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'intersection',  label: '운명교집합', icon: '🔮', href: '/' },
  { key: 'birthdesign',   label: '탄생디자인', icon: '🎨', href: 'https://www.destiny-code.kr/birth-design' },
  { key: 'compatibility', label: '운명궁합',   icon: '💕', href: '/compatibility' },
  { key: 'home',          label: '홈',         icon: '🏠', href: 'https://www.destiny-code.kr' },
];

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const className = `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
    active
      ? 'bg-purple-500/15 border border-purple-400/30 text-purple-200 shadow-[0_0_14px_-2px_rgba(168,85,247,0.55)]'
      : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
  }`;
  const content = (
    <>
      <span aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </>
  );

  if (item.href.startsWith('http')) {
    return (
      <a
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={className}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={className} onClick={onClick}>
      {content}
    </Link>
  );
}

export function SiteHeader({ active }: { active: SiteNavKey }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative z-30 border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* 브랜드 */}
        <a href="https://www.destiny-code.kr" className="group">
          <p className="text-base font-bold text-white tracking-wide group-hover:text-purple-300 transition-colors">
            Destiny Lab
          </p>
          <p className="text-[10px] text-slate-500 tracking-wide hidden sm:block">
            운명을 연구하는 디지털 실험실
          </p>
        </a>

        {/* 데스크톱 메뉴 */}
        <nav className="hidden md:flex items-center gap-1" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.key} item={item} active={active === item.key} />
          ))}
        </nav>

        {/* 모바일 햄버거 */}
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-slate-700/50 text-slate-300 hover:text-white hover:border-purple-500/40 transition-colors"
          aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* 모바일 메뉴 패널 */}
      {open && (
        <nav className="md:hidden border-t border-slate-800/60 px-4 py-3 flex flex-col gap-1" aria-label="주요 메뉴 (모바일)">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.key} item={item} active={active === item.key} onClick={() => setOpen(false)} />
          ))}
        </nav>
      )}
    </div>
  );
}
