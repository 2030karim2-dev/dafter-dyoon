import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-secondary rounded-lg", className)} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-card border rounded-2xl p-3.5 flex items-center gap-3 shadow-card"
        >
          <Shimmer className="size-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3 w-3/5" />
            <Shimmer className="h-2.5 w-1/3" />
          </div>
          <Shimmer className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-card">
      <Shimmer className="h-3 w-1/3" />
      <Shimmer className="h-8 w-2/3" />
      <Shimmer className="h-2 w-full" />
    </div>
  );
}
