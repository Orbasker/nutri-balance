"use client";

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AI_RESEARCH_INITIAL_STATE,
  type AiResearchState,
  AiResearchTracker,
} from "./ai-research-tracker";

const STORAGE_KEY = "nutri-balance-ai-research-tracker";

type AiResearchTrackerContextValue = {
  researchTracker: AiResearchState;
  setResearchTracker: Dispatch<SetStateAction<AiResearchState>>;
  resetResearchTracker: () => void;
};

const AiResearchTrackerContext = createContext<AiResearchTrackerContextValue | null>(null);

function isAiResearchState(value: unknown): value is AiResearchState {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<AiResearchState>;

  return (
    (candidate.phase === "idle" ||
      candidate.phase === "searching" ||
      candidate.phase === "done" ||
      candidate.phase === "error") &&
    typeof candidate.label === "string"
  );
}

export function AiResearchTrackerProvider({ children }: { children: ReactNode }) {
  const [researchTracker, setResearchTracker] = useState<AiResearchState>(() => {
    if (typeof window === "undefined") {
      return AI_RESEARCH_INITIAL_STATE;
    }

    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return AI_RESEARCH_INITIAL_STATE;
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      return isAiResearchState(parsed) ? parsed : AI_RESEARCH_INITIAL_STATE;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return AI_RESEARCH_INITIAL_STATE;
    }
  });

  useEffect(() => {
    if (researchTracker.phase === "idle") {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(researchTracker));
  }, [researchTracker]);

  const resetResearchTracker = useCallback(() => {
    setResearchTracker(AI_RESEARCH_INITIAL_STATE);
  }, []);

  const value = useMemo(
    () => ({
      researchTracker,
      setResearchTracker,
      resetResearchTracker,
    }),
    [researchTracker, resetResearchTracker],
  );

  return (
    <AiResearchTrackerContext.Provider value={value}>
      {children}
      <AiResearchTracker state={researchTracker} />
    </AiResearchTrackerContext.Provider>
  );
}

export function useAiResearchTracker() {
  const context = useContext(AiResearchTrackerContext);

  if (!context) {
    throw new Error("useAiResearchTracker must be used within AiResearchTrackerProvider");
  }

  return context;
}
