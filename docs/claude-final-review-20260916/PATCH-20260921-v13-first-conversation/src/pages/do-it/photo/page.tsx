import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SPACE_BG } from '../fortune/cardArt';
import { CameraController, CameraError } from './camera';
import { PhotoDrafts } from './photoDrafts';

interface Slot {
  id: string;
  label: string;
  hint: string;
}

// 2026-09-21 대표 확정: 필수 3장(전신·패션·취미) + 자유 3장. 정본은 src/doit/lib/photoPolicy.ts.
const SLOTS: Slot[] = [
  { id: 'full', label: '전신 (필수)', hint: '머리부터 발끝까지, 자연스럽게' },
  { id: 'style', label: '패션 (필수)', hint: '내가 자주 입는 스타일' },
  { id: 'hobby', label: '취미 (필수)', hint: '내가 좋아하는 활동을 하는 모습' },
  { id: 'activity', label: '자유 1 (선택)', hint: '더 보여 주고 싶은 나' },
  { id: 'charm', label: '자유 2 (선택)', hint: '내 하루의 한 장면' },
  { id: 'lifestyle', label: '자유 3 (선택)', hint: '나의 매력 포인트' },
];

type CameraState = 'idle' | 'starting' | 'live' | 'correcting';

// ─────────────────────────────────────────────────────────────
// 사진 크기 제한은 "실제 서버 기준"으로 주입해야 한다.
// 현재 업로드(저장) 연결이 없으므로 아래는 임시 클라이언트 상한이며,
// 서버 저장 연결 시 서버 설정값(바이트·해상도)으로 교체한다.
// ─────────────────────────────────────────────────────────────
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB — 임시(서버 기준 확정 전)
const MAX_CAPTURE_PIXELS = 12 * 1024 * 1024; // 12MP 카메라 상한

function cameraErrorText(code: string): string {
  switch (code) {
    case 'CAMERA_PERMISSION_DENIED':
      return '카메라 권한이 거부됐어요. 브라우저 설정에서 권한을 허용해 주세요.';
    case 'CAMERA_NOT_FOUND':
      return '카메라를 찾을 수 없어요.';
    case 'CAMERA_UNAVAILABLE':
      return '이 환경에서는 카메라를 사용할 수 없어요. (HTTPS가 필요해요)';
    case 'CAPTURE_TOO_LARGE':
      return '사진 해상도가 너무 커요. 다른 카메라로 다시 시도해 주세요.';
    case 'CAPTURE_BUSY':
      return '촬영이 진행 중이에요. 잠시만 기다려 주세요.';
    default:
      return '카메라를 열 수 없어요. 다시 시도해 주세요.';
  }
}

// 회전·밝기만 자연 보정으로 허용. 얼굴형·체형 변형·과도 필터는 금지(원칙 준수).
async function correctBlob(blob: Blob, rotation: number, brightness: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const radians = (rotation * Math.PI) / 180;
  const swap = rotation % 180 !== 0;
  const outW = swap ? bitmap.height : bitmap.width;
  const outH = swap ? bitmap.width : bitmap.height;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('CORRECTION_FAILED');
  }

  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(radians);
  ctx.filter = `brightness(${brightness})`;
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  const outBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!outBlob) throw new Error('CORRECTION_FAILED');
  return outBlob;
}

export default function PhotoPage() {
  const navigate = useNavigate();

  const draftsRef = useRef<PhotoDrafts | null>(null);
  if (draftsRef.current === null) {
    draftsRef.current = new PhotoDrafts(MAX_PHOTO_BYTES);
  }

  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);
  const capturedUrlRef = useRef<string | null>(null);

  // 모달이 열릴 때(activeIndex 변경) video 엘리먼트에 컨트롤러를 연결한다.
  useEffect(() => {
    if (activeIndex === null) return;
    const video = videoRef.current;
    if (!video) return;
    const controller = new CameraController(video, MAX_CAPTURE_PIXELS);
    cameraRef.current = controller;
    return () => {
      controller.close();
      if (cameraRef.current === controller) cameraRef.current = null;
    };
  }, [activeIndex]);

  const releaseCaptured = useCallback(() => {
    if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    capturedUrlRef.current = null;
    capturedBlobRef.current = null;
    setCapturedUrl(null);
  }, []);

  const closeCamera = useCallback(() => {
    cameraRef.current?.close();
    releaseCaptured();
    setActiveIndex(null);
    setCameraState('idle');
    setRotation(0);
    setBrightness(1);
    setCameraError(null);
  }, [releaseCaptured]);

  const startCamera = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) {
      setCameraError('카메라를 초기화할 수 없어요. 다시 시도해 주세요.');
      return;
    }
    setCameraState('starting');
    setCameraError(null);
    try {
      await cam.open('user');
      setCameraState('live');
    } catch (e) {
      const code = e instanceof CameraError ? e.code : 'CAMERA_OPEN_FAILED';
      setCameraError(cameraErrorText(code));
      setCameraState('idle');
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
      setCameraState('correcting');
      cam.close();
    } catch (e) {
      const code = e instanceof CameraError ? e.code : 'CAPTURE_FAILED';
      setCameraError(cameraErrorText(code));
      setCameraState('live');
    }
  }, []);

  const confirmPhoto = useCallback(async () => {
    const blob = capturedBlobRef.current;
    if (!blob || activeIndex === null) return;
    try {
      const corrected = await correctBlob(blob, rotation, brightness);
      try {
        draftsRef.current?.setCapture(activeIndex, corrected);
      } catch {
        setCameraError('이 사진은 서버에 저장된 뒤라 이 화면에서 교체할 수 없어요.');
        setCameraState('idle');
        return;
      }
      closeCamera();
      refresh();
    } catch {
      setCameraError('사진을 처리하지 못했어요. 다시 촬영해 주세요.');
      setCameraState('idle');
    }
  }, [activeIndex, rotation, brightness, closeCamera, refresh]);

  const resetCorrection = () => {
    setRotation(0);
    setBrightness(1);
  };

  const openSlot = (index: number) => {
    setActiveIndex(index);
    setCameraState('idle');
    setCameraError(null);
    releaseCaptured();
    setRotation(0);
    setBrightness(1);
  };

  const setPrimary = (index: number) => {
    try {
      draftsRef.current?.setPrimary(index);
      refresh();
    } catch {
      // 빈 슬롯 등은 무시
    }
  };

  const swapLocal = (a: number, b: number) => {
    if (a < 0 || b < 0 || a >= SLOTS.length || b >= SLOTS.length) return;
    try {
      draftsRef.current?.swapLocal(a, b);
      refresh();
    } catch {
      // 업로드 중/서버 저장분은 로컬 재정렬 불가
    }
  };

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      cameraRef.current?.close();
      draftsRef.current?.dispose();
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    };
  }, []);

  const snap = draftsRef.current.snapshot();
  const filledCount = snap.photos.filter((p) => p !== null).length;

  return (
    <div className="min-h-screen overflow-x-hidden" style={SPACE_BG}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/do-it/landing')}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#F5F3EF] transition-colors hover:bg-white/10"
          >
            <i className="ri-arrow-left-line text-lg" />
          </button>
          <span className="text-[11px] tracking-[.2em] text-[#6B7280]">내 프로필 사진</span>
        </div>

        <h1
          className="mt-7 text-[26px] leading-[1.3] text-[#F5F3EF]"
          style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}
        >
          있는 그대로의 나를
          <br />
          세 장에 담아요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
          앱 안 카메라로 직접 촬영해요. 갤러리에서 오래된 사진을 가져오는 방식은 기본으로 쓰지
          않아요. 목표는 예쁘게 속이는 게 아니라 실제 만남에서 괴리감이 없게 하는 거예요.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {SLOTS.map((slot, index) => {
            const photo = snap.photos[index];
            const isPrimary = snap.primarySlot === index;
            return (
              <div
                key={slot.id}
                className="relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#14161D]"
              >
                {photo ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openSlot(index)}
                      aria-label={`${slot.label} 다시 촬영`}
                      className="flex-1 overflow-hidden text-left"
                    >
                      <img src={photo.previewUrl} alt={slot.label} className="h-full w-full object-cover" />
                    </button>
                    <div className="flex items-center justify-between gap-1 border-t border-white/10 px-1 py-1.5">
                      <button
                        type="button"
                        onClick={() => swapLocal(index, index - 1)}
                        disabled={index === 0}
                        aria-label="앞 순서로 이동"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-white/10 disabled:opacity-30"
                      >
                        <i className="ri-arrow-left-s-line text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrimary(index)}
                        aria-label={isPrimary ? '대표 사진 해제 불가(다른 사진을 대표로 지정하세요)' : '대표 사진으로 지정'}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                      >
                        <i
                          className={`text-lg ${isPrimary ? 'ri-star-fill text-[#C9A24B]' : 'ri-star-line text-[#6B7280]'}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => swapLocal(index, index + 1)}
                        disabled={index === SLOTS.length - 1}
                        aria-label="뒤 순서로 이동"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-white/10 disabled:opacity-30"
                      >
                        <i className="ri-arrow-right-s-line text-lg" />
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSlot(index)}
                    className="flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center"
                  >
                    <i className="ri-camera-line text-2xl text-[#6B7280]" />
                    <p className="text-xs font-medium text-[#9CA3AF]">{slot.label}</p>
                    <p className="text-[10px] text-[#6B7280]">{slot.hint}</p>
                  </button>
                )}
                {isPrimary && photo && (
                  <span className="absolute left-2 top-2 rounded-full bg-[#C9A24B] px-2 py-0.5 text-[10px] font-medium text-[#0A0B0F]">
                    대표
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-[#6B7280]">{filledCount} / 6장 (필수 3장: 전신·패션·취미)</p>

        <div className="mt-5 rounded-2xl border border-[#C9A24B]/30 bg-[#C9A24B]/10 p-4">
          <p className="flex items-start gap-2 text-xs leading-5 text-[#d6ba78]">
            <i className="ri-information-line mt-0.5 shrink-0" />
            촬영은 내 기기에서만 이뤄져요. 서버 저장·본인 동일성 확인은 아직 준비 중이라, 이 화면을
            새로고침하면 사진이 초기화돼요. 얼굴형·체형을 실제와 다르게 바꾸는 보정은 제공하지
            않아요.
          </p>
        </div>

        <p className="mt-auto pt-6 text-center text-xs leading-5 text-[#6B7280]">
          별표는 대표 사진, 화살표는 순서를 바꿔요. 저장된 사진 복구·교체·순서는 서버 연결이 필요해요.
        </p>
      </div>

      {/* 카메라 모달 */}
      {activeIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0B0F]">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-[#F5F3EF]">{SLOTS[activeIndex].label}</span>
            <button
              type="button"
              onClick={closeCamera}
              aria-label="닫기"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#F5F3EF] transition-colors hover:bg-white/10"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {/* 라이브 뷰 (video는 항상 마운트해 컨트롤러가 연결되도록 함) */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${cameraState === 'live' || cameraState === 'starting' ? '' : 'hidden'}`}
              style={{ transform: 'scaleX(-1)' }}
            />
            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <i className="ri-loader-4-line animate-spin text-3xl text-white" />
              </div>
            )}

            {/* 촬영된 사진 / 보정 미리보기 */}
            {cameraState === 'correcting' && capturedUrl && (
              <div className="flex h-full flex-col items-center justify-center p-5">
                <div className="flex flex-1 items-center justify-center overflow-hidden">
                  <img
                    src={capturedUrl}
                    alt="촬영 미리보기"
                    className="max-h-full max-w-full object-contain transition-all"
                    style={{
                      transform: `rotate(${rotation}deg) scale(${rotation % 180 !== 0 ? 0.9 : 1})`,
                      filter: `brightness(${brightness})`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 오류 / 대기 */}
            {cameraState === 'idle' && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                {cameraError ? (
                  <>
                    <i className="ri-error-warning-line text-3xl text-[#C9A24B]" />
                    <p className="text-sm leading-6 text-[#9CA3AF]">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <i className="ri-camera-line text-4xl text-[#6B7280]" />
                    <p className="text-sm text-[#9CA3AF]">아래 버튼으로 카메라를 켜 촬영해 주세요.</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 보정 컨트롤 */}
          {cameraState === 'correcting' && (
            <div className="space-y-3 border-t border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-[#9CA3AF]">회전</span>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-white/15 text-sm text-[#F5F3EF] transition-colors hover:bg-white/5"
                >
                  <i className="ri-refresh-line" />
                  {rotation}°
                </button>
                <button
                  type="button"
                  onClick={resetCorrection}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 text-xs text-[#9CA3AF] transition-colors hover:bg-white/5"
                >
                  초기화
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-[#9CA3AF]">밝기</span>
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
              <p className="text-[11px] leading-4 text-[#6B7280]">
                회전·밝기 등 자연 보정만 제공해요. 얼굴형·체형 변형·과도한 필터는 없어요.
              </p>
            </div>
          )}

          {/* 하단 액션 */}
          <div className="flex gap-2 px-5 py-4">
            {cameraState === 'live' && (
              <button
                type="button"
                onClick={() => void capture()}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity hover:opacity-90"
              >
                <i className="ri-camera-line" />
                촬영
              </button>
            )}
            {cameraState === 'idle' && (
              <button
                type="button"
                onClick={() => void startCamera()}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity hover:opacity-90"
              >
                <i className="ri-camera-line" />
                카메라 켜기
              </button>
            )}
            {cameraState === 'correcting' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    releaseCaptured();
                    setCameraState('idle');
                    void startCamera();
                  }}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-white/15 text-sm text-[#F5F3EF] transition-colors hover:bg-white/5"
                >
                  <i className="ri-refresh-line" />
                  다시 찍기
                </button>
                <button
                  type="button"
                  onClick={() => void confirmPhoto()}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-[#C9A24B] text-[15px] font-medium text-[#0A0B0F] transition-opacity hover:opacity-90"
                >
                  <i className="ri-check-line" />
                  사용하기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}