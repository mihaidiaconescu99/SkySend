"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawerState = "collapsed" | "expanded";

type MobileMissionDrawerProps = {
  hasActiveAction: boolean;
  collapsedSummary: ReactNode;
  children: ReactNode;
};

export function MobileMissionDrawer({
  hasActiveAction,
  collapsedSummary,
  children,
}: MobileMissionDrawerProps) {
  const [drawerState, setDrawerState] = useState<DrawerState>(() =>
    hasActiveAction ? "expanded" : "collapsed",
  );
  const lastAutoExpandRef = useRef(hasActiveAction);
  const dragRef = useRef<{
    startY: number;
    lastY: number;
    didDrag: boolean;
  } | null>(null);

  useEffect(() => {
    if (hasActiveAction && !lastAutoExpandRef.current) {
      setDrawerState("expanded");
    }
    lastAutoExpandRef.current = hasActiveAction;
  }, [hasActiveAction]);

  const handleHandleClick = useCallback(() => {
    if (dragRef.current?.didDrag) {
      dragRef.current = null;
      return;
    }
    setDrawerState((value) => (value === "expanded" ? "collapsed" : "expanded"));
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        startY: event.clientY,
        lastY: event.clientY,
        didDrag: false,
      };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) return;
      const distance = event.clientY - dragRef.current.startY;
      dragRef.current = {
        ...dragRef.current,
        lastY: event.clientY,
        didDrag: Math.abs(distance) > 10,
      };
    },
    [],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = dragRef.current;
      if (!state) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const distance = state.lastY - state.startY;
      if (Math.abs(distance) > 28) {
        setDrawerState(distance < 0 ? "expanded" : "collapsed");
      }
    },
    [],
  );

  const isExpanded = drawerState === "expanded";

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[1.35rem] border border-border/80 bg-background/92 shadow-[var(--elevation-panel)] backdrop-blur-xl transition-[max-height] duration-300 ease-out",
        isExpanded
          ? "max-h-[60svh]"
          : "max-h-[calc(7.5rem_+_env(safe-area-inset-bottom))]",
      )}
      data-drawer-state={drawerState}
    >
      <button
        type="button"
        aria-label={isExpanded ? "Restrânge panoul" : "Extinde panoul"}
        aria-expanded={isExpanded}
        onClick={handleHandleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex shrink-0 touch-none flex-col items-center gap-1 px-4 pt-2 pb-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
      >
        <GripHorizontal className="size-5" aria-hidden="true" />
      </button>

      {!isExpanded ? (
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-1">
          {collapsedSummary}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {children}
        </div>
      )}
    </div>
  );
}
