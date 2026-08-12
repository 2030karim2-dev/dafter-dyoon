import { LucideIcon, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ReactNode } from "react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  back?: string;
  actions?: ReactNode;
}

/** Compact header used by inner pages (settings sub-pages, archive, etc.). */
export function PageHeader({ icon: Icon, title, subtitle, back, actions }: Props) {
  return (
    <div className="space-y-1.5">
      {back && (
        <Link
          to={back}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" /> رجوع
        </Link>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow shrink-0">
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-[14px] leading-tight tracking-tight truncate">
              {title}
            </h1>
            {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
