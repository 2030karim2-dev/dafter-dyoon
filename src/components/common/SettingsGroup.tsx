import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface Props {
  title?: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: Props) {
  return (
    <div className="space-y-1">
      {title && (
        <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">
          {title}
        </h3>
      )}
      <Card className="p-0.5 divide-y divide-border/40">{children}</Card>
    </div>
  );
}
