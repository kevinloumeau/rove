// When the evening check-in shows and which step it's on, kept import-free for node's test runner.

/** The check-in starts at 5 pm local time and runs until the day ends. */
export const CHECKIN_HOUR = 17;

/**
 * "log" asks what was worn, "rate" asks how it felt once something is logged, null hides the card:
 * before the evening, once today is rated, when dismissed for today, or with an empty closet.
 */
export function checkinStep(input: {
  hour: number;
  today: string;
  closetSize: number;
  wornToday: boolean;
  ratedToday: boolean;
  dismissedOn: string | null;
}): "log" | "rate" | null {
  if (!input.closetSize || input.hour < CHECKIN_HOUR || input.dismissedOn === input.today) return null;
  if (!input.wornToday) return "log";
  return input.ratedToday ? null : "rate";
}
