import { Link } from 'react-router-dom';
import {
  allChecked,
  MARKETING_ENABLED,
  requiredAllChecked,
  setAll,
  type ConsentChoice,
} from '@/lib/legal/consent';
import { LEGAL_VERSION } from '@/lib/legal/documents';
import './consent-checklist.css';

interface Props {
  value: ConsentChoice;
  onChange: (next: ConsentChoice) => void;
  disabled?: boolean;
}

interface Item {
  key: keyof ConsentChoice;
  required: boolean;
  label: string;
  docPath?: string;
}

const ALL_ITEMS: Item[] = [
  { key: 'terms', required: true, label: '이용약관에 동의합니다', docPath: '/legal/terms' },
  { key: 'privacy', required: true, label: '개인정보 수집·이용 및 국외 이전에 동의합니다', docPath: '/legal/privacy' },
  { key: 'age14', required: true, label: '만 14세 이상입니다' },
  { key: 'marketing', required: false, label: '새 기능·소식 안내를 이메일로 받겠습니다' },
];
// 보내는 기능이 없을 때는 마케팅 수신을 묻지 않는다(MASTER §14).
const ITEMS: Item[] = ALL_ITEMS.filter((item) => item.key !== 'marketing' || MARKETING_ENABLED);

// 가입·동의 화면 공용 체크 목록. "모두 동의"는 필수+선택을 한 번에 켜고 끈다.
// 필수 3개가 모두 켜져야 상위 화면의 계속 버튼이 열린다(requiredAllChecked).
export default function ConsentChecklist({ value, onChange, disabled = false }: Props) {
  const everything = allChecked(value);
  const requiredDone = requiredAllChecked(value);

  return (
    <fieldset className="legal-consent" disabled={disabled}>
      <legend className="legal-consent-legend">약관 동의 ({LEGAL_VERSION})</legend>

      <label className="legal-consent-row legal-consent-all">
        <input type="checkbox" checked={everything} onChange={(e) => onChange(setAll(e.target.checked))} />
        <span>모두 동의합니다</span>
      </label>

      <ul className="legal-consent-list">
        {ITEMS.map((item) => (
          <li key={item.key}>
            <label className="legal-consent-row">
              <input
                type="checkbox"
                checked={value[item.key]}
                onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
              />
              <span>
                <em className={item.required ? 'legal-consent-required' : 'legal-consent-optional'}>
                  {item.required ? '[필수]' : '[선택]'}
                </em>{' '}
                {item.label}
              </span>
            </label>
            {item.docPath && (
              <Link className="legal-consent-doc" to={item.docPath} target="_blank" rel="noopener noreferrer">
                보기 <span aria-hidden="true">↗</span>
              </Link>
            )}
          </li>
        ))}
      </ul>

      {!requiredDone && (
        <p className="legal-consent-hint" role="status">필수 항목 3개에 동의해야 계속할 수 있어요.</p>
      )}
    </fieldset>
  );
}
