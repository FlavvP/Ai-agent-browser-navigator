import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle";
};

export function Button({ className, variant = "subtle", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-white text-black hover:bg-zinc-200",
        variant === "ghost" && "text-zinc-300 hover:bg-zinc-800 hover:text-white",
        variant === "subtle" && "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
        className,
      )}
      {...props}
    />
  );
}
