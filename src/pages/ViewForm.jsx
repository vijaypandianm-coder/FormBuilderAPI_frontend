// src/pages/ViewForm.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FormService } from "../api/forms";
import { ResponsesApi } from "../api/responses";
import "./ViewForm.css";

const useQuery = () => new URLSearchParams(useLocation().search);

export default function ViewForm() {
  const { formKey } = useParams();
  const q = useQuery();
  const navigate = useNavigate();

  const [tab, setTab] = useState(q.get("tab") || "config");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [form, setForm] = useState(null);
  const layout = form?.layout || null;

  // responses state
  const [activeRespTab, setActiveRespTab] = useState("summary"); // "summary" | "individual"
  const [respQ, setRespQ] = useState("");
  const [respPage, setRespPage] = useState(1);
  const [respPageSize, setRespPageSize] = useState(10);
  const [respRows, setRespRows] = useState([]);
  const [respTotal, setRespTotal] = useState(0);
  const respPages = Math.max(1, Math.ceil(respTotal / respPageSize));
  const [selectedRespId, setSelectedRespId] = useState(null);

  // username cache: { [userId]: "Alice" }
  const [userNameMap, setUserNameMap] = useState({});

  /* ---------------- URL sync ---------------- */
  useEffect(() => {
    const s = new URLSearchParams(window.location.search);
    if (s.get("tab") !== tab) {
      s.set("tab", tab);
      navigate({ search: `?${s.toString()}` }, { replace: true });
    }
  }, [tab, navigate]);

  /* ---------------- form fetch ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const dto = await FormService.get(formKey);
        if (!alive) return;
        setForm(dto);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [formKey]);

  /* ---------------- label helpers ---------------- */

  // Normalize candidate keys (handles "form/..:fieldId", UUIDs etc.)
  const normalizeKey = (k) => {
    if (k == null) return "";
    const s = String(k);
    const last = s.split(/[\/:\.]/).pop();
    const hexTail = last.match(/[a-f0-9]{24,32}$/i);
    return (hexTail ? hexTail[0] : last).toLowerCase();
  };

  // Build a tolerant label index; supports layout.sections OR root array
  const buildLabelIndex = (lyt) => {
    const idx = {};
    const sections = Array.isArray(lyt?.sections)
      ? lyt.sections
      : Array.isArray(lyt)
        ? lyt
        : [];

    sections.forEach((s) => {
      const fields = Array.isArray(s?.fields) ? s.fields : [];
      fields.forEach((f) => {
        const label = f.label || f.name || "Untitled";
        const candidates = [
          f.fieldId, f.id, f.key, f.name, f.slug, f.dbKey, f.code, f.uuid
        ].filter(Boolean);

        candidates.forEach((k) => {
          const raw = String(k);
          idx[raw] = label;                 // raw key
          idx[raw.toLowerCase()] = label;   // lower-case variant
          idx[normalizeKey(raw)] = label;   // normalized tail
        });
      });
    });

    return idx;
  };

  const resolveLabel = (fieldId, fallbacks, labelIndex, lyt) => {
    const raw = fieldId != null ? String(fieldId) : "";
    const norm = normalizeKey(raw);

    // direct hits
    if (labelIndex[raw]) return labelIndex[raw];
    if (labelIndex[raw.toLowerCase()]) return labelIndex[raw.toLowerCase()];
    if (labelIndex[norm]) return labelIndex[norm];

    // suffix hit
    const hit = Object.keys(labelIndex).find((k) => {
      const kn = normalizeKey(k);
      return raw.endsWith(k) || raw.toLowerCase().endsWith(k.toLowerCase()) || norm === kn || norm.endsWith(kn);
    });
    if (hit) return labelIndex[hit];

    // last-chance scan (very cheap for typical sizes)
    const sections = Array.isArray(lyt?.sections) ? lyt.sections : (Array.isArray(lyt) ? lyt : []);
    for (const s of sections) {
      for (const f of (s?.fields || [])) {
        const keys = [f.fieldId, f.id, f.key, f.name, f.slug, f.dbKey, f.code, f.uuid]
          .filter(Boolean)
          .map(String);
        if (keys.some(k => {
          const kn = normalizeKey(k);
          return raw.endsWith(k) || raw.toLowerCase().endsWith(k.toLowerCase()) || norm === kn || norm.endsWith(kn);
        })) {
          return f.label || f.name || "Untitled";
        }
      }
    }

    // backend fallbacks (if present)
    return fallbacks.fieldLabel || fallbacks.label || fallbacks.questionLabel || raw;
  };

  /* ---------------- username helpers (read-only) ---------------- */

  const safeJson = async (url, signal) => {
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  const normalizeBulkUsers = (data) => {
    if (!data) return {};
    if (Array.isArray(data)) {
      const out = {};
      data.forEach((u) => {
        if (u && (u.id !== undefined)) {
          out[u.id] = u.name || u.username || `User ${u.id}`;
        }
      });
      return out;
    }
    const out = {};
    Object.entries(data).forEach(([id, name]) => {
      const n = typeof name === "string" ? name : (name?.name || name?.username);
      out[Number(id)] = n || `User ${id}`;
    });
    return out;
  };

  const fetchUsernamesIfMissing = async (ids, signal) => {
    const missing = ids.filter((id) => !(id in userNameMap));
    if (!missing.length) return;

    // try bulk endpoints (no backend change required if one exists)
    const bulkCandidates = [
      `/api/users/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
      `/api/admin/users/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
      `/users/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
      `/admin/users/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
    ];
    for (const url of bulkCandidates) {
      const data = await safeJson(url, signal);
      if (data) {
        const add = normalizeBulkUsers(data);
        if (Object.keys(add).length) {
          setUserNameMap((m) => ({ ...m, ...add }));
          return;
        }
      }
    }

    // per-id fallbacks
    const perIdCandidates = (id) => [
      `/api/users/${id}`,
      `/api/admin/users/${id}`,
      `/users/${id}`,
      `/admin/users/${id}`,
      `/api/user/${id}`,
    ];

    await Promise.allSettled(
      missing.map(async (id) => {
        for (const url of perIdCandidates(id)) {
          const u = await safeJson(url, signal);
          if (u) {
            setUserNameMap((m) => ({
              ...m,
              [id]: u.name || u.username || `User ${id}`,
            }));
            return;
          }
        }
      })
    );
  };

  /* ---------------- responses fetch ---------------- */
  useEffect(() => {
    if (tab !== "responses") return;
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setErr("");

        const flat = await ResponsesApi.list(Number(formKey));

        // label index (matches Form Layout behaviour)
        const labelIdx = buildLabelIndex(layout);

        // group by responseId
        const byId = new Map();
        flat.forEach((row) => {
          if (!byId.has(row.responseId)) {
            byId.set(row.responseId, {
              id: row.responseId,
              userId: row.userId,
              submittedOn: row.submittedAt,
              fields: [],
            });
          }

          byId.get(row.responseId).fields.push({
            fieldId: row.fieldId,
            label: resolveLabel(row.fieldId, row, labelIdx, layout),
            value: row.answerValue,
          });
        });

        // sort & filter
        const query = respQ.trim().toLowerCase();
        let subs = Array.from(byId.values()).sort(
          (a, b) => new Date(b.submittedOn) - new Date(a.submittedOn)
        );

        if (query) {
          subs = subs.filter(s =>
            String(s.userId).includes(query) ||
            s.fields.some(f =>
              String(f.label || "").toLowerCase().includes(query) ||
              String(f.value || "").toLowerCase().includes(query)
            )
          );
        }

        // pagination
        const total = subs.length;
        const start = (respPage - 1) * respPageSize;
        const pageRows = subs.slice(start, start + respPageSize);

        // resolve usernames (non-blocking)
        const idsOnPage = [...new Set(pageRows.map(r => r.userId).filter(v => v != null))];
        fetchUsernamesIfMissing(idsOnPage, ctrl.signal);

        // shape for current tab
        const rows = activeRespTab === "summary"
          ? pageRows.map(s => ({
              id: s.id,
              userId: s.userId,
              userName: userNameMap[s.userId] || `User ${s.userId}`,
              submittedOn: s.submittedOn,
              usedIn: "—",
              email: "—",
            }))
          : pageRows;

        if (!alive) return;
        setRespRows(rows);
        setRespTotal(total);

        if (activeRespTab === "individual") {
          const ids = pageRows.map(r => r.id);
          if (!ids.includes(selectedRespId)) {
            setSelectedRespId(pageRows[0]?.id ?? null);
          }
        }
      } catch (e) {
        if (!alive) return;
        setRespRows([]);
        setRespTotal(0);
        setErr(e?.message || "Failed to load responses");
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeRespTab, respPage, respPageSize, respQ, formKey, layout, userNameMap]);

  /* ---------------- renderers ---------------- */

  const renderConfig = () => (
    <div className="vf-card">
      <div className="vf-card-head">Form Details</div>

      <div className="vf-field">
        <label className="vf-label">Form Name</label>
        <input className="vf-input" value={form?.title || ""} disabled />
      </div>

      <div className="vf-field">
        <label className="vf-label">Form Description</label>
        <textarea className="vf-input" rows={3} value={form?.description || ""} disabled />
      </div>

      <div className="vf-field">
        <label className="vf-label">Form Visibility</label>
        <label className="vf-switch">
          <input
            type="checkbox"
            checked={String(form?.status).toLowerCase() === "published"}
            readOnly
          />
          <span aria-hidden />
        </label>
        <p className="vf-hint">
          Turn on to allow new workflows to use this form. Turn off to hide it; existing workflows keep working.
        </p>
      </div>
    </div>
  );

  const renderLayout = () => {
    // mirror the same normalization used by buildLabelIndex
    const sections = Array.isArray(layout?.sections)
      ? layout.sections
      : Array.isArray(layout)
        ? layout
        : [];

    if (sections.length === 0) return <div className="vf-empty">Not Found</div>;

    return (
      <div className="vf-layout">
        {sections.map((s, si) => (
          <section key={si} className="vf-sec">
            <div className="vf-sec-title">{s.title || `Section ${si + 1}`}</div>
            {(s.fields || []).map((f, fi) => {
              const label = f.label || f.name || f.fieldId || f.id || `Untitled Question ${fi + 1}`;
              return (
                <div key={fi} className="vf-q">
                  <div className="vf-q-title">
                    {label}{(f.isRequired || f.required) ? <span className="req">*</span> : null}
                  </div>
                  <div className="vf-q-type">{(f.type || "").toString()}</div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    );
  };

  const renderResponses = () => (
    <div className="vf-resp">
      <div className="vf-resp-tabs">
        <button
          className={`chip ${activeRespTab === "summary" ? "active" : ""}`}
          onClick={() => { setActiveRespTab("summary"); setRespPage(1); }}
        >
          Response Summary
        </button>
        <button
          className={`chip ${activeRespTab === "individual" ? "active" : ""}`}
          onClick={() => { setActiveRespTab("individual"); setRespPage(1); }}
        >
          Individual Response
        </button>

        <div className="grow" />
        <div className="vf-search">
          <input
            placeholder="Search by Name/User ID"
            value={respQ}
            onChange={(e) => { setRespQ(e.target.value); setRespPage(1); }}
          />
          <span aria-hidden>🔍</span>
        </div>
        <button className="btn ghost" onClick={() => window.alert("Filter UI TBD")}>Filter</button>
        <button className="btn primary" onClick={() => window.alert("Export API TBD")}>Export to Excel</button>
      </div>

      {activeRespTab === "summary" ? (
        <>
          <div className="vf-table-wrap">
            {err ? (
              <div className="vf-alert">{err}</div>
            ) : respRows.length === 0 ? (
              <div className="vf-empty">Not Found</div>
            ) : (
              <table className="vf-table">
                <thead>
                  <tr>
                    <th>Submitted By</th>
                    <th>User Id</th>
                    <th>Used In</th>
                    <th>Submitted On</th>
                    <th>Email</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {respRows.map((r) => (
                    <tr key={r.id}>
                      <td>{userNameMap[r.userId] || r.userName || `User ${r.userId}`}</td>
                      <td>{r.userId}</td>
                      <td>{r.usedIn}</td>
                      <td>{r.submittedOn ? new Date(r.submittedOn).toLocaleString() : "—"}</td>
                      <td>{r.email || "—"}</td>
                      <td>
                        <button
                          className="btn small"
                          onClick={() => { setActiveRespTab("individual"); setSelectedRespId(r.id); }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="vf-pager">
            <div className="vf-ipp">
              Items per page{" "}
              <select
                value={respPageSize}
                onChange={(e) => { setRespPageSize(Number(e.target.value)); setRespPage(1); }}
              >
                <option>10</option><option>25</option><option>50</option>
              </select>
            </div>
            <div className="grow" />
            <div className="vf-page">
              <button className="btn small" disabled={respPage <= 1} onClick={() => setRespPage(p => Math.max(1, p - 1))}>‹</button>
              <span>{respPage} of {respPages}</span>
              <button className="btn small" disabled={respPage >= respPages} onClick={() => setRespPage(p => Math.min(respPages, p + 1))}>›</button>
            </div>
          </div>
        </>
      ) : (
        <div className="vf-indiv">
          <aside className="vf-indiv-list">
            {respRows.length === 0 ? (
              <div className="vf-empty" style={{ padding: 16 }}>No responses</div>
            ) : (
              respRows.map((r) => (
                <button
                  key={r.id}
                  className={`vf-indiv-item ${selectedRespId === r.id ? "selected" : ""}`}
                  onClick={() => setSelectedRespId(r.id)}
                >
                  <div className="name">{userNameMap[r.userId] || `User ${r.userId}`}</div>
                  <div className="meta">
                    Submitted • {r.submittedOn ? new Date(r.submittedOn).toLocaleString() : "—"}
                  </div>
                  <div className="tag">Response ID: {r.id}</div>
                </button>
              ))
            )}
            <div className="vf-mini-pager">
              <button className="btn small" disabled={respPage <= 1} onClick={() => setRespPage(p => Math.max(1, p - 1))}>‹</button>
              <span>{respPage} / {respPages}</span>
              <button className="btn small" disabled={respPage >= respPages} onClick={() => setRespPage(p => Math.min(respPages, p + 1))}>›</button>
            </div>
          </aside>

          <section className="vf-indiv-detail">
            <div className="vf-formbox">
              <div className="vf-formbox-topbar" />
              <div className="vf-formbox-head">
                <div className="title">{form?.title || "Form"}</div>
                <div className="hint">{form?.description || ""}</div>
              </div>

              <div className="vf-formbox-body">
                {(() => {
                  const current = respRows.find((r) => r.id === selectedRespId) || respRows[0];
                  if (!current) return <div className="vf-empty">Select a response on the left</div>;
                  return (current.fields || []).map((f, i) => (
                    <div key={i} className="vf-formbox-q">
                      <div className="qnum">{i + 1}</div>
                      <div className="qmain">
                        <div className="qlabel">{f.label}</div>
                        <div className="qvalue">{String(f.value ?? "")}</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );

  /* ---------------- render root ---------------- */

  return (
    <div className="vf-root">
      <div className="vf-tabs" role="tablist" aria-label="View Form Tabs">
        <button role="tab" aria-selected={tab === "config"} className={`tab ${tab === "config" ? "active" : ""}`} onClick={() => setTab("config")}>Form Configuration</button>
        <button role="tab" aria-selected={tab === "layout"} className={`tab ${tab === "layout" ? "active" : ""}`} onClick={() => setTab("layout")}>Form Layout</button>
        <button role="tab" aria-selected={tab === "responses"} className={`tab ${tab === "responses" ? "active" : ""}`} onClick={() => setTab("responses")}>Responses</button>
      </div>

      {loading ? (
        <div className="vf-skel">Loading…</div>
      ) : err && tab !== "responses" ? (
        <div className="vf-alert">{err}</div>
      ) : tab === "config" ? (
        renderConfig()
      ) : tab === "layout" ? (
        renderLayout()
      ) : (
        renderResponses()
      )}
    </div>
  );
}