import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { estimateMeal } from "../lib/mealApi.js";

const SpeechRecognitionImpl =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

const SOURCE_LABEL = {
  llm: "Estimated by LLM parser",
  rules: "Estimated by rule parser (no LLM configured on the server)",
  offline: "Estimated in the browser (parser API not reachable)",
};

// Speak or type a meal, preview the estimate, then save it. The server recomputes and
// stores the estimate on save, so the numbers in the preview are the ones kept.
export default function VoiceLogger({ date, onSaved }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slot, setSlot] = useState("lunch");
  const [saved, setSaved] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  async function runEstimate(text) {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      setResult(await estimateMeal(text));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    if (!SpeechRecognitionImpl) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setTranscript(text);
      runEstimate(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function save() {
    if (!result || !transcript.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/meals", { method: "POST", body: { date, slot, text: transcript.trim() } });
      const day = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      setSaved(`Saved to ${day}.`);
      setTranscript("");
      setResult(null);
      window.dispatchEvent(new Event("meals-changed"));
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="log-heading">
      <h2 id="log-heading">Log a meal</h2>
      <p className="muted">Speak or type a meal in plain words. Estimates are ranges, not exact counts.</p>

      <div className="row">
        <label htmlFor="slot-select">Meal</label>
        <select id="slot-select" value={slot} onChange={(e) => setSlot(e.target.value)}>
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {SpeechRecognitionImpl ? (
          <button type="button" onClick={listening ? stopListening : startListening}>
            {listening ? "Stop listening" : "Start voice"}
          </button>
        ) : (
          <span className="muted">Voice input isn't supported in this browser. Type instead.</span>
        )}
      </div>

      <label htmlFor="meal-text">Meal description</label>
      <textarea
        id="meal-text"
        rows={3}
        placeholder="e.g. 10 spoons of greek yogurt, 1 cup of oats and 1 cup of berries"
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />

      <div className="row">
        <button type="button" onClick={() => runEstimate(transcript)} disabled={!transcript.trim() || busy}>
          {busy ? "Working..." : "Estimate calories"}
        </button>
        <button type="button" onClick={save} disabled={!result || busy}>
          Save meal
        </button>
      </div>

      {error && (
        <p role="alert" className="flag">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="saved-note">
          {saved}
        </p>
      )}

      {result && (
        <div className="estimate" aria-live="polite">
          <p className="muted">{SOURCE_LABEL[result.source] ?? result.source}</p>
          <ul>
            {result.items.map((item, i) =>
              item.matched ? (
                <li key={i}>
                  {item.quantity} {item.unit} {item.food}: {item.kcal.low} to {item.kcal.high} kcal
                  {item.needsConfirm && <span className="flag"> (confirm amount)</span>}
                </li>
              ) : (
                <li key={i} className="flag">
                  "{item.raw}" not recognized, so it isn't counted.
                </li>
              )
            )}
          </ul>
          <p>
            <strong>
              Total: {result.total.low} to {result.total.high} kcal
            </strong>{" "}
            (best guess {result.total.mid})
          </p>
        </div>
      )}
    </section>
  );
}
