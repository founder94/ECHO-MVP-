import { useEffect, useMemo, useState } from 'react';
import { TAROT_DECK, type TarotCard } from '@/doit/app/plan-a/tarotDeck';
import {
  generateTarotInterpretation,
  type TarotInterpretation,
} from '@/doit/lib/openai';
import { SHEET_URLS, spriteStyle, SERIF, SPACE_BG } from '../cardArt';

interface Props {
  onComplete: () => void;
  onExit: () => void;
  onBack: () => void;
}

const PURPOSES = [
  '친구 관계',
  '이성 관계',
  '동성 친구 관계',
  '동료 관계',
  '관심사 기반 관계',
  '가치관 기반 관계',
  '창업가 그룹',
  '전문직 그룹',
  '크리에이터 그룹',
  '프로젝트·스터디·성장',
  '목적성 기반 대화',
  '성소수자 보호 공간',
];

type Phase = 'purpose' | 'deck' | 'reveal' | 'result';

const dayKey = () => new Date().toLocaleDateString('sv-SE');
const storageKey = () => `echo-tarot-daily:${dayKey()}`;

function shuffled(): TarotCard[] {
  const cards = [...TAROT_DECK];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const t = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[t]] = [cards[t], cards[i]];
  }
  return cards;
}

function CardBack({ index }: { index: number }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] border border-[#d9bb72]/70 bg-[#1a1a22]">
      <div className="absolute inset-[7%] rounded-[9%] border border-[#d9bb72]/45" />
      <div className="absolute inset-[13%] rounded-[9%] border border-[#d9bb72]/25" />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, #e7cb7b 0 2px, transparent 3px), conic-gradient(from 45deg at 50% 50%, transparent 0 12.5%, rgba(231,203,123,.22) 12.5% 25%, transparent 25% 37.5%, rgba(231,203,123,.22) 37.5% 50%, transparent 50% 62.5%, rgba(231,203,123,.22) 62.5% 75%, transparent 75% 87.5%, rgba(231,203,123,.22) 87.5%)',
          backgroundSize: '28px 28px, 100% 100%',
        }}
      />
      <span className="absolute bottom-2 right-2 text-[8px] text-[#e7cb7b]/30">
        {String(index + 1).padStart(2, '0')}
      </span>
    </div>
  );
}

function CardFace({ card }: { card: TarotCard }) {
  const sheetUrl = SHEET_URLS[card.sheet];
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[#e8ddbd]">
      {sheetUrl && (
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{ backgroundImage: `url(${sheetUrl})`, ...spriteStyle(card) }}
        />
      )}
      <div className="pointer-events-none absolute inset-[5%] rounded-[8%] border border-[#a8863f]/45" />
      <div className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-[#a8863f]/25" />
    </div>
  );
}

export default function TarotFlow({ onComplete, onExit, onBack }: Props) {
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey()) || 'null') as {
        cardId: string;
        purpose: string;
      } | null;
    } catch {
      return null;
    }
  }, []);

  const [purpose, setPurpose] = useState(saved?.purpose || '');
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffled());
  const [phase, setPhase] = useState<Phase>(saved ? 'reveal' : 'purpose');
  const [selected, setSelected] = useState<TarotCard | null>(() =>
    saved ? TAROT_DECK.find((c) => c.id === saved.cardId) || null : null,
  );

  // AI 해석 상태
  const [result, setResult] = useState<TarotInterpretation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (card: TarotCard) => {
    setSelected(card);
    setPhase('reveal');
    localStorage.setItem(storageKey(), JSON.stringify({ cardId: card.id, purpose }));
  };

  const requestReading = () => {
    if (!selected || loading) return;
    setLoading(true);
    setError(null);
    generateTarotInterpretation(selected.nameKo, purpose)
      .then((r) => {
        setResult(r);
        setPhase('result');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.');
      })
      .finally(() => setLoading(false));
  };

  // 페이지 뒤로가기 시 시작 화면으로 돌아갈 수 있도록 헤더 제공
  return (
    <div className="min-h-screen overflow-x-hidden" style={SPACE_BG}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 pt-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#F5F3EF] transition-colors hover:bg-white/10"
          >
            <i className="ri-arrow-left-line text-lg" />
          </button>
          <span className="text-[11px] tracking-[.2em] text-[#6B7280]">FREE · 오늘의 타로</span>
        </div>

        {phase === 'purpose' && (
          <div className="flex flex-1 flex-col">
            <h1
              className="mt-7 text-[26px] leading-[1.3] text-[#F5F3EF]"
              style={{ fontFamily: SERIF }}
            >
              오늘, 어떤 사람을
              <br />
              만나고 싶나요?
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
              관계 목적을 먼저 고르면 카드와 대화가 오늘의 탐색 맥락이 돼요.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {PURPOSES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPurpose(item)}
                  className={`min-h-12 rounded-xl px-3 text-left text-[13px] transition-colors ${
                    purpose === item
                      ? 'border-[#C9A24B] bg-[#C9A24B]/12 text-[#F3DFA8]'
                      : 'border-white/10 bg-[#14161D] text-[#9CA3AF]'
                  } border`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'deck' && (
          <div className="flex flex-1 flex-col">
            <h1 className="mt-7 text-[26px] leading-[1.3] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
              78장 중 오늘 마음이
              <br />
              멈추는 한 장을 고르세요
            </h1>
            <p className="mt-2 text-xs text-[#d6ba78]">{purpose}</p>
            <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
              모든 카드는 서로 다른 원화예요. 좌우로 넘겨 한 장을 선택해 주세요.
            </p>
            <div className="-mx-5 mt-6 flex snap-x gap-2.5 overflow-x-auto px-[42%] pb-4 [scrollbar-width:none]">
              {deck.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  aria-label={`78장 중 ${index + 1}번째 카드 선택`}
                  onClick={() => choose(card)}
                  className="h-[210px] w-[136px] shrink-0 snap-center rounded-[14px] border border-[#d9bb72]/60 bg-[#101218] transition-transform hover:-translate-y-1 active:scale-95"
                >
                  <CardBack index={index} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDeck(shuffled())}
              className="mx-auto mt-2 flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm text-[#9CA3AF] transition-colors hover:bg-white/5"
            >
              <i className="ri-refresh-line" />
              카드 다시 섞기
            </button>
          </div>
        )}

        {phase === 'reveal' && selected && (
          <div className="flex flex-1 flex-col items-center">
            <p className="mt-6 text-xs tracking-[.18em] text-[#6B7280]">
              {saved ? '오늘 이미 선택한 카드' : '오늘 당신이 고른 카드'}
            </p>
            <div className="mt-5 h-[360px] w-[236px] rounded-[18px] border border-[#d9bb72]/60 bg-[#101218]">
              <CardFace card={selected} />
            </div>
            <h2 className="mt-5 text-xl text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
              {selected.nameKo}
            </h2>
            <p className="mt-1 text-[11px] tracking-[.18em] text-[#6B7280]">{selected.nameEn}</p>
            <div className="mt-4 w-full rounded-xl border border-white/10 bg-[#14161D] p-4 text-left">
              <p className="text-sm text-[#e4cb8f]">
                <i className="ri-moon-clear-line mr-1.5" />
                오늘 탐색에 반영할 맥락
              </p>
              <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
                <b className="text-[#F5F3EF]">{purpose}</b> 목적과 오늘의 카드에서 시작된 대화를
                함께 참고해요.
              </p>
            </div>
            <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-5 text-[#6B7280]">
              <i className="ri-shield-check-line mt-0.5 shrink-0 text-[#C9A24B]" />
              카드는 미래를 확정하거나 사람을 단독 판정하지 않아요. 결과는 참고로만 봐주세요.
            </p>
          </div>
        )}

        {phase === 'result' && (
          <div className="flex flex-1 flex-col">
            <p className="mt-6 flex items-center gap-1.5 text-[11px] tracking-[.08em] text-[#6B7280]">
              {loading && <i className="ri-loader-4-line animate-spin text-[#C9A24B]" />}
              {loading ? 'AI가 카드를 해석하고 있어요' : 'AI 해석'}
            </p>
            <h1 className="mt-3 text-[26px] leading-[1.3] text-[#F5F3EF]" style={{ fontFamily: SERIF }}>
              지금의 당신에게 보이는 흐름
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-[#9CA3AF]">
              이 결과는 미래를 단정하지 않아요. 지금의 마음과 선택을 돌아보는 참고로 봐주세요.
            </p>

            {result && (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-[#14161D] px-3 py-1 text-xs text-[#9CA3AF]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-[15px] leading-7 text-[#F5F3EF]">{result.summary}</p>
                <div className="mt-5 flex flex-col gap-3">
                  {result.cards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-white/10 bg-[#14161D] p-4">
                      <p className="text-[11px] tracking-[.1em] text-[#6B7280]">{card.label}</p>
                      <p className="mt-1.5 text-[14.5px] leading-6 text-[#F5F3EF]">{card.value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-white/10 bg-[#14161D] p-4">
                <p className="text-sm leading-6 text-[#9CA3AF]">{error}</p>
                <button
                  type="button"
                  onClick={requestReading}
                  className="mt-3 flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-[#F5F3EF] transition-colors hover:bg-white/5"
                >
                  <i className="ri-refresh-line" />
                  다시 시도
                </button>
              </div>
            )}
          </div>
        )}

        {/* 하단 액션 */}
        <div className="mt-6 flex flex-col gap-2">
          {phase === 'purpose' && (
            <button
              type="button"
              disabled={!purpose}
              onClick={() => setPhase('deck')}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity disabled:opacity-40"
            >
              78장 카드 만나기
            </button>
          )}
          {phase === 'reveal' && (
            <button
              type="button"
              onClick={requestReading}
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity disabled:opacity-40"
            >
              {loading ? '해석 중...' : '카드 이야기 듣기'}
            </button>
          )}
          {phase === 'result' && result && (
            <button
              type="button"
              onClick={onComplete}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity hover:opacity-90"
            >
              AI와 조금 더 이야기하기
            </button>
          )}
          {phase !== 'deck' && (
            <button
              type="button"
              onClick={onExit}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 text-sm text-[#9CA3AF] transition-colors hover:bg-white/5"
            >
              오늘은 여기까지만 볼게요
            </button>
          )}
        </div>
      </div>
    </div>
  );
}