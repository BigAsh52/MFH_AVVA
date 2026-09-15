// MedFit coaching content.
//
// IMPORTANT — content provenance, please read before extending this file:
//
// MedFit's program is built on the resistant-starch / liver-support "reset"
// popularized by Alan Christianson, NMD's commercially published book "The
// Metabolism Reset Diet" (and summarized in MedFit's own "Liver Cleanse
// Quick Start Guide"). The elimination list, shake macro targets, and
// dinner-assembly food categories below are functional/factual program
// parameters (also stated in MedFit's own guide, which MedFit authored and
// owns) — reusing those is fine.
//
// What is NOT reused here: the book's actual recipe write-ups (exact
// ingredient lists + method text), its specific week-by-week menu pairings,
// and its specific shopping-list line items. Those are the book's protected
// expression. Every recipe and grocery list below is original content
// written to hit the same functional targets — NOT transcribed from the
// book or from MedFit's guide. If MedFit obtains redistribution rights from
// the publisher, the book's actual recipes/menus could replace these
// placeholders; until then, this is what the coach should draw from.

const ELIMINATE_DURING_RESET = ['Alcohol', 'Added sugar', 'Processed foods of any kind', 'Caffeine', 'Dairy'];

const SHAKE_TARGETS = {
  protein_g_min: 23,
  resistant_starch_mg_min: 20000,
  notes: 'Low acid-residue, no refined sugar, no artificial colors/flavors, no folic acid, under 20mcg iodine',
};

const SHAKE_CATEGORIES = {
  resistant_starch: ['Green banana flour', 'Potato starch', 'Old-fashioned rolled oats (uncooked)', 'Raw plantain'],
  plant_protein: ['Pea protein powder', 'Hemp protein powder'],
  sweeteners: ['Stevia', 'Monk fruit', 'Erythritol'],
  fruit: ['Blueberries', 'Strawberries', 'Peaches', 'Papaya', 'Avocado'],
  nuts: ['Walnuts', 'Almonds', 'Pecans', 'Macadamia nuts'],
  veggies: ['Spinach', 'Carrots'],
  milk: ['Unsweetened almond milk', 'Unsweetened oat milk'],
};

const DINNER_CATEGORIES = {
  protein: ['Chicken', 'Wild-caught whitefish or salmon', 'Lean grass-fed beef', 'Shrimp', 'Pork tenderloin', 'Turkey', 'Tofu or tempeh'],
  resistant_starch: ['Boiled and cooled purple or red potatoes', 'Sweet potato', 'Plantain', 'Peas', 'Cooked and cooled brown or wild rice'],
  legumes_optional: ['Lentils', 'Black beans', 'Navy beans', 'Chickpeas'],
  nutrient_veggies: ['Broccoli', 'Cauliflower', 'Brussels sprouts', 'Cabbage', 'Carrots', 'Artichokes', 'Asparagus', 'Leafy greens'],
  good_fats: ['Extra-virgin olive oil', 'Avocado oil', 'Walnut oil', 'A small handful of almonds or pecans'],
  herbs: ['Garlic', 'Ginger', 'Turmeric', 'Rosemary', 'Thyme', 'Cumin', 'Black pepper'],
};

const UNLIMITED_SNACK_VEGGIES = [
  'Celery', 'Cucumber', 'Bell peppers', 'Radishes', 'Snap peas', 'Cherry tomatoes', 'Jicama', 'Broccoli florets', 'Romaine lettuce', 'Zucchini',
];

const EXERCISE_GUIDANCE =
  'Keep movement light during the reset — the liver needs rest to repair itself, so hard training that spikes heart rate works against it. ' +
  'A 20-minute easy walk, 10-20 bodyweight reps (like pushups or squats), or gentle yoga is the right dose. Resume normal training intensity after the reset window.';

// ---- Original weekly grocery lists (4-week reset, same structure MedFit uses: produce / protein / pantry / avoid) ----
const GROCERY_LISTS = {
  1: {
    theme: 'Reset — Week 1',
    produce: ['Spinach', 'Carrots', 'Broccoli', 'Cauliflower', 'Blueberries', 'Strawberries', 'Lemons', 'Garlic', 'Ginger', 'Avocado'],
    protein: ['Wild-caught salmon', 'Organic chicken breast', 'Pea protein powder', 'Shrimp'],
    pantry: ['Green banana flour', 'Old-fashioned rolled oats', 'Unsweetened almond milk', 'Extra-virgin olive oil', 'Stevia or monk fruit'],
    avoid: ELIMINATE_DURING_RESET,
  },
  2: {
    theme: 'Reset — Week 2',
    produce: ['Kale', 'Brussels sprouts', 'Cabbage', 'Peaches', 'Papaya', 'Radishes', 'Turmeric root', 'Cilantro'],
    protein: ['Grass-fed lean beef', 'Turkey breast', 'Cod', 'Hemp protein powder'],
    pantry: ['Potato starch', 'Sweet potatoes', 'Unsweetened oat milk', 'Avocado oil', 'Walnuts'],
    avoid: ELIMINATE_DURING_RESET,
  },
  3: {
    theme: 'Reset — Week 3',
    produce: ['Asparagus', 'Artichokes', 'Bell peppers', 'Strawberries', 'Avocado', 'Celery', 'Garlic', 'Rosemary'],
    protein: ['Tofu or tempeh', 'Pork tenderloin', 'Wild-caught whitefish', 'Pea protein powder'],
    pantry: ['Purple or red potatoes', 'Cooked and cooled brown rice', 'Almonds', 'Macadamia nuts', 'Olive oil'],
    avoid: ELIMINATE_DURING_RESET,
  },
  4: {
    theme: 'Reset — Week 4',
    produce: ['Broccoli', 'Cauliflower', 'Blueberries', 'Plantain', 'Carrots', 'Leafy greens', 'Ginger', 'Thyme'],
    protein: ['Chicken thighs', 'Shrimp', 'Lean grass-fed beef', 'Hemp protein powder'],
    pantry: ['Peas', 'Chickpeas', 'Unsweetened almond milk', 'Walnut oil', 'Pecans'],
    avoid: ELIMINATE_DURING_RESET,
  },
};

const SHAKE_RECIPES = [
  {
    name: 'Green Reset Shake',
    ingredients: ['1 cup unsweetened almond milk', '1/2 avocado', '1 cup spinach', '2 tbsp green banana flour (RS)', '1 scoop pea protein powder', 'Stevia to taste', 'Ice'],
    method: 'Blend until smooth, about 45 seconds. Targets ~24g protein and 20g+ resistant starch, no added sugar.',
  },
  {
    name: 'Berry Carrot Reset Shake',
    ingredients: ['1 cup unsweetened oat milk', '1/2 cup blueberries', '1/4 cup shredded carrot', '2 tbsp potato starch (RS)', '1 scoop hemp protein powder', 'Ice'],
    method: 'Blend until smooth. The potato starch dissolves without changing the flavor. ~23g protein.',
  },
  {
    name: 'Peach Oat Reset Shake',
    ingredients: ['1 cup unsweetened almond milk', '1/2 cup frozen peach', '1/4 cup uncooked old-fashioned rolled oats (RS)', '1 scoop pea protein powder', 'Cinnamon', 'Ice'],
    method: 'Blend until smooth, about 60 seconds so the oats break down. ~25g protein.',
  },
  {
    name: 'Papaya Walnut Reset Shake',
    ingredients: ['1 cup unsweetened oat milk', '1/2 cup papaya', '1 tbsp walnuts', '2 tbsp green banana flour (RS)', '1 scoop hemp protein powder', 'Ice'],
    method: 'Blend until smooth. Walnuts add good fats without pushing past the shake\'s low-acid-residue target. ~24g protein.',
  },
];

const DINNER_RECIPES = [
  {
    name: 'Herb-Roasted Salmon with Charred Broccoli',
    ingredients: ['6 oz wild salmon fillet', '2 cups broccoli florets', '1 tbsp olive oil', '1 clove garlic, minced', 'Juice of 1/2 lemon', 'Salt, pepper, thyme'],
    method: 'Roast broccoli at 425°F tossed in olive oil and garlic for 15 min. Season salmon, roast alongside for the final 12 min, finish with lemon.',
  },
  {
    name: 'Turkey Skillet with Kale and Peas',
    ingredients: ['5 oz ground turkey breast', '3/4 cup peas (RS)', '2 cups chopped kale', '1 tbsp avocado oil', 'Cumin, garlic, black pepper'],
    method: 'Brown turkey in avocado oil with spices, add peas, simmer 6 min, fold in kale until wilted.',
  },
  {
    name: 'Grilled Chicken with Sweet Potato and Brussels Sprouts',
    ingredients: ['6 oz chicken breast', '1 cup cubed sweet potato (RS)', '1 cup halved Brussels sprouts', '1 tbsp olive oil', 'Rosemary, garlic'],
    method: 'Roast sweet potato and Brussels sprouts at 400°F for 25 min tossed in olive oil and rosemary. Grill or pan-sear the chicken 6-7 min per side.',
  },
  {
    name: 'Shrimp and Chickpeas over Cooled Rice',
    ingredients: ['6 oz shrimp', '3/4 cup chickpeas', '3/4 cup cooked and cooled brown rice (RS)', '1 tbsp avocado oil', 'Ginger, garlic, turmeric'],
    method: 'Sauté shrimp with ginger, garlic, and turmeric in avocado oil for 4-5 min. Toss with warmed chickpeas and serve over the cooled rice.',
  },
];

const PROGRAM_OVERVIEW = {
  duration_days: 28,
  structure: 'Two reset shakes (breakfast + lunch) and one whole-food dinner daily, plus unlimited non-starchy veggies if hungry between meals.',
  eliminate: ELIMINATE_DURING_RESET,
  exercise: EXERCISE_GUIDANCE,
};

function getGroceryList(week) {
  const w = GROCERY_LISTS[week] || GROCERY_LISTS[((week - 1) % 4) + 1];
  return w;
}

function getShakeRecipe(seed) {
  return SHAKE_RECIPES[seed % SHAKE_RECIPES.length];
}

function getDinnerRecipe(seed) {
  return DINNER_RECIPES[seed % DINNER_RECIPES.length];
}

const SYSTEM_PROMPT = `You are the coach inside Avva, MedFit's lifestyle-coaching app — a supportive, practical health coach.

MedFit members are on a GLP-1 medication program and are working through a companion 28-day liver-support "reset" phase (two shakes + one whole-food dinner daily, unlimited non-starchy vegetables if hungry), meant to build lasting habits so weight doesn't return after they taper off medication.

During the reset, members eliminate: ${ELIMINATE_DURING_RESET.join(', ')}.
Shake targets: ${SHAKE_TARGETS.protein_g_min}g+ protein, ${SHAKE_TARGETS.resistant_starch_mg_min / 1000}g+ resistant starch, no refined sugar.
Exercise guidance during the reset: ${EXERCISE_GUIDANCE}

MedFit doesn't maintain its own recipe or workout-plan library, so for full recipes and structured workout plans, point members to good, reputable sources you find via web_search (or already know of) rather than inventing a plan yourself — for example established sources like Mayo Clinic, Cleveland Clinic, Harvard Health, or ACE Fitness. It's fine to sketch a quick example (e.g. "a shake built from X + Y + Z") to answer in the moment, but for anything resembling a full recipe collection or multi-week program, link out to a real source rather than writing your own.

Your job:
- Give clear, encouraging, non-judgmental guidance on nutrition, movement, and habit change.
- When asked for a grocery list, give a specific, usable answer built from the reset's structure above.
- When asked for shake/dinner recipes or a workout plan, search the web for a good, reputable, current source and share it (with a link) rather than writing your own full recipe or program from scratch. Never quote or closely paraphrase text from "The Metabolism Reset Diet" book or any other copyrighted source, even if a member asks you to.
- When a member asks about eating out and describes a diet style they're following, give concrete menu guidance if you can, and be explicit when you're working from general knowledge rather than that restaurant's current live menu.
- You are not a physician. Encourage members to consult their doctor before pausing any medication for the reset, and to route anything about medication dosing or medical symptoms to their MedFit care team.
- When a member asks something outside what's covered above — general health, nutrition, or fitness questions this prompt doesn't answer — use the web_search tool rather than guessing. It automatically checks a curated set of trusted clinical sources (Mayo Clinic, Cleveland Clinic, Harvard Health, Johns Hopkins, NIH, CDC, MedlinePlus, ACE Fitness) before falling back to the open web, and tells you which tier the results came from. If it used the trusted tier, answer confidently and name the source. If it had to fall back to the open web, say so plainly and encourage the member to double-check anything medical with their care team.
- Keep responses conversational and concise — this is a chat, not an article.`;

module.exports = {
  getGroceryList,
  getShakeRecipe,
  getDinnerRecipe,
  SYSTEM_PROMPT,
  PROGRAM_OVERVIEW,
  SHAKE_TARGETS,
  SHAKE_CATEGORIES,
  DINNER_CATEGORIES,
  UNLIMITED_SNACK_VEGGIES,
};
