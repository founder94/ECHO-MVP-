import { Link } from 'react-router-dom';
import { LEGAL_DRAFT, LEGAL_DRAFT_NOTICE, LEGAL_UPDATED_DATE, type LegalDocument as LegalDocumentData } from '@/lib/legal/documents';
import './legal.css';

interface Props { document: LegalDocumentData }

// 이용약관·개인정보 처리방침 열람 화면. 본문은 src/lib/legal/documents.ts 하나에서 온다.
export default function LegalDocument({ document }: Props) {
  return (
    <div className="legal-page">
      <header className="legal-page-nav">
        <Link to="/" className="legal-page-home">DO IT <span>COMPANY</span></Link>
        <nav aria-label="문서 이동">
          <Link to="/legal/terms" aria-current={document.key === 'terms' ? 'page' : undefined}>이용약관</Link>
          <Link to="/legal/privacy" aria-current={document.key === 'privacy' ? 'page' : undefined}>개인정보 처리방침</Link>
        </nav>
      </header>

      <main className="legal-page-body">
        <p className="legal-page-eyebrow">{document.version} · 시행일 {document.effectiveDate} · 최종 변경 {LEGAL_UPDATED_DATE}</p>
        <h1>{document.title}</h1>
        {LEGAL_DRAFT && <p className="legal-page-draft" role="note">{LEGAL_DRAFT_NOTICE}</p>}
        <p className="legal-page-intro">{document.intro}</p>

        {document.sections.map((section) => (
          <section key={section.title} className="legal-page-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}

        <footer className="legal-page-footer">
          <Link to="/">홈으로 돌아가기</Link>
        </footer>
      </main>
    </div>
  );
}
