// src/pages/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthService } from "../api/auth";
import "./auth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const nav = useNavigate();
  const { state } = useLocation();

  async function onSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setErr("");
      await AuthService.login({ email, password, remember });

      const role = AuthService.getProfile()?.role?.toString() || "";
      if (role.toLowerCase() === "admin") {
        nav("/", { replace: true });
      } else {
        nav("/learn", { replace: true });
      }
    } catch (ex) {
      setErr(ex?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-left">
          <div className="welcome-title">Welcome back!</div>
          <div className="welcome-sub">
            You can sign in to access with your existing account.
          </div>
          <div className="decor-1" />
          <div className="decor-2" />
          <div className="decor-3" />
        </div>

        <div className="auth-right">
          <h2 className="form-title">Sign In</h2>

          {state?.msg && <div className="auth-note">{state.msg}</div>}
          {err && <div className="auth-error">{err}</div>}

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-input">
              <span className="icon" aria-hidden>👤</span>
              <input
                type="email"
                placeholder="Email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <div className="auth-row">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <button
                className="link-ghost"
                type="button"
                onClick={() => alert("Forgot password flow coming soon")}
              >
                Forgot password?
              </button>
            </div>

            <button className="auth-primary" type="submit" disabled={loading}>
              {loading ? "Signing In…" : "Sign In"}
            </button>
          </form>

          <div className="auth-foot">
            New here? <Link to="/register">Create an Account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}