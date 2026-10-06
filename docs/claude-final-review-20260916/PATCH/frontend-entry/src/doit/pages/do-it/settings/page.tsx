import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import Card from "@/doit/components/base/Card";
import Button from "@/doit/components/base/Button";
import { Modal } from "@/doit/components/base/Modal";
import { useAuth } from "@/doit/hooks/useAuth";

interface ToggleRowProps {
  icon: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ icon, label, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background-200 text-foreground-600">
          <i className={`${icon} text-sm`} />
        </span>
        <span className="text-sm text-foreground-800">{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? "bg-primary-500" : "bg-background-300"
        }`}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: value ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

interface LinkRowProps {
  icon: string;
  label: string;
  to?: string;
  danger?: boolean;
  onClick?: () => void;
}

function LinkRow({ icon, label, to, danger, onClick }: LinkRowProps) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) onClick();
    if (to) navigate(to);
  };

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-center justify-between py-3 text-left"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            danger
              ? "bg-primary-100 text-primary-600"
              : "bg-background-200 text-foreground-600"
          }`}
        >
          <i className={`${icon} text-sm`} />
        </span>
        <span
          className={`text-sm ${
            danger ? "text-primary-600" : "text-foreground-800"
          }`}
        >
          {label}
        </span>
      </div>
      <span className="flex h-5 w-5 items-center justify-center text-foreground-400">
        <i className="ri-arrow-right-s-line" />
      </span>
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [notifActivity, setNotifActivity] = useState(true);
  const [notifKey, setNotifKey] = useState(true);
  const [notifMission, setNotifMission] = useState(true);
  const [safeMode, setSafeMode] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "withdraw">(null);
  const [info, setInfo] = useState<null | "terms" | "privacy">(null);
  const [done, setDone] = useState<string | null>(null);

  const handleDangerConfirm = () => {
    setDone(
      confirm === "delete"
        ? "데이터 삭제 요청 접수 (데모)"
        : "탈퇴 요청 접수 (데모)",
    );
    setConfirm(null);
    setTimeout(() => setDone(null), 2500);
  };

  return (
    <MobileLayout title="설정" back>
      <div className="animate-fade-up pt-4">
        {/* Notifications */}
        <Card padding="md" className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-foreground-400">
            알림
          </h3>
          <ToggleRow
            icon="ri-notification-3-line"
            label="활동 알림"
            value={notifActivity}
            onChange={setNotifActivity}
          />
          <div className="h-px bg-background-200" />
          <ToggleRow
            icon="ri-key-2-line"
            label="KEY 알림"
            value={notifKey}
            onChange={setNotifKey}
          />
          <div className="h-px bg-background-200" />
          <ToggleRow
            icon="ri-flag-line"
            label="미션 리마인드"
            value={notifMission}
            onChange={setNotifMission}
          />
        </Card>

        {/* Safety */}
        <Card padding="md" className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-foreground-400">
            안전
          </h3>
          <ToggleRow
            icon="ri-shield-star-line"
            label="안전 모드"
            value={safeMode}
            onChange={setSafeMode}
          />
          <div className="h-px bg-background-200" />
          <LinkRow icon="ri-alarm-warning-line" label="안전하게 멈추기" to="/doit/home" />
        </Card>

        {/* 2026-09-20 대표 확정: 메인은 Plan A 하나다.
            예전 B(마음 날씨) 문과 여정 다시 고르기 링크를 설정에서 내렸다. 화면 파일은 지우지 않았다. */}

        {/* Account */}
        <Card padding="md" className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-foreground-400">
            계정
          </h3>
          <LinkRow icon="ri-user-3-line" label="프로필 수정" to="/doit/profile" />
          <div className="h-px bg-background-200" />
          <LinkRow
            icon="ri-logout-box-r-line"
            label="로그아웃"
            onClick={() => {
              void signOut().finally(() => navigate("/"));
            }}
          />
          <div className="h-px bg-background-200" />
          <LinkRow
            icon="ri-delete-bin-6-line"
            label="내 데이터 삭제"
            danger
            onClick={() => setConfirm("delete")}
          />
          <div className="h-px bg-background-200" />
          <LinkRow
            icon="ri-user-unfollow-line"
            label="회원 탈퇴"
            danger
            onClick={() => setConfirm("withdraw")}
          />
        </Card>

        {/* Info */}
        <Card padding="md" className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-foreground-400">
            정보
          </h3>
          <LinkRow icon="ri-file-list-3-line" label="이용약관" onClick={() => setInfo("terms")} />
          <div className="h-px bg-background-200" />
          <LinkRow
            icon="ri-shield-check-line"
            label="개인정보 처리방침"
            onClick={() => setInfo("privacy")}
          />
          <div className="h-px bg-background-200" />
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background-200 text-foreground-600">
                <i className="ri-information-line text-sm" />
              </span>
              <span className="text-sm text-foreground-800">버전</span>
            </div>
            <span className="text-xs text-foreground-400">1.0.0</span>
          </div>
        </Card>

        <p className="px-1 text-xs leading-relaxed text-foreground-400">
          데이터 삭제·회원 탈퇴는 데모 동작이에요. 실제 데이터 삭제와 계정 처리는 서버
          연동 시 적용돼요.
        </p>
      </div>

      {done && (
        <div className="fixed left-1/2 bottom-20 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-4 py-2 text-sm text-foreground-700">
          {done}
        </div>
      )}

      {/* Danger confirm */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "delete" ? "데이터를 삭제할까요?" : "정말 탈퇴할까요?"}
      >
        <p className="text-sm leading-relaxed text-foreground-600">
          {confirm === "delete"
            ? "프로필, 신호, 방 기록이 모두 지워져요. 되돌릴 수 없어요."
            : "계정과 모든 활동이 사라져요. 되돌릴 수 없어요."}
        </p>
        <p className="mt-2 text-xs text-foreground-400">
          이 동작은 데모예요. {confirm === "delete" ? "실제 데이터 삭제" : "실제 계정 처리"}는 서버 연동 시 적용돼요.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" full onClick={() => setConfirm(null)}>
            취소
          </Button>
          <Button full onClick={handleDangerConfirm}>
            {confirm === "delete" ? "삭제하기" : "탈퇴하기"}
          </Button>
        </div>
      </Modal>

      {/* Info modal */}
      <Modal
        open={!!info}
        onClose={() => setInfo(null)}
        title={info === "terms" ? "이용약관" : "개인정보 처리방침"}
      >
        <p className="text-sm leading-relaxed text-foreground-600">
          {info === "terms"
            ? "목적성 연결을 위한 서비스 이용약관이 들어갈 자리예요. (데모)"
            : "개인정보 수집·이용에 관한 안내가 들어갈 자리예요. (데모)"}
        </p>
        <Button full onClick={() => setInfo(null)} className="mt-4">
          닫기
        </Button>
      </Modal>
    </MobileLayout>
  );
}