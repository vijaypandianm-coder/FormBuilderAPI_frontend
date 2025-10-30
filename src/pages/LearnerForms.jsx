// src/pages/LearnerForms.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FormService } from "../api/forms";
import { AuthService } from "../api/auth";
import "./learner.css";

function norm(form) {
  const status = (form?.status ?? form?.Status ?? "").toString();
  return {
    formKey: form?.formKey ?? form?.FormKey ?? form?.key ?? form?.Key ?? null,
    title: form?.title ?? form?.Title ?? "Untitled",
    description: form?.description ?? form?.Description ?? "",
    status,
    publishedAt:
      form?.publishedAt ??
      form?.PublishedAt ??
      form?.updatedAt ??
      form?.UpdatedAt ??
      form?.createdAt ??
      form?.CreatedAt ??
      null,
  };
}

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
        const res = await FormService.list({ status: "Published", page: 1, pageSize: 100 });
        const raw =
          (res && (res.items || res.Items)) ??
          (Array.isArray(res) ? res : []) ?? [];
        const normalized = raw.map(norm).filter((f) => {
          if (!f.formKey) return false;
          return !f.status || f.status.toLowerCase() === "published";
        });
        normalized.sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return String(a.title).localeCompare(String(b.title));
        });
        if (alive) setItems(normalized);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (x) =>
        (x.title || "").toLowerCase().includes(needle) ||
        (x.description || "").toLowerCase().includes(needle) ||
        String(x.formKey || "").includes(needle)
    );
  }, [items, q]);

  const openForm = (key) => {
    if (!key) return;
    nav(`/forms/${encodeURIComponent(key)}`);
  };

  return (
    <div className="learner-shell">
      {/* ⬇️ No top header here (removed as requested) */}

      {/* Tabs row */}
      <nav className="lr-tabs" role="tablist" aria-label="Forms">
        <span className="lr-tab active" role="tab" aria-selected="true">
          Self-Service Forms
        </span>
        <span className="lr-tab disabled" role="tab" aria-disabled="true" title="Coming soon">
          Mandated Forms
        </span>
        <Link className="lr-tab" role="tab" aria-selected="false" to="/learn/my-submissions">
          My Submission
        </Link>
      </nav>

      {/* Toolbar row: banner (left) + search/filter (right) */}
      <div className="lr-toolbar">
        <div className="lr-banner">
          <span className="lr-info-icon" aria-hidden>ℹ️</span>
          These forms are optional and can be submitted multiple times if needed.
        </div>
        <div className="lr-tools">
          <div className="lr-search">
            <span aria-hidden>🔍</span>
            <input
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="lr-filter" type="button" title="Filter">Filter</button>
        </div>
      </div>

      {/* Cards grid */}
      <section className="lr-grid">
        {loading && (
          <>
            <div className="lr-card lr-skel" />
            <div className="lr-card lr-skel" />
            <div className="lr-card lr-skel" />
          </>
        )}

        {!loading && err && <div className="lr-error">{err}</div>}

        {!loading && !err && filtered.length === 0 && (
          <div className="lr-empty">No forms found.</div>
        )}

        {!loading && !err && filtered.map((f) => (
          <article key={f.formKey} className="lr-card" aria-label={f.title}>
            <div className="lr-card-body">
              <h3 className="lr-card-title">{f.title}</h3>

              {/* 2-line clamp; uniform block height */}
              <p className="lr-card-desc">{f.description || "—"}</p>

              <div className="lr-meta-row">
                <span className="lr-meta-k">Due Date:</span>
                <span className="lr-meta-v">
                  {f.publishedAt ? new Date(f.publishedAt).toLocaleDateString() : "—"}
                </span>
              </div>

              <div className="lr-badges">
                <span className="pill pill-green">Training Needs Form</span>
              </div>
            </div>

            <div className="lr-card-cta">
              <button
                className="lr-primary"
                onClick={() => openForm(f.formKey)}
                disabled={!f.formKey}
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