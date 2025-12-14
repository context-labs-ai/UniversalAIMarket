"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-500/90 text-white hover:bg-indigo-500 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_36px_rgba(99,102,241,0.25)]",
  secondary:
    "glass-panel text-white hover:bg-white/10 border-transparent",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  danger:
    "bg-rose-500/90 text-white hover:bg-rose-500 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export default function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

