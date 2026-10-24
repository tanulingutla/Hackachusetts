import { FOOD_TABLE } from "../data/foodTable.js";

// Meal parsing in two steps:
//   1. ruleParse(text) turns free text into structured items (food id, quantity, unit).
//   2. estimateItems(items) looks up kcal in FOOD_TABLE and returns low / mid / high ranges.
// An LLM can replace step 1 (see server/llmParser.js). Step 2 always uses the table,
// so the calorie numbers stay auditable.

export const UNIT_OPTIONS = ["cup", "tbsp", "tsp", "g", "oz", "slice", "scoop", "medium", "egg"];

const NUMBER_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
};

// Spoken or written unit -> canonical unit used in FOOD_TABLE.
const UNIT_WORDS = {
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  spoon: "tbsp",
  spoons: "tbsp",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  g: "g",
  gram: "g",
  grams: "g",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  slice: "slice",
  slices: "slice",
  scoop: "scoop",
  scoops: "scoop",
  medium: "medium",
};

// Units people say loosely. Estimates for these get a wider range.
const VAGUE_UNIT_WORDS = new Set(["cup", "cups", "spoon", "spoons"]);

const RANGE_PRECISE = 0.05;
const RANGE_VAGUE = 0.2;

const SEGMENT_SPLIT = /,|\s+and\s+|\s+with\s+|\s+plus\s+/;

const SEGMENT_PATTERN = new RegExp(
  "^(?:(\\d+(?:\\.\\d+)?|" +
    Object.keys(NUMBER_WORDS).join("|") +
    ")\\s+)?" +
    "(?:(" +
    Object.keys(UNIT_WORDS).join("|") +
    ")\\s+)?" +
    "(?:of\\s+)?(.*)$"
);

function findFood(text) {
  let best = null;
  let bestLength = 0;
  for (const food of FOOD_TABLE) {
    for (const alias of food.aliases) {
      if (alias.length > bestLength && new RegExp(`\\b${alias}\\b`).test(text)) {
        best = food;
        bestLength = alias.length;
      }
    }
  }
  return best;
}

function parseSegment(raw) {
  const text = raw.trim();
  if (!text) return null;

  const match = text.match(SEGMENT_PATTERN);
  const qtyWord = match[1];
  const unitWord = match[2];
  const rest = match[3].trim();

  const food = findFood(rest);
  const quantity = qtyWord ? NUMBER_WORDS[qtyWord] ?? parseFloat(qtyWord) : 1;

  return {
    raw: text,
    foodId: food ? food.id : null,
    quantity,
    unit: unitWord ? UNIT_WORDS[unitWord] : null,
    vague: !unitWord || VAGUE_UNIT_WORDS.has(unitWord),
  };
}

// Step 1 (rules): free text -> items.
export function ruleParse(text) {
  return text
    .toLowerCase()
    .split(SEGMENT_SPLIT)
    .map(parseSegment)
    .filter(Boolean);
}

function roundRange(range) {
  return {
    low: Math.round(range.low),
    mid: Math.round(range.mid),
    high: Math.round(range.high),
  };
}

// Step 2: structured items -> kcal estimates. Works the same for rule and LLM output.
// Each input item: { raw, foodId | null, quantity, unit | null, vague }.
export function estimateItems(items) {
  const results = items.map((item) => {
    const food = FOOD_TABLE.find((f) => f.id === item.foodId);
    if (!food) {
      return {
        raw: item.raw,
        matched: false,
        kcal: { low: 0, mid: 0, high: 0 },
        note: "Food not in the reference table. Confirm or add it.",
      };
    }

    const quantity = item.quantity > 0 ? item.quantity : 1;
    const requestedUnit = item.unit;
    let unit = requestedUnit ?? food.defaultUnit;
    let grams;
    let note = null;

    if (requestedUnit === "g") {
      grams = quantity;
    } else if (food.units[unit] !== undefined) {
      grams = quantity * food.units[unit];
    } else {
      // Unit not defined for this food. Fall back to the food's default portion.
      note = `No ${requestedUnit} conversion for ${food.name}. Used ${food.defaultUnit}.`;
      unit = food.defaultUnit;
      grams = quantity * food.units[unit];
    }

    const midKcal = (grams / 100) * food.kcalPer100g;
    const pct = item.vague || requestedUnit === null ? RANGE_VAGUE : RANGE_PRECISE;

    return {
      raw: item.raw,
      matched: true,
      foodId: food.id,
      food: food.name,
      quantity,
      unit,
      grams: Math.round(grams),
      needsConfirm: item.vague || requestedUnit === null || Boolean(note),
      note,
      kcal: roundRange({
        low: midKcal * (1 - pct),
        mid: midKcal,
        high: midKcal * (1 + pct),
      }),
    };
  });

  const matched = results.filter((r) => r.matched);
  const total = roundRange(
    matched.reduce(
      (sum, r) => ({
        low: sum.low + r.kcal.low,
        mid: sum.mid + r.kcal.mid,
        high: sum.high + r.kcal.high,
      }),
      { low: 0, mid: 0, high: 0 }
    )
  );

  return {
    items: results,
    total,
    unmatched: results.filter((r) => !r.matched).map((r) => r.raw),
    needsConfirm: matched.some((r) => r.needsConfirm),
  };
}

// Rules only, end to end. Used by the offline fallback in the browser.
export function parseMeal(text) {
  return estimateItems(ruleParse(text));
}
