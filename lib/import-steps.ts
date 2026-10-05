/** The three steps the import screen shows, in order. */
export const importSteps = ["Understanding the photo", "Separating and cleaning pieces", "Writing names and tags"];

/**
 * Which import step a progress message belongs to (0-2), from the messages
 * processWardrobeImage and analyzeAndUpload report. Unknown messages count as the first step.
 */
export function importStepFor(message: string | null) {
  if (!message) return 0;
  if (/^Cleaning\b/.test(message)) return 1;
  if (/^Naming\b|style model|ready|^Saving\b/.test(message)) return 2;
  return 0;
}
