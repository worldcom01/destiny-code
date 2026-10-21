'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ensurePalmSession } from '@/app/lib/palmClient';
import { normalizePalmPhoto, PALM_PHOTO_ERROR_TEXT } from '@/app/lib/palmPhoto';
import { PALM_DISCLAIMER, PALM_PROCESSING_NOTICE_TEXT } from '@/app/lib/palmPresentation';

// ── Palm V2: 입력 단계의 선택형 손바닥 사진 ─────────────────────────────────────
// 사진은 선택 사항이다. 없어도 기존 분석은 그대로 동작한다.
// 공개 Palm이 꺼져 있으면(세션 enabled:false) 이 영역 자체를 보여 주지 않는다.

export type PalmPhoto = { blob: Blob; previewUrl: string };

type Props = { photo: PalmPhoto | null; onChange: (photo: PalmPhoto | null) => void };

export default function PalmPhotoInput({ photo, onChange }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    ensurePalmSession().then((s) => { if (!cancelled) setAvailable(s.enabled); });
    return () => { cancelled = true; };
  }, []);

  if (!available) return null;

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 사진을 다시 고를 수 있게
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const r = await normalizePalmPhoto(file);
    setBusy(false);
    if (!r.ok) {
      setProblem(PALM_PHOTO_ERROR_TEXT[r.error]);
      return;
    }
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onChange({ blob: r.blob, previewUrl: URL.createObjectURL(r.blob) });
  };

  const remove = () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onChange(null);
  };

  return (
    <div className="mt-6 p-4 rounded-xl bg-slate-900/40 border border-violet-500/20">
      <p className="text-sm font-semibold text-violet-200">✋ 손바닥 사진 <span className="text-slate-500 font-normal text-xs">(선택)</span></p>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
        손금을 함께 분석하면 사주·별자리·MBTI와 겹치는 패턴까지 통합해서 보여 드려요. 주로 쓰는 손의 손바닥 전체가 밝게 보이도록 찍어 주세요.
      </p>

      {photo ? (
        <div className="mt-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt="선택한 손바닥 사진 미리보기" className="w-24 h-24 object-cover rounded-lg border border-slate-700" />
          <div className="flex flex-col gap-2 text-xs">
            <span className="text-emerald-300">사진이 준비됐어요. 분석할 때 함께 보냅니다.</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => galleryRef.current?.click()} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300">다른 사진</button>
              <button type="button" onClick={remove} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400">빼기</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()}
            className="py-2.5 rounded-lg border border-violet-500/30 text-violet-200 text-xs disabled:opacity-50">📷 촬영하기</button>
          <button type="button" disabled={busy} onClick={() => galleryRef.current?.click()}
            className="py-2.5 rounded-lg border border-violet-500/30 text-violet-200 text-xs disabled:opacity-50">🖼 앨범에서 선택</button>
        </div>
      )}
      {busy && <p className="mt-2 text-xs text-slate-400">사진을 준비하는 중…</p>}
      {problem && <p className="mt-2 text-xs text-amber-300" role="alert">{problem}</p>}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pick} />

      <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">{PALM_PROCESSING_NOTICE_TEXT} {PALM_DISCLAIMER}</p>
    </div>
  );
}
