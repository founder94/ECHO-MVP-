import { useNavigate } from 'react-router-dom';
import { SPACE_BG } from '../fortune/cardArt';

// 등급 순서는 서버가 결정하는 고정 체계. Red → Silver → Gold → Perfume → Platinum → Black.
// 현재 등급·승급 점수·혜택은 서버 판정 산식이 확정되지 않아 임의 생성하지 않고,
// 화면에는 고정 순서와 평가 방향만 표시한다. (가짜 "현재 등급" 표시 없음)
const GRADES = [
  { id: 'red', label: '레드', color: '#C4453C', desc: '신뢰를 처음 쌓아가는 단계' },
  { id: 'silver', label: '실버', color: '#A8B0B8', desc: '활동을 꾸준히 이어온 단계' },
  { id: 'gold', label: '골드', color: '#C9A24B', desc: '함께한 활동이 쌓인 단계' },
  { id: 'perfume', label: '퍼퓸', color: '#D9A7A0', desc: '깊은 활동을 통해 쌓인 단계' },
  { id: 'platinum', label: '플래티늄', color: '#6E7A84', desc: '오랜 신뢰가 쌓인 단계' },
  { id: 'black', label: '블랙', color: '#E8E3DA', desc: '돈으로 구매할 수 없는 최고 신뢰' },
];

const FACTORS = [
  '약속 이행',
  '신고·차단 이력',
  '상대방 배려',
  '미션 참여',
  '활동 일관성',
  '피드백',
  '커뮤니티 기여',
  '권한 악용 여부',
];

export default function GradePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-x-hidden" style={SPACE_BG}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/do-it/landing')}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#F5F3EF] transition-colors hover:bg-white/10"
          >
            <i className="ri-arrow-left-line text-lg" />
          </button>
          <span className="text-[11px] tracking-[.2em] text-[#6B7280]">등급과 활동</span>
        </div>

        <h1 className="mt-7 text-[26px] leading-[1.3] text-[#F5F3EF]" style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}>
          신뢰는 돈이 아니라
          <br />
          행동으로 쌓여요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
          등급은 함께한 활동으로 쌓인 신뢰의 표시예요. 결제로 구매할 수 없고, 서버가 실제 행동
          누적을 바탕으로 판정합니다.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {GRADES.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#14161D] p-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                style={{
                  backgroundColor: `${g.color}22`,
                  color: g.color,
                  border: `1px solid ${g.color}55`,
                }}
              >
                {g.label.slice(0, 1)}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#F5F3EF]">{g.label}</p>
                <p className="text-xs text-[#9CA3AF]">{g.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-[#14161D] p-4">
          <p className="text-sm font-medium text-[#F5F3EF]">등급 판정에 반영되는 방향</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FACTORS.map((f) => (
              <span key={f} className="rounded-full border border-white/10 bg-[#0A0B0F] px-3 py-1 text-xs text-[#9CA3AF]">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#C9A24B]/30 bg-[#C9A24B]/10 p-4">
          <p className="flex items-start gap-2 text-xs leading-5 text-[#d6ba78]">
            <i className="ri-information-line mt-0.5 shrink-0" />
            현재 내 등급·승급 점수·등급별 혜택은 서버 판정 산식이 확정되지 않아 표시하지 않습니다.
            임의 점수나 자동 승급을 만들지 않아요.
          </p>
        </div>

        <p className="mt-auto pt-6 text-center text-xs leading-5 text-[#6B7280]">
          블랙 등급은 돈으로 구매할 수 없어요.
        </p>
      </div>
    </div>
  );
}