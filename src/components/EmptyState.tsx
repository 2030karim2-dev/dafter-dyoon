import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "default" | "compact";
}

export function EmptyState({ icon: Icon, title, description, action, variant = "default" }: Props) {
  const isCompact = variant === "compact";
  return (
    <div
      className={`text-center ${isCompact ? "py-10" : "py-16"} px-4 animate-in fade-in duration-300`}
    >
      <div
        className={`mx-auto rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center mb-4 shadow-glow ${isCompact ? "size-14" : "size-20"}`}
      >
        <Icon className={isCompact ? "size-6" : "size-9"} />
      </div>
      <h3 className={`font-bold mb-1 ${isCompact ? "text-base" : "text-lg"}`}>{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">{description}</p>
      )}
      {action}
    </div>
  );
}
