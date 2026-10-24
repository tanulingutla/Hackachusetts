import { useState } from "react";
import { api } from "../lib/api.js";
import { GENDER_OPTIONS } from "../lib/options.js";

// Sign in, or create an account. Accounts are personal. Nobody else can see your data.
export default function AuthPage({ initialMode = "signin", onSignedIn, onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = isSignup
        ? { name, email, gender, age: Number(age), password }
        : { email, password };
      const data = await api(isSignup ? "/signup" : "/login", { method: "POST", body });
      setPassword("");
      onSignedIn(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <p className="brand">why tho</p>
      <h1>{isSignup ? "Create your account" : "Sign in"}</h1>
      <p className="lead">
        {isSignup
          ? "Use a passphrase of at least 12 characters. Your data is visible only to you."
          : "Your meals, wearable data, and cycle log are visible only to you."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isSignup && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {isSignup && (
          <>
            <div className="field">
              <label htmlFor="gender">Gender</label>
              <select id="gender" name="gender" required value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="" disabled>
                  Choose one
                </option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="age">Age</label>
              <input id="age" name="age" type="number" inputMode="numeric" min={13} max={100} required value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 12 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="cta" disabled={busy}>
          {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
        </button>

        {error && (
          <p role="alert" className="flag">
            {error}
          </p>
        )}
      </form>

      <div className="auth-switch">
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(isSignup ? "signin" : "signup");
            setError("");
          }}
        >
          {isSignup ? "I already have an account" : "Create an account"}
        </button>
        {onBack && (
          <button type="button" className="link-button" onClick={onBack}>
            Back to home
          </button>
        )}
      </div>
    </main>
  );
}
