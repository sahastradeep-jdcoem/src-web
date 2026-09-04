import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "orange" | "navy" | "slate" | "outline" | "success" | "warning" | "rose";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "orange",
  size = "sm",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    orange: "bg-[#E78023]/10 text-[#E78023] border-[#E78023]/30 font-semibold",
    navy: "bg-[#17458F]/10 text-[#17458F] border-[#17458F]/25 font-semibold",
    slate: "bg-slate-100 text-slate-700 border-slate-300 font-medium",
    outline: "bg-transparent text-slate-700 border-slate-300 font-medium",
    success: "bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold",
    warning: "bg-amber-50 text-amber-800 border-amber-300 font-semibold",
    rose: "bg-rose-50 text-rose-700 border-rose-300 font-bold",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2.5 py-0.5 uppercase tracking-wider font-sans",
    md: "text-xs px-3 py-1 uppercase tracking-wider font-sans",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-colors shadow-xs font-sans",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
