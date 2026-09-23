import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Camera, ImagePlus, Loader2, Star, X } from "lucide-react";
import { PhotoDrafts } from "@/pages/do-it/photo/photoDrafts";
import { colors, serif } from "@/doit/app/plan-a/theme";
import { PrimaryButton } from "@/doit/app/plan-a/components/PrimaryButton";
import { CameraSheet } from "@/doit/app/plan-a/components/CameraSheet";
import {
  SupabasePhotoAdapter,
  restorePhotos,
  setPrimaryPhoto,
  replacePhoto,
  signedUrlFor,
  buildStoragePath,
  PHOTO_SLOT_COUNT,
  type RestoredPhoto,
} from "@/doit/lib/photoStorage";

import { MAX_UPLOAD_PHOTO_BYTES, prepareAlbumPhoto, RecentPhotoError, type PreparedAlbumPhoto } from "@/doit/lib/recentPhoto";
import { PHOTO_SLOTS, PHOTO_REQUIRED_COUNT, VERDICT_LABEL, photoSetComplete, requestPhotoCheck, requiredFilledCount, type PhotoCheck } from "@/doit/lib/photoPolicy";

const MAX_PHOTO_BYTES = MAX_UPLOAD_PHOTO_BYTES;
type PhotoTarget = { slot: number; mode: "capture" | "replace" };

function PhotoDialog({ title, busy, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.78)", backdropFilter: "blur(8px)" }}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-3xl p-5 overflow-y-auto" style={{ background: "linear-gradient(145deg,#242832,#11141a)", border: "1px solid #c9d2df42", color: colors.text, maxHeight: "90dvh" }} onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]') ?? [])];
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    }}>
      <div className="flex items-center justify-between gap-4 mb-4"><h2 className="text-base font-semibold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

// 2026-09-21 대표 확정: 필수 3장(전신·패션·취미) + 자유 3장. 슬롯 = 종류(photoPolicy.ts 가 정본).
const SLOTS = PHOTO_SLOTS.map((spec) => ({ label: spec.required ? `${spec.label} (필수)` : `${spec.label} (선택)`, hint: spec.hint, required: spec.required }));

interface Props {
  userId: string | null;
  onNext: () => void;
  onBack?: () => void;
}

type RestoreState = "loading" | "ready" | "error";

export function PhotoCapture({ userId, onNext, onBack }: Props) {
  return <PhotoCaptureSession key={userId ?? "signed-out"} userId={userId} onNext={onNext} onBack={onBack} />;
}

function PhotoCaptureSession({ userId, onNext, onBack }: Props) {
  const mountedRef = useRef(true);
  const loadVersionRef = useRef(0);
  const primaryInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const albumTargetRef = useRef<PhotoTarget | null>(null);
  const albumPreviewRef = useRef<string | null>(null);
  const draftsRef = useRef<PhotoDrafts | null>(null);
  if (userId && draftsRef.current === null) {
    draftsRef.current = new PhotoDrafts(
      MAX_PHOTO_BYTES,
      new SupabasePhotoAdapter(userId),
    );
  }

  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const [restoreState, setRestoreState] = useState<RestoreState>("loading");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<number, RestoredPhoto>>({});
  const [primarySlot, setPrimarySlot] = useState<number | null>(null);
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [camera, setCamera] = useState<PhotoTarget | null>(null);
  const [sourceChoice, setSourceChoice] = useState<PhotoTarget | null>(null);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({});
  const [album, setAlbum] = useState<(PreparedAlbumPhoto & { target: PhotoTarget; preview: string }) | null>(null);
  const [confirmedRecent, setConfirmedRecent] = useState(false);
  // AI 판별 결과(칸별). 저장 뒤 비동기로 요청하고, 서버 함수가 없으면 '확인 대기'로만 표시한다(막지 않음).
  const [checks, setChecks] = useState<Record<number, PhotoCheck | "pending">>({});
  const requestCheck = useCallback((slot: number, photoId: string) => {
    if (!userId) return;
    setChecks((prev) => ({ ...prev, [slot]: "pending" }));
    void requestPhotoCheck(userId, photoId, slot).then((result) => {
      if (mountedRef.current) setChecks((prev) => ({ ...prev, [slot]: result }));
    });
  }, [userId]);

  const loadSaved = useCallback(async () => {
    const version = ++loadVersionRef.current;
    if (!userId) {
      setSaved({});
      setPrimarySlot(null);
      setRestoreState("ready");
      return;
    }
    setRestoreState("loading");
    setRestoreError(null);
    try {
      const photos = await restorePhotos(userId);
      if (!mountedRef.current || version !== loadVersionRef.current) return;
      const map: Record<number, RestoredPhoto> = {};
      let primary: number | null = null;
      for (const p of photos) {
        map[p.slot] = p;
        if (p.isPrimary) primary = p.slot;
      }
      setSaved(map);
      setPrimarySlot(primary);
      setRestoreState("ready");
    } catch {
      if (!mountedRef.current || version !== loadVersionRef.current) return;
      setRestoreError("기존 사진을 불러오지 못했어요. 다시 시도해 주세요.");
      setRestoreState("error");
    }
  }, [userId]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadVersionRef.current += 1;
      if (albumPreviewRef.current) URL.revokeObjectURL(albumPreviewRef.current);
      albumPreviewRef.current = null;
      draftsRef.current?.dispose();
      draftsRef.current = null;
    };
  }, []);

  const choosePrimary = useCallback(
    async (slot: number) => {
      if (!userId || primaryInFlightRef.current || saveInFlightRef.current || saveBusy || album || sourceChoice || camera) return;
      primaryInFlightRef.current = true;
      const previous = primarySlot;
      setPrimarySlot(slot);
      setActionError(null);
      setPrimaryBusy(true);
      try {
        const err = await setPrimaryPhoto(userId, slot);
        if (!mountedRef.current) return;
        if (err) {
          setPrimarySlot(previous);
          setActionError("대표 사진을 저장하지 못했어요. 다시 선택해 주세요.");
          await loadSaved();
        }
      } catch {
        if (!mountedRef.current) return;
        setPrimarySlot(previous);
        setActionError("대표 사진을 저장하지 못했어요. 다시 선택해 주세요.");
        await loadSaved();
      } finally {
        primaryInFlightRef.current = false;
        if (mountedRef.current) setPrimaryBusy(false);
      }
    },
    [userId, saveBusy, primarySlot, loadSaved, album, sourceChoice, camera],
  );

  const savePhoto = useCallback(
    async (target: PhotoTarget, blob: Blob) => {
      if (!userId || saveInFlightRef.current || primaryInFlightRef.current) throw new Error("PHOTO_BUSY");
      const { slot, mode } = target;
      if (blob.type !== "image/jpeg" || blob.size < 1 || blob.size > MAX_PHOTO_BYTES) throw new RecentPhotoError("5MB 이하 JPG 사진만 저장할 수 있어요.");
      saveInFlightRef.current = true;
      setBusySlot(slot);
      setSlotErrors((prev) => ({ ...prev, [slot]: "" }));
      setActionError(null);
      setSaveBusy(true);

      try {
        const existing = saved[slot];
        const previousDraft = draftsRef.current?.snapshot().photos[slot];
        if (mode === "replace" || existing || previousDraft?.status === "uploaded") {
          const result = await replacePhoto(
            userId,
            slot,
            blob,
            crypto.randomUUID(),
            existing?.storagePath ?? (previousDraft?.status === "uploaded" ? buildStoragePath(userId, slot, previousDraft.captureId) : null),
          );
          if (!mountedRef.current) return;
          if (result.cleanupPendingPath) setActionError("새 사진은 저장했어요. 이전 사진 정리가 끝나지 않아 확인이 필요해요.");
          requestCheck(slot, result.photoId);
          setSaved((prev) => ({
            ...prev,
            [slot]: {
              slot,
              photoId: result.photoId,
              storagePath: result.storagePath,
              url: result.url,
              isPrimary: primarySlot === slot,
            },
          }));
        } else {
          const drafts = draftsRef.current;
          if (!drafts) throw new Error("DRAFTS_UNAVAILABLE");
          drafts.setCapture(slot, blob);
          const receipt = await drafts.upload(slot);
          const path = buildStoragePath(userId, slot, receipt.captureId);
          const url = await signedUrlFor(path);
          if (!mountedRef.current) return;
          requestCheck(slot, receipt.photoId);
          setSaved((prev) => ({
            ...prev,
            [slot]: {
              slot,
              photoId: receipt.photoId,
              storagePath: path,
              url,
              isPrimary: false,
            },
          }));
        }
        refresh();
      } catch (error) {
        if (mountedRef.current) {
          setSlotErrors((prev) => ({ ...prev, [slot]: "사진을 저장하지 못했어요. 기존 사진은 다시 불러와 확인할 수 있어요." }));
          refresh();
        }
        throw error;
      } finally {
        saveInFlightRef.current = false;
        if (mountedRef.current) { setSaveBusy(false); setBusySlot(null); }
      }
    },
    [userId, saved, primarySlot, refresh, requestCheck],
  );

  const closeAlbum = () => {
    if (saveInFlightRef.current) return;
    if (albumPreviewRef.current) URL.revokeObjectURL(albumPreviewRef.current);
    albumPreviewRef.current = null;
    setAlbum(null);
    setConfirmedRecent(false);
  };

  const prepareSelectedFile = async (file: File) => {
    const target = albumTargetRef.current;
    albumTargetRef.current = null;
    if (!target || saveInFlightRef.current || primaryInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaveBusy(true);
    setBusySlot(target.slot);
    setSlotErrors((prev) => ({ ...prev, [target.slot]: "" }));
    try {
      const prepared = await prepareAlbumPhoto(file);
      if (!mountedRef.current) return;
      const preview = URL.createObjectURL(prepared.blob);
      if (albumPreviewRef.current) URL.revokeObjectURL(albumPreviewRef.current);
      albumPreviewRef.current = preview;
      setConfirmedRecent(false);
      setAlbum({ ...prepared, target, preview });
    } catch (error) {
      if (mountedRef.current) setSlotErrors((prev) => ({ ...prev, [target.slot]: error instanceof RecentPhotoError ? error.message : "사진을 준비하지 못했어요. 다른 사진으로 다시 시도해 주세요." }));
    } finally {
      saveInFlightRef.current = false;
      if (mountedRef.current) { setSaveBusy(false); setBusySlot(null); }
    }
  };

  const confirmAlbum = async () => {
    if (!album || saveInFlightRef.current || (album.dateCheck.kind === "needs-confirmation" && !confirmedRecent)) return;
    try {
      await savePhoto(album.target, album.blob);
      if (mountedRef.current) closeAlbum();
    } catch { /* The slot error remains visible and the user can retry or cancel. */ }
  };

  const snap = draftsRef.current?.snapshot();

  const savedList = Object.values(saved);
  const filledCount = requiredFilledCount(savedList);
  const uploading =
    snap?.photos.some((p) => p?.status === "uploading") ?? false;
  // 완료 = 필수 3칸 + 대표 1장(photoSetComplete). 자유 칸은 비어 있어도 된다.
  const photosComplete =
    photoSetComplete(savedList) &&
    primarySlot !== null &&
    Boolean(saved[primarySlot]);
  // 2026-09-23 대표 "사진은 6장을 무조건 다 안 채워도 넘어가지게": 몇 장이든(0장도) 다음 화면으로 넘어갈 수 있다.
  // 다 채우지 않았다고 막지 않는다. 다만 올리는 중·저장 중·창이 열린 중에는 넘어가지 않는다(올리던 사진이 끊기지 않게).
  // 연결 자격(필수 3장 + 대표 1장)은 그대로다 — 넘어간 뒤에도 연결 화면과 프로필에서 "채울 사진"으로 보인다.
  const canProceed =
    userId !== null &&
    !uploading && !primaryBusy && !saveBusy && !album && !sourceChoice && !camera && restoreState === "ready";

  const openSourceChoice = (slot: number, mode: "capture" | "replace") => {
    if (primaryInFlightRef.current || saveInFlightRef.current || saveBusy) return;
    setActionError(null);
    setSourceChoice({ slot, mode });
  };

  // ─────────────────────────────────────────────────────────────
  // 미로그인 → DB 저장 불가. 로그인 필요 안내만 제공한다.
  // ─────────────────────────────────────────────────────────────
  if (!userId) {
    return (
      <div
        className="flex flex-col min-h-screen"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Camera size={32} color={colors.textFaint} />
          <p
            style={{
              fontFamily: serif,
              fontSize: 22,
              color: colors.text,
              marginTop: 16,
            }}
          >
            로그인이 필요해요
          </p>
          <p
            style={{
              color: colors.textMuted,
              fontSize: 14,
              lineHeight: 1.6,
              marginTop: 8,
              maxWidth: 320,
            }}
          >
            프로필 사진은 로그인한 계정에 안전하게 저장돼요.
            로그인 후 다시 시도해 주세요.
          </p>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-6 rounded-full px-6 py-3 whitespace-nowrap"
              style={{
                border: `1px solid ${colors.borderStrong}`,
                color: colors.text,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              뒤로 가기
            </button>
          )}
        </div>
      </div>
    );
  }

  if (restoreState === "loading") {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
        style={{ backgroundColor: colors.bg }}
      >
        <Loader2 size={20} color={colors.textMuted} className="animate-spin" />
        <p style={{ fontSize: 14, color: colors.textMuted, marginTop: 10 }}>
          사진을 불러오는 중…
        </p>
      </div>
    );
  }

  if (restoreState === "error") {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
        style={{ backgroundColor: colors.bg }}
      >
        <p style={{ fontSize: 20, fontWeight: 600, color: colors.text }}>
          사진을 불러오지 못했어요
        </p>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: colors.textMuted,
            marginTop: 8,
            maxWidth: 320,
          }}
        >
          {restoreError}
        </p>
        <button
          type="button"
          onClick={() => void loadSaved()}
          className="mt-6 rounded-full px-6 py-3 whitespace-nowrap"
          style={{
            backgroundColor: colors.text,
            color: colors.bg,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: colors.bg }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <p
            style={{
              color: colors.textFaint,
              fontSize: 11,
              letterSpacing: "0.2em",
              marginBottom: 10,
            }}
          >
            프로필 사진
          </p>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 26,
              lineHeight: 1.3,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            있는 그대로의 나를
            <br />
            세 장에 담아요
          </h1>

          <p style={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.65 }}>
            연결을 받으려면 전신·패션·취미 세 장이 필요해요. 지금 다 못 채워도 괜찮아요.
            최근 2개월 안에 찍은, 지금의 나를 담아주세요.
          </p>
          <p style={{ color: colors.textFaint, fontSize: 12, lineHeight: 1.7, marginTop: 12 }}>
            JPG · PNG · WebP, 한 장당 최대 20MB를 선택할 수 있어요.
            저장할 때는 5MB 이하 JPG로 준비해요. 사진 등록과 본인 인증은 별개예요.
          </p>
        </motion.div>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="앨범 사진 선택" className="hidden" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void prepareSelectedFile(file);
        }} />
        <div className="grid grid-cols-2 gap-3">
          {SLOTS.map((slot, index) => {
            const savedPhoto = saved[index];
            const draft = snap?.photos[index];
            const preview = savedPhoto?.url ?? draft?.previewUrl;
            const isPrimary = primarySlot === index;
            const busy = busySlot === index || draft?.status === "uploading";
            const mode = savedPhoto ? "replace" : "capture";
            return <div key={slot.label} className="flex flex-col gap-2">
              <div className="relative flex flex-col overflow-hidden rounded-2xl" style={{ background: "linear-gradient(140deg,#242832,#14171e)", border: `1px solid ${colors.borderStrong}` }}>
                <button type="button" disabled={saveBusy || primaryBusy} onClick={() => openSourceChoice(index, mode)} aria-label={`${slot.label} ${preview ? "바꾸기" : "추가하기"}`} className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden text-center disabled:cursor-wait">
                  {preview ? <img src={preview} alt={slot.label} className="absolute inset-0 h-full w-full object-cover" /> : <><ImagePlus size={25} color="#b7bfca" /><span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{slot.label}</span><span style={{ fontSize: 10, color: colors.textMuted }}>{slot.hint}</span></>}
                  {isPrimary && <span className="absolute left-2 top-2 rounded-full px-2 py-1" style={{ background: "#e5e8ed", color: "#171a20", fontSize: 10, fontWeight: 600 }}>대표</span>}
                  {savedPhoto && checks[index] && <span className="absolute right-2 top-2 rounded-full px-2 py-1" style={{ background: checks[index] === "pending" ? "#2a2f3a" : checks[index].verdict === "ok" ? "#1f3b2a" : checks[index].verdict === "rejected" ? "#4a1f1f" : "#3b331f", color: "#e5e8ed", fontSize: 10, fontWeight: 600 }}>{checks[index] === "pending" ? "AI 확인 중" : VERDICT_LABEL[checks[index].verdict]}</span>}
                  {busy && <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65" role="status"><Loader2 size={20} color="#fff" className="animate-spin" /><span style={{ color: "#fff", fontSize: 11 }}>사진 준비·저장 중</span></span>}
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1" style={{ borderTop: `1px solid ${colors.border}` }}>
                  {savedPhoto && <button type="button" disabled={saveBusy || primaryBusy} onClick={() => void choosePrimary(index)} aria-label={isPrimary ? `${slot.label}, 대표 사진` : `${slot.label}, 대표 사진으로 지정`} aria-pressed={isPrimary} className="flex h-11 w-10 items-center justify-center disabled:opacity-40"><Star size={16} fill={isPrimary ? "#dce2ea" : "none"} color={isPrimary ? "#dce2ea" : colors.textMuted} /></button>}
                  <button type="button" disabled={saveBusy || primaryBusy} onClick={() => openSourceChoice(index, mode)} className="min-h-11 flex-1 px-1 text-center disabled:opacity-40" style={{ fontSize: 12, color: "#d7dce5", fontWeight: 600 }}>{preview ? "사진 바꾸기" : "사진 추가하기"}</button>
                </div>
              </div>
              {slotErrors[index] && <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: 11, lineHeight: 1.65, wordBreak: "keep-all" }}>{slotErrors[index]}</p>}
              {checks[index] && checks[index] !== "pending" && checks[index].reasons.length > 0 && <p role="status" style={{ margin: 0, color: "#d9c8a0", fontSize: 11, lineHeight: 1.65, wordBreak: "keep-all" }}>{checks[index].reasons.join(" ")}</p>}
            </div>;
          })}
        </div>
        <p style={{ color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          필수 {filledCount} / {PHOTO_REQUIRED_COUNT} 완료 · 전체 {savedList.length} / {PHOTO_SLOT_COUNT}장
        </p>

        <div
          className="mt-4 rounded-2xl p-4 flex items-start gap-2.5"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Star size={14} color={colors.accent} className="mt-0.5 shrink-0" />
          <p style={{ color: colors.textFaint, fontSize: 12, lineHeight: 1.6 }}>
            별표는 대표 사진이에요. 다 채우지 않아도 다음으로 넘어갈 수 있어요. 연결을 받으려면 필수 세 장과 대표 사진 한 장이 있어야 해요. 나중에 프로필에서 채워도 돼요.
            AI가 사람·종류·화면 재촬영 여부를 확인해요. 본인 여부와 실제 촬영일은 AI가 확인하지 못해요.
          </p>
        </div>
      </div>

      <div
        className="px-6 py-6 flex flex-col gap-3"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        {actionError && (
          <p
            style={{
              color: colors.danger,
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
          >
            {actionError}
          </p>
        )}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={saveBusy || primaryBusy}
            className="w-full rounded-full px-6 py-2 whitespace-nowrap"
            style={{
              color: colors.textMuted,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            이전으로
          </button>
        )}

        <PrimaryButton onClick={onNext} disabled={!canProceed}>
          {photosComplete ? "프로필 확인하기" : "사진은 나중에 채우고 넘어가기"}
        </PrimaryButton>
      </div>

      {sourceChoice && <PhotoDialog title={SLOTS[sourceChoice.slot].label} onClose={() => setSourceChoice(null)}>
        <p style={{ color: "#bac2cf", fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>편한 방법으로 사진을 골라주세요.</p>
        <button type="button" className="w-full flex items-center justify-center gap-2 rounded-2xl min-h-14 px-4 py-4 mb-3" style={{ background: "linear-gradient(115deg,#f0f2f4,#bbc4d0)", color: "#141820", fontWeight: 600 }} onClick={() => { setCamera(sourceChoice); setSourceChoice(null); }}><Camera size={18} />지금 촬영</button>
        <button type="button" className="w-full flex items-center justify-center gap-2 rounded-2xl min-h-14 px-4 py-4" style={{ border: "1px solid #cbd5e34d", color: "#e5e9ef", fontWeight: 600 }} onClick={() => {
          albumTargetRef.current = sourceChoice;
          setSourceChoice(null);
          fileInputRef.current?.click();
        }}><ImagePlus size={18} />앨범에서 선택</button>
        <p style={{ color: "#aab3c1", fontSize: 11, lineHeight: 1.8, marginTop: 16 }}>최근 2개월 안에 찍은 본인 사진을 선택해 주세요.</p>
      </PhotoDialog>}
      {album && <PhotoDialog title="이 사진을 올릴까요?" busy={saveBusy} onClose={closeAlbum}>
        <img src={album.preview} alt={`${SLOTS[album.target.slot].label} 업로드 전 확인`} className="w-full rounded-xl object-contain" style={{ maxHeight: "35dvh", background: "#090b10" }} />
        {album.dateCheck.kind === "needs-confirmation" ? <>
          <p style={{ fontSize: 12, lineHeight: 1.8, color: "#c5ccd7", marginTop: 16 }}>촬영 시점을 확인할 수 없어요. 최근 2개월 안에 찍은 본인 사진만 올려주세요.</p>
          <label className="flex items-start gap-3 py-4" style={{ color: "#e4e8ef", fontSize: 13, lineHeight: 1.7 }}><input type="checkbox" checked={confirmedRecent} disabled={saveBusy} onChange={(event) => setConfirmedRecent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-slate-300" />최근 2개월 내 찍은 본인 사진입니다</label>
        </> : <p style={{ fontSize: 12, lineHeight: 1.8, color: "#c5ccd7", marginTop: 16 }}>최근 2개월 안의 날짜가 사진 정보에 기록되어 있어요.</p>}
        <p style={{ fontSize: 11, lineHeight: 1.8, color: "#aab3c1", marginTop: 8 }}>사진 정보는 바뀌거나 빠질 수 있어요. 실제 촬영일·본인 여부·AI 생성 여부를 확인한 것은 아니에요.</p>
        {slotErrors[album.target.slot] && <p role="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 1.7, marginTop: 12 }}>{slotErrors[album.target.slot]}</p>}
        <button type="button" disabled={saveBusy || (album.dateCheck.kind === "needs-confirmation" && !confirmedRecent)} onClick={() => void confirmAlbum()} className="w-full rounded-2xl min-h-14 px-4 py-4 mt-5 disabled:opacity-40" style={{ background: "linear-gradient(115deg,#f0f2f4,#bbc4d0)", color: "#141820", fontWeight: 600 }}>{saveBusy ? "사진 저장 중" : "이 사진 올리기"}</button>
      </PhotoDialog>}
      {camera && (
        <CameraSheet
          slotLabel={SLOTS[camera.slot].label}
          onClose={() => { if (!saveInFlightRef.current) setCamera(null); }}
          onConfirm={(blob) => savePhoto(camera, blob)}
        />
      )}
    </div>
  );
}
