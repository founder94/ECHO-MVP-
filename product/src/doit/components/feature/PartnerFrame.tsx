import { useEffect, useState } from 'react';
import DoItSymbol from '@/components/DoItSymbol';
import type { MatchPartner } from '@/doit/lib/connectApi';
import { frameSentence } from '@/doit/lib/partnerFrame';
import './partner-frame.css';

// 2026-10-01 대표 「PROFILE / PHOTO REVEAL / SCENES」: ECHO FRAME — 상대가 직접 남긴 한 문장 → 실제 사진의 장면(꽉 찬 얼굴 사진 아님) → 관계 단서 하나.
// 서버 계약 그대로만 그린다: 이 화면은 서버가 공개(revealed)라고 보낸 partner 만 받는다. 공개 전에는 partner 자체가 오지 않는다(connectApi 주석).
//   흐림·가리기로 숨기는 사진은 없다. 부분 공개(사진 조각)·장면들(Scenes)은 서버 지원이 없어 그리지 않는다(SERVER HOLD).
// FILM: 이 연결의 FRAME 을 처음 볼 때 한 번만 1.4초 장면 진입. 다시 열면 바로 보인다. 이 기기 표시용 기억일 뿐 공개 권한과 무관하다.
const FILM_KEY = (matchId: string) => `echo:frame-film:${matchId}`;

function firstFilm(matchId: string): boolean {
  try {
    if (localStorage.getItem(FILM_KEY(matchId))) return false;
    localStorage.setItem(FILM_KEY(matchId), '1');
    return true;
  } catch {
    return false; // 저장이 막힌 환경은 매번 장면 진입을 보이지 않는다(조용한 쪽)
  }
}

type PhotoState = 'loading' | 'ready' | 'failed';

export default function PartnerFrame({ matchId, partner, onRetry }: { matchId: string; partner: MatchPartner; onRetry: () => void }) {
  const [film] = useState(() => firstFilm(matchId));
  const [photo, setPhoto] = useState<PhotoState>(partner.photo_url ? 'loading' : 'failed');
  useEffect(() => { setPhoto(partner.photo_url ? 'loading' : 'failed'); }, [partner.photo_url]);
  const sentence = frameSentence(partner);
  const fromAnswer = !partner.bio && !!sentence;
  const bio = (partner.bio ?? '').replace(/\s+/g, ' ').trim();
  const rest = bio && sentence && bio.startsWith(sentence) ? bio.slice(sentence.length).trim() : bio && !sentence.endsWith('…') ? '' : bio;

  return <section className="doit-partner-frame" data-film={film ? 'true' : undefined} aria-label={`${partner.nickname}의 소개`}>
    {sentence && <blockquote className="doit-partner-sentence">
      <p>{sentence}</p>
      <cite>{partner.nickname} · {fromAnswer ? '첫 질문에 쓴 답' : '직접 쓴 소개'}</cite>
    </blockquote>}
    <figure className="doit-partner-scene" data-photo={photo}>
      {partner.photo_url && photo !== 'failed' && <img src={partner.photo_url} alt={`${partner.nickname}의 대표 사진`} width={480} height={600} decoding="async" referrerPolicy="no-referrer" onLoad={() => setPhoto('ready')} onError={() => setPhoto('failed')} />}
      {photo === 'failed' && <div className="doit-partner-scene-empty">
        <DoItSymbol decorative className="doit-partner-anchor" />
        {partner.photo_url
          ? <><p>사진을 불러오지 못했어요.</p><button type="button" className="doit-connect-link" onClick={onRetry}>다시 불러오기</button></>
          : <p>아직 보여 줄 사진이 없어요.</p>}
      </div>}
    </figure>
    <p className="doit-partner-meta">
      <strong>{partner.nickname}</strong>
      {partner.purpose && <span>{partner.purpose}</span>}
    </p>
    {rest && <p className="doit-partner-bio">{rest}</p>}
  </section>;
}
