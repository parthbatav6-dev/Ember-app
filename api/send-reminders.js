/**
 * EMBER — Reminder dispatch endpoint
 * -------------------------------------------------------------
 * This is a Vercel Serverless Function, not a React component —
 * it runs on Vercel's servers on a schedule, not in the browser.
 *
 * What it does each time it's called:
 * 1. Fetches all active habits that have a reminder_time set
 * 2. For each one, checks if today's check-in already happened
 * 3. If NOT checked in yet AND current time has passed reminder_time,
 *    sends a push notification to that specific user via OneSignal,
 *    targeted using the external_id we set via OneSignal.login()
 *    in App.jsx
 *
 * SECURITY: uses the Supabase SERVICE ROLE key, not the anon key —
 * this bypasses Row Level Security so it can read all users' habits
 * (a normal user's anon key correctly cannot do this). NEVER expose
 * the service role key to the browser — it only belongs in this
 * server-side file, read from an environment variable.
 *
 * Required environment variables (add these in Vercel dashboard,
 * Project Settings -> Environment Variables — NOT in .env, since
 * that file is for browser-exposed VITE_ vars only):
 *   SUPABASE_URL              (same as VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (from Supabase: Settings -> API -> service_role)
 *   ONESIGNAL_APP_ID
 *   ONESIGNAL_REST_API_KEY    (from OneSignal: Settings -> Keys & IDs)
 * -------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Reject anyone who doesn't know the shared secret
  const incomingSecret = req.headers["x-cron-secret"];
  if (incomingSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const nowUTC = new Date();
   const istOffsetMs = 5.5 * 60 * 60 * 1000;
   const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
   const today = nowIST.toISOString().slice(0, 10);
   const nowTime = nowIST.toISOString().slice(11, 16); // "HH:MM"

  // 1. Get all active habits with a reminder time set
  const { data: habits, error: habitsErr } = await supabase
    .from("habits")
    .select("id, user_id, name, reminder_time")
    .eq("is_active", true)
    .not("reminder_time", "is", null);

  if (habitsErr) {
    return res.status(500).json({ error: habitsErr.message });
  }

  // 2. Only consider habits whose reminder time has already passed today
  const dueHabits = (habits || []).filter((h) => h.reminder_time <= nowTime);

  if (dueHabits.length === 0) {
    return res.status(200).json({ sent: 0, message: "No habits due yet" });
  }

  // 3. Check which of those are already checked in today
  const habitIds = dueHabits.map((h) => h.id);
  const { data: checkins, error: checkinsErr } = await supabase
    .from("habit_checkins")
    .select("habit_id")
    .eq("checkin_date", today)
    .in("habit_id", habitIds);

  if (checkinsErr) {
    return res.status(500).json({ error: checkinsErr.message });
  }

  const checkedInIds = new Set((checkins || []).map((c) => c.habit_id));
  const needsReminder = dueHabits.filter((h) => !checkedInIds.has(h.id));

  // 4. Send one notification per user (grouped, so someone with 3
  // overdue habits gets 1 message, not 3 separate pings)
  const byUser = {};
  needsReminder.forEach((h) => {
    if (!byUser[h.user_id]) byUser[h.user_id] = [];
    byUser[h.user_id].push(h.name);
  });

  const userIds = Object.keys(byUser);
  let sent = 0;

  for (const userId of userIds) {
    const habitNames = byUser[userId];
    const message =
      habitNames.length === 1
        ? `You haven't checked in "${habitNames[0]}" yet today.`
        : `${habitNames.length} habits still waiting on you today.`;

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_aliases: { external_id: [userId] },
        target_channel: "push",
        headings: { en: "Keep the fire lit 🔥" },
        contents: { en: message },
      }),
    });

    if (response.ok) sent++;
  }

  return res.status(200).json({ sent, checked: needsReminder.length });
}