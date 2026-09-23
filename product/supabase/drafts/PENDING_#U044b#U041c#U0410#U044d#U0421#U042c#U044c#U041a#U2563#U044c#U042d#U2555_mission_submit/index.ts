// ============================================================
// PENDING_대표승인 — 협동 미션 제출 Edge Function (배포 대기 초안)
// 파일: supabase/drafts/PENDING_대표승인_mission_submit/index.ts
// 상태: 초안. 대표 승인 전까지 Supabase Edge Function으로 배포 금지.
//
// 역할:
//  1) JWT로 사용자 인증 (기존 auth와 연결)
//  2) 커맨드의 SHA-256 digest 계산 (요청 중복 판별용)
//  3) 원자적 상태머신 RPC(submit_mission_command)에 위임
//     — 조회/저장을 여기서 나눠 호출하지 않는다. 동시성은 SQL의
//       SELECT ... FOR UPDATE 가 보장한다.
//  4) 서버 리뷰(apply_server_review)는 이 함수에서 사용자 입력으로
//     호출하지 않는다. approved 는 서버 검증 평가에서만 도출한다.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 실제 배포 시 승인 도메인으로 제한
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    // 1) 인증
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ code: 'UNAUTHENTICATED' }, 401, corsHeaders);
    }

    // 2) 입력 파싱
    const body = await req.json();
    const missionId = body?.missionId;
    const command = body?.command;
    if (typeof missionId !== 'string' || !missionId.trim() || missionId.length > 128) {
      return json({ code: 'INVALID_MISSION_ID' }, 400, corsHeaders);
    }
    if (!command || typeof command !== 'object') {
      return json({ code: 'INVALID_COMMAND' }, 400, corsHeaders);
    }

    // 3) digest 계산 (요청 중복 판별)
    const digest = await sha256(JSON.stringify(command));

    // 4) 원자적 RPC 위임
    const { data, error } = await supabase.rpc('submit_mission_command', {
      p_mission_id: missionId,
      p_user_id: user.id,
      p_request_id: command.requestId,
      p_request_digest: digest,
      p_expected_revision: command.expectedRevision,
      p_action: command.action,
      p_answer: command.action === 'submit' ? command.answer : null,
    });

    if (error) {
      return json({ code: error.message || 'MISSION_ERROR' }, 409, corsHeaders);
    }

    return json({ code: 'OK', data }, 200, corsHeaders);
  } catch (err) {
    return json({ code: 'INTERNAL_ERROR' }, 500, corsHeaders);
  }
});

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 클로드 인계 메모:
//  - apply_server_review(리뷰)는 이 함수가 아니라 별도 "검증 평가" 결과로
//    서버가 호출한다. 사용자가 보낸 approved/LLM 답변을 approved 에
//    직접 연결하지 않는다.
//  - 미션 생성·AI 미션 후보 생성·보상 지급은 이번 코드에 포함되지 않았다.
//    각각 별도 승인·별도 함수로 나눠 구현한다.
// ============================================================