// Scheduled prompts ("Routines"). Times use the browser's local time zone.
export type Schedule =
  | { kind: "daily"; time: string }
  | { kind: "weekdays"; time: string }
  | { kind: "weekly"; days: number[]; time: string } // 0 = Sunday
  | { kind: "interval"; minutes: number }
  | { kind: "once"; at: string }; // datetime-local value, e.g. "2026-10-28T09:00"

export type Routine = {
  id: string;
  botId: string;
  name: string;
  prompt: string;
  schedule: Schedule;
  enabled: boolean;
  nextRunAt: number | null;
  lastRunAt?: number;
  lastError?: string;
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MIN_INTERVAL_MINUTES = 15;

function atTime(day: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

// First run strictly after `from`, or null when the schedule has nothing left.
export function computeNext(s: Schedule, from: number): number | null {
  if (s.kind === "interval") return from + Math.max(MIN_INTERVAL_MINUTES, s.minutes) * 60_000;
  if (s.kind === "once") {
    const t = new Date(s.at).getTime();
    return Number.isFinite(t) && t > from ? t : null;
  }
  const allowed =
    s.kind === "daily" ? [0, 1, 2, 3, 4, 5, 6] : s.kind === "weekdays" ? [1, 2, 3, 4, 5] : s.days;
  if (!allowed.length) return null;
  const start = new Date(from);
  for (let i = 0; i <= 7; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (!allowed.includes(day.getDay())) continue;
    const t = atTime(day, s.time).getTime();
    if (t > from) return t;
  }
  return null;
}

export function describeSchedule(s: Schedule): string {
  switch (s.kind) {
    case "daily":
      return `Every day at ${s.time}`;
    case "weekdays":
      return `Every weekday at ${s.time}`;
    case "weekly":
      return `Every ${[...s.days].sort().map((d) => DAY_NAMES[d]).join(", ")} at ${s.time}`;
    case "interval":
      return s.minutes % 60 === 0
        ? `Every ${s.minutes / 60 === 1 ? "hour" : `${s.minutes / 60} hours`}`
        : `Every ${s.minutes} minutes`;
    case "once":
      return `Once on ${formatWhen(new Date(s.at).getTime())}`;
  }
}

export function formatWhen(t: number) {
  const d = new Date(t);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const clock = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `today ${clock}`;
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${clock}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${clock}`;
}
