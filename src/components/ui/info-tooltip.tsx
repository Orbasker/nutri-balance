"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoTooltipProps {
  title: string;
  description: string;
  /** Optional accent color class for the icon background, e.g. "bg-md-secondary" */
  accent?: string;
  /** Optional accent text color for the icon, e.g. "text-md-secondary" */
  accentText?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

const accentToText: Record<string, string> = {
  "bg-md-primary": "text-md-primary",
  "bg-md-secondary": "text-md-secondary",
  "bg-md-tertiary": "text-md-tertiary",
  "bg-md-outline": "text-md-outline",
};

export function InfoTooltip({
  title,
  description,
  accent = "bg-md-primary",
  accentText,
  side = "top",
  children,
}: InfoTooltipProps) {
  const iconTextColor = accentText ?? accentToText[accent] ?? "text-md-primary";

  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex items-center cursor-help"
        onClick={(e) => e.preventDefault()}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="!max-w-[280px] !p-0 !rounded-2xl !bg-gradient-to-br !from-gray-900/95 !to-gray-800/95 !backdrop-blur-md !border !border-white/10 !shadow-[0_0_30px_rgba(79,70,229,0.15)] overflow-hidden"
      >
        <div className="relative p-3.5">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full ${accent}/20`}>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3.5 h-3.5 ${iconTextColor}`}
              >
                <path
                  clipRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-[11px] font-semibold text-white uppercase tracking-wider">
              {title}
            </h3>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] leading-relaxed text-gray-300">{description}</p>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-xl opacity-50 pointer-events-none" />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
