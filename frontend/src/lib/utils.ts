import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDataRate(kbps: number): string {
  if (!Number.isFinite(kbps) || kbps < 0) return "0.0 KB/s";
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
  return `${kbps.toFixed(1)} KB/s`;
}

export function formatTimestamp(iso: string): string {
  if (!iso) return "-";
  // SQLite datetime('now') stores UTC without a suffix — append Z so the
  // browser converts to the user's local timezone.
  const normalized = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}
