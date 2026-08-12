interface Props {
  count: number;
  tone?: "primary" | "danger" | "success" | "muted";
  max?: number;
}

const TONES = {
  primary: "bg-primary text-primary-foreground",
  danger: "bg-danger text-danger-foreground",
  success: "bg-success text-success-foreground",
  muted: "bg-secondary text-secondary-foreground",
};

export function BadgeCount({ count, tone = "primary", max = 99 }: Props) {
  if (!count) return null;
  const display = count > max ? `${max}+` : String(count);
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full ${TONES[tone]} tabular-nums`}
    >
      {display}
    </span>
  );
}
