"use client";

import { Component, type ReactNode } from "react";

import { SceneStill } from "./scene-still";

/**
 * 2026-10-10 출시 차단 P1(Codex G1): 3D 장면에서 난 오류(WebGL 생성 실패 · 장면 청크 내려받기·실행 실패)를
 * 장면 칸 안에서만 막고 기존 정지 이미지(SceneStill)로 바꾼다. 홈페이지 글·메뉴·시작 버튼은 그대로.
 * 앱 전역 ErrorBoundary 는 그대로 둔다(다른 오류는 예전처럼 잡는다). 이 파일은 장면 청크 밖(첫 번들)에 있어야
 * 장면 청크 자체가 실패해도 잡는다(Codex P1 4236660589).
 */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <SceneStill /> : this.props.children;
  }
}
