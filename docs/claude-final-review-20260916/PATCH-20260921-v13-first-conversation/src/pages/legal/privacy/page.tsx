import LegalDocument from '@/pages/legal/LegalDocument';
import { PRIVACY_DOCUMENT } from '@/lib/legal/documents';

export default function PrivacyPage() {
  return <LegalDocument document={PRIVACY_DOCUMENT} />;
}
