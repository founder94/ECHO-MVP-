import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveFormSubmission } from '@/pages/admin/components/FormTable';
import { addEvent } from '@/pages/admin/components/EventLog';
import MagneticButton from '@/components/base/MagneticButton';

interface TrialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

const FORM_URL = 'https://readdy.ai/api/form/d8u1j9kuatl81q3tfqt0';

export default function TrialFormModal({ isOpen, onClose, isDarkMode }: TrialFormModalProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const honeypotEl = form.querySelector<HTMLInputElement>('[name="website_alt"]');
    if (honeypotEl && honeypotEl.value.trim() !== '') {
      setStatus('success');
      setTimeout(() => { setStatus('idle'); onClose(); }, 3000);
      return;
    }
    setStatus('submitting');

    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const company = formData.get('company') as string || '';
    const phone = formData.get('phone') as string || '';
    const serviceInterest = formData.get('service_interest') as string || '';
    const message = formData.get('message') as string || '';

    try {
      saveFormSubmission({ name, email, company, phone, serviceInterest, message });
      addEvent('FORM_SUBMIT', `무료 체험 신청 — ${name} (${serviceInterest || '미선택'})`, 'success');
    } catch {
      // localStorage save is non-critical
    }

    try {
      if (honeypotEl) formData.delete('website_alt');
      const urlEncoded = new URLSearchParams(formData as any).toString();
      await fetch(FORM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: urlEncoded,
      });
      // Save contact info for report generation
      try {
        localStorage.setItem('echo_contact_info', JSON.stringify({ name, email }));
      } catch { /* ignore */ }
      setStatus('success');
      form.reset();
      setTimeout(() => {
        setStatus('idle');
        onClose();
        // Navigate to AI analysis report
        navigate('/report');
      }, 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div ref={modalRef} className={`relative w-full max-w-lg rounded-2xl border p-8 md:p-10 shadow-2xl ${isDarkMode ? 'bg-[#0f0f0f] border-white/[0.08]' : 'bg-white border-black/[0.06]'}`} style={{ animation: 'modal-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        <button onClick={onClose} className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${isDarkMode ? 'text-white/30 hover:text-white/80 hover:bg-white/[0.06]' : 'text-black/30 hover:text-black/80 hover:bg-black/[0.04]'}`}>
          <i className="ri-close-line text-base" />
        </button>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDarkMode ? 'bg-[#D4D4D4]' : 'bg-[#3D3D3D]'}`} />
            <span className={`text-[10px] font-mono tracking-[0.35em] uppercase ${isDarkMode ? 'text-white/25' : 'text-black/25'}`}>Free Trial</span>
          </div>
          <h2 className={`font-display font-bold text-2xl md:text-3xl tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>무료 체험 신청</h2>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-white/35' : 'text-black/35'}`}>아래 정보를 남겨주시면 24시간 이내에 맞춤형 체험 안내를 드립니다.</p>
        </div>
        <form data-readdy-form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input type="text" name="website_alt" className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex-1">
              <label className={`text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block ${isDarkMode ? 'text-white/22' : 'text-black/22'}`}>이름 *</label>
              <input type="text" name="name" required className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border ${isDarkMode ? 'bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]' : 'bg-black/[0.02] border-black/[0.08] text-black placeholder:text-black/15 focus:border-black/[0.18] focus:bg-black/[0.02]'}`} placeholder="홍길동" />
            </div>
            <div className="flex-1">
              <label className={`text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block ${isDarkMode ? 'text-white/22' : 'text-black/22'}`}>이메일 *</label>
              <input type="email" name="email" required className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border ${isDarkMode ? 'bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]' : 'bg-black/[0.02] border-black/[0.08] text-black placeholder:text-black/15 focus:border-black/[0.18] focus:bg-black/[0.02]'}`} placeholder="hello@example.com" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex-1">
              <label className={`text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block ${isDarkMode ? 'text-white/22' : 'text-black/22'}`}>회사명</label>
              <input type="text" name="company" className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border ${isDarkMode ? 'bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]' : 'bg-black/[0.02] border-black/[0.08] text-black placeholder:text-black/15 focus:border-black/[0.18] focus:bg-black/[0.02]'}`} placeholder="회사명 (선택사항)" />
            </div>
            <div className="flex-1">
              <label className={`text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block ${isDarkMode ? 'text-white/22' : 'text-black/22'}`}>연락처</label>
              <input type="tel" name="phone" className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border ${isDarkMode ? 'bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]' : 'bg-black/[0.02] border-black/[0.08] text-black placeholder:text-black/15 focus:border-black/[0.18] focus:bg-black/[0.02]'}`} placeholder="010-0000-0000" />
            </div>
          </div>
          <div>
            <label className={`text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block ${isDarkMode ? 'text-white/22' : 'text-black/22'}`}>관심 서비스</label>
            <select name="service_interest" className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border appearance-none cursor-pointer ${isDarkMode ? 'bg-white/[0.03] border-white/[0.08] text-white focus:border-white/[0.18] focus:bg-white/[0.05]' : 'bg-black/[0.02] border-black/[0.08] text-black focus:border-black/[0.18] focus:bg-black/[0.02]'}`}>
              <option value="">선택해주세요</option>
              <option value="hx-design">Human Experience Design</option>
              <option value="relationship-intelligence">Relationship Intelligence</option>
              <option value="identity-recovery">Identity Recovery</option>
              <option value="ai-coaching">AI Coaching</option>
              <option value="data-platform">Data Platform</option>
              <option value="other">기타 문의</option>
            </select>
          </div>
          <div>
            <label className={`text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block ${isDarkMode ? 'text-white/22' : 'text-black/22'}`}>문의 내용</label>
            <textarea name="message" maxLength={500} rows={3} className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border resize-none ${isDarkMode ? 'bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]' : 'bg-black/[0.02] border-black/[0.08] text-black placeholder:text-black/15 focus:border-black/[0.18] focus:bg-black/[0.02]'}`} placeholder="궁금하신 점이나 필요하신 서비스를 알려주세요 (500자 이내)" />
          </div>
          <MagneticButton
            type="submit"
            disabled={status === 'submitting'}
            variant="primary"
            size="md"
            className="w-full"
          >
            {status === 'submitting' ? '전송 중...' : '무료 체험 신청하기'}
          </MagneticButton>
          {status === 'success' && (
            <div className={`text-center py-3 rounded-lg text-sm ${isDarkMode ? 'bg-white/[0.04] text-green-400/80' : 'bg-black/[0.02] text-green-600/80'}`}>
              <i className="ri-check-line mr-1.5" />신청이 완료되었습니다. 24시간 이내에 연락드리겠습니다!
            </div>
          )}
          {status === 'error' && (
            <div className={`text-center py-3 rounded-lg text-sm ${isDarkMode ? 'bg-white/[0.04] text-red-400/80' : 'bg-black/[0.02] text-red-600/80'}`}>
              <i className="ri-error-warning-line mr-1.5" />오류가 발생했습니다. 0423doit@gmail.com 으로 직접 연락 부탁드립니다.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}