import DoItSymbol from '@/components/DoItSymbol';
import ProfilePhotoGallery from '@/doit/components/feature/ProfilePhotoGallery';
import type { ProfileDraft } from './ProfileBuild';
import '@/doit/components/feature/product-brand.css';

interface Props {
  onNext: () => void;
  onEditProfile?: () => void;
  onEditPhotos?: () => void;
  userId?: string | null;
  purposeLabel?: string;
  profile?: ProfileDraft;
}

export function ProfileReview({ onNext, onEditProfile, onEditPhotos, userId = null, purposeLabel, profile }: Props) {
  const fields = [
    { label: '연결 목적', value: purposeLabel },
    { label: '생활 리듬', value: profile?.lifeRhythm },
    { label: '활동 지역', value: profile?.region },
  ];

  return <div className="doit-profile-review"><div className="doit-profile-review-inner">
    <div className="doit-profile-review-brand"><DoItSymbol decorative />DO IT COMPANY</div>
    <p className="doit-product-kicker">PROFILE REVIEW · 프로필 확인</p>
    <h1 className="doit-product-title">내가 고른 말로,<br />나를 소개합니다.</h1>
    <p className="doit-product-description">직접 적은 이야기를 한 번 더 읽어보세요.<br />지금의 나와 달라졌다면 고쳐도 괜찮아요.</p>
    <ProfilePhotoGallery userId={userId} onManage={onEditPhotos} />
    <div className="doit-profile-card">
      <div className="doit-profile-card-head"><span className="doit-product-kicker">직접 작성한 프로필</span><DoItSymbol decorative /></div>
      <h2 className="doit-profile-name">{profile?.nickname?.trim() || '닉네임을 적어주세요'}</h2>
      <p className="doit-profile-intro">{profile?.intro?.trim() || '소개를 아직 적지 않았어요.'}</p>
      <dl className="doit-profile-facts">{fields.map(({label,value}) => <div key={label}><dt>{label}</dt><dd>{value?.trim() || '아직 작성하지 않았어요'}</dd></div>)}</dl>
    </div>
    <div className="doit-product-note"><span className="doit-product-status">내 소개를 확인했어요</span><p>이곳에는 직접 적고 저장한 정보를 담아요. 사진을 등록해도 본인 인증이 되는 것은 아니에요. 연결을 받으려면 전화 인증까지 마쳐 주세요.</p></div>
    {onEditProfile && <button type="button" className="doit-product-action" onClick={onEditProfile}>내 소개 수정하기</button>}
    <button type="button" className="doit-product-action doit-product-action--secondary" onClick={onNext}>연결까지 남은 것 보기 <span aria-hidden="true">↗</span></button>
    <p className="doit-product-footnote">저장해도 다른 사람에게 바로 보이지 않아요. 연결된 상대에게만, 둘 다 첫 질문에 답한 뒤에 보여요.</p>
  </div></div>;
}
