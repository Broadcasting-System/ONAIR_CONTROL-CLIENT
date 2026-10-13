"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** 창·알림을 화면 맨 위(body)에 그린다 — 본문 안 쌓임 순서(폰 하단 탭 등)에 갇히지 않게 */
export default function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}
