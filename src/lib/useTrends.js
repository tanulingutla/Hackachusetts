import { useEffect, useState } from "react";
import { api } from "./api.js";
import { localDate } from "./dates.js";

// Loads daily records for the last `days` days ending today.
// Reloads whenever a meal is logged, changed, or deleted anywhere in the app.
export function useTrends(days) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("meals-changed", bump);
    return () => window.removeEventListener("meals-changed", bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError("");
    api(`/trends?end=${localDate()}&days=${days}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days, version]);

  return { data, error };
}
