import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { hasSeenIntro } from '@/pages/do-it/intro/introSeen';

interface Props { landing: ReactElement }

// 메인 진입(/): 이 세션에서 온보딩을 아직 안 봤으면 심볼 온보딩으로, 봤으면 바로 랜딩.
// 랜딩은 첫 화면 번들에 그대로 남는다(지연 불러오기로 바꾸지 않는다).
export default function DoItEntry({ landing }: Props) {
  if (!hasSeenIntro()) return <Navigate to="/do-it/intro" replace />;
  return landing;
}
