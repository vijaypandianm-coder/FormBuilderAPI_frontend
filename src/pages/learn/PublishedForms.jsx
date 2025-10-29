// src/pages/learn/PublishedForms.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPublishedForms } from "../../api/forms";
import "./learn.css";

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function PublishedForms() {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Server should already return only Published when status=Published
        const data = await getPublishedForms();
        const items = Array.isArray(data) ? data : (data.items ?? data.Items ?? []);
        // extra guard: keep only Published
        const published = (items || []).filter(
          (f) => (f.status || f.Status || "").toLowerCase() === "published"
        );
        if (mounted) setForms(published);
      } catch (e) {
        setError(e.message || "Failed to load forms");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return forms;
    return forms.filter((f) => {
      const title = (f.title || f.Title || "").toLowerCase();
      const desc  = (f.description || f.Description || "").toLowerCase();
      return title.includes(term) || desc.includes(term);
    });
  }, [q, forms]);

  return (
    <div className="page">
      {/* breadcrumb/header area */}
      <div className="topbar">
        <div className="crumbs">
          <span className="crumb">Action Center</span>
          <span className="crumb-sep">›</span>
          <span className="crumb is-last">Forms</span>
        </div>
        <h1 className="page-title">Available Training Request</h1>
      </div>

      {/* tabs */}
      <div className="tabs">
        <button className="tab active">Form List</button>
        <button className="tab" disabled>Mandated Forms</button>
        <button className="tab" onClick={() => nav("/learn/my-submissions")}>My Submission</button>
      </div>

      {/* banner + search */}
      <div className="toolbar">
        <div className="note">
          <span className="note-dot" aria-hidden>ℹ️</span>
          <span>These forms are optional and can be submitted multiple times if needed.</span>
        </div>
        <div className="search">
          <input
            className="search-input"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="page">Loading…</div>}
      {error && <div className="page error">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty">No published forms found.</div>
      )}

      <div className="grid">
        {filtered.map((f) => {
          const key  = f.formKey ?? f.FormKey;
          const title = f.title ?? f.Title ?? "Untitled";
          const desc  = f.description ?? f.Description ?? "";
          const publishedAt = f.publishedAt ?? f.PublishedAt ?? f.updatedAt ?? f.UpdatedAt;

          return (
            <div key={key} className="card card--form">
              <div className="card-body">
                <div className="card-title">{title}</div>
                {desc ? <div className="card-desc">{desc}</div> : null}
                <div className="meta">
                  <span className="meta-label">Published</span>
                  <span className="meta-value">{fmtDate(publishedAt)}</span>
                </div>
              </div>

              <div className="card-footer">
                <button className="btn primary w100" onClick={() => nav(`/learn/forms/${key}`)}>
                  Start Submission
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}