import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import MobileLayout from './MobileLayout';

interface Props {
  title: string;
  tab?: string;
  eyebrow: string;
  heading: ReactNode;
  description: string;
  notice: string;
  action?: { label: string; to: string };
  back?: boolean;
}

/** 아직 서버에 연결되지 않은 기능을 빈 조회 결과나 실제 활동처럼 표시하지 않는다. */
export default function PreparationPage({ title, tab, eyebrow, heading, description, notice, action = { label: '내 프로필 확인하기', to: '/doit/profile' }, back }: Props) {
  return <MobileLayout title={title} showNav activeTab={tab} back={back}>
    <section className="doit-product-story">
      <p className="doit-product-kicker">{eyebrow}</p>
      <h2 className="doit-product-title">{heading}</h2>
      <p className="doit-product-description">{description}</p>
      <div className="doit-product-stage" aria-hidden="true"><DoItSymbol decorative /><span>DO IT · JUST TRY</span></div>
      <div className="doit-product-note"><span className="doit-product-status">서비스 준비 중</span><p>{notice}</p></div>
      <Link className="doit-product-action" to={action.to}>{action.label}<span aria-hidden="true">↗</span></Link>
    </section>
  </MobileLayout>;
}
