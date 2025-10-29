// src/pages/LearnerForms.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FormService } from "../api/forms";
import { AuthService } from "../api/auth";
import "./learner.css";

export default function LearnerForms() {
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        // Only published go to learner list
        const res = await FormService.list({ status: "Published", page: 1, pageSize: 100 });
        const rows = Array.isArray(res?.items || res?.Items) ? (res.items || res.Items) : [];
        if (!alive) return;
        // normalize
        const mapped = rows.map((r) => ({
          formKey: r.formKey ?? r.FormKey ?? r.key,
          title: r.title ?? r.Title ?? "Untitled",
          description: r.description ?? r.Description ?? "",
          publishedAt: r.publishedAt ?? r.PublishedAt ?? r.updatedAt ?? r.UpdatedAt,
        }));
        setItems(mapped);
      } catch (e) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (x) =>
        x.title?.toLowerCase().includes(needle) ||
        x.description?.toLowerCase().includes(needle)
    );
  }, [items, q]);

  const logout = () => {
    AuthService.logout?.();
    nav("/login", { replace: true });
  };

  return (
    <div className="learner-shell">
      {/* Top bar */}
      <header className="lr-topbar">
        <div className="lr-left">
          <div className="lr-app">Form Builder</div>
          <div className="lr-breadcrumb">Form List</div>
        </div>
        <div className="lr-right">
          <div className="lr-search">
            <span aria-hidden>🔍</span>
            <input
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="lr-filter" type="button" title="Filter">
            Filter
          </button>
          <button className="lr-logout" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {/* Tabs row (Figma style) */}
      <nav className="lr-tabs" role="tablist" aria-label="Forms">
        <span className="lr-tab active" role="tab" aria-selected="true">Form List</span>
        <span className="lr-tab disabled" role="tab" aria-disabled="true" title="Coming soon">Mandated Forms</span>
        <Link className="lr-tab" role="tab" aria-selected="false" to="/learn/my-submissions">
          My Submission
        </Link>
      </nav>

      {/* Info banner */}
      <div className="lr-banner">
        <span className="lr-info-icon" aria-hidden>ℹ️</span>
        These forms are optional and can be submitted multiple times if needed.
      </div>

      {/* Grid of cards */}
      <section className="lr-grid">
        {loading && <div className="lr-empty">Loading…</div>}
        {!loading && err && <div className="lr-error">{err}</div>}
        {!loading && !err && filtered.length === 0 && (
          <div className="lr-empty">No forms found.</div>
        )}

        {!loading &&
          !err &&
          filtered.map((f) => (
            <article key={f.formKey} className="lr-card" aria-label={f.title}>
              <div className="lr-card-body">
                <h3 className="lr-card-title">{f.title}</h3>
                <p className="lr-card-desc">
                  {f.description || "—"}
                </p>
                <div className="lr-meta">
                  <span className="lr-meta-k">Published Date:</span>
                  <span className="lr-meta-v">
                    {f.publishedAt
                      ? new Date(f.publishedAt).toLocaleDateString()
                      : "-"}
                  </span>
                </div>
              </div>
              <div className="lr-card-cta">
                <button
                  className="lr-primary"
                  onClick={() => nav(`/forms/${encodeURIComponent(f.formKey)}`)}
                >
                  Start Submission
                </button>
              </div>
            </article>
          ))}
      </section>
    </div>
  );
}