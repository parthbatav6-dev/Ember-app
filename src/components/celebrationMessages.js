export const CHECKIN_MESSAGES = [
  "Session complete. Somewhere, a plate is being filled because you didn't quit.",
  "You stayed. A family gets clean water because of it.",
  "Done for today. That's real impact, not just a checkmark.",
  "Small effort, real reach. Someone benefits from this today.",
  "You showed up. That's what keeps this going.",
];

export const STREAK_7_MESSAGES = [
  "7 days unbroken. That's a full week of meals for someone who needed it.",
  "A week of discipline. A week of real help for someone else.",
];

export const STREAK_30_MESSAGES = [
  "30 days. You didn't just build a habit — you built someone's winter coat.",
  "One month strong. That's a month of consistent impact behind you.",
];

export function getRandomMessage(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}