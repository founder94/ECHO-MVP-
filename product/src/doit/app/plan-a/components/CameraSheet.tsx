import { useCallback, useEffect, useRef, useState } from "react";
import { CameraController, CameraError } from "@/pages/do-it/photo/camera";
import { correctBlob } from "@/doit/lib/photoCorrect";
import { colors, serif } from "@/doit/app/plan-a/theme";

const MAX_CAPTURE_PIXELS = 12 * 1024 * 1024; // 12MP 카메라 상한

type CameraState = "idle" | "starting" | "live" | "correcting" | "saving";

function cameraErrorText(code: string): string {
  switch (code) {
    case "CAMERA_PERMISSION_DENIED":
      return "카메라 권한이 거부됐어요. 브라우저 설정에서 권한을 허용해 주세요.";
    case "CAMERA_NOT_FOUND":
      return "카메라를 찾을 수 없어요.";
    case "CAMERA_UNAVAILABLE":
      return "이 환경에서는 카메라를 사용할 수 없어요. (HTTPS가 필요해요)";
    case "CAPTURE_TOO_LARGE":
      return "사진 해상도가 너무 커요. 다른 카메라로 다시 시도해 주세요.";
    case "CAPTURE_BUSY":
      return "촬영이 진행 중이에요. 잠시만 기다려 주세요.";
    default:
      return "카메라를 열 수 없어요. 다시 시도해 주세요.";
  }
}

interface Props {
  slotLabel: string;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}

// 기존 CameraController + correctBlob 로직을 재사용한 plan-a 스타일 카메라 시트.
export function CameraSheet({ slotLabel, onClose, onConfirm }: Props) {
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);
  const capturedUrlRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const controller = new CameraController(video, MAX_CAPTURE_PIXELS);
    cameraRef.current = controller;
    return () => {
      controller.close();
      if (cameraRef.current === controller) cameraRef.current = null;
    };
  }, []);

  const releaseCaptured = useCallback(() => {
    if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    capturedUrlRef.current = null;
    capturedBlobRef.current = null;
    setCapturedUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      cameraRef.current?.close();
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    };
  }, []);

  const startCamera = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) {
      setCameraError("카메라를 초기화할 수 없어요. 다시 시도해 주세요.");
      return;
    }
    setCameraState("starting");
    setCameraError(null);
    try {
      await cam.open("user");
      setCameraState("live");
    } catch (e) {
      const code = e instanceof CameraError ? e.code : "CAMERA_OPEN_FAILED";
      setCameraError(cameraErrorText(code));
      setCameraState("idle");
    }
  }, []);

  const capture = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    try {
      const blob = await cam.capture();
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
      const url = URL.createObjectURL(blob);
      capturedBlobRef.current = blob;
      capturedUrlRef.current = url;
      setCapturedUrl(url);
      setRotation(0);
      setBrightness(1);
      setCameraState("correcting");
      cam.close();
    } catch (e) {
      const code = e instanceof CameraError ? e.code : "CAPTURE_FAILED";
      setCameraError(cameraErrorText(code));
      setCameraState("live");
    }
  }, []);

  const confirm = useCallback(async () => {
    if (savingRef.current) return;
    const blob = capturedBlobRef.current;
    if (!blob) return;
    savingRef.current = true;
    setCameraState("saving");
    setCameraError(null);
    try {
      const corrected = await correctBlob(blob, rotation, brightness);
      await onConfirm(corrected);
      releaseCaptured();
      onClose();
    } catch {
      setCameraError("저장하지 못했어요. 다시 시도해 주세요.");
      setCameraState("idle");
    } finally {
      savingRef.current = false;
    }
  }, [rotation, brightness, onConfirm, releaseCaptured, onClose]);

  const resetCorrection = () => {
    setRotation(0);
    setBrightness(1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: colors.bg }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <span style={{ fontSize: 14, color: colors.text, fontFamily: serif }}>
          {slotLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            border: `1px solid ${colors.borderStrong}`,
            color: colors.text,
            cursor: "pointer",
          }}
        >
          <i className="ri-close-line text-lg" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${
            cameraState === "live" || cameraState === "starting" ? "" : "hidden"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />

        {cameraState === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <i className="ri-loader-4-line animate-spin text-3xl text-white" />
          </div>
        )}

        {cameraState === "correcting" && capturedUrl && (
          <div className="flex h-full items-center justify-center overflow-hidden p-5">
            <img
              src={capturedUrl}
              alt="촬영 미리보기"
              className="max-h-full max-w-full object-contain transition-all"
              style={{
                transform: `rotate(${rotation}deg) scale(${
                  rotation % 180 !== 0 ? 0.9 : 1
                })`,
                filter: `brightness(${brightness})`,
              }}
            />
          </div>
        )}

        {cameraState === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            {cameraError ? (
              <>
                <i
                  className="ri-error-warning-line text-3xl"
                  style={{ color: colors.accent }}
                />
                <p style={{ fontSize: 14, lineHeight: 1.6, color: colors.textMuted }}>
                  {cameraError}
                </p>
              </>
            ) : (
              <>
                <i className="ri-camera-line text-4xl" style={{ color: colors.textFaint }} />
                <p style={{ fontSize: 14, color: colors.textMuted }}>
                  아래 버튼으로 카메라를 켜 촬영해 주세요.
                </p>
              </>
            )}
          </div>
        )}

        {cameraState === "saving" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
            <i className="ri-loader-4-line animate-spin text-3xl text-white" />
            <p style={{ fontSize: 14, color: colors.textMuted }}>저장 중이에요…</p>
          </div>
        )}
      </div>

      {cameraState === "correcting" && (
        <div
          className="space-y-3 px-5 py-4"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0" style={{ fontSize: 12, color: colors.textMuted }}>
              회전
            </span>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full"
              style={{
                border: `1px solid ${colors.borderStrong}`,
                fontSize: 14,
                color: colors.text,
                cursor: "pointer",
              }}
            >
              <i className="ri-refresh-line" />
              {rotation}°
            </button>
            <button
              type="button"
              onClick={resetCorrection}
              className="flex h-9 items-center justify-center gap-1.5 rounded-full px-4"
              style={{
                border: `1px solid ${colors.borderStrong}`,
                fontSize: 12,
                color: colors.textMuted,
                cursor: "pointer",
              }}
            >
              초기화
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0" style={{ fontSize: 12, color: colors.textMuted }}>
              밝기
            </span>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="flex-1"
              aria-label="밝기 조절"
            />
          </div>

          <p style={{ fontSize: 11, lineHeight: 1.5, color: colors.textFaint }}>
            회전·밝기 등 자연 보정만 제공해요. 얼굴형·체형 변형·과도한 필터는 없어요.
          </p>
        </div>
      )}

      <div className="flex gap-2 px-5 py-4">
        {cameraState === "live" && (
          <button
            type="button"
            onClick={() => void capture()}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full whitespace-nowrap"
            style={{
              backgroundColor: colors.accent,
              color: colors.onAccent,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            <i className="ri-camera-line" />
            촬영
          </button>
        )}

        {cameraState === "idle" && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full whitespace-nowrap"
            style={{
              backgroundColor: colors.accent,
              color: colors.onAccent,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            <i className="ri-camera-line" />
            카메라 켜기
          </button>
        )}

        {cameraState === "correcting" && (
          <>
            <button
              type="button"
              onClick={() => {
                releaseCaptured();
                setCameraState("idle");
                void startCamera();
              }}
              className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full whitespace-nowrap"
              style={{
                border: `1px solid ${colors.borderStrong}`,
                fontSize: 14,
                color: colors.text,
                cursor: "pointer",
              }}
            >
              <i className="ri-refresh-line" />
              다시 찍기
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full whitespace-nowrap"
              style={{
                backgroundColor: colors.accent,
                color: colors.onAccent,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              <i className="ri-check-line" />
              사용하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}