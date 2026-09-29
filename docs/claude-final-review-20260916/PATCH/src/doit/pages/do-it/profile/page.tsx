import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import GradeBadge from "@/doit/components/feature/GradeBadge";
import Card from "@/doit/components/base/Card";
import SpaceCard from "@/doit/components/feature/SpaceCard";
import ConnectionCard from "@/doit/components/feature/ConnectionCard";
import DemoNotice from "@/doit/components/feature/DemoNotice";
import { myProfile, spaces, connections, purposes } from "@/doit/mocks/do-it";
import { useAuth } from "@/doit/hooks/useAuth";
import { loadProfile, type LoadedProfile } from "@/doit/lib/profileSave";

const purposeMap: Record<string, string> = {};
purposes.forEach((p) => { purposeMap[p.id] = p.label; });

type TabKey = "spaces" | "keys";

// 2026-09-16: 실제 저장한 프로필(닉네임·소개·목적·지역·생활 리듬)을 이 화면에 연결한다.
// 등급·공간·연결·미션 수치는 아직 서버 집계가 없어 데모로 남기고, 그 사실을 화면에 그대로 적는다.
type RealProfileState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "none" }
  | { status: "ok"; profile: LoadedProfile }
  | { status: "error"; message: string };

function formatJoined(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function Profile() {
  const [tab, setTab] = useState<TabKey>("spaces");
  const { user, loading: authLoading } = useAuth();
  const [real, setReal] = useState<RealProfileState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    if (!user) {
      setReal({ status: "signed_out" });
      return;
    }
    setReal({ status: "loading" });
    void loadProfile(user.id).then((result) => {
      if (!alive) return;
      if (result.status === "error") setReal({ status: "error", message: result.message });
      else if (!result.profile) setReal({ status: "none" });
      else setReal({ status: "ok", profile: result.profile });
    });
    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  const mySpaces = spaces.filter((s) => s.status !== "locked").slice(0, 4);
  const myConnections = connections;

  const profile = real.status === "ok" ? real.profile : null;
  const displayName = profile?.nickname?.trim() || (real.status === "ok" || real.status === "none" ? "닉네임을 아직 정하지 않았어요" : "");
  const intro = profile?.intro?.trim() || (real.status === "ok" || real.status === "none" ? "소개를 아직 적지 않았어요" : "");
  const facts = [profile?.purposeLabel, profile?.region, profile?.lifeRhythm].filter((v): v is string => !!v && !!v.trim());
  const joined = formatJoined(user?.created_at);

  return (
    <MobileLayout title="프로필" showNav activeTab="profile">
      <div className="animate-fade-up pt-4">
        <DemoNotice text="닉네임·소개·목적·지역은 내가 저장한 값이에요. 등급과 공간·연결·미션 수치는 아직 서버 집계가 없어 데모 미리보기로 표시돼요." />
        {/* Profile header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-user-3-line text-3xl" />
          </span>
          <h2 className="mt-3 font-heading text-xl font-semibold text-foreground-950">
            {real.status === "loading" && "불러오는 중…"}
            {real.status === "signed_out" && "로그인이 필요해요"}
            {real.status === "error" && "불러오기 실패"}
            {(real.status === "ok" || real.status === "none") && displayName}
          </h2>
          <div className="mt-1">
            <GradeBadge grade={myProfile.grade} />
          </div>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-foreground-500">
            {real.status === "error" ? real.message : real.status === "signed_out" ? "로그인하면 내가 저장한 프로필을 볼 수 있어요." : intro}
          </p>
          {facts.length > 0 && (
            <p className="mt-1 text-xs text-foreground-500">{facts.join(" · ")}</p>
          )}
          {joined && (
            <p className="mt-1 text-xs text-foreground-400">
              가입일 {joined}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-2">
          {[
            { label: "공간", value: myProfile.stats.spaces, icon: "ri-compass-3-line" },
            { label: "연결", value: myProfile.stats.connections, icon: "ri-hearts-line" },
            { label: "미션", value: myProfile.stats.missions, icon: "ri-check-double-line" },
          ].map((stat) => (
            <Card key={stat.label} padding="sm" className="text-center">
              <span className="flex h-7 w-7 mx-auto mb-1 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                <i className={`${stat.icon} text-sm`} />
              </span>
              <p className="font-heading text-lg font-semibold text-foreground-950">
                {stat.value}
              </p>
              <p className="text-[11px] text-foreground-500">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Grade */}
        <div className="mb-6">
          <Link
            to="/doit/grade"
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-background-200 bg-background-50 py-3 text-sm font-medium text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-medal-line" />
            등급 가이드
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-full bg-background-200 p-1">
          <button
            onClick={() => setTab("spaces")}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === "spaces"
                ? "bg-background-50 text-foreground-950"
                : "text-foreground-500"
            }`}
          >
            나의 공간 {mySpaces.length}
          </button>
          <button
            onClick={() => setTab("keys")}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === "keys"
                ? "bg-background-50 text-foreground-950"
                : "text-foreground-500"
            }`}
          >
            나의 연결 {myConnections.length}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex flex-col gap-3">
          {tab === "spaces" &&
            mySpaces.map((s) => (
              <SpaceCard key={s.id} {...s} purposeLabel={purposeMap[s.purposeId] || s.purposeId} />
            ))}

          {tab === "keys" && myConnections.map((c) => <ConnectionCard key={c.id} {...c} />)}
        </div>

        {tab === "spaces" && mySpaces.length === 0 && (
          <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background-200 text-foreground-500">
              <i className="ri-compass-3-line text-xl" />
            </span>
            <p className="text-sm text-foreground-500">참여 중인 공간이 없어요</p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}