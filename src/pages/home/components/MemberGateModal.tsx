import { useNavigate } from 'react-router-dom';

interface MemberGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export default function MemberGateModal({ isOpen, onClose, isDarkMode }: MemberGateModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] p-8 text-center"
        style={{
          background: '#0f0f0f',
          animation: 'modal-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer"
          aria-label="닫기"
        >
          <i className="ri-close-line text-base" />
        </button>

        <div className="mb-7">
          <div className="text-[9px] font-mono tracking-[0.35em] uppercase text-white/15 mb-4">
            MEMBERS ONLY
          </div>
          <h3 className="font-display font-bold text-lg text-white mb-3 tracking-tight">
            ECHO는 회원 전용 경험입니다.
          </h3>
          <p className="text-white/45 text-sm leading-relaxed">
            관계와 행동의 흐름을 통해
            <br />
            진짜 나를 더 선명하게 이해하기 위해
            <br />
            먼저 계정을 만들어 주세요.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              onClose();
              navigate('/auth');
            }}
            className="w-full rounded-full px-6 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #FF6B9D, #9B59B6)',
              color: '#FFFFFF',
              boxShadow: '0 0 40px rgba(255,107,157,0.2)',
            }}
          >
            회원가입하기
          </button>
          <button
            onClick={() => {
              onClose();
              navigate('/auth?mode=login');
            }}
            className="w-full rounded-full px-6 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer border border-white/[0.12] text-white/60 hover:text-white/85 hover:border-white/[0.22] hover:bg-white/[0.03]"
          >
            로그인하기
          </button>
          <button
            onClick={onClose}
            className="text-white/25 text-xs hover:text-white/45 transition-colors cursor-pointer mt-1.5 py-1"
          >
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  );
}