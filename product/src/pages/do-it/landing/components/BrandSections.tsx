import { appUrl } from '@/lib/siteRole';
import './brand-sections.css';

// 회사 홈페이지(do-it.company) 전용 브랜딩 구간 (대표 2026-09-23 "모바일 말고는 회사 홈페이지 브랜딩용이야.
// 우리 핵심 차별점과 브랜딩, 모바일로 연결해서 모바일로 시작할 수 있게. 지금 둘 다 똑같잖아").
// - 앱(app.do-it.company)에는 나오지 않는다(랜딩 화면이 사이트 역할을 보고 넣는다).
// - 히어로·사진 9장 이야기는 그대로 두고, 그 앞뒤에 끼운다.
// - 지금 실제로 되는 것만 쓴다. 아직 열리지 않은 연결 기능에는 「준비 중」을 붙인다(UX 라이팅 원칙 5).

// 대표 최종 승인 2026-09-24 「AGENT v1 / HOMEPAGE FINAL LOCK」 두 번째 구역.
// Quiet Luxury: 기능 카드·번호를 늘어놓지 않고 문장 세 줄만. 다 알려주지 않는다.
// 지금 되는 것 = 말 기억(대화 기록)·결 알아가기(다섯 가지 질문 뒤 「내가 이렇게 이해했어요」).
// 「한 사람을 보여드립니다」는 운영에서 아직 아무도 받을 수 없다(2026-09-24 운영 읽기: 전화 인증 0명·연결 0건, 문자 발송 업체 미연결)
// → 작은 「준비 중」을 붙인다(구현된 것처럼 단정하지 않는다).
const FLOW: Array<{ line: string; soon?: boolean }> = [
  { line: '당신의 말을 기억하고.' },
  { line: '당신과 어울리는 결을 알아가고.' },
  { line: '때가 되면, 한 사람을 보여드립니다.', soon: true },
];

// 대표 최종 승인 Trust: 기술어 대신 사용자 약속으로. 셋 다 지금 대화 서버가 실제로 하는 일(정정 우선·거절 차단·미확인 분리).
const TRUST: string[] = [
  '틀리면 고치고,',
  '아니라고 한 것은 다시 단정하지 않고,',
  '아직 모르는 것은 모르는 채로 둡니다.',
];
const TRUST_CLOSING = ['천천히 알아가는 것.', '사람에게도, AI에게도 필요하니까.'];

// 대표 최종 승인 Just Try: 미션·열쇠·만남 결과 기능은 아직 없으므로 기능 설명·버튼을 붙이지 않는다(문장만).
const JUST_TRY: string[] = ['한 번의 대답.', '한 번의 선택.', '한 번의 만남.'];

const STEPS: Array<{ title: string; body: string; soon?: boolean }> = [
  // 대표 FINAL TWO-SITE LOCK(2026-09-25): 대화 → 연결 준비 → ECHO 가 대신 찾음. 「당신이 잠든 사이」= 내가 찾아다니지 않아도 ECHO 가 대신 찾는다는 뜻(수면 감지 아님) · 연결은 아직 열리지 않아 「준비 중」.
  { title: 'ECHO와 짧게 이야기해요', body: '어떤 만남을 원하는지, 어떤 사람이 편한지. 다섯 번이면 충분해요.' },
  { title: '연결을 준비해요', body: '최근 사진 세 장과, 나를 소개할 몇 줄.' },
  { title: '당신이 잠든 사이, ECHO가 찾아요', body: '내가 계속 찾아다니지 않아도, AI가 먼저 만나봅니다.', soon: true },
];

const SOON_LABEL = '준비 중';
// 홈페이지 아래쪽 시작 버튼은 이 말로 통일한다(히어로 버튼은 대표 최종 승인 2026-09-24 「ECHO 시작하기」).
export const MOBILE_START_LABEL = 'ECHO 시작하기'; // 대표 FINAL TWO-SITE LOCK(2026-09-25): 홈페이지 CTA 이름 = 「ECHO 시작하기」(히어로 버튼과 같은 이름)
const DOTS_EARTH_SRC = '/brand/doit-dots-earth.webp';

// 배경 사진(2026-09-23 대표 "홈페이지 배경에 이 사진들을 다 넣고 브랜딩해"). 이야기 01~09 에 쓰지 않은 파란 우주인 사진 4장.
// 글자는 사진 위 어두운 막 위에 놓인다. 사진은 꾸밈이라 화면 읽기 도구에는 알리지 않는다(alt="").
const SCENES = {
  why: { src: '/brand/scenes/scene-why.webp', position: 'center 62%' }, // 빛나는 책에 적는 우주인: 내 말로
  steps: { src: '/brand/scenes/scene-steps.webp', position: 'center 66%' }, // 별자리로 이어지는 모습
  handoff: { src: '/brand/scenes/scene-handoff.webp', position: 'center 70%' }, // 빛으로 이어진 두 사람
  closing: { src: '/brand/scenes/scene-closing.webp', position: 'center 58%' }, // 하늘에서 내려온 빛
} as const;

function SceneBackdrop({ scene }: { scene: keyof typeof SCENES }) {
  const { src, position } = SCENES[scene];
  return <img className="doit-brand-scene" src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" width="941" height="1672" style={{ objectPosition: position }} />;
}

// 컴퓨터(넓은 화면 + 마우스)인지. CSS 에서 QR 을 보여 주는 조건과 같은 식을 쓴다.
export const DESKTOP_QUERY = '(min-width:900px) and (hover:hover) and (pointer:fine)';

// 히어로 바로 아래: 좋은 인연은 조금 더 알아가는 데서(대표 최종 승인 두 번째 구역).
export function BrandDifference() {
  return (
    <section className="doit-brand-section doit-brand-scened doit-brand-why" id="doit-why" aria-labelledby="doit-why-title">
      <SceneBackdrop scene="why" />
      <p className="doit-brand-section-kicker">ECHO</p>
      <h2 id="doit-why-title" className="doit-brand-section-title doit-brand-section-title--quiet">좋은 인연은<br />많이 보는 것보다,<br />조금 더 알아가는 데서 시작되니까.</h2>
      <ul className="doit-brand-verse">
        {FLOW.map((item) => (
          <li key={item.line}>{item.line}{item.soon && <>{' '}<em className="doit-brand-soon">{SOON_LABEL}</em></>}</li>
        ))}
      </ul>
    </section>
  );
}

// 대표 최종 승인 Trust: 사진 이야기 뒤. 제목 하나 + 약속 세 줄 + 마지막 두 줄.
export function BrandTrust() {
  return (
    <section className="doit-brand-section doit-brand-trust" id="doit-trust" aria-labelledby="doit-trust-title">
      <p className="doit-brand-section-kicker">ECHO가 지키는 것</p>
      <h2 id="doit-trust-title" className="doit-brand-section-title doit-brand-section-title--quiet">당신을 함부로<br />정의하지 않습니다.</h2>
      <ul className="doit-brand-verse">
        {TRUST.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className="doit-brand-verse-closing">{TRUST_CLOSING[0]}<br />{TRUST_CLOSING[1]}</p>
    </section>
  );
}

// 대표 최종 승인 Just Try: 문장만. 버튼·기능 설명 없음.
export function BrandJustTry() {
  return (
    <section className="doit-brand-section doit-brand-justtry" id="doit-justtry" aria-labelledby="doit-justtry-title">
      <p className="doit-brand-section-kicker">JUST TRY</p>
      <h2 id="doit-justtry-title" className="doit-brand-section-title doit-brand-section-title--quiet">좋은 관계가 시작되는 데<br />거창한 용기는<br />필요하지 않을지도 모릅니다.</h2>
      <ul className="doit-brand-verse">
        {JUST_TRY.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className="doit-brand-verse-closing">작은 시도에서 시작됩니다.</p>
    </section>
  );
}

// 사진 이야기 뒤: 어떻게 시작하는지 + 휴대폰으로 넘어가기
export function BrandMobileStart() {
  const startUrl = appUrl('/doit/start-journey');
  return (
    <section className="doit-brand-mobile" id="doit-start-mobile" aria-labelledby="doit-start-mobile-title">
      <div className="doit-brand-section doit-brand-mobile-intro">
        {/* 대표 그림(2026-09-23 대표가 보낸 점 DOIT 지구). 글자는 그림 안에 있으니 alt 로 읽어 준다. */}
        <figure className="doit-brand-mobile-art">
          <img src={DOTS_EARTH_SRC} width="1000" height="1000" loading="lazy" decoding="async" alt="지구 위에 점으로 찍은 DOIT 글자" />
        </figure>
        <p className="doit-brand-section-kicker">시작하는 법</p>
        <h2 id="doit-start-mobile-title" className="doit-brand-section-title">나는 말하고,<br />찾는 건 ECHO가 해요.</h2>
      </div>

      <div className="doit-brand-section doit-brand-scened doit-brand-steps-zone">
        <SceneBackdrop scene="steps" />
        <ol className="doit-brand-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="doit-brand-step-no" aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{step.title}{step.soon && <>{' '}<em className="doit-brand-soon">{SOON_LABEL}</em></>}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="doit-brand-section doit-brand-scened doit-brand-handoff-zone">
        <SceneBackdrop scene="handoff" />
        <div className="doit-brand-handoff">
          {/* 휴대폰으로 볼 때: 버튼 하나로 앱에서 시작 */}
          <div className="doit-brand-handoff-phone">
            <a className="doit-brand-handoff-action" href={startUrl}>{MOBILE_START_LABEL}</a>
            <p>한 번 열고 홈 화면에 놓아 두면, 다음부터는 아이콘으로 바로 열려요.</p>
          </div>
          {/* 컴퓨터로 볼 때: 휴대폰 카메라로 QR 을 비추면 앱이 열린다 */}
          <div className="doit-brand-handoff-desk" id="doit-start-qr">
            <img className="doit-brand-qr" src="/brand/app-qr.svg" width="168" height="168" alt="app.do-it.company 로 가는 QR 코드" />
            <div>
              <p className="doit-brand-handoff-title">휴대폰 카메라로 비춰 보세요.</p>
              <p>바로 DO IT이 열려요. 주소는 <strong>https://app.do-it.company</strong></p>
              <a className="doit-brand-handoff-link" href={startUrl}>이 컴퓨터에서 열기</a>
            </div>
          </div>
        </div>
      </div>

      {/* 마지막 장면: 글자 없이 사진만(바닥글 앞). */}
      <div className="doit-brand-section doit-brand-scened doit-brand-closing" aria-hidden="true">
        <SceneBackdrop scene="closing" />
      </div>
    </section>
  );
}

// 회사 소개(2026-09-23 대표 "회사 구조에 맞춰서 브랜딩 홈페이지 만들어"). 회사가 무엇을 하는지 · 서비스 · 문의 · 문서.
// 사업자 등록 정보는 바로 아래 바닥글에 그대로 있다(같은 내용을 두 번 쓰지 않는다).
export function BrandAbout() {
  return (
    <section className="doit-brand-section doit-brand-about" id="doit-about" aria-labelledby="doit-about-title">
      <p className="doit-brand-section-kicker">회사 소개</p>
      <h2 id="doit-about-title" className="doit-brand-section-title">DO IT COMPANY</h2>
      <p className="doit-brand-section-lead">만남을 프로필이 아니라 대화로 시작하게 하는 AI를 만듭니다.</p>
      <dl className="doit-brand-about-list">
        <div className="doit-brand-about-row">
          <dt>하는 일</dt>
          <dd>어떤 만남을 원하는지 내 말로 듣고, 내가 맞다고 한 말로 나를 소개하는 앱 DO IT을 만듭니다.</dd>
        </div>
        <div className="doit-brand-about-row">
          <dt>서비스</dt>
          <dd>DO IT 모바일 앱 · <a href={appUrl('/')}>https://app.do-it.company</a></dd>
        </div>
        <div className="doit-brand-about-row">
          <dt>문의</dt>
          <dd><a href="mailto:0423doit@gmail.com">0423doit@gmail.com</a></dd>
        </div>
        <div className="doit-brand-about-row">
          <dt>문서</dt>
          <dd className="doit-brand-about-links"><a href="/legal/terms">이용약관</a><a href="/legal/privacy">개인정보처리방침</a></dd>
        </div>
      </dl>
    </section>
  );
}

// 대표 인사말(2026-09-23 대표 "마지막에 대표 인사말, 내가 경험한 그대로를 적어" / "모바일에는 없어, 홈페이지에만").
// 지어낸 일화는 넣지 않는다. 뼈대는 대표가 예전에 직접 쓴 인사말(src/pages/home/components/FounderMessageSection.tsx, ECHO 시절)의
// 문장 그대로다. 바꾼 것은 서비스 이름(ECHO → DO IT)과, 지금 DO IT 에 없는 기능(마음 날씨·노래 기록) 문단을 뺀 것,
// 그리고 지금 실제로 되는 것(고친 말은 다시 묻지 않음 · 맞다고 한 말로만 소개)과 히어로 문구 한 줄을 이어 붙인 것뿐이다.
const GREETING_TITLE = 'DO IT은 제가 직접 겪은 경험에서 시작됐습니다.';
const GREETING: string[] = [
  '생각은 많은데 정작 제 마음이 왜 이런지 설명하기 어려웠고, AI를 오랫동안 사용하면서도 같은 이야기를 다시 설명하거나, 제가 「그게 아니에요」라고 정정한 내용이 제대로 반영되지 않는 경험을 반복했습니다.',
  '그때 생각했습니다. AI가 나를 대신 판단하는 게 아니라, 내가 나를 이해할 수 있게 도와주면 어떨까.',
  '그래서 DO IT에서는 AI가 잘못 이해하면 내가 직접 고칩니다. 고친 말은 다시 묻지 않고, 내가 맞다고 한 말로만 나를 소개합니다.',
  '사람은 프로필보다, 함께한 행동에서 더 많이 보인다고 믿습니다. 그래서 만남도 프로필이 아니라 대화에서 시작하려 합니다.',
  'DO IT이 사람을 정의하거나 정답을 내려주는 AI가 되기를 원하지 않습니다.',
];
const GREETING_CLOSING = ['나를 판단하는 AI가 아니라,', '내가 나를 알아가게 하는 AI.'];

export function BrandGreeting() {
  return (
    <section className="doit-brand-section doit-brand-greeting" id="doit-greeting" aria-labelledby="doit-greeting-title">
      <p className="doit-brand-section-kicker">대표 인사말</p>
      <h2 id="doit-greeting-title" className="doit-brand-section-title">{GREETING_TITLE}</h2>
      <div className="doit-brand-greeting-body">
        {GREETING.map((line) => <p key={line}>{line}</p>)}
        <p className="doit-brand-greeting-closing">{GREETING_CLOSING[0]}<br />{GREETING_CLOSING[1]}</p>
      </div>
      <p className="doit-brand-greeting-sign"><span>DO IT COMPANY 대표</span> <strong>박진욱</strong></p>
    </section>
  );
}
