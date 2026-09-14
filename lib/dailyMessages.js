// A 30-day sequence of check-in messages, one per day of a member's Reset
// phase (day number = days since program_start_date + 1). Original content,
// written for Avva — themed loosely around the shape of a good daily
// coaching check-in (welcome, adjustment, weekly weigh-ins, prompts to try
// with the coach, movement reminders, a closing review), but not copied from
// any outside source.
//
// Each entry:
//   message — the text sent (SMS/email) and shown in the member app's
//             "Today" card
//   action  — optional: { type: 'log_weight' } to nudge a weigh-in, or
//             { type: 'ask_coach', prompt } to suggest something to paste
//             into the Avva coach chat. The prompt wording is chosen to line
//             up with what the coach (scripted or live) actually recognizes
//             — grocery list, shake, dinner/recipe, restaurant/menu, snack,
//             workout/exercise.

const DAILY_MESSAGES = [
  { day: 1, message: "Welcome to your Reset. For the next 30 days, keep it simple: your two Reset shakes, a Reset dinner, and 20 minutes of light movement. You don't have to be perfect — just keep stacking good days.", action: null },
  { day: 2, message: "The first few days are usually the biggest adjustment — your routine is shifting all at once. Don't overthink today. Shakes, dinner, movement. That's it.", action: null },
  { day: 3, message: "If today feels harder than day one, that's normal — it doesn't mean the plan isn't working. Stay with the three habits and let the routine catch up to you.", action: null },
  { day: 4, message: "Quick refresher on your dinners: protein + a resistant-starch food + vegetables. You don't need to memorize a whole food list — we'll make the choices easier as you go.", action: null },
  { day: 5, message: "Having the right groceries on hand makes everything easier this week.", action: { type: 'ask_coach', prompt: "What's my grocery list for this week? I need ingredients for two shakes a day and one Reset dinner each night." } },
  { day: 6, message: "Reset dinners don't need to be fancy — just repeatable. Let's build tonight's.", action: { type: 'ask_coach', prompt: "What's a good dinner recipe for tonight? Keep it to protein, a resistant-starch food, and vegetables." } },
  { day: 7, message: "One week down. The routine should be starting to feel a little less foreign — that's exactly the goal. Keep stacking your three habits.", action: null },
  { day: 8, message: "Time for your first weekly check-in. We're watching the trend over time, not judging any single number.", action: { type: 'log_weight' } },
  { day: 9, message: "Your shakes are doing a lot of the work right now, so variety helps. Let's mix it up.", action: { type: 'ask_coach', prompt: "Give me a good shake recipe for today — something different from what I've had this week." } },
  { day: 10, message: "Resistant starch shows up a lot in this program. You don't need the science today — just a few foods you actually enjoy.", action: { type: 'ask_coach', prompt: "What are some good resistant-starch foods I can rotate through my Reset dinners?" } },
  { day: 11, message: "Feeling hungry between meals is normal, and it's a solvable problem, not something to white-knuckle through.", action: { type: 'ask_coach', prompt: "What's a good snack idea that fits my Reset if I get hungry between meals?" } },
  { day: 12, message: "A few minutes of planning tonight makes tomorrow a lot easier.", action: { type: 'ask_coach', prompt: "Help me plan tomorrow's meals — two shakes and a Reset dinner, kept simple." } },
  { day: 13, message: "Eating out doesn't have to mean guessing at the menu.", action: { type: 'ask_coach', prompt: "I'm eating at a restaurant tonight — what looks good on the menu for my Reset?" } },
  { day: 14, message: "Two weeks in. At this point it's less about learning more and more about nutrition, and more about repeating the basics: shakes, dinner, movement, repeat.", action: null },
  { day: 15, message: "Weekly check-in time. We care about the trend line, not this morning's mood about the scale.", action: { type: 'log_weight' } },
  { day: 16, message: "You don't need 30 different dinners to finish this Reset — a handful of go-to meals is plenty.", action: { type: 'ask_coach', prompt: "Give me a few simple dinner recipes I can rotate through this week." } },
  { day: 17, message: "Before you shop for more food, check what's already in your kitchen.", action: { type: 'ask_coach', prompt: "Help me build a Reset dinner using food I already have at home." } },
  { day: 18, message: "Cravings happen — they don't erase the progress you've made. Treat a craving as a problem to solve, not a test you failed.", action: { type: 'ask_coach', prompt: "I'm craving something that might not fit my Reset — what's a good alternative?" } },
  { day: 19, message: "Movement today doesn't need to be a hard workout. A 20-minute walk, some stretching, or light mobility work is enough — just get it in.", action: null },
  { day: 20, message: "Busy days are exactly when a plan pays off.", action: { type: 'ask_coach', prompt: "Help me fit my Reset into a busy schedule tomorrow — two shakes, a dinner, and 20 minutes of movement." } },
  { day: 21, message: "Three weeks down. Notice more than the scale today — hunger, energy, and how automatic the routine feels are all real signs of progress.", action: null },
  { day: 22, message: "Weekly check-in. Today's number is one data point, nothing more.", action: { type: 'log_weight' } },
  { day: 23, message: "If you've found a dinner you actually like, there's no rule against repeating it — fewer decisions is a good thing.", action: { type: 'ask_coach', prompt: "Give me a couple of variations on a Reset dinner I already like, so it doesn't feel repetitive." } },
  { day: 24, message: "Traveling or away from home takes a little more planning, but the same rules still apply.", action: { type: 'ask_coach', prompt: "I'll be away from home tomorrow — help me plan my Reset meals for the day." } },
  { day: 25, message: "Getting tired of your usual shake is a solvable problem, not a reason to fall off the plan.", action: { type: 'ask_coach', prompt: "I want a new shake flavor idea — something different from what I usually make." } },
  { day: 26, message: "One imperfect meal or a rough day doesn't require starting over. The next decision is the one that counts — just come back to your three habits.", action: null },
  { day: 27, message: "A few days left — let's make sure you're not caught short on groceries right before the finish.", action: { type: 'ask_coach', prompt: "Build me a grocery list for the last few days of my Reset, keeping it as short as possible." } },
  { day: 28, message: "Four weeks in. Think about how different today feels compared to day one — that shift is one of the real wins of this program.", action: null },
  { day: 29, message: "One more weekly check-in before you close out this phase. Same as always — look at the trend, not the single number.", action: { type: 'log_weight' } },
  { day: 30, message: "You made it through 30 days. Before jumping into what's next, it's worth taking a minute to look back at what actually worked for you.", action: { type: 'ask_coach', prompt: "Help me review my last 30 days — what went well, what was hard, and what habits I should carry forward." } },
];

function getDailyMessage(dayNumber) {
  return DAILY_MESSAGES.find((d) => d.day === dayNumber) || null;
}

// day number = days since program_start_date, 1-indexed (day 1 is the day
// the program started).
function dayNumberFor(programStartDate, asOf = new Date()) {
  if (!programStartDate) return null;
  const start = new Date(programStartDate + 'T00:00:00Z');
  const now = new Date(asOf.toISOString().slice(0, 10) + 'T00:00:00Z');
  const diffDays = Math.round((now - start) / 86400000);
  return diffDays + 1;
}

module.exports = { DAILY_MESSAGES, getDailyMessage, dayNumberFor };
