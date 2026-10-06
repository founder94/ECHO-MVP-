import LegalDocument from '@/pages/legal/LegalDocument';
import { TERMS_DOCUMENT } from '@/lib/legal/documents';

export default function TermsPage() {
  return <LegalDocument document={TERMS_DOCUMENT} />;
}
