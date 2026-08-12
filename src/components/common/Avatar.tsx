interface Props {
  name: string;
  color?: string | null;
  size?: "sm" | "md" | "lg";
}

const PALETTE = [
  "oklch(0.7 0.15 245)",
  "oklch(0.7 0.15 165)",
  "oklch(0.7 0.18 25)",
  "oklch(0.7 0.18 305)",
  "oklch(0.72 0.14 80)",
  "oklch(0.65 0.16 200)",
];

function pickColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function Avatar({ name, color, size = "md" }: Props) {
  const initial = (name?.trim()?.[0] ?? "؟").toUpperCase();
  const bg = color || pickColor(name || "?");
  const sz =
    size === "lg" ? "size-12 text-lg" : size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-card`}
      style={{ background: bg }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
