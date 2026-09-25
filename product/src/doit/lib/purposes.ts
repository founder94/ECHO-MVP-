// Purpose 정본 = 운영 DB public.purposes 의 is_active=true 행.
// 2026-09-20 대표 확정: 프론트에 Purpose 목록을 따로 두지 않는다.
// 조회 실패와 "목적 없음"을 구분한다. 실패했다고 하드코딩 목록으로 대체하지 않는다.
import { READ_TIMEOUT_MS, withTimeout } from "@/doit/lib/withTimeout";
import { getSupabase } from "@/doit/lib/supabase";

export interface ActivePurpose {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
}

export type PurposeListResult =
  | { status: "ok"; purposes: ActivePurpose[] }
  | { status: "error"; message: string };

async function fetchActivePurposesOnce(): Promise<PurposeListResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "error", message: "Supabase가 연결되지 않았습니다." };

  const { data, error } = await supabase
    .from("purposes")
    .select("id, label, description, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // 읽기 실패는 "목적 없음"과 다르다. 빈 목록으로 바꾸지 않는다.
  if (error) return { status: "error", message: error.message };

  const purposes = (data ?? []).map((row) => ({
    id: String(row.id),
    label: String(row.label),
    description: row.description == null ? null : String(row.description),
    sortOrder: Number(row.sort_order ?? 0),
  }));
  return { status: "ok", purposes };
}

// 저장된 목적이 현재 활성 목록에 없으면 재선택이 필요하다.
// 기존 값을 지우거나 다른 목적으로 자동 매핑하지 않는다.
export function needsReselection(savedId: string | null, purposes: ActivePurpose[]): boolean {
  if (!savedId) return false;
  return !purposes.some((p) => p.id === savedId);
}

// 목적 목록 읽기에 시간 상한을 둔다. 넘으면 "읽기 실패"(화면에 다시 시도 버튼)로 돌려준다.
export async function fetchActivePurposes(): Promise<PurposeListResult> {
  try {
    return await withTimeout(fetchActivePurposesOnce(), READ_TIMEOUT_MS, "fetchActivePurposes");
  } catch {
    return { status: "error", message: "응답이 늦어 목적 목록을 읽지 못했어요." };
  }
}
