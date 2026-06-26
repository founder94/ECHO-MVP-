import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';

interface TermItem {
  id: string;
  label: string;
  required: boolean;
  summary: string;
  fullText: string;
}

const TERMS_DATA: TermItem[] = [
  {
    id: 'service',
    label: '이용약관 동의',
    required: true,
    summary: 'ECHO는 당신의 자기이해를 돕는 공간입니다. 의료·심리 치료를 대신하지 않으며, 분석은 참고를 위한 것입니다.',
    fullText: `제1조 (목적)
본 약관은 ECHO(이하 "서비스")가 제공하는 인간관계 분석 및 자기이해 플랫폼의 이용 조건과 절차, 회원과 서비스 제공자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
① "서비스"란 회원이 입력한 관계·감정 데이터를 기반으로 AI 분석을 통해 자기이해를 돕는 플랫폼을 의미합니다.
② "회원"이란 본 약관에 동의하고 서비스에 가입하여 서비스를 이용하는 자를 말합니다.

제3조 (서비스의 성격)
① ECHO는 자기이해와 개인 성장을 위한 참고 도구입니다.
② ECHO는 의료 진단, 심리 치료, 법률 상담을 대신하지 않습니다.
③ ECHO의 분석 결과는 참고 자료일 뿐이며, 전문가의 조언을 대체할 수 없습니다.

제4조 (회원의 의무)
① 회원은 진실된 정보를 제공해야 합니다.
② 회원은 타인의 권리를 침해하거나 부적절한 콘텐츠를 게시해서는 안 됩니다.
③ 회원은 서비스를 통해 얻은 타인의 정보를 무단으로 공유해서는 안 됩니다.

제5조 (서비스 이용 제한)
① 서비스는 만 14세 이상만 이용할 수 있습니다.
② 다음과 같은 경우 서비스 이용이 제한될 수 있습니다:
  - 허위 정보 등록
  - 타인의 계정 도용
  - 서비스 운영을 방해하는 행위

제6조 (면책 조항)
① ECHO는 회원이 서비스를 통해 내린 결정에 대해 책임을 지지 않습니다.
② ECHO는 천재지변, 시스템 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.`,
  },
  {
    id: 'privacy',
    label: '개인정보 수집·이용 동의',
    required: true,
    summary: '서비스 제공에 필요한 최소한의 정보만 받습니다. 탈퇴하면 지체 없이 지웁니다.',
    fullText: `제1조 (수집하는 개인정보 항목)
ECHO는 서비스 제공을 위해 다음과 같은 최소한의 개인정보를 수집합니다:
① 필수 항목: 이메일 주소, 비밀번호, 닉네임
② 선택 항목: 연령대

제2조 (수집 및 이용 목적)
① 회원 식별 및 가입 관리
② 서비스 제공 및 개선
③ 중요 공지사항 전달
④ 맞춤형 자기이해 분석 제공

제3조 (보유 및 이용 기간)
① 회원 탈퇴 시 모든 개인정보는 지체 없이 파기됩니다.
② 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관 후 파기합니다.

제4조 (개인정보의 제3자 제공)
① ECHO는 회원의 개인정보를 외부에 판매하지 않습니다.
② 법령에 의한 경우를 제외하고, 회원의 동의 없이 제3자에게 제공하지 않습니다.

제5조 (개인정보 보호 조치)
① 개인정보는 암호화되어 안전하게 저장됩니다.
② 정기적인 보안 점검을 실시합니다.
③ 개인정보 접근 권한은 최소 인원으로 제한됩니다.

제6조 (회원의 권리)
① 회원은 언제든지 자신의 개인정보 열람·수정·삭제를 요청할 수 있습니다.
② 회원은 개인정보 수집·이용에 대한 동의를 철회할 수 있습니다.`,
  },
  {
    id: 'sensitive',
    label: '민감정보(관계·감정 데이터) 수집·이용 동의',
    required: true,
    summary: '당신이 남긴 관계와 감정의 기록은 오직 당신의 분석을 위해 쓰입니다. 가장 조심히 다루겠습니다.',
    fullText: `제1조 (민감정보의 정의)
본 약관에서 "민감정보"란 회원이 서비스 이용 중 입력하는 관계 경험, 감정 상태, 인간관계 패턴, 자기이해와 성장에 관한 데이터를 의미합니다.

제2조 (수집 목적)
민감정보는 오직 다음의 목적으로만 사용됩니다:
① 회원 개인에 대한 자기이해 분석 제공
② 관계 패턴 인식 및 인사이트 도출
③ 회원 맞춤형 서비스 경험 제공

제3조 (보호 원칙)
① 민감정보는 일반 개인정보보다 강화된 보안 체계로 보호됩니다.
② 민감정보는 서비스 제공을 위한 분석 외의 목적으로 사용되지 않습니다.
③ 분석은 자동화된 AI 시스템을 통해 이루어지며, 개별 직원이 회원의 민감정보에 접근하는 것은 엄격히 제한됩니다.

제4조 (보유 기간 및 파기)
① 회원 탈퇴 시 모든 민감정보는 지체 없이 완전히 파기됩니다.
② 회원이 특정 데이터의 삭제를 요청하는 경우, 7일 이내에 처리됩니다.

제5조 (예외 사항)
① 회원이 명시적으로 동의한 경우에 한하여, 익명화된 민감정보가 연구 목적으로 활용될 수 있습니다.
② 이 경우에도 개인을 특정할 수 없도록 완전한 익명화 처리를 거칩니다.`,
  },
  {
    id: 'anonymous',
    label: '익명 통계·연구 활용 동의',
    required: false,
    summary: '동의하시면, 누구인지 알 수 없게 익명 처리된 후에만 더 나은 ECHO를 만드는 데 쓰입니다. 거부해도 서비스 이용에 지장 없습니다.',
    fullText: `제1조 (목적)
본 동의는 ECHO 서비스 개선 및 인간관계 패턴 연구를 위해, 익명화된 데이터를 활용하는 것에 대한 동의입니다.

제2조 (익명화 처리)
① 개인을 특정할 수 없도록 모든 개인 식별 정보가 완전히 제거됩니다.
② 이메일, 닉네임, 연령대 등 개인 식별 가능 정보는 절대 포함되지 않습니다.
③ 통계적 집계 방식으로 가공되어, 개별 데이터로 복원할 수 없습니다.

제3조 (활용 범위)
익명화된 데이터는 다음의 목적으로만 활용됩니다:
① 서비스 알고리즘 개선
② 인간관계 패턴에 관한 학술 연구
③ ECHO 서비스 품질 향상을 위한 내부 분석

제4조 (선택권)
① 본 동의는 완전한 선택 사항입니다.
② 동의하지 않아도 모든 서비스를 동일하게 이용할 수 있습니다.
③ 동의 후에도 언제든지 철회할 수 있으며, 철회 시 해당 데이터는 즉시 연구 목적에서 제외됩니다.`,
  },
  {
    id: 'age',
    label: '만 19세 이상입니다.',
    required: true,
    summary: '',
    fullText: 'ECHO 서비스는 만 19세 이상만 이용할 수 있습니다. 본인은 만 19세 이상임을 확인하며, 이에 해당하지 않을 경우 서비스 이용이 제한될 수 있습니다.',
  },
  {
    id: 'medical',
    label: '의료·상담·진단·법률 서비스가 아님을 이해했습니다.',
    required: true,
    summary: 'ECHO는 자기이해를 돕는 정보 서비스이며, 의료 진단이나 치료, 법률 자문을 제공하지 않습니다.',
    fullText: `ECHO 서비스 성격에 관한 중요 고지

ECHO는 의료, 심리치료, 상담, 법률, 점술 서비스가 아닙니다.

ECHO는 관계 경험을 바탕으로 자기이해를 돕는 정보 서비스입니다.

AI 응답은 참고용 정보이며 판단, 진단, 치료, 법률 자문을 제공하지 않습니다.

위급 상황에서는 112, 119 또는 전문기관에 도움을 요청해 주세요.

본인은 위 내용을 충분히 이해하였으며, ECHO를 정보 참고 목적으로만 이용할 것을 확인합니다.`,
  },
];

interface TermsAgreementProps {
  serviceAgreed: boolean;
  onServiceAgreedChange: (v: boolean) => void;
  privacyAgreed: boolean;
  onPrivacyAgreedChange: (v: boolean) => void;
  sensitiveAgreed: boolean;
  onSensitiveAgreedChange: (v: boolean) => void;
  anonymousAgreed: boolean;
  onAnonymousAgreedChange: (v: boolean) => void;
  ageAgreed: boolean;
  onAgeAgreedChange: (v: boolean) => void;
  medicalAgreed: boolean;
  onMedicalAgreedChange: (v: boolean) => void;
  highlightErrors?: boolean;
}

const PINK_ACCENT = '#FF6B9D';
const PURPLE_ACCENT = '#9B59B6';

export default function TermsAgreement({
  serviceAgreed,
  onServiceAgreedChange,
  privacyAgreed,
  onPrivacyAgreedChange,
  sensitiveAgreed,
  onSensitiveAgreedChange,
  anonymousAgreed,
  onAnonymousAgreedChange,
  ageAgreed,
  onAgeAgreedChange,
  medicalAgreed,
  onMedicalAgreedChange,
  highlightErrors = false,
}: TermsAgreementProps) {
  const [modalTerm, setModalTerm] = useState<TermItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const trustLine1Ref = useRef<HTMLParagraphElement>(null);
  const trustLine2Ref = useRef<HTMLParagraphElement>(null);
  const allCheckRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const noticeLine1Ref = useRef<HTMLParagraphElement>(null);
  const noticeLine2Ref = useRef<HTMLParagraphElement>(null);
  const noticeLine3Ref = useRef<HTMLParagraphElement>(null);

  const getAgreed = useCallback((id: string): boolean => {
    switch (id) {
      case 'service': return serviceAgreed;
      case 'privacy': return privacyAgreed;
      case 'sensitive': return sensitiveAgreed;
      case 'anonymous': return anonymousAgreed;
      case 'age': return ageAgreed;
      case 'medical': return medicalAgreed;
      default: return false;
    }
  }, [serviceAgreed, privacyAgreed, sensitiveAgreed, anonymousAgreed, ageAgreed, medicalAgreed]);

  const setAgreed = useCallback((id: string, v: boolean) => {
    switch (id) {
      case 'service': onServiceAgreedChange(v); break;
      case 'privacy': onPrivacyAgreedChange(v); break;
      case 'sensitive': onSensitiveAgreedChange(v); break;
      case 'anonymous': onAnonymousAgreedChange(v); break;
      case 'age': onAgeAgreedChange(v); break;
      case 'medical': onMedicalAgreedChange(v); break;
    }
  }, [onServiceAgreedChange, onPrivacyAgreedChange, onSensitiveAgreedChange, onAnonymousAgreedChange, onAgeAgreedChange, onMedicalAgreedChange]);

  const allChecked = serviceAgreed && privacyAgreed && sensitiveAgreed && anonymousAgreed && ageAgreed && medicalAgreed;

  const handleAllToggle = () => {
    const newVal = !allChecked;
    onServiceAgreedChange(newVal);
    onPrivacyAgreedChange(newVal);
    onSensitiveAgreedChange(newVal);
    onAnonymousAgreedChange(newVal);
    onAgeAgreedChange(newVal);
    onMedicalAgreedChange(newVal);
  };

  const openModal = (term: TermItem) => {
    setModalTerm(term);
    setModalOpen(true);
  };

  const closeModal = () => {
    const content = document.querySelector('.terms-modal-content');
    if (content) {
      gsap.to(content, {
        scale: 0.97,
        opacity: 0,
        duration: 0.125,
        ease: 'power2.in',
        onComplete: () => setModalOpen(false),
      });
    } else {
      setModalOpen(false);
    }
  };

  // Entry animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.15 });

      // Trust message
      if (trustLine1Ref.current && trustLine2Ref.current) {
        tl.fromTo(
          [trustLine1Ref.current, trustLine2Ref.current],
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.075, ease: 'power3.out' },
        );
      }

      // All checkbox
      if (allCheckRef.current) {
        tl.fromTo(
          allCheckRef.current,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' },
          '-=0.1',
        );
      }

      // Individual items
      itemsRef.current.forEach((el, i) => {
        if (el) {
          tl.fromTo(
            el,
            { x: -8, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.2, ease: 'power2.out' },
            `-=${i > 0 ? 0.125 : 0.05}`,
          );
        }
      });

      // Bottom notice
      if (noticeLine1Ref.current && noticeLine2Ref.current && noticeLine3Ref.current) {
        tl.fromTo(
          [noticeLine1Ref.current, noticeLine2Ref.current, noticeLine3Ref.current],
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.25, stagger: 0.05, ease: 'power2.out' },
          '-=0.1',
        );
      }
    });

    return () => ctx.revert();
  }, []);

  // Modal entry animation
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => {
        const content = document.querySelector('.terms-modal-content');
        if (content) {
          gsap.fromTo(
            content,
            { scale: 0.92, y: 20, opacity: 0 },
            { scale: 1, y: 0, opacity: 1, duration: 0.2, ease: 'power3.out' },
          );
        }
      }, 25);
    }
  }, [modalOpen]);

  return (
    <>
      <div className="flex flex-col gap-4 mt-2">
        {/* Trust message */}
        <div className="text-center mb-1">
          <p
            ref={trustLine1Ref}
            className="text-white/55 font-display text-sm leading-relaxed tracking-tight"
          >
            당신의 이야기는 안전합니다.
          </p>
          <p
            ref={trustLine2Ref}
            className="text-white/60 font-display text-sm leading-relaxed tracking-tight"
          >
            우리가 먼저 지킵니다.
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="text-white/15 text-[9px] font-mono tracking-[0.15em] uppercase">약관 동의</span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>

        {/* All agree */}
        <div ref={allCheckRef}>
          <button
            type="button"
            onClick={handleAllToggle}
            className="flex items-center gap-3 w-full text-left group cursor-pointer py-1"
          >
            <div
              className={`w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition-all duration-300 border ${
                allChecked
                  ? 'border-transparent'
                  : 'border-white/[0.12] group-hover:border-white/[0.2]'
              }`}
              style={
                allChecked
                  ? { background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT})` }
                  : { background: 'transparent' }
              }
            >
              <i
                className={`ri-check-line text-[10px] text-white transition-all duration-300 ${
                  allChecked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                }`}
              />
            </div>
            <span className="text-white/70 text-xs font-medium tracking-wide transition-colors group-hover:text-white/90">
              전체 동의합니다.
            </span>
          </button>
        </div>

        <div className="w-full h-px bg-white/[0.04]" />

        {/* Individual items */}
        <div className="flex flex-col gap-1.5">
          {TERMS_DATA.map((term, i) => {
            const checked = getAgreed(term.id);
            const showError = highlightErrors && term.required && !checked;
            return (
              <div
                key={term.id}
                ref={(el) => { itemsRef.current[i] = el; }}
                className={`flex items-start gap-3 group py-1 transition-all duration-500 ${
                  showError ? 'opacity-100' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setAgreed(term.id, !checked)}
                  className="mt-[2px]"
                >
                  <div
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition-all duration-300 border ${
                      checked
                        ? 'border-transparent'
                        : showError
                          ? 'border-white/[0.35]'
                          : 'border-white/[0.12] group-hover:border-white/[0.2]'
                    } ${showError && !checked ? 'animate-pulse' : ''}`}
                    style={
                      checked
                        ? { background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT})` }
                        : showError
                          ? { background: 'rgba(255,107,157,0.06)', boxShadow: '0 0 12px rgba(255,107,157,0.08)' }
                          : { background: 'transparent' }
                    }
                  >
                    <i
                      className={`ri-check-line text-[10px] text-white transition-all duration-300 ${
                        checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                      }`}
                    />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs leading-relaxed transition-colors ${
                        showError ? 'text-white/55' : checked ? 'text-white/70' : 'text-white/35'
                      }`}
                    >
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-[1px] text-[9px] font-mono tracking-[0.05em] mr-1.5 transition-all duration-300 ${
                          showError
                            ? 'text-white/70 bg-white/[0.12]'
                            : term.required
                              ? 'text-white/50 bg-white/[0.06]'
                              : 'text-white/25 bg-white/[0.03]'
                        }`}
                      >
                        {term.required ? '필수' : '선택'}
                      </span>
                      {term.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openModal(term); }}
                      className="text-[9px] font-mono tracking-[0.08em] text-white/20 hover:text-white/50 underline underline-offset-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      전문 보기
                    </button>
                  </div>
                  {term.summary && (
                    <p className={`text-[10px] leading-relaxed mt-0.5 line-clamp-2 transition-colors duration-300 ${
                      showError ? 'text-white/30' : 'text-white/18'
                    }`}>
                      {term.summary}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="w-full h-px bg-white/[0.04]" />

        {/* Bottom notice */}
        <div className="text-center space-y-0.5">
          <p
            ref={noticeLine1Ref}
            className="text-white/40 text-[10px] font-medium tracking-wide leading-relaxed"
          >
            <span className="text-white/55">우리는 당신의 데이터를 팔지 않습니다.</span>
          </p>
          <p
            ref={noticeLine2Ref}
            className="text-white/30 text-[9px] leading-relaxed"
          >
            외부에 나갈 땐, 당신이 누구인지 지운 뒤에만 나갑니다.
          </p>
        </div>
      </div>

      {/* Modal for full terms */}
      {modalOpen && modalTerm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal content */}
          <div className="terms-modal-content relative w-full max-w-lg max-h-[80vh] rounded-2xl border border-white/[0.08] overflow-hidden"
            style={{
              background: 'rgba(10,10,10,0.98)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-[1px] text-[9px] font-mono tracking-[0.05em] ${
                    modalTerm.required ? 'text-white/50 bg-white/[0.06]' : 'text-white/25 bg-white/[0.03]'
                  }`}
                >
                  {modalTerm.required ? '필수' : '선택'}
                </span>
                <h3 className="text-white/80 font-display text-sm tracking-tight">{modalTerm.label}</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/30 hover:text-white/70 hover:bg-white/10 transition-all duration-200 cursor-pointer"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 65px)' }}>
              <pre className="text-white/45 text-xs leading-relaxed whitespace-pre-wrap font-sans tracking-wide">
                {modalTerm.fullText}
              </pre>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-3.5 border-t border-white/[0.05] flex items-center justify-between">
              <p className="text-white/18 text-[10px]">
                {modalTerm.summary || 'ECHO는 당신의 데이터를 안전하게 보호합니다.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!getAgreed(modalTerm.id)) {
                    setAgreed(modalTerm.id, true);
                  }
                  closeModal();
                }}
                className="px-4 py-1.5 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition-all duration-300 cursor-pointer text-white/80 hover:text-white border border-white/[0.12] hover:border-white/[0.25]"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                {getAgreed(modalTerm.id) ? '확인했습니다' : '동의하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}