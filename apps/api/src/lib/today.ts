const PRAGUE_DATE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
});

/** Dnešní datum v Praze jako „YYYY-MM-DD“ (server může běžet v UTC). */
export function todayInPrague(now: Date = new Date()): string {
  return PRAGUE_DATE.format(now);
}
