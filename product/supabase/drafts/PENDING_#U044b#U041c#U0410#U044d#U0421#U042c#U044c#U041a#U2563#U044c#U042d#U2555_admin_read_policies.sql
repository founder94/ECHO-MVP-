-- STOP: 대표 승인 전 실행 금지
-- =============================================================================
-- ECHO · DO IT 관리자 읽기 전용 정책 초안 (2026-09-06)
-- 목적: 관리자(profiles.role = 'admin')가 ECHO 사용자 흐름 데이터를 읽을 수 있게 한다.
--       현재 RLS에는 conversations / understanding_results / payments / reports 의
--       SELECT 정책에 is_admin() 조건이 없어, 관리자도 본인 데이터만 읽을 수 있다.
--
-- 근거(실제 스키마 확인):
--   - public.is_admin() 는 "profiles.id = auth.uid() AND profiles.role = 'admin'" 로 정의됨 (SECURITY DEFINER)
--   - 기존 사용자 정책은 유지되며, 아래 정책은 "추가"만 한다.
--
-- 영향:
--   - 각 테이블에 관리자용 SELECT 정책 1개씩 추가됨.
--   - 일반 사용자의 접근은 기존 정책 그대로(자기 것만)라 영향 없음.
--   - 개인정보 노출 범위가 넓어지므로, 관리자 화면은 이메일 마스킹·최소 컬럼 조회를 유지해야 함.
--
-- 되돌리기(롤백):
--   아래 "DROP POLICY" 문장을 실행하면 원상 복구된다.
-- =============================================================================

-- 1) conversations: ECHO STEP 흐름(현재 단계·상태)
CREATE POLICY "conversations_select_admin" ON public.conversations
  FOR SELECT USING (public.is_admin());

-- 2) understanding_results: 이해 확인 단계
CREATE POLICY "understanding_results_select_admin" ON public.understanding_results
  FOR SELECT USING (public.is_admin());

-- 3) payments: 결제(4,900원) 완료 건
CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT USING (public.is_admin());

-- 4) reports: 리포트
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT USING (public.is_admin());

-- =============================================================================
-- 되돌리기(대표 승인 후 불필요해지면 실행)
-- =============================================================================
-- DROP POLICY "conversations_select_admin" ON public.conversations;
-- DROP POLICY "understanding_results_select_admin" ON public.understanding_results;
-- DROP POLICY "payments_select_admin" ON public.payments;
-- DROP POLICY "reports_select_admin" ON public.reports;