import PreparationPage from '@/doit/components/feature/PreparationPage';

export default function Page() {
  return <PreparationPage title="함께할 공간" tab="spaces" eyebrow="A LITTLE ROOM FOR US"
    heading={<>우리의 이야기가<br />시작될 곳.</>}
    description="같은 목적을 가진 사람들이 함께할 수 있는 공간을 준비하고 있어요."
    notice="대화방 입장·메시지 전송·미션 참여는 아직 열리지 않았어요." action={{ label: "공간으로 돌아가기", to: "/doit/spaces" }} />;
}
