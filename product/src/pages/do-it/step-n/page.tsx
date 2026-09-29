import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import JourneyStepScreen from '@/pages/do-it/components/JourneyStepScreen';
import { journeyStatusForStep } from '@/lib/echo/api';

// /step/:n (n = 3~7). /step/2 는 기존 고정 경로가 먼저 잡는다. 범위 밖 숫자는 404 로 보낸다.
export default function StepNPage() {
  const { n } = useParams();
  const [searchParams] = useSearchParams();
  const status = journeyStatusForStep(Number(n));
  if (!status) return <Navigate to="/404" replace />;
  return <JourneyStepScreen key={`${status}:${searchParams.get('c') ?? ''}`} expectedStatus={status} />;
}