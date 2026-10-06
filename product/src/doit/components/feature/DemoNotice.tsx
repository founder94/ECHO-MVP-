import Card from "@/doit/components/base/Card";

// 서버 연결 전 화면임을 알리는 공통 배너.
// 가짜 매칭·등급·프로필·활동·인증을 실제 결과처럼 보이지 않도록 명확히 표시한다.
export default function DemoNotice({ text }: { text?: string }) {
  return (
    <Card padding="md" className="mb-4 border-accent-300 bg-accent-100/60">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-800">
          <i className="ri-information-line text-sm" />
        </span>
        <p className="text-xs leading-relaxed text-accent-900">
          {text ??
            "이 화면은 서버 연결 전 데모 미리보기예요. 실제 데이터는 저장·연결 기능이 준비된 뒤 제공돼요."}
        </p>
      </div>
    </Card>
  );
}