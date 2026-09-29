// Plan A 분석 수집기 (A단계 — 비활성화 상태로 설치)
//
// 동작 조건: VITE_PA_ANALYTICS_ENABLED === "true" AND enabled === true
//   둘 다 참일 때만 실제 수집. 현재 enabled=false 로 설치하므로
//   ID 생성/저장소 접근/이벤트/모든 분석 RPC 호출이 0이 된다.
//
// 개인정보 수집 금지:
//   - raw auth.uid 저장 금지 (is_authenticated boolean 만)
//   - 이메일/이름/전화/자유입력/대화/사주·타로·목적 원문/프로필/사진/
//     리포트/주문번호/결제키/공간·방 UUID/검색어/토큰 수집 금지
//   - UTM: 소문자 허용문자 [a-z0-9_.-] 만, 길이 제한
//   - 경로: 쿼리·fragment 제거, UUID/긴 식별자 :id 정규화

import type { SupabaseClient } from "@supabase/supabase-js";

// 허용 클릭 키 (allowlist) — 이 외의 키는 무시
export const ALLOWED_CLICK_KEYS: ReadonlySet<string> = new Set([
  "signup_start",
  "verification_start",
  "photo_start",
  "purpose_screen_enter",
  "space_enter",
  "room_enter",
  "door_enter",
  "key_purchase_start",
]);

// 실제 라우트 → 퍼널 단계 매핑표 (작성만, 이번 턴 부착 금지)
export const ROUTE_STAGE_MAP: Record<string, string> = {
  "/": "free_start",
  "/doit/fortune": "select_mode",
  "/doit/sign-up": "signup_consent",
  "/doit/purpose": "purpose",
  "/doit/verify": "signup_consent",
  "/doit/photo": "profile",
  "/doit/profile": "profile",
  "/doit/spaces": "auto_search",
  "/doit/room": "core_door",
};

// 관리자 경로 판별 (/admin 또는 /admin/...)
function isAdminPath(pathname: string): boolean {
  return pathname === "/doit/admin" || pathname.startsWith("/doit/admin/");
}

// 경로 정규화: 쿼리·fragment 제거, UUID/긴 식별자 → :id
function normalizePath(rawPath: string): string {
  const path = rawPath.split("?")[0].split("#")[0];
  return path
    .split("/")
    .map((seg) => {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          seg,
        )
      ) {
        return ":id";
      }
      if (/^\d{6,}$/.test(seg)) return ":id";
      return seg;
    })
    .join("/");
}

// UTM 정규화: 소문자, [a-z0-9_.-] 만, 길이 제한(128)
function sanitizeUtm(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 128);
}

type EventShape =
  | { kind: "click"; key: string }
  | { kind: "stage_enter"; stage: string }
  | { kind: "session_start" }
  | { kind: "page_view"; path: string }
  | { kind: "heartbeat" };

interface CollectorConfig {
  supabase: SupabaseClient;
  enabled: boolean;
}

const QUEUE_MAX = 200;
const BATCH_SIZE = 20;

export class AnalyticsCollector {
  private supabase: SupabaseClient;
  private enabled: boolean;
  private queue: EventShape[] = [];
  private visitorId: string | null = null;
  private sessionId: string | null = null;
  private storageProbed = false;
  private flushing = false;
  private disposed = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: CollectorConfig) {
    this.supabase = config.supabase;
    this.enabled =
      config.enabled &&
      import.meta.env.VITE_PA_ANALYTICS_ENABLED === "true";
  }

  // 실제 동작 여부 (관리자 경로 제외 포함)
  private active(pathname: string): boolean {
    return this.enabled && !isAdminPath(pathname);
  }

  // 저장소 probe: 종류별 1회 캐시, 실패 시 메모리 ID
  private ensureIds(): void {
    if (!this.storageProbed) {
      this.storageProbed = true;
      try {
        this.visitorId = localStorage.getItem("pa_vid");
        this.sessionId = sessionStorage.getItem("pa_sid");
      } catch {
        this.visitorId = null;
        this.sessionId = null;
      }
    }
    if (!this.visitorId) {
      this.visitorId = crypto.randomUUID();
      try {
        localStorage.setItem("pa_vid", this.visitorId);
      } catch {
        /* 메모리 ID 유지 */
      }
    }
    if (!this.sessionId) {
      this.sessionId = crypto.randomUUID();
      try {
        sessionStorage.setItem("pa_sid", this.sessionId);
      } catch {
        /* 메모리 ID 유지 */
      }
    }
  }

  private enqueue(ev: EventShape): void {
    if (this.queue.length >= QUEUE_MAX) return;
    this.queue.push(ev);
    if (this.queue.length >= BATCH_SIZE) void this.flush();
  }

  // 실패 시 1회 재시도 후 폐기
  private async flush(): Promise<void> {
    if (this.flushing || this.disposed) return;
    if (this.queue.length === 0) return;

    // 관리자 이동 시 큐 폐기
    if (isAdminPath(window.location.pathname)) {
      this.queue = [];
      return;
    }

    this.flushing = true;
    const batch = this.queue.splice(0, BATCH_SIZE);

    const send = async (): Promise<boolean> => {
      const { error } = await this.supabase.functions.invoke(
        "pa_analytics_ingest",
        { body: { events: batch } },
      );
      return !error;
    };

    const ok = await send();
    if (!ok) {
      await send(); // 1회 재시도
    }
    this.flushing = false;
  }

  // 클릭 이벤트 (허용 키만)
  trackClick(key: string): void {
    if (!this.active(window.location.pathname)) return;
    if (!ALLOWED_CLICK_KEYS.has(key)) return;
    this.ensureIds();
    this.enqueue({ kind: "click", key });
  }

  // 단계 진입 (라우트 매핑표 기준 — 이번 턴 부착 금지)
  trackStage(stage: string): void {
    if (!this.active(window.location.pathname)) return;
    this.ensureIds();
    this.enqueue({ kind: "stage_enter", stage });
  }

  // 페이지 뷰
  trackPageView(): void {
    if (!this.active(window.location.pathname)) return;
    this.ensureIds();
    this.enqueue({
      kind: "page_view",
      path: normalizePath(window.location.pathname),
    });
  }

  // 하트비트 시작 (정리 필수)
  startHeartbeat(intervalMs = 60000): void {
    if (!this.enabled) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.active(window.location.pathname)) {
        this.enqueue({ kind: "heartbeat" });
      }
    }, intervalMs);
  }

  // 중단: 남은 큐 강제 전송 금지, 타이머/리스너 정리
  stop(): void {
    this.disposed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    // 남은 큐는 전송하지 않고 폐기
    this.queue = [];
  }
}