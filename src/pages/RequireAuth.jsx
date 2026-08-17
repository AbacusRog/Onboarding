import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setSigningIn(false);
  }

  if (session === undefined) {
    return <div className="page">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="page">
        <form className="card card--narrow" onSubmit={handleLogin}>
          <img src="/logo.jpg" alt="Abacus Accountants" className="firm-logo" />
          <h1>Sign in</h1>
          <p className="intro">Sign in with your Supabase account to view submissions.</p>
          <div className="field">
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="field-error field-error--form">{error}</p>}
          <button type="submit" className="submit-button" disabled={signingIn}>
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return children;
}
