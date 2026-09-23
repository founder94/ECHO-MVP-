import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import Card from "@/doit/components/base/Card";
import Button from "@/doit/components/base/Button";

export default function Photo() {
  const navigate = useNavigate();
  const [capturing, setCapturing] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  const handleCapture = () => {
    if (capturing) return;
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      setHasPhoto(true);
    }, 1200);
  };

  return (
    <MobileLayout title="사진" back>
      <div className="animate-fade-up pt-4">
        <h2 className="mb-1 font-heading text-xl font-semibold text-foreground-950">
          사진을 찍어볼까요?
        </h2>
        <p className="mb-5 text-sm text-foreground-500">
          자연스러운 전신 사진이 좋아요. 증명사진보다 있는 그대로의 모습을 보여줘요.
        </p>

        {/* Camera frame */}
        <Card padding="none" className="mb-4 overflow-hidden">
          <div className="relative flex h-80 items-center justify-center bg-background-100">
            {hasPhoto ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-secondary-100 to-primary-100">
                <i className="ri-user-3-line text-6xl text-foreground-300" />
                <span className="rounded-full bg-background-950/60 px-3 py-1 text-xs text-white">
                  데모 사진
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-foreground-400">
                <i className="ri-camera-line text-5xl" />
                <p className="text-sm">아직 사진이 없어요</p>
              </div>
            )}
            {capturing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background-950/30">
                <i className="ri-loader-4-line animate-spin-slow text-3xl text-white" />
              </div>
            )}
          </div>
        </Card>

        {/* Guide */}
        <Card padding="md" className="mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center text-accent-600">
                <i className="ri-check-line text-sm" />
              </span>
              <p className="text-xs text-foreground-600">자연스러운 전신 사진 중심</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center text-foreground-400">
                <i className="ri-forbid-2-line text-sm" />
              </span>
              <p className="text-xs text-foreground-500">과도한 얼굴·체형 보정 없음</p>
            </div>
          </div>
        </Card>

        {/* MOCK note */}
        <Card padding="md" className="mb-4 border-accent-200 bg-accent-50">
          <p className="text-xs leading-relaxed text-accent-900">
            이 화면은 데모 촬영이에요. 실제 카메라·사진 업로드는 서버 연동 시 적용돼요.
          </p>
        </Card>

        {/* Actions */}
        {!hasPhoto ? (
          <Button full size="lg" loading={capturing} onClick={handleCapture}>
            {capturing ? "촬영 중..." : "촬영하기"}
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button full size="lg" onClick={() => navigate("/doit/home")}>
              다음 (Home으로)
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" full loading={capturing} onClick={handleCapture}>
                다시 촬영
              </Button>
              <Button variant="ghost" full onClick={() => setHasPhoto(false)}>
                취소
              </Button>
            </div>
          </div>
        )}

        {hasPhoto && (
          <p className="mt-3 text-center text-xs text-foreground-400">
            사진 촬영 완료 · 필수 조건 충족
          </p>
        )}
      </div>
    </MobileLayout>
  );
}