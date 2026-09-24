import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import DoItSymbol from '@/components/DoItSymbol';
import { fetchActivePurposes, type ActivePurpose } from '@/doit/lib/purposes';
import { savePurpose } from '@/doit/lib/profileSave';
import './core-conversation.css';

interface Props {
  userId: string;
  // 목적 저장이 끝난 뒤. line 은 "한 줄 더 적기"(선택)의 원문이며 비어 있을 수 있다.
  onDone: (purpose: { id: string; label: string }, line: string) => void;
}

const LINE_MAX = 300;
const SAVE_ERROR = '고른 걸 저장하지 못했어요. 인터넷이 잘 되는지 보고 다시 눌러 주세요.';

// 첫 질문 = "어떤 만남을 원하세요?" (v13 유일한 고정 문장).
// 답은 운영 DB의 목적 목록(타일)이며, 한 줄을 덧붙이면 그 말이 곧바로 첫 이야기가 된다(장면 1).
// 목적 목록은 하드코딩하지 않는다. 읽기 실패와 0건을 구분해 보여 준다.
export default function ConversationOpening({ userId, onDone }: Props) {
  const [purposes, setPurposes] = useState<ActivePurpose[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActivePurpose | null>(null);
  const [line, setLine] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const loadPurposes = async () => {
    setLoadError(null);
    const result = await fetchActivePurposes();
    if (!alive.current) return;
    if (result.status === 'error') { setLoadError('만남의 종류를 불러오지 못했어요. 다시 시도해 주세요.'); return; }
    setPurposes(result.purposes);
  };
  useEffect(() => { void loadPurposes(); }, []);

  const submit = async () => {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const error = await savePurpose(userId, { purposeId: selected.id, purposeLabel: selected.label });
      if (!alive.current) return;
      if (error) { setSaveError(SAVE_ERROR); return; }
      onDone({ id: selected.id, label: selected.label }, line.trim() ? line : '');
    } catch {
      if (alive.current) setSaveError(SAVE_ERROR);
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  };

  return <section className="echo-dialogue echo-dialogue--pastel echo-opening" aria-busy={saving}>
    <header className="echo-dialogue-header"><DoItSymbol decorative /><span>DO IT / ECHO</span></header>
    <p className="echo-eyebrow">첫 질문</p>
    <h1>어떤 만남을<br />원하세요?</h1>
    <p className="echo-lead">하나만 골라 주세요. 한 줄 덧붙이면 거기서부터 이야기를 시작할게요.</p>

    {loadError && <div className="echo-error" role="alert"><p>{loadError}</p><button onClick={() => void loadPurposes()}>다시 불러오기</button></div>}
    {!loadError && purposes === null && <p className="echo-busy" role="status"><Loader2 size={16} className="animate-spin" />만남의 종류를 불러오고 있어요</p>}
    {purposes && purposes.length === 0 && <p className="echo-error" role="alert">지금 고를 수 있는 만남의 종류가 없어요. 잠시 뒤 다시 확인해 주세요.</p>}

    {purposes && purposes.length > 0 && <div className="echo-opening-tiles" role="radiogroup" aria-label="원하는 만남">
      {purposes.map(purpose => <button key={purpose.id} type="button" role="radio" aria-checked={selected?.id === purpose.id} className={selected?.id === purpose.id ? 'echo-opening-tile is-selected' : 'echo-opening-tile'} disabled={saving} onClick={() => setSelected(purpose)}>
        <span className="echo-opening-tile-label">{purpose.label}</span>
        {purpose.description && <span className="echo-opening-tile-desc">{purpose.description}</span>}
      </button>)}
    </div>}

    {selected && <form className="echo-composer echo-opening-line" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor="echo-opening-line">한 줄 더 적기 · 안 적어도 괜찮아요</label>
      <textarea id="echo-opening-line" value={line} onChange={event => setLine(event.target.value.slice(0, LINE_MAX))} placeholder="예: 급하진 않아요. 천천히 알아가고 싶어요." maxLength={LINE_MAX} rows={3} disabled={saving} />
      <div className="echo-composer-footer"><span>{line.length}/{LINE_MAX}</span></div>
      {saveError && <p className="echo-error" role="alert">{saveError}</p>}
      <button type="submit" className="echo-primary" disabled={saving}>{saving ? '저장하고 있어요' : line.trim() ? '이 말로 시작하기' : '이렇게 시작하기'} {saving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}</button>
    </form>}
    <p className="echo-fine">고른 건 나만 봐요. 나중에 언제든 바꿀 수 있어요.</p>
  </section>;
}
