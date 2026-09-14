// Curated external resources for recipes and workout plans. MedFit doesn't
// license its own recipe/workout content library, so rather than the coach
// inventing plans, it points members to reputable, publicly available
// sources. Vetted for source credibility on 2026-09-10 — worth a periodic
// re-check that links still resolve and content hasn't shifted.

const RESOURCE_LIBRARY = {
  nutrition: [
    {
      title: 'Mediterranean Meal Plan',
      source: 'Mayo Clinic Diet',
      url: 'https://diet.mayoclinic.org/us/meal-plans/mediterranean-meal-plan/',
      note: 'A full structured meal plan — good fit for the whole-food dinner phase.',
    },
    {
      title: 'Mediterranean Diet: Food List & Meal Plan',
      source: 'Cleveland Clinic',
      url: 'https://my.clevelandclinic.org/health/articles/16037-mediterranean-diet',
      note: "What's in and out, plus sample meal ideas.",
    },
    {
      title: 'What Is Resistant Starch? Foods and Benefits',
      source: 'Cleveland Clinic',
      url: 'https://health.clevelandclinic.org/resistant-starch',
      note: 'Food sources of resistant starch, explained clinically.',
    },
    {
      title: 'Resistant Starch: Can You Make the Carbs You Eat a Little Healthier?',
      source: 'Harvard Health',
      url: 'https://www.health.harvard.edu/diet-and-nutrition/resistant-starch-can-you-make-the-carbs-you-eat-a-little-healthier',
      note: 'Background on why resistant starch matters metabolically.',
    },
    {
      title: 'Healthy Recipes',
      source: 'Fatty Liver Foundation',
      url: 'https://www.fattyliverfoundation.org/tags/healthy',
      note: 'Liver-friendly recipes from a nonprofit patient-education organization.',
    },
  ],
  workouts: [
    {
      title: "ACE's Kick Start Workout — A Week-by-Week, 3-Month Exercise Program",
      source: 'American Council on Exercise (ACE Fitness)',
      url: 'https://www.acefitness.org/resources/everyone/blog/6594/ace-s-kick-start-workout-a-week-by-week-3-month-exercise-program/',
      note: 'A structured progression — good for after the 28-day reset window, when it\'s safe to train harder.',
    },
    {
      title: '4-Week Walking and Strength-Training Workout for Beginners',
      source: 'TODAY.com',
      url: 'https://www.today.com/health/31-day-strength-training-plan-beginners-t226958',
      note: 'Beginner-friendly, mixes walking with light strength work.',
    },
    {
      title: 'Walking for Weight Loss: 8-Week Beginner Plan',
      source: 'MoveTogether.fit',
      url: 'https://movetogether.fit/resources/walking-weight-loss-beginner-guide',
      note: 'A gentle, low-impact plan — fits the light-activity guidance during the reset itself.',
    },
  ],
};

module.exports = { RESOURCE_LIBRARY };
