import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

export function IconByName({ name, ...props }: { name: string } & LucideProps) {
  const Comp = (Icons as unknown as Record<string, typeof Icons.Tag>)[name] ?? Icons.Tag;
  return <Comp {...props} />;
}

export const CATEGORY_ICONS = [
  "UtensilsCrossed",
  "Car",
  "Receipt",
  "ShoppingBag",
  "HeartPulse",
  "Gamepad2",
  "GraduationCap",
  "Home",
  "Coffee",
  "Plane",
  "Fuel",
  "Phone",
  "Wifi",
  "Shirt",
  "Baby",
  "Dog",
  "Gift",
  "Hammer",
  "Briefcase",
  "Music",
  "Film",
  "Book",
  "Bus",
  "Train",
  "Bike",
  "Pizza",
  "Apple",
  "Cake",
  "CreditCard",
  "Banknote",
  "Wallet",
  "PiggyBank",
  "Building",
  "Users",
  "Heart",
  "Star",
  "Tag",
  "MoreHorizontal",
];

export const CATEGORY_COLORS = [
  "#f97316",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#10b981",
  "#06b6d4",
  "#a16207",
  "#64748b",
  "#0ea5e9",
  "#84cc16",
  "#f59e0b",
  "#d946ef",
  "#14b8a6",
  "#6366f1",
  "#f43f5e",
];
