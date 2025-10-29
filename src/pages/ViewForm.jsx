// src/pages/ViewForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FormService} from "../api/forms";
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

  const [form, setForm] = useState(null);     // full object from backend (includes Layout)
  const layout = form?.layout || null;

  // responses state
  const [activeRespTab, setActiveRespTab] = useState("summary");
  const [respQ, setRespQ] = useState("");
  const [respPage, setRespPage] = useState(1);
  const [respPageSize, setRespPageSize] = useState(10);
  const [respRows, setRespRows] = useState([]); // rendered rows (summary or individual)
  const [respTotal, setRespTotal] = useState(0);

  const respPages = Math.max(1, Math.ceil(respTotal / respPageSize));

  // sync tab in URL
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("tab") !== tab) {
      search.set("tab", tab);
      navigate({ search: `?${search.toString()}` }, { replace: true });
    }
  }, [tab, navigate]);

  // Fetch form (config + layout) once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const cfg = await FormService.get(formKey); // already includes layout
        if (!alive) return;
        setForm(cfg);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [formKey]);

  // Fetch responses when responses tab visible / filters change
  useEffect(() => {
    if (tab !== "responses") return;

    let alive = true;
    (async () => {
      try {
        setErr("");

        // backend returns a FLAT list: [{responseId, formKey, userId, submittedAt, fieldId, answerValue}, ...]
        const flat = await ResponsesApi.list(Number(formKey));

        // Build lookup for labels from layout
        const fieldLabel = {};
        (layout?.sections || []).forEach((s) =>
          (s.fields || []).forEach((f) => {
            if (f.fieldId) fieldLabel[f.fieldId] = f.label || f.name || f.fieldId;
          })
        );

        // Group by responseId
        const byResp = new Map();
        flat.forEach((row) => {
          const id = row.responseId;
          if (!byResp.has(id)) {
            byResp.set(id, {
              id,
              userId: row.userId,
              submittedOn: row.submittedAt,
              fields: [],
            });
          }
          byResp.get(id).fields.push({
            fieldId: row.fieldId,
            label: fieldLabel[row.fieldId] || row.fieldId,
            value: row.answerValue,
          });
        });

        // Optional search filter on userId string or label/value text
        const searchText = respQ.trim().toLowerCase();
        let submissions = Array.from(byResp.values()).sort(
          (a, b) => new Date(b.submittedOn) - new Date(a.submittedOn)
        );

        if (searchText) {
          submissions = submissions.filter(
            (s) =>
              String(s.userId).includes(searchText) ||
              s.fields.some(
                (f) =>
                  (f.label || "").toLowerCase().includes(searchText) ||
                  String(f.value || "").toLowerCase().includes(searchText)
              )
          );
        }

        const total = submissions.length;

        // paginate
        const start = (respPage - 1) * respPageSize;
        const paged = submissions.slice(start, start + respPageSize);

        // For “summary”, shrink info to one row each; for “individual”, keep fields list
        const rows =
          activeRespTab === "summary"
            ? paged.map((s) => ({
                id: s.id,
                userId: s.userId,
                userName: `User ${s.userId}`, // you can replace with real name if API returns it later
                submittedOn: s.submittedOn,
                usedIn: "—",
                email: "—",
              }))
            : paged;

        if (!alive) return;
        setRespRows(rows);
        setRespTotal(total);
      } catch (e) {
        if (!alive) return;
        setRespRows([]);
        setRespTotal(0);
        setErr(e?.message || "Failed to load responses");
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeRespTab, respPage, respPageSize, respQ, formKey, layout]);

  const onChangeTab = (next) => setTab(next);

  /* ----------------------- Renderers ----------------------- */

  const renderConfig = () => {
    if (!form) return <div className="vf-empty">Not Found</div>;
    return (
      <div className="vf-card">
        <div className="vf-card-head">Form Details</div>
        <div className="vf-field">
          <label className="vf-label">Form Name</label>
          <input className="vf-input" value={form.title || ""} disabled />
        </div>
        <div className="vf-field">
          <label className="vf-label">Form Description</label>
          <textarea className="vf-input" rows={3} value={form.description || ""} disabled />
        </div>
        <div className="vf-field">
          <label className="vf-label">Form Visibility</label>
          <label className="vf-switch">
            <input type="checkbox" checked={String(form.status).toLowerCase() === "published"} readOnly />
            <span aria-hidden />
          </label>
          <p className="vf-hint">
            Turn on to allow new workflows to use this form. Turn off to hide it; existing workflows keep working.
          </p>
        </div>
      </div>
    );
  };

  const renderLayout = () => {
    if (!layout?.length && !layout?.sections?.length) return <div className="vf-empty">Not Found</div>;
    const sections = layout.sections || layout; // tolerate both shapes
    return (
      <div className="vf-layout">
        {sections.map((s, si) => (
          <section key={si} className="vf-sec">
            <div className="vf-sec-title">{s.title || `Section ${si + 1}`}</div>
            {(s.fields || []).map((f, fi) => (
              <div key={fi} className="vf-q">
                <div className="vf-q-title">
                  {f.label || f.name || `Untitled Question ${fi + 1}`}
                  {f.isRequired || f.required ? <span className="req">*</span> : null}
                </div>
                <div className="vf-q-type">{(f.type || "").toString()}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  };

  const renderResponses = () => {
    return (
      <div className="vf-resp">
        <div className="vf-resp-tabs">
          <button
            className={`chip ${activeRespTab === "summary" ? "active" : ""}`}
            onClick={() => {
              setActiveRespTab("summary");
              setRespPage(1);
            }}
          >
            Response Summary
          </button>
          <button
            className={`chip ${activeRespTab === "individual" ? "active" : ""}`}
            onClick={() => {
              setActiveRespTab("individual");
              setRespPage(1);
            }}
          >
            Individual Response
          </button>

          <div className="grow" />
          <div className="vf-search">
            <input
              placeholder="Search by Name/User ID"
              value={respQ}
              onChange={(e) => {
                setRespQ(e.target.value);
                setRespPage(1);
              }}
            />
            <span aria-hidden>🔍</span>
          </div>
          <button className="btn ghost" onClick={() => window.alert("Filter UI TBD")}>
            Filter
          </button>
          <button className="btn primary" onClick={() => window.alert("Export API TBD")}>
            Export to Excel
          </button>
        </div>

        <div className="vf-table-wrap">
          {err && tab === "responses" ? (
            <div className="vf-alert">{err}</div>
          ) : respRows.length === 0 ? (
            <div className="vf-empty">Not Found</div>
          ) : activeRespTab === "summary" ? (
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
                    <td>{r.userName}</td>
                    <td>{r.userId}</td>
                    <td>{r.usedIn}</td>
                    <td>{r.submittedOn ? new Date(r.submittedOn).toLocaleString() : "—"}</td>
                    <td>{r.email || "—"}</td>
                    <td>
                      <button className="btn small" onClick={() => setActiveRespTab("individual")}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="vf-table">
              <thead>
                <tr>
                  <th>Submitted On</th>
                  <th>Submitted By</th>
                  <th>User Id</th>
                  <th>Email</th>
                  <th>Fields</th>
                </tr>
              </thead>
              <tbody>
                {respRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.submittedOn ? new Date(r.submittedOn).toLocaleString() : "—"}</td>
                    <td>{`User ${r.userId}`}</td>
                    <td>{r.userId}</td>
                    <td>—</td>
                    <td>
                      {(r.fields || []).slice(0, 3).map((f, i) => (
                        <div key={i}>
                          <strong>{f.label}:</strong> <span>{String(f.value ?? "")}</span>
                        </div>
                      ))}
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
              onChange={(e) => {
                setRespPageSize(Number(e.target.value));
                setRespPage(1);
              }}
            >
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </div>
          <div className="grow" />
          <div className="vf-page">
            <button
              className="btn small"
              disabled={respPage <= 1}
              onClick={() => setRespPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <span>
              {respPage} of {respPages}
            </span>
            <button
              className="btn small"
              disabled={respPage >= respPages}
              onClick={() => setRespPage((p) => Math.min(respPages, p + 1))}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="vf-root">
      {/* Local breadcrumb only (no duplicate global header) */}
      <div className="vf-bc">
        <Link to="/" className="home">
          Form Builder
        </Link>
        <span className="sep">›</span>
        <span className="cur">View Form</span>
      </div>

      <div className="vf-tabs" role="tablist" aria-label="View Form Tabs">
        <button
          role="tab"
          aria-selected={tab === "config"}
          className={`tab ${tab === "config" ? "active" : ""}`}
          onClick={() => onChangeTab("config")}
        >
          Form Configuration
        </button>
        <button
          role="tab"
          aria-selected={tab === "layout"}
          className={`tab ${tab === "layout" ? "active" : ""}`}
          onClick={() => onChangeTab("layout")}
        >
          Form Layout
        </button>
        <button
          role="tab"
          aria-selected={tab === "responses"}
          className={`tab ${tab === "responses" ? "active" : ""}`}
          onClick={() => onChangeTab("responses")}
        >
          Responses
        </button>
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