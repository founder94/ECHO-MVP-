import { useParams, Link } from 'react-router-dom';

const featureLabels: Record<string, string> = {
  profile: '내 프로필',
  story: '내 스토리',
  spaces: '공간과 미션',
  grade: '등급과 활동',
  key: 'KEY 내역',
  saju: '사주',
  taro: '타로',
  settings: '설정',
};

export default function ComingSoonPage() {
  const { feature } = useParams<{ feature: string }>();
  const label = (feature && featureLabels[feature]) || '이 기능';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-50 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
        <i className="ri-time-line text-3xl" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold text-foreground-950">{label}</h1>
      <p className="mt-2 text-sm font-medium text-foreground-700">준비 중이에요</p>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-foreground-500">
        이 기능은 아직 서버와 데이터 연결이 필요해요. 실제 저장과 권한 검증이 완료된 뒤에 제공될
        예정이에요.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-background-50 transition-colors hover:bg-primary-600"
      >
        <i className="ri-arrow-left-line" />
        홈으로 돌아가기
      </Link>
    </div>
  );
}