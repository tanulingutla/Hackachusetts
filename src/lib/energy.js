// Energy availability (EA) = (energy intake - exercise energy) / fat-free mass.
// Sustained values below about 30 kcal/kg FFM/day are a common low-EA flag.
// Needs fat-free mass, so it returns null when body composition isn't available.

export const LOW_EA_THRESHOLD = 30;

export function energyAvailability({ intakeKcal, exerciseKcal, ffmKg }) {
  if (!ffmKg) return null;
  return Math.round(((intakeKcal - exerciseKcal) / ffmKg) * 10) / 10;
}
