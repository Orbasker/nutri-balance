"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type AiResearchPhase = "idle" | "searching" | "done" | "error";

export interface AiResearchState {
  phase: AiResearchPhase;
  label: string;
  detail?: string;
  result?: string;
  error?: string;
}

const INITIAL_STATE: AiResearchState = { phase: "idle", label: "" };

const DONE_LINGER_MS = 8_000;
const NOTIFICATION_LINGER_MS = 4_000;
const CLOSE_LINGER_MS = 3_000;

/**
 * Floating pill that tracks AI research progress.
 * Sits above the mobile bottom-nav (bottom-24) and opens a modal on click.
 */
export function AiResearchTracker({ state }: { state: AiResearchState }) {
  const [open, setOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [visible, setVisible] = useState(false);
  const prevPhaseRef = useRef<AiResearchPhase>("idle");
  const openRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearNotificationTimer = useCallback(() => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(
    (delay: number) => {
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, delay);
    },
    [clearHideTimer],
  );

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Show tracker when searching starts, auto-hide after done/error lingers.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;

    clearHideTimer();
    clearNotificationTimer();

    if (state.phase === "searching") {
      setVisible(true);
      setShowNotification(false);
    } else if (state.phase === "done" || state.phase === "error") {
      setVisible(true);
      if (prev === "searching" && !openRef.current) {
        setShowNotification(true);
        notificationTimerRef.current = setTimeout(() => {
          setShowNotification(false);
        }, NOTIFICATION_LINGER_MS);
        scheduleHide(DONE_LINGER_MS);
      }
    } else {
      setVisible(false);
      setOpen(false);
      setShowNotification(false);
    }
  }, [clearHideTimer, clearNotificationTimer, scheduleHide, state.phase]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(
    () => () => {
      clearHideTimer();
      clearNotificationTimer();
    },
    [clearHideTimer, clearNotificationTimer],
  );

  // When modal closes after done, start fade timer
  const handleClose = useCallback(() => {
    setOpen(false);
    if (state.phase === "done" || state.phase === "error") {
      scheduleHide(CLOSE_LINGER_MS);
    }
  }, [scheduleHide, state.phase]);

  if (!visible) return null;

  return (
    <>
      {/* Notification toast — slides in from bottom when research completes */}
      {showNotification && (
        <div className="fixed bottom-28 md:bottom-8 right-4 md:right-6 z-[60] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <button
            onClick={() => {
              clearHideTimer();
              clearNotificationTimer();
              setShowNotification(false);
              setOpen(true);
            }}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border backdrop-blur-sm transition-all hover:scale-[1.02] active:scale-[0.98]",
              state.phase === "done"
                ? "bg-emerald-50/90 border-emerald-200/60 text-emerald-800"
                : "bg-red-50/90 border-red-200/60 text-red-800",
            )}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {state.phase === "done" ? "check_circle" : "error"}
            </span>
            <span className="text-sm font-semibold max-w-[240px] truncate">
              {state.phase === "done" ? (state.result ?? "Research complete") : "Research failed"}
            </span>
            <span className="material-symbols-outlined text-[16px] opacity-50">open_in_new</span>
          </button>
        </div>
      )}

      {/* Floating pill button */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            clearHideTimer();
            setShowNotification(false);
          }}
          className={cn(
            "fixed bottom-28 md:bottom-8 right-4 md:right-6 z-50",
            "flex items-center gap-2.5 rounded-full px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.15)]",
            "border backdrop-blur-sm transition-all duration-300",
            "hover:scale-105 active:scale-95",
            "animate-in slide-in-from-bottom-4 fade-in duration-300",
            state.phase === "searching" && "bg-white/90 border-blue-200/60 text-blue-800",
            state.phase === "done" && "bg-emerald-50/90 border-emerald-200/60 text-emerald-800",
            state.phase === "error" && "bg-red-50/90 border-red-200/60 text-red-800",
          )}
        >
          {state.phase === "searching" && (
            <>
              <span className="relative flex h-6 w-6">
                <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
                <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600">
                  <span className="material-symbols-outlined text-white text-[16px]">
                    neurology
                  </span>
                </span>
              </span>
              <span className="text-sm font-semibold max-w-[140px] truncate hidden sm:inline">
                Researching...
              </span>
            </>
          )}
          {state.phase === "done" && (
            <>
              <span
                className="material-symbols-outlined text-emerald-600 text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span className="text-sm font-semibold hidden sm:inline">Done</span>
            </>
          )}
          {state.phase === "error" && (
            <>
              <span
                className="material-symbols-outlined text-red-500 text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              <span className="text-sm font-semibold hidden sm:inline">Failed</span>
            </>
          )}
        </button>
      )}

      {/* Expanded modal panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="fixed bottom-28 md:bottom-8 right-4 md:right-6 z-50 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-200/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      state.phase === "searching" &&
                        "bg-gradient-to-br from-blue-600 to-indigo-600",
                      state.phase === "done" && "bg-emerald-500",
                      state.phase === "error" && "bg-red-500",
                    )}
                  >
                    <span
                      className={cn(
                        "material-symbols-outlined text-white text-[18px]",
                        state.phase === "searching" && "animate-pulse",
                      )}
                    >
                      {state.phase === "searching" && "neurology"}
                      {state.phase === "done" && "check"}
                      {state.phase === "error" && "close"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {state.phase === "searching" && "AI Researching"}
                      {state.phase === "done" && "Research Complete"}
                      {state.phase === "error" && "Research Failed"}
                    </p>
                    <p className="text-xs text-slate-500">{state.label}</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                {/* Progress animation for searching */}
                {state.phase === "searching" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin shrink-0" />
                      <p className="text-sm text-slate-700">
                        {state.detail ?? "Looking up substance data..."}
                      </p>
                    </div>
                    {/* Fun progress bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full animate-progress-indeterminate" />
                    </div>
                    <p className="text-xs text-slate-400">
                      You can keep browsing — we&apos;ll notify you when it&apos;s ready
                    </p>
                  </div>
                )}

                {/* Result for done */}
                {state.phase === "done" && state.result && (
                  <div className="flex items-start gap-3 bg-emerald-50 rounded-xl px-4 py-3">
                    <span
                      className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <p className="text-sm text-emerald-800 leading-relaxed">{state.result}</p>
                  </div>
                )}

                {/* Error message */}
                {state.phase === "error" && state.error && (
                  <div className="flex items-start gap-3 bg-red-50 rounded-xl px-4 py-3">
                    <span
                      className="material-symbols-outlined text-red-500 text-[20px] mt-0.5"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      error
                    </span>
                    <p className="text-sm text-red-700 leading-relaxed">{state.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export { INITIAL_STATE as AI_RESEARCH_INITIAL_STATE };
