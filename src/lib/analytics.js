// Shared calculations for the dashboard, the trends view, and the clinician report.
// Pure functions only, so the same code runs in the browser and on the server.
//
// Day record shape used throughout:
// {
//   date: "YYYY-MM-DD",
//   intake: { low, mid, high } | null,   // null when no meals were logged that day
//   exerciseKcal: number | null,
//   restingHr: number | null,
//   hrvMs: number | null,
//   hrvBaselineMid: number | null,
//   sleepHours: number | null,
// }

import { energyAvailability } from "./energy.js";

// Intake target uses 45 kcal/kg fat-free mass, a commonly used energy availability goal.
// It is a planning number, not a clinical prescription.
export const EA_TARGET = 45;
export const EA_LOW = 30;

const RHR_RISE_BPM = 3;
const HRV_DROP_FRACTION = 0.1;
const SLEEP_DROP_HOURS = 0.5;
const MIN_LOGGED_DAYS_PER_WEEK = 5;

// Daily intake target. Prefers fat-free mass, then measured RMR, otherwise null.
export function dayTarget({ ffmKg, rmrKcal, exerciseKcal }) {
  const exercise = exerciseKcal ?? 0;
  if (ffmKg) {
    return {
      kcal: Math.round(EA_TARGET * ffmKg + exercise),
      method: `${EA_TARGET} kcal/kg fat-free mass plus exercise`,
    };
  }
  if (rmrKcal) {
    return { kcal: Math.round(rmrKcal + exercise), method: "measured RMR plus exercise" };
  }
  return null;
}

function mean(values) {
  const present = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

// Adds an energy availability value to each day that has both intake and body composition.
export function withEnergyAvailability(days, ffmKg) {
  return days.map((d) => ({
    ...d,
    energyAvailability:
      d.intake && ffmKg
        ? energyAvailability({
            intakeKcal: d.intake.mid,
            exerciseKcal: d.exerciseKcal ?? 0,
            ffmKg,
          })
        : null,
  }));
}

function summarizeWeek(days, ffmKg) {
  const logged = days.filter((d) => d.intake);
  return {
    loggedDays: logged.length,
    energyAvailability: ffmKg ? mean(logged.map((d) => d.energyAvailability)) : null,
    restingHr: mean(days.map((d) => d.restingHr)),
    hrvMs: mean(days.map((d) => d.hrvMs)),
    sleepHours: mean(days.map((d) => d.sleepHours)),
  };
}

// Weekly underfueling check. Compares the most recent 7 days with the 7 days before.
// One bad day never triggers a flag. Output is a review prompt for a clinician.
export function underfuelingCheck(days, ffmKg) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 14) {
    return { status: "insufficient", reason: "Need 14 days of data for a weekly comparison." };
  }

  const withEa = withEnergyAvailability(sorted.slice(-14), ffmKg);
  const previous = summarizeWeek(withEa.slice(0, 7), ffmKg);
  const current = summarizeWeek(withEa.slice(7), ffmKg);

  if (previous.loggedDays < MIN_LOGGED_DAYS_PER_WEEK || current.loggedDays < MIN_LOGGED_DAYS_PER_WEEK) {
    return {
      status: "insufficient",
      reason: `Log meals on at least ${MIN_LOGGED_DAYS_PER_WEEK} days in each week to assess fueling.`,
      weeks: { previous, current },
    };
  }

  const signals = [];
  if (current.restingHr !== null && previous.restingHr !== null &&
      current.restingHr - previous.restingHr >= RHR_RISE_BPM) {
    signals.push("resting heart rate rising");
  }
  if (current.hrvMs !== null && previous.hrvMs !== null &&
      current.hrvMs < previous.hrvMs * (1 - HRV_DROP_FRACTION)) {
    signals.push("HRV falling");
  }
  if (current.sleepHours !== null && previous.sleepHours !== null &&
      previous.sleepHours - current.sleepHours >= SLEEP_DROP_HOURS) {
    signals.push("sleep shortening");
  }

  if (!ffmKg) {
    return {
      status: "unavailable",
      reason: "Energy availability needs fat-free mass from a body composition scan.",
      signals,
      weeks: { previous, current },
    };
  }

  const lowBoth =
    previous.energyAvailability !== null &&
    current.energyAvailability !== null &&
    previous.energyAvailability < EA_LOW &&
    current.energyAvailability < EA_LOW;

  let status = "ok";
  let reason = "Fueling and recovery trends look stable this week.";
  if (lowBoth && signals.length >= 2) {
    status = "flagged";
    reason = `Energy availability was below ${EA_LOW} kcal/kg in both weeks, with ${signals.join(" and ")}. Flag for clinician review.`;
  } else if (current.energyAvailability !== null && current.energyAvailability < EA_LOW) {
    status = "watch";
    reason = `Energy availability is below ${EA_LOW} kcal/kg this week. Keep watching the trend.`;
  }

  return { status, reason, signals, weeks: { previous, current } };
}

// Simple 4-week rollup used by the trends view.
export function weeklyRollup(days, ffmKg) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const withEa = withEnergyAvailability(sorted, ffmKg);
  const weeks = [];
  for (let end = withEa.length; end > 0; end -= 7) {
    const slice = withEa.slice(Math.max(0, end - 7), end);
    weeks.unshift({ weekEnding: slice[slice.length - 1].date, ...summarizeWeek(slice, ffmKg) });
  }
  return weeks;
}

// ---- Protein and the thermic effect of food ----
// Digesting protein costs energy. About a quarter of protein's calories are used up in digestion.
// Sleep isn't added here: resting metabolic rate is measured at rest, and sleep burns a little less than that.
export const PROTEIN_TEF = 0.25;

// Grams of protein per 100 g, for the foods in FOOD_TABLE. Approximate demo values.
export const PROTEIN_PER_100G = {
  greek_yogurt_nonfat: 10,
  rolled_oats: 13,
  mixed_berries: 0.7,
  milk_2pct: 3.4,
  banana: 1.1,
  egg: 12.6,
  chicken_breast: 31,
  salmon: 25,
  white_rice: 2.7,
  peanut_butter: 25,
  whole_wheat_bread: 13,
  whey_protein: 80,
  olive_oil: 0,
  almonds: 21,
  broccoli_cooked: 2.8,
  sweet_potato: 2,
  potato: 1.9,
  pretzels: 9.5,
};

// Protein grams in a meal estimate's matched items.
export function proteinGrams(items) {
  return (items ?? []).reduce((sum, item) => {
    if (!item.matched || item.grams === undefined) return sum;
    return sum + (item.grams / 100) * (PROTEIN_PER_100G[item.foodId] ?? 0);
  }, 0);
}

// Energy spent digesting this much protein, in kcal.
export function proteinTefKcal(proteinG) {
  return Math.round(proteinG * 4 * PROTEIN_TEF);
}

// ---- Macronutrients (carbohydrate, fat, fiber) per 100 g. Approximate demo values. ----
export const CARB_PER_100G = {
  greek_yogurt_nonfat: 3.6,
  rolled_oats: 66,
  mixed_berries: 12,
  milk_2pct: 4.8,
  banana: 23,
  egg: 0.7,
  chicken_breast: 0,
  salmon: 0,
  white_rice: 28,
  peanut_butter: 20,
  whole_wheat_bread: 41,
  whey_protein: 8,
  olive_oil: 0,
  almonds: 22,
  broccoli_cooked: 7,
  sweet_potato: 20,
  potato: 17,
  pretzels: 79,
};

export const FAT_PER_100G = {
  greek_yogurt_nonfat: 0.4,
  rolled_oats: 7,
  mixed_berries: 0.3,
  milk_2pct: 2,
  banana: 0.3,
  egg: 9.5,
  chicken_breast: 3.6,
  salmon: 13,
  white_rice: 0.3,
  peanut_butter: 50,
  whole_wheat_bread: 3.4,
  whey_protein: 5,
  olive_oil: 100,
  almonds: 50,
  broccoli_cooked: 0.4,
  sweet_potato: 0.2,
  potato: 0.1,
  pretzels: 3.3,
};

export const FIBER_PER_100G = {
  greek_yogurt_nonfat: 0,
  rolled_oats: 10,
  mixed_berries: 2.4,
  milk_2pct: 0,
  banana: 2.6,
  egg: 0,
  chicken_breast: 0,
  salmon: 0,
  white_rice: 0.4,
  peanut_butter: 6,
  whole_wheat_bread: 7,
  whey_protein: 0,
  olive_oil: 0,
  almonds: 12,
  broccoli_cooked: 3.3,
  sweet_potato: 3,
  potato: 1.8,
  pretzels: 3,
};

// Protein, carbohydrate, fat, and fiber (grams) for a meal estimate's matched items.
export function macrosOf(items) {
  const totals = { proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  for (const item of items ?? []) {
    if (!item.matched || item.grams === undefined) continue;
    const f = item.grams / 100;
    totals.proteinG += f * (PROTEIN_PER_100G[item.foodId] ?? 0);
    totals.carbsG += f * (CARB_PER_100G[item.foodId] ?? 0);
    totals.fatG += f * (FAT_PER_100G[item.foodId] ?? 0);
    totals.fiberG += f * (FIBER_PER_100G[item.foodId] ?? 0);
  }
  return {
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
    fiberG: Math.round(totals.fiberG),
  };
}

// Carbohydrate guidance in grams per kg body weight, by how much the athlete trained that day.
// Rough training guidance for endurance athletes, not a prescription.
export function carbTargetGPerKg(exerciseMin) {
  if (!exerciseMin || exerciseMin <= 0) return 3;
  if (exerciseMin <= 60) return 5;
  return 6;
}

// Carbs against guidance. Under 80% of the target is flagged as low.
export function carbStatus(gramsPerKgActual, targetGPerKg) {
  if (gramsPerKgActual === null || targetGPerKg === null) return "unknown";
  return gramsPerKgActual < targetGPerKg * 0.8 ? "low" : "adequate";
}

// ---- Sodium and the fueling rules ----
// Sodium in mg per 100 g. Approximate demo values.
export const SODIUM_PER_100G = {
  greek_yogurt_nonfat: 36,
  rolled_oats: 2,
  mixed_berries: 1,
  milk_2pct: 44,
  banana: 1,
  egg: 124,
  chicken_breast: 74,
  salmon: 59,
  white_rice: 1,
  peanut_butter: 430,
  whole_wheat_bread: 491,
  whey_protein: 150,
  olive_oil: 2,
  almonds: 1,
  broccoli_cooked: 33,
  sweet_potato: 55,
  potato: 6,
  pretzels: 1100,
};

export const FUELING_RULES = {
  energyAvailabilityLow: 30, // kcal per kg fat-free mass per day
  energyGapFraction: 0.1, // intake more than 10% below expenditure
  carbFraction: 0.8, // carbs below 80% of training guidance
  proteinGPerKgLow: 1.2, // grams per kg per day
  sodiumMgLow: 1500, // mg per day
  trainingDaysForCarbSodium: 3, // carb and sodium checks apply in weeks with at least this many training days
  minLoggedDays: 5, // of 7
};

// All nutrients for a meal estimate, including sodium.
export function nutrientsOf(items) {
  const totals = { proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 };
  for (const item of items ?? []) {
    if (!item.matched || item.grams === undefined) continue;
    const f = item.grams / 100;
    totals.proteinG += f * (PROTEIN_PER_100G[item.foodId] ?? 0);
    totals.carbsG += f * (CARB_PER_100G[item.foodId] ?? 0);
    totals.fatG += f * (FAT_PER_100G[item.foodId] ?? 0);
    totals.fiberG += f * (FIBER_PER_100G[item.foodId] ?? 0);
    totals.sodiumMg += f * (SODIUM_PER_100G[item.foodId] ?? 0);
  }
  return {
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
    fiberG: Math.round(totals.fiberG),
    sodiumMg: Math.round(totals.sodiumMg),
  };
}

function average(values) {
  const present = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

// One 7-day window. Averages are per day, over the logged days for intake and nutrients,
// and over all days for training and expenditure.
// Day record fields used: intake, exerciseKcal, exerciseMin, proteinG, carbsG, sodiumMg.
export function windowFueling(days, { rmrKcal, ffmKg, weightKg }) {
  const logged = days.filter((d) => d.intake);
  if (logged.length < FUELING_RULES.minLoggedDays) {
    return { insufficient: true, loggedDays: logged.length, flags: [] };
  }

  const trainingDays = days.filter((d) => (d.exerciseMin ?? 0) > 0).length;
  const exerciseMean = average(days.map((d) => d.exerciseKcal ?? 0));
  const eatenMean = average(logged.map((d) => d.intake.mid));
  const proteinMean = average(logged.map((d) => d.proteinG ?? 0));
  const expendedMean =
    rmrKcal !== null && rmrKcal !== undefined
      ? rmrKcal + exerciseMean + proteinTefKcal(proteinMean)
      : null;
  const gapPerDay = expendedMean === null ? null : expendedMean - eatenMean;
  const energyAvailability =
    ffmKg && rmrKcal !== null
      ? average(logged.map((d) => (d.intake.mid - (d.exerciseKcal ?? 0)) / ffmKg))
      : null;

  const carbsPerKg = weightKg ? average(logged.map((d) => (d.carbsG ?? 0) / weightKg)) : null;
  const carbTarget = weightKg ? average(days.map((d) => carbTargetGPerKg(d.exerciseMin ?? 0))) : null;
  const proteinPerKg = weightKg ? proteinMean / weightKg : null;
  const sodiumMean = average(logged.map((d) => d.sodiumMg ?? 0));

  const flags = [];
  if (energyAvailability !== null) {
    if (energyAvailability < FUELING_RULES.energyAvailabilityLow) {
      flags.push({
        key: "energy",
        label: "Energy availability low",
        detail: `${(energyAvailability / 2.20462).toFixed(1)} kcal/lb fat-free mass a day (below ${(FUELING_RULES.energyAvailabilityLow / 2.20462).toFixed(1)})`,
      });
    }
  } else if (gapPerDay !== null && gapPerDay > FUELING_RULES.energyGapFraction * expendedMean) {
    flags.push({
      key: "energy",
      label: "Eating below need",
      detail: `about ${Math.round(gapPerDay)} kcal a day under expenditure`,
    });
  }

  if (trainingDays >= FUELING_RULES.trainingDaysForCarbSodium && carbsPerKg !== null) {
    if (carbsPerKg < FUELING_RULES.carbFraction * carbTarget) {
      flags.push({
        key: "carbs",
        label: "Carbohydrate low for training",
        detail: `${(carbsPerKg / 2.20462).toFixed(1)} g/lb a day against about ${(carbTarget / 2.20462).toFixed(1)} g/lb`,
      });
    }
  }

  if (proteinPerKg !== null && proteinPerKg < FUELING_RULES.proteinGPerKgLow) {
    flags.push({
      key: "protein",
      label: "Protein low",
      detail: `${(proteinPerKg / 2.20462).toFixed(1)} g/lb a day (below ${(FUELING_RULES.proteinGPerKgLow / 2.20462).toFixed(1)})`,
    });
  }

  if (trainingDays >= FUELING_RULES.trainingDaysForCarbSodium && sodiumMean !== null) {
    if (sodiumMean < FUELING_RULES.sodiumMgLow) {
      flags.push({
        key: "sodium",
        label: "Sodium low for training",
        detail: `about ${Math.round(sodiumMean)} mg a day (below ${FUELING_RULES.sodiumMgLow})`,
      });
    }
  }

  return {
    insufficient: false,
    loggedDays: logged.length,
    trainingDays,
    eatenPerDay: Math.round(eatenMean),
    expendedPerDay: expendedMean === null ? null : Math.round(expendedMean),
    gapPerDay: gapPerDay === null ? null : Math.round(gapPerDay),
    weeklyGap: gapPerDay === null ? null : Math.round(gapPerDay * 7),
    energyAvailability: energyAvailability === null ? null : Math.round(energyAvailability * 10) / 10,
    carbsPerKg: carbsPerKg === null ? null : Math.round(carbsPerKg * 10) / 10,
    carbTargetPerKg: carbTarget === null ? null : Math.round(carbTarget * 10) / 10,
    proteinPerKg: proteinPerKg === null ? null : Math.round(proteinPerKg * 10) / 10,
    sodiumPerDay: sodiumMean === null ? null : Math.round(sodiumMean),
    flags,
    underfueled: flags.length > 0,
  };
}

// Current 7 days, and the 7 before. Underfueling is judged over the window, never a single day.
export function fuelingReport(records, profile) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const current = windowFueling(sorted.slice(-7), profile);
  const previous = sorted.length >= 14 ? windowFueling(sorted.slice(-14, -7), profile) : null;

  let status = "insufficient";
  let reason = "Log meals on at least 5 of the last 7 days to check fueling.";
  if (!current.insufficient) {
    if (current.underfueled) {
      const persistent = previous && !previous.insufficient && previous.underfueled;
      status = persistent ? "persistent" : "underfueled";
      reason = persistent
        ? "Underfueled for two weeks in a row. Share the report with a sports dietitian or doctor."
        : "Underfueled this week: " + current.flags.map((f) => f.label.toLowerCase()).join(", ") + ".";
    } else {
      status = "ok";
      reason = "This week's intake covers training and recovery.";
    }
  }
  return { status, reason, current, previous };
}

// ---- Overall assessment: underfueling, overtraining, or normal ----
// Compares the latest 7 days with the 7 before. Underfueling is checked first, from the fueling rules.
// Overtraining needs two or more load and recovery signals while fueling is adequate.
export const OVERTRAINING_RULES = {
  restingHrRise: 3, // bpm
  hrvDropFraction: 0.1,
  exerciseRiseFraction: 0.25,
  acwrHigh: 1.5,
  sleepDropHours: 0.5,
  signalsNeeded: 2,
};

export function loadAssessment(records, profile) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const fueling = fuelingReport(sorted, profile);
  const cur = sorted.slice(-7);
  // Recovery and load are compared with the three weeks before the latest week (a steadier baseline than one week).
  const prev = sorted.slice(-28, -7);

  const weekly = (rows) => ({
    restingHr: average(rows.map((r) => r.restingHr)),
    hrvMs: average(rows.map((r) => r.hrvMs)),
    sleepHours: average(rows.map((r) => r.sleepHours)),
    exerciseKcal: average(rows.map((r) => r.exerciseKcal ?? 0)),
    loggedDays: rows.filter((r) => r.intake).length,
  });
  const current = weekly(cur);
  const previous = weekly(prev);

  // Latest training load ratio, from the most recent day that has both loads.
  const latestLoad = [...sorted].reverse().find((r) => r.acuteLoad && r.chronicLoad);
  const acwr = latestLoad ? latestLoad.acuteLoad / latestLoad.chronicLoad : null;

  const signals = [];
  if (current.restingHr !== null && previous.restingHr !== null &&
      current.restingHr - previous.restingHr >= OVERTRAINING_RULES.restingHrRise) {
    signals.push(`resting heart rate up ${Math.round(current.restingHr - previous.restingHr)} bpm`);
  }
  if (current.hrvMs !== null && previous.hrvMs !== null &&
      current.hrvMs < previous.hrvMs * (1 - OVERTRAINING_RULES.hrvDropFraction)) {
    signals.push(`HRV down ${Math.round((1 - current.hrvMs / previous.hrvMs) * 100)}%`);
  }
  if (previous.exerciseKcal > 0 && current.exerciseKcal > previous.exerciseKcal * (1 + OVERTRAINING_RULES.exerciseRiseFraction)) {
    signals.push(`training energy up ${Math.round((current.exerciseKcal / previous.exerciseKcal - 1) * 100)}%`);
  }
  if (acwr !== null && acwr >= OVERTRAINING_RULES.acwrHigh) {
    signals.push(`training load ratio ${acwr.toFixed(2)}`);
  }
  if (current.sleepHours !== null && previous.sleepHours !== null &&
      previous.sleepHours - current.sleepHours >= OVERTRAINING_RULES.sleepDropHours) {
    signals.push("sleep shorter");
  }

  let state;
  let label;
  let summary;
  const reasons = [];
  if (fueling.status === "insufficient") {
    state = "insufficient";
    label = "Not enough data";
    summary = "Log meals on at least 5 of the last 7 days, and sync or import recovery data, to see this week's status.";
  } else if (fueling.current.underfueled) {
    state = "underfueling";
    label = "Underfueling";
    summary = fueling.reason;
    reasons.push(...fueling.current.flags.map((f) => `${f.label}: ${f.detail}`));
    if (signals.length >= OVERTRAINING_RULES.signalsNeeded) {
      reasons.push(`Training load signals too: ${signals.join(", ")}`);
    }
  } else if (signals.length >= OVERTRAINING_RULES.signalsNeeded) {
    state = "overtraining";
    label = "Overtraining";
    summary = "Fueling covers training, but recovery is slipping as load rises. Consider a lighter week and more rest.";
    reasons.push(...signals.map((s) => s.charAt(0).toUpperCase() + s.slice(1)));
  } else {
    state = "normal";
    label = "Normal";
    summary = "Fueling covers training, and recovery is in its usual range.";
    if (signals.length > 0) reasons.push(`Watch: ${signals.join(", ")}`);
  }

  return { state, label, summary, reasons, signals, current, previous };
}
