import type { ButtonHTMLAttributes } from 'react';
import './glass-button.css';

// ECHO 공통 유리 버튼(2026-09-28 대표 「BUTTON SYSTEM FINAL LOCK」). 새 버튼은 이것만 쓴다 — 화면마다 색을 박지 않는다.
// primary = 주요(진한 흰 막) · secondary = 보조(투명 + 테두리) · choice = 고르는 칸(고르면 진한 막) · text = 글 버튼.
export type GlassVariant = 'primary' | 'secondary' | 'choice' | 'text';

export default function GlassButton({ variant = 'secondary', selected, className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: GlassVariant; selected?: boolean }) {
  return <button type={type} {...rest} {...(variant === 'choice' ? { 'aria-pressed': !!selected } : {})} className={`echo-glass-btn echo-glass-btn--${variant}${className ? ` ${className}` : ''}`} />;
}
