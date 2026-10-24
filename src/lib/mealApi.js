import { ApiError, api } from "./api.js";
import { parseMeal } from "./parseMeal.js";

// Estimates a meal through the server. If the server can't be reached at all,
// falls back to the in-browser rule parser so the estimate still appears.
// Server errors (for example an expired session) are thrown, not hidden.
export async function estimateMeal(text) {
  try {
    return await api("/parse-meal", { method: "POST", body: { text } });
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    return { source: "offline", ...parseMeal(text) };
  }
}
