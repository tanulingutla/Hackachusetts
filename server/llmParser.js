// Server-side meal parsing. The LLM only extracts structure (which food, how much,
// which unit). Calories come from src/data/foodTable.js via estimateItems().
// Configure with environment variables:
//   LLM_PROVIDER=anthropic  ANTHROPIC_API_KEY=...  LLM_MODEL=<model id>
//   LLM_PROVIDER=ollama     OLLAMA_URL=http://127.0.0.1:11434  LLM_MODEL=<local model>
// With no provider set, or if the call fails, the rule-based parser is used.

import { FOOD_TABLE } from "../src/data/foodTable.js";
import { UNIT_OPTIONS, estimateItems, ruleParse } from "../src/lib/parseMeal.js";

const TIMEOUT_MS = 15000;
const MAX_TEXT_LENGTH = 500;

const FOOD_LIST = FOOD_TABLE.map((f) => `- ${f.id}: ${f.name}`).join("\n");

const SYSTEM_PROMPT = `You extract food items from a short spoken meal description.
Return ONLY a JSON object, no prose, in this shape:
{"items":[{"raw":"<the phrase>","foodId":"<id from list or null>","quantity":<number>,"unit":"<one of ${UNIT_OPTIONS.join(", ")}, or null>","vague":<true|false>}]}

Rules:
- foodId must be one of the ids below, or null if no food in the list fits.
- "spoon" or "spoons" means tbsp. Set vague to true.
- A cup, or any amount with no unit, is vague. Set vague to true.
- Use grams (unit "g") only when the speaker gives grams.
- Do not estimate calories. Do not add foods that were not said.

Known foods:
${FOOD_LIST}`;

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

// Keep only items that can be safely used. Anything else is dropped or marked unmatched.
function validateLlmItems(parsed, sourceText) {
  if (!parsed || !Array.isArray(parsed.items)) throw new Error("Model output has no items array");

  const validIds = new Set(FOOD_TABLE.map((f) => f.id));
  return parsed.items.slice(0, 20).map((item) => {
    const raw = typeof item.raw === "string" ? item.raw.slice(0, 120) : sourceText.slice(0, 120);
    const foodId = typeof item.foodId === "string" && validIds.has(item.foodId) ? item.foodId : null;
    const quantity = Number(item.quantity);
    const unit = UNIT_OPTIONS.includes(item.unit) ? item.unit : null;
    return {
      raw,
      foodId,
      quantity: Number.isFinite(quantity) && quantity > 0 && quantity <= 50 ? quantity : 1,
      unit,
      vague: item.vague === true || unit === null,
    };
  });
}

async function callAnthropic(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!apiKey || !model) throw new Error("ANTHROPIC_API_KEY and LLM_MODEL must be set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Anthropic API returned ${res.status}`);
  const data = await res.json();
  const block = data.content?.find((b) => b.type === "text");
  return extractJson(block?.text ?? "");
}

async function callOllama(text) {
  const baseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const model = process.env.LLM_MODEL;
  if (!model) throw new Error("LLM_MODEL must be set for Ollama");

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return extractJson(data.message?.content ?? "");
}

// Returns { source: "llm" | "rules", ...estimate } or throws on bad input.
export async function parseMealText(rawText) {
  if (typeof rawText !== "string" || rawText.trim() === "") {
    throw new Error("text is required");
  }
  const text = rawText.trim().slice(0, MAX_TEXT_LENGTH);

  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (provider === "anthropic" || provider === "ollama") {
    try {
      const parsed = provider === "anthropic" ? await callAnthropic(text) : await callOllama(text);
      const items = validateLlmItems(parsed, text);
      return { source: "llm", ...estimateItems(items) };
    } catch (err) {
      console.warn(`LLM parse failed, using rules: ${err.message}`);
    }
  }

  return { source: "rules", ...estimateItems(ruleParse(text)) };
}
