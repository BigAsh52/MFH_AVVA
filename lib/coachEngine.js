const {
  getGroceryList,
  SYSTEM_PROMPT,
  PROGRAM_OVERVIEW,
  UNLIMITED_SNACK_VEGGIES,
  SHAKE_TARGETS,
  SHAKE_CATEGORIES,
  DINNER_CATEGORIES,
} = require('./framework');
const { RESOURCE_LIBRARY } = require('./resources');
const { lookupExternalKnowledge } = require('./webKnowledge');

function formatResource(r) {
  return `${r.title} (${r.source}) — ${r.url}`;
}

// ---- Web search tool (used only when the real Claude API path is active) ----
// Trusted-allowlist-first, open-web-fallback — see lib/webKnowledge.js.
async function webSearch(query) {
  const result = await lookupExternalKnowledge(query);
  if (!result.ok) {
    return {
      live: false,
      note: `Live web search is not configured or returned nothing for this deployment (${result.reason}). Answer from general knowledge and say so explicitly.`,
    };
  }
  return {
    live: true,
    source_tier: result.tier, // 'trusted' (curated clinical sources) or 'open' (general web fallback)
    results: result.results.map((r) => `${r.title}: ${r.snippet} (${r.url})`),
  };
}

const TOOLS = [
  {
    name: 'web_search',
    description:
      "Search for anything outside your built-in knowledge — general health/nutrition/fitness questions, restaurant/menu specifics, or a reputable recipe/workout resource to share. Automatically tries a curated set of trusted clinical sources first, then falls back to the open web only if that turns up nothing — the result tells you which tier it used.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
];

async function callClaude(history) {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

  const messages = history.map((m) => ({ role: m.role, content: m.content }));

  let resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API error: ${resp.status} ${errText}`);
  }

  let data = await resp.json();

  // Single round of tool use, if requested.
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
  if (toolUse) {
    const result = await webSearch(toolUse.input.query);
    const followUpMessages = [
      ...messages,
      { role: 'assistant', content: data.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          },
        ],
      },
    ];
    const resp2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: followUpMessages,
      }),
    });
    data = await resp2.json();
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text');
  return textBlock ? textBlock.text : "Sorry, I couldn't put together a response that time — try asking again.";
}

// ---- Scripted fallback (no ANTHROPIC_API_KEY configured) ----
async function scriptedReply(message, memberWeekNumber) {
  const m = message.toLowerCase();

  const weekMatch = m.match(/week\s*(\d+)/);
  const week = weekMatch ? parseInt(weekMatch[1], 10) : memberWeekNumber || 1;

  if (m.includes('grocery') || m.includes('shopping list')) {
    const list = getGroceryList(week);
    return (
      `Here's your grocery list for ${list.theme}:\n\n` +
      `Produce: ${list.produce.join(', ')}\n` +
      `Protein: ${list.protein.join(', ')}\n` +
      `Pantry: ${list.pantry.join(', ')}\n` +
      `Skip this phase: ${list.avoid.join(', ')}`
    );
  }

  if (m.includes('shake')) {
    const rs = SHAKE_CATEGORIES.resistant_starch.join(', ');
    const protein = SHAKE_CATEGORIES.plant_protein.join(' or ');
    const fruit = SHAKE_CATEGORIES.fruit.join(', ');
    const milk = SHAKE_CATEGORIES.milk.join(' or ');
    return (
      `A reset shake should land around ${SHAKE_TARGETS.protein_g_min}g+ protein and ${SHAKE_TARGETS.resistant_starch_mg_min / 1000}g+ resistant starch, no refined sugar. ` +
      `Build one from: ${milk} + a handful of ${fruit.toLowerCase()} + ${protein} + a resistant-starch source (${rs.toLowerCase()}). ` +
      `For full recipes: ${RESOURCE_LIBRARY.nutrition.map(formatResource).join(' | ')}`
    );
  }

  if (m.includes('dinner') || m.includes('recipe')) {
    const protein = DINNER_CATEGORIES.protein.join(', ');
    const starch = DINNER_CATEGORIES.resistant_starch.join(', ');
    const veg = DINNER_CATEGORIES.nutrient_veggies.slice(0, 5).join(', ');
    return (
      `Dinner formula: a 4-6oz protein (${protein.toLowerCase()}) + a resistant-starch side (${starch.toLowerCase()}) + a nutrient-dense veggie (${veg.toLowerCase()}) + a drizzle of good fat. ` +
      `For full recipes, MedFit doesn't have its own library yet, so these are worth bookmarking: ${RESOURCE_LIBRARY.nutrition.map(formatResource).join(' | ')}`
    );
  }

  if (m.includes('workout') || m.includes('work out') || m.includes('exercise plan') || m.includes('training plan')) {
    return (
      `${PROGRAM_OVERVIEW.exercise} Once you're past the reset window and ready for a structured plan, these are solid, free programs: ` +
      RESOURCE_LIBRARY.workouts.map(formatResource).join(' | ')
    );
  }

  if (m.includes('resource') || m.includes('link') || m.includes('where can i find')) {
    return (
      'Here are the resources I pull from:\n\n' +
      `Nutrition: ${RESOURCE_LIBRARY.nutrition.map(formatResource).join(' | ')}\n\n` +
      `Workouts: ${RESOURCE_LIBRARY.workouts.map(formatResource).join(' | ')}`
    );
  }

  if (m.includes('restaurant') || m.includes('menu') || /steak|grill|cafe|kitchen/.test(m)) {
    return (
      "I don't have live access to that restaurant's current menu in this demo mode (that turns on with a search API key), " +
      'but generally: look for a grilled or broiled protein (fish, chicken, or a lean cut of steak), ask for double vegetables instead of a starch side, ' +
      'and go easy on butter-based sauces and bread service — that keeps it lining up with a Mediterranean-style plate.'
    );
  }

  if (m.includes('snack') || m.includes('hungry between')) {
    return (
      `If you get hungry between meals, these are unlimited: ${UNLIMITED_SNACK_VEGGIES.join(', ')}. ` +
      'Most people need snacks for the first week or so and then find they are not as hungry between meals.'
    );
  }

  if (m.includes('exercise') || m.includes('activity')) {
    return PROGRAM_OVERVIEW.exercise;
  }

  if (m.includes('what is the reset') || m.includes('how does this work') || m.includes('what should i eat') || m.includes('overview')) {
    return (
      `Here's the shape of your ${PROGRAM_OVERVIEW.duration_days}-day reset: ${PROGRAM_OVERVIEW.structure} ` +
      `During this window you'll skip ${PROGRAM_OVERVIEW.eliminate.join(', ').toLowerCase()}. ${PROGRAM_OVERVIEW.exercise}`
    );
  }

  // Nothing scripted matched — this is exactly the "outside our knowledge
  // base" case. Without a full conversational AI (ANTHROPIC_API_KEY) we
  // can't synthesize a natural-language answer, but we can still do the
  // same trusted-first/open-fallback lookup and hand back real sources.
  const lookup = await lookupExternalKnowledge(message);
  if (lookup.ok) {
    const tierNote =
      lookup.tier === 'trusted'
        ? 'from trusted clinical sources'
        : "from a general web search (nothing on-topic turned up in MedFit's trusted sources)";
    const links = lookup.results
      .slice(0, 3)
      .map((r) => `${r.title} — ${r.url}`)
      .join('\n');
    return `That's outside what I can answer directly in demo mode, but here's what I found ${tierNote}:\n\n${links}`;
  }

  return (
    "I'm here to help with your reset — ask me for this week's grocery list, a shake or dinner recipe, or how to navigate a restaurant menu on your diet style, " +
    'and I can walk you through it. For anything else, live lookup isn\'t configured for this deployment yet.'
  );
}

async function getCoachReply({ message, history, memberWeekNumber }) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { reply: await callClaude(history), live: true };
    } catch (err) {
      console.error('Claude API call failed, falling back to scripted reply:', err.message);
      return { reply: await scriptedReply(message, memberWeekNumber), live: false, fallbackReason: err.message };
    }
  }
  return { reply: await scriptedReply(message, memberWeekNumber), live: false };
}

module.exports = { getCoachReply };
