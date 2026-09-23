/* eslint-disable react-refresh/only-export-components -- A 구조 원본 구조 유지(컴포넌트+훅 같은 파일). 동작 영향 없음 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  keyWallet as seedWallet,
  keyHistory as seedHistory,
} from "@/doit/mocks/do-it";

export interface KeyHistoryItem {
  id: string;
  type: "earn" | "spend" | "charge";
  title: string;
  amount: number;
  bucket: "Reward" | "Revenue";
  time: string;
}

export interface DeductResult {
  success: boolean;
  reason?: "insufficient" | "duplicate";
  remaining: number;
  deductedReward: number;
  deductedRevenue: number;
}

interface KeyWalletValue {
  // DEMO ONLY. 서버 원장(key_balances) 연결 전까지 이 wallet은 전부 인메모리 예시 값이다.
  // isDemo가 true인 동안 어떤 잔액·차감도 공식 경제 상태로 취급하면 안 된다.
  isDemo: boolean;
  revenueKey: number;
  rewardKey: number;
  total: number;
  history: KeyHistoryItem[];
  deductKeys: (requestId: string, amount: number, title: string) => DeductResult;
}

const KeyWalletContext = createContext<KeyWalletValue | null>(null);

export function KeyWalletProvider({ children }: { children: ReactNode }) {
  const [revenueKey, setRevenueKey] = useState(seedWallet.revenueKey);
  const [rewardKey, setRewardKey] = useState(seedWallet.rewardKey);
  const [history, setHistory] = useState<KeyHistoryItem[]>(seedHistory as KeyHistoryItem[]);
  const processedRef = useRef<Set<string>>(new Set());

  // Reward KEY 우선 차감 → 부족분만 Revenue KEY 차감.
  // requestId 기준으로 한 번만 처리해 중복 차감을 막는다.
  const deductKeys = useCallback(
    (requestId: string, amount: number, title: string): DeductResult => {
      if (processedRef.current.has(requestId)) {
        return {
          success: false,
          reason: "duplicate",
          remaining: revenueKey + rewardKey,
          deductedReward: 0,
          deductedRevenue: 0,
        };
      }

      const totalNow = revenueKey + rewardKey;
      if (totalNow < amount) {
        return {
          success: false,
          reason: "insufficient",
          remaining: totalNow,
          deductedReward: 0,
          deductedRevenue: 0,
        };
      }

      const fromReward = Math.min(rewardKey, amount);
      const fromRevenue = amount - fromReward;

      processedRef.current.add(requestId);
      setRewardKey((r) => r - fromReward);
      setRevenueKey((r) => r - fromRevenue);
      setHistory((prev) => [
        {
          id: `h-${Date.now()}`,
          type: "spend",
          title,
          amount,
          bucket: fromReward > 0 ? "Reward" : "Revenue",
          time: "방금 전",
        },
        ...prev,
      ]);

      return {
        success: true,
        remaining: totalNow - amount,
        deductedReward: fromReward,
        deductedRevenue: fromRevenue,
      };
    },
    [revenueKey, rewardKey],
  );

  const value = useMemo<KeyWalletValue>(
    () => ({
      isDemo: true,
      revenueKey,
      rewardKey,
      total: revenueKey + rewardKey,
      history,
      deductKeys,
    }),
    [revenueKey, rewardKey, history, deductKeys],
  );

  return (
    <KeyWalletContext.Provider value={value}>
      {children}
    </KeyWalletContext.Provider>
  );
}

export function useKeyWallet() {
  const ctx = useContext(KeyWalletContext);
  if (!ctx) {
    throw new Error("useKeyWallet must be used within KeyWalletProvider");
  }
  return ctx;
}