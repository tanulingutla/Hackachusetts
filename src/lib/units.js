// US units for display and input. The server stores metric values (kg, cm); conversion happens here.
const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;
const CM_PER_IN = 2.54;

export function kgToLb(kg) {
  return kg === null || kg === undefined ? null : kg * LB_PER_KG;
}

export function lbToKg(lb) {
  return lb === null || lb === undefined || lb === "" ? null : Number(lb) * KG_PER_LB;
}

export function cmToIn(cm) {
  return cm === null || cm === undefined ? null : cm / CM_PER_IN;
}

export function inToCm(inches) {
  return inches === null || inches === undefined || inches === "" ? null : Number(inches) * CM_PER_IN;
}

// A per-kilogram value (grams, kcal) becomes per-pound. For example, 2 g/kg is about 0.9 g/lb.
export function perKgToPerLb(value) {
  return value === null || value === undefined ? null : value / LB_PER_KG;
}

// Height in feet and inches, for example "5 ft 4 in".
export function formatHeight(cm) {
  if (cm === null || cm === undefined) return "Not set";
  const totalInches = Math.round(cmToIn(cm));
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
}

export function formatWeight(kg) {
  if (kg === null || kg === undefined) return "Not set";
  return `${Math.round(kgToLb(kg))} lb`;
}

// Per-kilogram value (g/kg or kcal/kg) shown per pound, rounded to one decimal.
export function perLb(perKg) {
  if (perKg === null || perKg === undefined) return null;
  return Math.round(perKgToPerLb(perKg) * 10) / 10;
}
