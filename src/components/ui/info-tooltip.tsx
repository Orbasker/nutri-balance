"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoTooltipProps {
  title: string;
  description: string;
  /** Optional accent color class for the top border, e.g. "bg-md-secondary" */
  accent?: string;
  side?: "top" | "bottom" | "left" | "right";
  children?: React.ReactNode;
}

export function InfoTooltip({
  title,
  description,
  accent = "bg-md-primary",
  side = "top",
  children,
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex items-center justify-center cursor-help"
        onClick={(e) => e.preventDefault()}
      >
        {children ?? (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-md-surface-container-high text-md-outline hover:bg-md-primary/10 hover:text-md-primary transition-colors duration-200">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
              <path
                d="M5 0.5C2.51 0.5 0.5 2.51 0.5 5C0.5 7.49 2.51 9.5 5 9.5C7.49 9.5 9.5 7.49 9.5 5C9.5 2.51 7.49 0.5 5 0.5ZM5.45 7.25H4.55V4.55H5.45V7.25ZM5.45 3.65H4.55V2.75H5.45V3.65Z"
                fill="currentColor"
              />
            </svg>
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="!max-w-[260px] !p-0 !rounded-xl !bg-md-inverse-surface !border-0 !shadow-2xl !shadow-black/25 overflow-hidden"
      >
        <div className={`h-[3px] w-full ${accent}`} />
        <div className="px-3.5 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-md-inverse-primary mb-1">
            {title}
          </p>
          <p className="text-[11px] leading-relaxed text-md-inverse-on-surface/80">{description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
