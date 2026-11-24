import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const BLOOM = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
export const BLOOM_COLORS = ["#28765a", "#4f9a7b", "#a8b89a", "#d8b982", "#c79a5b", "#8a6d3b"];

export const fmtBytes = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export function fmtDuration(seconds) {
  const m = Math.round((seconds || 0) / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

export function isInvalidKeypress(text) {
  const t = (text || "").trim();
  if (!t || t.length < 3) return false;

  // Allow math operators, units, equations (e.g. F = ma, 10m/s^2, E=mc^2, x^2)
  if (/[\+\-\*\/\=\^\<\>_~]/.test(t)) return false;
  if (/^-?\d+(\.\d+)?\s*(m\/s\^?2?|km\/h|kg|g|n|j|w|v|a|pa|hz|c|k|mol|s|min|h)?$/i.test(t)) return false;

  const validShort = new Set([
    "yes", "no", "up", "down", "left", "right", "same", "zero", "none", "equal", "true", "false",
    "high", "low", "more", "less", "fast", "slow", "work", "heat", "mass", "time", "flow",
    "watt", "volt", "joule", "newton", "force", "field", "charge", "north", "south", "east", "west"
  ]);
  if (validShort.has(t.toLowerCase())) return false;

  // Repeated identical or near-identical characters (e.g. aaaaaa, 11111)
  if (t.length >= 4 && new Set(t.toLowerCase()).size <= 2) return true;

  // QWERTY keyboard walks
  const walks = [
    "qwertyuiop", "asdfghjkl", "zxcvbnm",
    "1234567890", "0987654321",
    "qazwsxedcrfvtgbyhnujmikolp",
    "zaqwsxcderfvbgtyhnmjuiklop"
  ];
  const clean = t.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const w of walks) {
    const rev = w.split("").reverse().join("");
    if (clean.length >= 4 && (w.includes(clean) || rev.includes(clean))) return true;
  }

  // Token-level check for words
  const words = t.split(/\s+/);
  let invalidCount = 0;
  for (const word of words) {
    const w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!w) continue;
    // Interspersed letter-number mash (e.g. g88yg88, h89sd, 12a34b), excluding standard variable subscripts like x1, v0
    if ((/[a-z]+\d+[a-z]+/i.test(w) || /\d+[a-z]+\d+/i.test(w)) && !/^[a-z]\d+$/i.test(w)) {
      invalidCount++;
      continue;
    }
    if (w.length >= 4 && new Set(w).size <= 2) {
      invalidCount++;
      continue;
    }
    const letters = (w.match(/[a-z]/g) || []).length;
    const vowels = (w.match(/[aeiouy]/g) || []).length;
    if (letters >= 5 && vowels === 0) {
      invalidCount++;
      continue;
    }
    if (letters >= 7 && vowels / letters < 0.15) {
      invalidCount++;
      continue;
    }
  }

  return words.length > 0 && invalidCount === words.length;
}
