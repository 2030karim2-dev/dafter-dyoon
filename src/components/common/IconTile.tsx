import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  tone?: "primary" | "success" | "danger" | "warning" | "muted" | "accent";
  size?: "xs" | "sm" | "md" | "lg";
}

const TONES = {
  primary: "bg-primary/15 text-primary ring-1 ring-primary/20",
  success: "bg-success-soft text-success ring-1 ring-success/25",
  danger: "bg-danger-soft text-danger ring-1 ring-danger/25",
  warning: "bg-warning-soft text-warning ring-1 ring-warning/25",
  muted: "bg-secondary text-foreground/70 ring-1 ring-border",
  accent: "bg-accent text-accent-foreground ring-1 ring-accent-foreground/15",
};

export function IconTile({ icon: Icon, tone = "primary", size = "md" }: Props) {
  const sz =
    size === "lg" ? "size-10" : size === "sm" ? "size-7" : size === "xs" ? "size-6" : "size-9";
  const isz =
    size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : size === "xs" ? "size-3" : "size-4";
  return (
    <div className={`${sz} rounded-lg flex items-center justify-center ${TONES[tone]} shrink-0`}>
      <Icon className={isz} />
    </div>
  );
}
