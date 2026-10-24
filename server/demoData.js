// SYNTHETIC demo data for a new account. Every row is tagged source = "demo".
// Meal estimates use the same rule parser as the app. Values are invented for the hackathon.
import { estimateItems, ruleParse } from "../src/lib/parseMeal.js";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const DAYS = 28;

const PLAN = {
  breakfast: [
    "1 cup of oats, 1 cup of berries and 10 spoons of greek yogurt",
    "2 eggs and 1 slice of toast",
    "1 banana and 2 tbsp of peanut butter",
  ],
  lunch: [
    "1 cup of white rice, 4 oz of chicken and 1 cup of broccoli",
    "1 cup of greek yogurt and 1 cup of berries",
  ],
  dinner: [
    "4 oz of salmon, 1 medium sweet potato and 1 cup of broccoli",
    "1 cup of white rice and 4 oz of chicken",
  ],
  snack: ["1 medium banana", "1 cup of milk and 1 scoop of whey", "1 oz of almonds"],
};

const EXERCISE = [620, 0, 450, 780, 0, 540, 300, 820, 0, 600, 470, 0, 700, 520];
const RHR = [0, 1, 0, 2, 1, 0, -1, 0, 1, 2, 1, 0, 0, 1];
const HRV = [0, 4, -6, 9, -1, 2, -12, 7, -3, 4, -7, -4, 2, 0];
const SLEEP = [7.4, 6.8, 7.1, 5.9, 6.6, 7.8, 8.1, 6.2, 6.9, 7.3, 5.8, 7.0, 7.6, 6.5];

function localDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function buildDemoData() {
  const dates = Array.from({ length: DAYS }, (_, i) => localDate(DAYS - 1 - i));

  const meals = dates.flatMap((date, dayIndex) =>
    SLOTS.map((slot) => {
      const options = PLAN[slot];
      const text = options[dayIndex % options.length];
      return { date, slot, text, estimate: estimateItems(ruleParse(text)) };
    })
  );

  const wearable = dates.map((date, i) => {
    const k = i % EXERCISE.length;
    return {
      date,
      restingHr: 40 + RHR[k],
      hrvMs: 85 + HRV[k],
      hrvBaselineMid: 90,
      sleepHours: SLEEP[k],
      exerciseKcal: EXERCISE[k],
      exerciseMin: Math.round(EXERCISE[k] / 6),
    };
  });

  return { meals, wearable };
}
