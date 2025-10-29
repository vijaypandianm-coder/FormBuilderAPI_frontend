// src/pages/MySubmissions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ResponseService from "../api/responses";
import { FormService } from "../api/forms";
import { AuthService } from "../api/auth";
import "./learner.css";

function toStr(x) { return x == null ? "" : String(x); }

// Normalize API row
function mapRow(r) {
  return {
    responseId: r.responseId ?? r.ResponseId ?? r.id ?? r.Id ?? null,
    formKey: r.formKey ?? r.FormKey ?? null,
    title: r.title ?? r.formTitle ?? r.Title ?? r.FormTitle ?? undefined,
    description: r.description ?? r.FormDescription ?? r.Description ?? undefined,
    submittedAt: r.submittedAt ?? r.SubmittedAt ?? r.submitted_on ?? r.SubmittedOn ?? null,
    userName: r.userName ?? r.UserName ?? undefined,
  };
}

export default function MySubmissions() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // 1) fetch my headers
        const res = await ResponseService.listMy();
        const headers = Array.isArray(res)
          ? res
          : res?.items || res?.Items || res?.data || [];

        if (!alive) return;
        const mapped = headers.map(mapRow);

        // 2) resolve titles per formKey if missing
        const missing = [...new Set(mapped
          .filter(h => !h.title && h.formKey != null)
          .map(h => h.formKey))];

        const titleMap = new Map();
        await Promise.all(missing.map(async (k) => {
          try {
            const f = await FormService.get(k);
            titleMap.set(k, f?.title || f?.Title || `Form ${k}`);
          } catch {
            titleMap.set(k, `Form ${k}`);
          }
        }));

        const withTitles = mapped.map(h => ({
          ...h,
          title: h.title ?? titleMap.get(h.formKey) ?? `Form ${h.formKey}`,
        }));

        setRows(withTitles);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load submissions");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      toStr(r.title).toLowerCase().includes(needle) ||
      toStr(r.formKey).toLowerCase().includes(needle)
    );
  }, [q, rows]);

  return (
    <div className="learner-shell">
      {/* Top bar */}
      <header className="lr-topbar">
        <div className="lr-left">
          <div className="lr-app">Form Builder</div>
          <div className="lr-breadcrumb">My Submission</div>
        </div>
        <div className="lr-right learner-toolbar">
          <div className="lr-search">
            <span aria-hidden>🔍</span>
            <input
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="ghost" type="button" onClick={() => alert("Filter panel coming soon")}>
            Filter
          </button>
          <Link className="ghost" to="/learn">Form List</Link>
          <button
            className="lr-logout"
            onClick={() => { AuthService.logout?.(); window.location.assign("/login"); }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="lr-tabs" role="tablist">
        <Link className="lr-tab" to="/learn">Form List</Link>
        <span className="lr-tab disabled" aria-disabled="true">Mandated Forms</span>
        <span className="lr-tab active">My Submission</span>
      </nav>

      {/* Body */}
      <div className="lr-panel">
        {loading && <div className="lr-empty">Loading…</div>}
        {!loading && err && <div className="lr-error">{err}</div>}
        {!loading && !err && filtered.length === 0 && <div className="lr-empty">No submissions yet.</div>}

        {!loading && !err && filtered.length > 0 && (
          <div className="lr-table-wrap">
            <table className="lr-table">
              <thead>
                <tr>
                  <th>Training / Form</th>
                  <th>Requested On</th>
                  <th>Completion On</th>
                  <th>Form Key</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.responseId}-${r.formKey}`}>
                    <td>
                      <div className="cell-title">{r.title || `Form ${r.formKey}`}</div>
                      {r.description && <div className="cell-sub">{r.description}</div>}
                    </td>
                    <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                    <td>—{/* completion date can be wired later if/when you persist it */}</td>
                    <td>{r.formKey ?? "—"}</td>
                    <td><span className="badge badge-purple">Request Submitted</span></td>
                    <td className="lr-actions">
                      <button
                        className="btn-link"
                        onClick={() => nav(`/learn/submissions/${encodeURIComponent(r.responseId)}`)}
                      >
                        View
                      </button>
                      <Link className="btn-link" to={`/forms/${encodeURIComponent(r.formKey || "")}`}>
                        Submit Again
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* simple pager stub to match figma layout */}
            <div className="lr-table-footer">
              <div className="items-per-page">
                <label>Items per page</label>
                <select defaultValue="10" disabled>
                  <option>10</option><option>25</option><option>50</option>
                </select>
              </div>
              <div className="pager">
                <button disabled>{"<"}</button>
                <span>1 of 1 pages</span>
                <button disabled>{">"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}