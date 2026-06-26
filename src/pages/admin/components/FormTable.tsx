import { useEffect, useState } from 'react';

interface FormSubmission {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  serviceInterest: string;
  message: string;
  submittedAt: number;
  status: 'pending' | 'contacted' | 'completed';
}

const SERVICE_LABELS: Record<string, string> = {
  'hx-design': 'HX Design',
  'relationship-intelligence': 'Relationship Intelligence',
  'identity-recovery': 'Identity Recovery',
  'ai-coaching': 'AI Coaching',
  'data-platform': 'Data Platform',
  'other': '기타 문의',
};

const MOCK_SUBMISSIONS: FormSubmission[] = [
  { id: 'sub_1', name: '홍길동', email: 'hong@example.com', company: 'ABC Tech', phone: '010-1234-5678', serviceInterest: 'hx-design', message: '웹사이트 리뉴얼 프로젝트 문의드립니다.', submittedAt: Date.now() - 86400000 * 5, status: 'completed' },
  { id: 'sub_2', name: '김철수', email: 'kim@startup.kr', company: 'StartupX', phone: '010-9876-5432', serviceInterest: 'relationship-intelligence', message: '관계 분석 플랫폼 도입 상담하고 싶습니다.', submittedAt: Date.now() - 86400000 * 4, status: 'contacted' },
  { id: 'sub_3', name: '이영희', email: 'lee@design.co', company: 'Design Studio', phone: '010-5555-7777', serviceInterest: 'ai-coaching', message: 'AI 코칭 서비스 무료 체험 신청합니다.', submittedAt: Date.now() - 86400000 * 3, status: 'pending' },
  { id: 'sub_4', name: '박민수', email: 'park@global.com', company: 'Global Inc', phone: '010-2222-3333', serviceInterest: 'data-platform', message: '데이터 플랫폼 구축 관련 문의', submittedAt: Date.now() - 86400000 * 2, status: 'pending' },
  { id: 'sub_5', name: '최지우', email: 'choi@brand.kr', company: 'Brand House', phone: '010-4444-8888', serviceInterest: 'identity-discovery', message: '정체성 발견 프로그램 상세 안내 부탁드립니다.', submittedAt: Date.now() - 86400000, status: 'contacted' },
  { id: 'sub_6', name: '정수민', email: 'jung@marketing.com', company: 'Marketing Pro', phone: '010-6666-9999', serviceInterest: 'hx-design', message: '마케팅 팀 HX 디자인 워크숍 문의', submittedAt: Date.now() - 36000000, status: 'pending' },
  { id: 'sub_7', name: '강다은', email: 'kang@edu.kr', company: 'EduCenter', phone: '010-7777-1111', serviceInterest: 'other', message: '교육 프로그램 맞춤 개발 가능한지 문의', submittedAt: Date.now() - 18000000, status: 'pending' },
];

// eslint-disable-next-line react-refresh/only-export-components
export function loadFormSubmissions(): FormSubmission[] {
  const raw = localStorage.getItem('echo_form_submissions');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as FormSubmission[];
      return [...MOCK_SUBMISSIONS, ...parsed].sort((a, b) => b.submittedAt - a.submittedAt);
    } catch {
      return MOCK_SUBMISSIONS;
    }
  }
  return MOCK_SUBMISSIONS;
}

// eslint-disable-next-line react-refresh/only-export-components
export function saveFormSubmission(data: Omit<FormSubmission, 'id' | 'submittedAt' | 'status'>) {
  const submissions = loadFormSubmissions();
  const newSubmission: FormSubmission = {
    ...data,
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    submittedAt: Date.now(),
    status: 'pending',
  };
  const existing = submissions.filter((s) => !s.id.startsWith('sub_1') && !s.id.startsWith('sub_2') && !s.id.startsWith('sub_3') && !s.id.startsWith('sub_4') && !s.id.startsWith('sub_5') && !s.id.startsWith('sub_6') && !s.id.startsWith('sub_7'));
  const newSubmissions = [newSubmission, ...existing];
  localStorage.setItem('echo_form_submissions', JSON.stringify(newSubmissions));
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '대기', color: 'rgba(251,191,36,0.80)', bg: 'rgba(251,191,36,0.08)' },
  contacted: { label: '연락완료', color: 'rgba(96,165,250,0.80)', bg: 'rgba(96,165,250,0.08)' },
  completed: { label: '완료', color: 'rgba(74,222,128,0.80)', bg: 'rgba(74,222,128,0.08)' },
};

interface FormTableProps {
  accentColor: string;
}

export default function FormTable({ accentColor }: FormTableProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    setSubmissions(loadFormSubmissions());
    const interval = setInterval(() => {
      setSubmissions(loadFormSubmissions());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all' ? submissions : submissions.filter((s) => s.status === filter);

  const updateStatus = (id: string, status: FormSubmission['status']) => {
    const raw = localStorage.getItem('echo_form_submissions');
    let parsed: FormSubmission[] = [];
    if (raw) {
      try { parsed = JSON.parse(raw); } catch { /* */ }
    }
    const updated = parsed.map((s) => s.id === id ? { ...s, status } : s);
    localStorage.setItem('echo_form_submissions', JSON.stringify(updated));
    setSubmissions(loadFormSubmissions());
  };

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: `${accentColor}25` }} />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: `${accentColor}25` }} />
      <div className="flex items-center justify-between mb-5">
        <span className="text-[8px] font-mono tracking-[0.35em] uppercase text-white/18">PROJECT INQUIRY FORM SUBMISSIONS</span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-pulse" />
          <span className="text-[8px] font-mono text-white/15 tracking-wider">LIVE</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        {[{ key: 'all', label: '전체' }, { key: 'pending', label: '대기' }, { key: 'contacted', label: '연락완료' }, { key: 'completed', label: '완료' }].map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} className={`px-3 py-1 rounded-full text-[9px] font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer border ${filter === tab.key ? 'bg-white/[0.08] text-white/60 border-white/[0.12]' : 'bg-transparent text-white/20 border-white/[0.04] hover:border-white/[0.08]'}`}>{tab.label}</button>
        ))}
        <span className="ml-auto text-[8px] font-mono text-white/15 tracking-wider">{filtered.length} RECORDS</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['이름', '이메일', '회사', '서비스', '날짜', '상태', ''].map((h) => (
                <th key={h} className="text-left py-2 px-2 text-[8px] font-mono tracking-wider uppercase text-white/15">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((sub) => (
              <tr key={sub.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 px-2 text-[10px] font-mono text-white/50">{sub.name}</td>
                <td className="py-2.5 px-2 text-[10px] font-mono text-white/35">{sub.email}</td>
                <td className="py-2.5 px-2 text-[10px] font-mono text-white/35">{sub.company || '-'}</td>
                <td className="py-2.5 px-2 text-[10px] font-mono text-white/35">{SERVICE_LABELS[sub.serviceInterest] || sub.serviceInterest}</td>
                <td className="py-2.5 px-2 text-[9px] font-mono text-white/25">{formatDate(sub.submittedAt)}</td>
                <td className="py-2.5 px-2">
                  <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-mono tracking-wider uppercase" style={{ color: STATUS_CONFIG[sub.status].color, background: STATUS_CONFIG[sub.status].bg }}>{STATUS_CONFIG[sub.status].label}</span>
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateStatus(sub.id, 'contacted')} className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-blue-400/50 hover:text-blue-400/80 hover:bg-blue-400/5 transition-all cursor-pointer" title="연락완료"><i className="ri-phone-line" /></button>
                    <button onClick={() => updateStatus(sub.id, 'completed')} className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-green-400/50 hover:text-green-400/80 hover:bg-green-400/5 transition-all cursor-pointer" title="완료"><i className="ri-check-line" /></button>
                    <button onClick={() => updateStatus(sub.id, 'pending')} className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-yellow-400/50 hover:text-yellow-400/80 hover:bg-yellow-400/5 transition-all cursor-pointer" title="대기"><i className="ri-time-line" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <div className="text-center py-10"><span className="text-[9px] font-mono text-white/15 tracking-wider">NO SUBMISSIONS FOUND</span></div>}
    </div>
  );
}