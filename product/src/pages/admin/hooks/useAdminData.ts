import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Period } from '../meta';

// 숫자가 0인 상태와 서버에서 확인할 수 없는 상태를 섞지 않는다.
export type DataStatus =
  | 'loading'
  | 'success'
  | 'empty'
  | 'blocked'
  | 'missing'
  | 'unavailable'
  | 'error'
  | 'needs_check';

export interface AdminUserRow {
  id: string;
  emailMasked: string | null;
  nickname: string | null;
  createdAt: string | null;
}

export interface AdminOperationRow {
  id: string;
  label: string | null;
  status: string | null;
  createdAt: string | null;
}

export interface AdminPaymentRow {
  orderIdMasked: string | null;
  amount: number | null;
  status: string | null;
  approvedAt: string | null;
}

export interface AdminEchoStep {
  step: number;
  count: number;
}

export interface AdminFeatureItem {
  id: string;
  label: string;
  status:
    | 'ok'
    | 'empty'
    | 'error'
    | 'unavailable'
    | 'needs_check'
    | 'review_pending'
    | 'not_run';
  detail: string | null;
  evidenceAt: string | null;
}

export interface AdminPeriodInfo {
  key: Period;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
}

export interface AdminData {
  loading: boolean;
  errorMessage: string | null;
  lastFetchedAt: Date | null;
  period: AdminPeriodInfo;
  users: {
    status: DataStatus;
    total: number | null;
    periodNew: number | null;
    recent: AdminUserRow[];
  };
  echo: {
    status: DataStatus;
    started: number | null;
    step7Completed: number | null;
    whiteDoorReached: number | null;
    currentByStep: AdminEchoStep[];
  };
  payments: {
    status: DataStatus;
    periodPaid: number | null;
    lifetimePaid: number | null;
    recent: AdminPaymentRow[];
    paymentMode: 'review_pending' | 'enabled' | 'unavailable';
    purchaseAvailable: boolean | null;
  };
  doIt: {
    status: DataStatus;
    records: number | null;
    insights: number | null;
    handoffs: number | null;
    requestErrors: number | null;
    purposes: number | null;
    spaces: number | null;
    routeTelemetry: string | null;
  };
  operations: {
    status: DataStatus;
    reportsOpen: number | null;
    blocks: number | null;
    auditRecords: number | null;
    auditRecent: AdminOperationRow[];
    reportRecent: AdminOperationRow[];
    diagnosticsStatus: DataStatus;
  };
  features: {
    status: DataStatus;
    items: AdminFeatureItem[];
  };
}

type UnknownRecord = Record<string, unknown>;

interface FunctionErrorBody {
  code?: string;
  error?: string;
}

function emptyData(period: Period, status: DataStatus = 'loading'): AdminData {
  return {
    loading: status === 'loading',
    errorMessage: null,
    lastFetchedAt: null,
    period: { key: period, startAt: null, endAt: null, timezone: 'Asia/Seoul' },
    users: { status, total: null, periodNew: null, recent: [] },
    echo: {
      status,
      started: null,
      step7Completed: null,
      whiteDoorReached: null,
      currentByStep: [],
    },
    payments: {
      status,
      periodPaid: null,
      lifetimePaid: null,
      recent: [],
      paymentMode: 'unavailable',
      purchaseAvailable: null,
    },
    doIt: {
      status,
      records: null,
      insights: null,
      handoffs: null,
      requestErrors: null,
      purposes: null,
      spaces: null,
      routeTelemetry: null,
    },
    operations: {
      status,
      reportsOpen: null,
      blocks: null,
      auditRecords: null,
      auditRecent: [],
      reportRecent: [],
      diagnosticsStatus: status,
    },
    features: { status, items: [] },
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function nullableAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function sectionStatus(value: unknown, total: number | null): DataStatus {
  const status = typeof value === 'string' ? value.toLowerCase() : '';

  if (total !== null && total > 0 && (status === 'ok' || status === 'success' || status === 'empty')) {
    return 'success';
  }
  if (status === 'ok' || status === 'success' || status === 'available') {
    return total === 0 ? 'empty' : 'success';
  }
  if (status === 'empty' || status === 'zero' || status === 'no_data') return 'empty';
  if (status === 'blocked' || status === 'forbidden' || status === 'unauthorized') return 'blocked';
  if (status === 'missing') return 'missing';
  if (status === 'unavailable' || status === 'not_available' || status === 'not_collected') {
    return 'unavailable';
  }
  if (status === 'error' || status === 'failed') return 'error';
  return 'unavailable';
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

function parseCurrentByStep(value: unknown): AdminEchoStep[] {
  if (Array.isArray(value)) {
    return value.flatMap((raw): AdminEchoStep[] => {
      if (!isRecord(raw)) return [];
      const step = nullableCount(raw.step);
      const count = nullableCount(raw.count);
      if (step === null || step < 1 || step > 7 || count === null) return [];
      return [{ step, count }];
    }).sort((a, b) => a.step - b.step);
  }

  // 이전 키-값 형식이 잠시 남아 있어도 화면 전체가 깨지지 않게 한다.
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([rawStep, rawCount]): AdminEchoStep[] => {
    const step = Number(rawStep.replace(/[^0-9]/g, ''));
    const count = nullableCount(rawCount);
    return Number.isInteger(step) && step >= 1 && step <= 7 && count !== null
      ? [{ step, count }]
      : [];
  }).sort((a, b) => a.step - b.step);
}

function parseUsers(value: unknown): AdminData['users'] {
  const section = isRecord(value) ? value : {};
  const total = nullableCount(section.total);
  const periodNew = nullableCount(section.periodNew ?? section.period_new);
  const recent = Array.isArray(section.recent)
    ? section.recent.flatMap((raw, index): AdminUserRow[] => {
        if (!isRecord(raw)) return [];
        return [{
          id: nullableString(raw.id) ?? `user-${index}`,
          // 원본 이메일은 받거나 표시하지 않고, 서버가 마스킹한 값만 사용한다.
          emailMasked: nullableString(raw.emailMasked ?? raw.email_masked),
          nickname: nullableString(raw.nickname),
          createdAt: nullableString(raw.createdAt ?? raw.created_at),
        }];
      })
    : [];

  return {
    status: sectionStatus(section.status, total),
    total,
    periodNew,
    recent,
  };
}

function parseOperationRows(value: unknown, prefix: string): AdminOperationRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index): AdminOperationRow[] => {
    if (!isRecord(raw)) return [];
    return [{
      id: nullableString(raw.id ?? raw.auditId ?? raw.reportId ?? raw.audit_id ?? raw.report_id)
        ?? `${prefix}-${index}`,
      label: nullableString(raw.label ?? raw.action ?? raw.reason ?? raw.summary),
      status: nullableString(raw.status),
      createdAt: nullableString(raw.createdAt ?? raw.created_at),
    }];
  });
}

function parsePayments(value: unknown): AdminData['payments'] {
  const section = isRecord(value) ? value : {};
  const periodPaid = nullableCount(section.periodPaid ?? section.period_paid);
  const lifetimePaid = nullableCount(section.lifetimePaid ?? section.lifetime_paid);
  const recent = Array.isArray(section.recent)
    ? section.recent.flatMap((raw): AdminPaymentRow[] => {
        if (!isRecord(raw)) return [];
        return [{
          // 결제 번호도 서버가 안전하게 줄인 값만 표시한다.
          orderIdMasked: nullableString(raw.orderIdMasked ?? raw.order_id_masked),
          amount: nullableAmount(raw.amount),
          status: nullableString(raw.status),
          approvedAt: nullableString(raw.approvedAt ?? raw.approved_at),
        }];
      })
    : [];
  const rawMode = nullableString(section.paymentMode ?? section.payment_mode);
  const paymentMode = rawMode === 'review_pending' || rawMode === 'enabled'
    ? rawMode
    : 'unavailable';

  return {
    status: sectionStatus(section.status, lifetimePaid),
    periodPaid,
    lifetimePaid,
    recent,
    paymentMode,
    purchaseAvailable: typeof section.purchaseAvailable === 'boolean'
      ? section.purchaseAvailable
      : typeof section.purchase_available === 'boolean'
        ? section.purchase_available
        : null,
  };
}

function parseFeatureStatus(value: unknown): AdminFeatureItem['status'] {
  if (
    value === 'ok'
    || value === 'empty'
    || value === 'error'
    || value === 'needs_check'
    || value === 'review_pending'
    || value === 'not_run'
  ) return value;
  return 'unavailable';
}

function parseSnapshot(value: unknown, requestedPeriod: Period): AdminData | null {
  if (!isRecord(value) || value.ok !== true) return null;

  const users = parseUsers(value.users);
  const echoSection = isRecord(value.echo) ? value.echo : {};
  const started = nullableCount(echoSection.started);
  const step7Completed = nullableCount(echoSection.step7Completed ?? echoSection.step7_completed);
  const whiteDoorReached = nullableCount(echoSection.whiteDoorReached ?? echoSection.white_door_reached);
  const currentByStep = parseCurrentByStep(echoSection.currentByStep ?? echoSection.current_by_step);
  const echoTotal = sumKnown([
    started,
    step7Completed,
    whiteDoorReached,
    ...currentByStep.map((item) => item.count),
  ]);

  const doItSection = isRecord(value.doIt) ? value.doIt : isRecord(value.doit) ? value.doit : {};
  const records = nullableCount(doItSection.records);
  const insights = nullableCount(doItSection.insights);
  const handoffs = nullableCount(doItSection.handoffs);
  const requestErrors = nullableCount(doItSection.requestErrors ?? doItSection.request_errors);
  const purposes = nullableCount(doItSection.purposes);
  const spaces = nullableCount(doItSection.spaces);

  const operationsSection = isRecord(value.operations) ? value.operations : {};
  const reportsOpen = nullableCount(operationsSection.reportsOpen ?? operationsSection.reports_open);
  const blocks = nullableCount(operationsSection.blocks);
  const auditRecords = nullableCount(operationsSection.auditRecords ?? operationsSection.audit_records);
  const auditRecent = parseOperationRows(
    operationsSection.auditRecent ?? operationsSection.audit_recent,
    'audit',
  );
  const reportRecent = parseOperationRows(
    operationsSection.reportRecent ?? operationsSection.report_recent,
    'report',
  );
  const operationsTotal = sumKnown([reportsOpen, blocks, auditRecords]);

  const periodSection = isRecord(value.period) ? value.period : {};
  const periodKey = periodSection.key === 'today' || periodSection.key === '7d' || periodSection.key === '30d'
    ? periodSection.key
    : requestedPeriod;
  const timezone = nullableString(periodSection.timezone) ?? 'Asia/Seoul';

  const featureSource = Array.isArray(value.features) ? value.features : null;
  const featuresPresent = featureSource !== null;
  const featureItems = featureSource
    ? featureSource.flatMap((raw, index): AdminFeatureItem[] => {
        if (!isRecord(raw)) return [];
        return [{
          id: nullableString(raw.id) ?? `feature-${index}`,
          label: nullableString(raw.label) ?? '이름 없는 기능',
          status: parseFeatureStatus(raw.status),
          detail: nullableString(raw.detail),
          evidenceAt: nullableString(raw.evidenceAt ?? raw.evidence_at),
        }];
      })
    : [];

  const asOf = nullableString(value.asOf ?? value.as_of);
  const asOfDate = asOf ? new Date(asOf) : new Date();

  return {
    loading: false,
    errorMessage: null,
    lastFetchedAt: Number.isNaN(asOfDate.getTime()) ? new Date() : asOfDate,
    period: {
      key: periodKey,
      startAt: nullableString(periodSection.startAt ?? periodSection.start_at),
      endAt: nullableString(periodSection.endAt ?? periodSection.end_at),
      timezone,
    },
    users,
    echo: {
      status: sectionStatus(echoSection.status, echoTotal),
      started,
      step7Completed,
      whiteDoorReached,
      currentByStep,
    },
    payments: parsePayments(value.payments),
    doIt: {
      status: sectionStatus(
        doItSection.status,
        sumKnown([records, insights, handoffs, requestErrors, purposes, spaces]),
      ),
      records,
      insights,
      handoffs,
      requestErrors,
      purposes,
      spaces,
      routeTelemetry: nullableString(doItSection.routeTelemetry ?? doItSection.route_telemetry),
    },
    operations: {
      status: sectionStatus(operationsSection.status, operationsTotal),
      reportsOpen,
      blocks,
      auditRecords,
      auditRecent,
      reportRecent,
      diagnosticsStatus: sectionStatus(
        operationsSection.diagnosticsStatus ?? operationsSection.diagnostics_status,
        null,
      ),
    },
    features: {
      status: featuresPresent ? (featureItems.length ? 'success' : 'empty') : 'unavailable',
      items: featureItems,
    },
  };
}

async function readFunctionError(error: unknown): Promise<FunctionErrorBody> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      return (await context.clone().json()) as FunctionErrorBody;
    } catch {
      if (context.status === 401) return { code: 'UNAUTHORIZED' };
      if (context.status === 403) return { code: 'FORBIDDEN' };
    }
  }
  return { error: (error as { message?: string })?.message };
}

function failedData(period: Period, status: DataStatus, message: string): AdminData {
  const next = emptyData(period, status);
  next.loading = false;
  next.errorMessage = message;
  return next;
}

function statusForCode(code: unknown): DataStatus {
  return code === 'UNAUTHORIZED' || code === 'FORBIDDEN' ? 'blocked' : 'error';
}

// 관리자 화면은 테이블을 직접 읽지 않고, 민감정보를 줄인 서버 스냅샷만 사용한다.
export function useAdminData(period: Period) {
  const [data, setData] = useState<AdminData>(() => emptyData(period));
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestVersion.current;
    setData((previous) => ({
      ...emptyData(period),
      lastFetchedAt: previous.lastFetchedAt,
    }));

    try {
      const { data: response, error } = await supabase.functions.invoke('admin-dashboard', {
        body: { action: 'snapshot', period },
      });

      if (requestId !== requestVersion.current) return;

      if (error) {
        const body = await readFunctionError(error);
        if (requestId !== requestVersion.current) return;
        setData(failedData(
          period,
          statusForCode(body.code),
          body.code === 'UNAUTHORIZED'
            ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
            : body.code === 'FORBIDDEN'
              ? '관리자 권한이 없습니다.'
              : '운영 자료를 불러오지 못했습니다.',
        ));
        return;
      }

      if (!isRecord(response) || response.ok !== true) {
        const code = isRecord(response) ? response.code : undefined;
        setData(failedData(period, statusForCode(code), '운영 자료를 불러오지 못했습니다.'));
        return;
      }

      const snapshot = parseSnapshot(response, period);
      setData(snapshot ?? failedData(period, 'error', '운영 자료 형식을 확인할 수 없습니다.'));
    } catch {
      if (requestId === requestVersion.current) {
        setData(failedData(period, 'error', '운영 자료를 불러오지 못했습니다.'));
      }
    }
  }, [period]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  return { data, refresh: load };
}
