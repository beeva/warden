import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "critical" | "high" | "medium" | "low" | "info" | "safe";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-steel-800 text-steel-300",
  critical: "bg-crimson-500/15 text-crimson-400",
  high: "bg-crimson-500/15 text-crimson-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-cobalt-500/15 text-cobalt-400",
  info: "bg-steel-700/60 text-steel-300",
  safe: "bg-mint-500/15 text-mint-400",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", children, ...props }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], className)} {...props}>
      {children}
    </span>
  );
}
