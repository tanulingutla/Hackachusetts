import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const CALLBACK_MESSAGES = {
  connected: "COROS is connected. Sync to pull your recent days.",
  denied: "COROS connection was cancelled.",
  error: "COROS connection failed. Try again. The connect link expires after 15 minutes.",
};

// COROS connection through its official MCP server (OAuth). Used on the COROS device page.
export default function CorosConnect() {
  const [coros, setCoros] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadStatus() {
    api("/coros/status")
      .then(setCoros)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    // Returning from COROS sign-in: show the outcome, then clean the address bar.
    const outcome = new URLSearchParams(window.location.search).get("coros");
    if (outcome && CALLBACK_MESSAGES[outcome]) setMessage(CALLBACK_MESSAGES[outcome]);
    if (outcome) window.history.replaceState({}, "", window.location.pathname);
    loadStatus();
  }, []);

  async function handleConnect() {
    setError("");
    setMessage("");
    try {
      const data = await api("/coros/connect", { method: "POST" });
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSync() {
    setError("");
    setMessage("Syncing COROS...");
    try {
      const result = await api("/coros/sync", { method: "POST" });
      setMessage(
        `Synced ${result.days} day${result.days === 1 ? "" : "s"} from COROS. Parsed sleep for ${result.parsed.sleep}, HRV for ${result.parsed.hrv}, resting HR for ${result.parsed.restingHr}.`
      );
      loadStatus();
    } catch (err) {
      setMessage("");
      setError(err.message);
    }
  }

  async function handleDisconnect() {
    setError("");
    try {
      await api("/coros", { method: "DELETE" });
      setMessage("COROS is disconnected. Your imported data stays.");
      loadStatus();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card" aria-labelledby="coros-heading">
      <h2 id="coros-heading">Connect COROS</h2>
      <p className="muted">
        Sign in to your COROS account through COROS's official server and approve access. Sync pulls recent sleep,
        HRV, and resting heart rate. Data only updates when you press sync.
      </p>

      {coros && !coros.connected && (
        <button type="button" className="cta" onClick={handleConnect}>
          Connect COROS
        </button>
      )}

      {coros?.connected && (
        <div className="row">
          <button type="button" className="cta" onClick={handleSync}>
            Sync now
          </button>
          <button type="button" className="tab" onClick={handleDisconnect}>
            Disconnect
          </button>
          <span className="muted">
            {coros.lastSyncAt ? `Last sync ${new Date(coros.lastSyncAt).toLocaleString()}` : "Not synced yet"}
          </span>
        </div>
      )}

      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="flag">
          {error}
        </p>
      )}
    </section>
  );
}
