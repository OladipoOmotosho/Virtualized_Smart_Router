import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const VARIANTS: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-600",
};

export function Badge({ variant = "neutral", className, children }: BadgeProps) {
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", VARIANTS[variant], className)}>
      {children}
    </span>
  );
}
