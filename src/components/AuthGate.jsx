import { useEffect, useState } from "react";
import App from "../App.jsx";
import AuthPage from "./AuthPage.jsx";
import Landing from "./Landing.jsx";
import ReportView from "./ReportView.jsx";
import { api } from "../lib/api.js";

// Clinician and coach reports open from a link with a ?report= token and skip sign-in.
const reportToken = new URLSearchParams(window.location.search).get("report");

// Session states: checking, home (public landing), auth (sign in or up), signedIn, unavailable.
export default function AuthGate() {
  const [status, setStatus] = useState("checking");
  const [authMode, setAuthMode] = useState("signin");
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (reportToken) return undefined;
    api("/session")
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          setStatus("signedIn");
        } else {
          setStatus("home");
        }
      })
      .catch(() => setStatus("unavailable"));

    // Any API call that gets a 401 drops the app back to the home page.
    const expire = () => {
      setUser(null);
      setStatus("home");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);

  if (reportToken) return <ReportView token={reportToken} />;

  async function handleSignOut() {
    await api("/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setStatus("home");
  }

  if (status === "checking") return <p className="center muted">Loading...</p>;

  if (status === "unavailable") {
    return (
      <main className="center">
        <p>
          Can't reach the server. Start it with <code>npm run api</code>.
        </p>
      </main>
    );
  }

  if (status === "home") {
    return (
      <Landing
        onChoose={(mode) => {
          setAuthMode(mode);
          setStatus("auth");
        }}
      />
    );
  }

  if (status === "auth") {
    return (
      <AuthPage
        key={authMode}
        initialMode={authMode}
        onBack={() => setStatus("home")}
        onSignedIn={(signedInUser) => {
          setUser(signedInUser);
          setStatus("signedIn");
        }}
      />
    );
  }

  return <App user={user} onUserChange={setUser} onSignOut={handleSignOut} />;
}
