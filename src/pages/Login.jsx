// src/pages/Login.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthService } from "../api/auth";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await AuthService.login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (ex) {
      setErr(ex?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-root">
      <form className="login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        {err ? <div className="login-err">{err}</div> : null}

        <label className="login-label">Email</label>
        <input
          className="login-input"
          type="email"
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />

        <label className="login-label">Password</label>
        <input
          className="login-input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="login-btn" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}