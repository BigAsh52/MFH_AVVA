function computeBmi(weightLbs, heightIn) {
  if (!weightLbs || !heightIn) return null;
  return +((weightLbs / (heightIn * heightIn)) * 703).toFixed(1);
}

// Standard CDC/WHO adult BMI bands. A screening indicator, not a diagnosis —
// surface it that way in the UI.
function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy range';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

module.exports = { computeBmi, bmiCategory };
