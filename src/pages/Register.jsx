// src/pages/Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthService } from "../api/auth";
import "./auth.css";

export default function Register() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (pw !== pw2) {
      setErr("Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      setErr("");
      await AuthService.register({ name, email, password: pw });
      // either autologin (if token returned) or redirect to login with message
      if (AuthService.getToken?.()) {
        // decide path by role
        const role = AuthService.getProfile()?.role?.toString() || "";
        if (role.toLowerCase() === "admin") nav("/", { replace: true });
        else nav("/learn", { replace: true });
      } else {
        nav("/login", { replace: true, state: { msg: "Account created. Please sign in." } });
      }
    } catch (ex) {
      setErr(ex?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-left">
          <div className="welcome-title">Create your account</div>
          <div className="welcome-sub">It takes less than a minute.</div>
          <div className="decor-1" />
          <div className="decor-2" />
          <div className="decor-3" />
        </div>

        <div className="auth-right">
          <h2 className="form-title">Sign Up</h2>

          {err && <div className="auth-error">{err}</div>}

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-input">
              <span className="icon" aria-hidden>🧑</span>
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="auth-input">
              <span className="icon" aria-hidden>✉️</span>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-input">
              <span className="icon" aria-hidden>🔒</span>
              <input
                type="password"
                placeholder="Password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                minLength={6}
              />
            </label>

            <label className="auth-input">
              <span className="icon" aria-hidden>🔒</span>
              <input
                type="password"
                placeholder="Confirm password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required
                minLength={6}
              />
            </label>

            <button className="auth-primary" type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Account"}
            </button>
          </form>

          <div className="auth-foot">
            Already have an account? <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}