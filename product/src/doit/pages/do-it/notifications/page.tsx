import PreparationPage from '@/doit/components/feature/PreparationPage';

export default function Page() {
  return <PreparationPage title="알림" back eyebrow="WHEN THERE IS SOMETHING TO SHARE"
    heading={<>반가운 소식은,<br />이곳에 모이도록.</>}
    description="새로운 연결과 함께할 시간에 관한 소식을 한곳에서 확인할 수 있도록 준비하고 있어요."
    notice="알림 서비스는 준비 중이에요. 알림을 조회하거나 읽음 상태를 저장하는 기능은 아직 제공하지 않아요." />;
}
