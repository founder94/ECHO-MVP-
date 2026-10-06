/* eslint-disable react-refresh/only-export-components -- A 구조 원본 구조 유지(컴포넌트+훅 같은 파일). 동작 영향 없음 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface PurposeValue {
  purposeId: string;
  setPurposeId: (id: string) => void;
}

// 데모용 목적 상태. 온보딩에서 선택한 목적을 Home 등에서 공유한다.
// 실제 운영에서는 서버가 사용자 목적을 저장·관리한다.
const PurposeContext = createContext<PurposeValue | null>(null);

export function PurposeProvider({ children }: { children: ReactNode }) {
  const [purposeId, setPurposeId] = useState("create");

  const value = useMemo<PurposeValue>(
    () => ({ purposeId, setPurposeId }),
    [purposeId],
  );

  return (
    <PurposeContext.Provider value={value}>
      {children}
    </PurposeContext.Provider>
  );
}

export function usePurpose() {
  const ctx = useContext(PurposeContext);
  if (!ctx) {
    throw new Error("usePurpose must be used within PurposeProvider");
  }
  return ctx;
}