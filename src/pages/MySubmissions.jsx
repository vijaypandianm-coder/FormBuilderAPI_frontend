// src/pages/MySubmissions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ResponseService from "../api/responses";
import { FormService } from "../api/forms";
import "./learner.css";
import view from "../assets/ViewSub.png";
import search from "../assets/Search.png";

const toStr = (x) => (x == null ? "" : String(x));

function mapRow(r) {
  return {
    responseId: r.responseId ?? r.ResponseId ?? r.id ?? r.Id ?? null,
    formKey: r.formKey ?? r.FormKey ?? null,
    title:
      r.title ??
      r.formTitle ??
      r.Title ??
      r.FormTitle ??
      undefined,
    description:
      r.description ??
      r.FormDescription ??
      r.Description ??
      undefined,
    submittedAt:
      r.submittedAt ??
      r.SubmittedAt ??
      r.submitted_on ??
      r.SubmittedOn ??
      null,
    formType:
      r.formType ??
      r.FormType ??
      "External Training Completion",
    status:
      r.status ??
      r.Status ??
      "Completion Submitted",
  };
}

export default function MySubmissions() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // client-side pager
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // fetch ALL submissions once (no server-side paging)
        const res = await ResponseService.listMy();
        const headers = Array.isArray(res)
          ? res
          : res?.items || res?.Items || res?.data || [];

        if (!alive) return;

        const mapped = headers.map(mapRow);

        // resolve missing titles using form meta
        const missingKeys = [
          ...new Set(
            mapped
              .filter((h) => !h.title && h.formKey)
              .map((h) => h.formKey)
          ),
        ];
        const titleMap = new Map();
        await Promise.all(
          missingKeys.map(async (k) => {
            try {
              const f = await FormService.get(k);
              titleMap.set(k, f?.title || f?.Title || `Form ${k}`);
            } catch {
              titleMap.set(k, `Form ${k}`);
            }
          })
        );

        const withTitles = mapped.map((h) => ({
          ...h,
          title: h.title ?? titleMap.get(h.formKey) ?? `Form ${h.formKey}`,
        }));

        // newest first
        withTitles.sort((a, b) => {
          const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return toStr(a.title).localeCompare(toStr(b.title));
        });

        setRows(withTitles);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load submissions");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // distinct types for the select
  const types = useMemo(() => {
    const s = new Set(
      rows.map((r) => r.formType || "External Training Completion")
    );
    return ["ALL", ...Array.from(s)];
  }, [rows]);

  // filter + search (client-side)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const passType =
        type === "ALL" ||
        (r.formType || "").toLowerCase() === type.toLowerCase();
      const passSearch =
        !needle ||
        toStr(r.title).toLowerCase().includes(needle) ||
        toStr(r.formKey).toLowerCase().includes(needle);
      return passType && passSearch;
    });
  }, [rows, q, type]);

  // pagination math (client-side)
  const totalItems = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageSafe = Math.min(page, pageCount);

  const startIndex = (pageSafe - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const displayed = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  // reset to page 1 on filters/search/pageSize change
  useEffect(() => {
    setPage(1);
  }, [q, type, pageSize]);

  const pillClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("approved")) return "tag tag--green";
    if (s.includes("rejected")) return "tag tag--red";
    return "tag tag--amber";
  };

  return (
    <div className="learner-shell">
      {/* Tabs */}
      <nav className="lr-tabs" role="tablist" aria-label="Forms">
        <Link className="lr-tab" role="tab" to="/learn">
          Self-Service Forms
        </Link>
        <span className="lr-tab disabled" role="tab" aria-disabled="true">
          Mandated Forms
        </span>
        <span className="lr-tab active" role="tab" aria-selected="true">
          My Submission
        </span>
      </nav>

      {/* Panel with toolbar + table */}
      <section className="ms-panel">
        {/* Toolbar */}
        <div className="ms-toolbar">
          <div className="ms-left">
            <label className="vis-hidden" htmlFor="ms-type">
              Form Type
            </label>
            <div className="ms-select">
              <select
                id="ms-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t === "ALL" ? "External Training Completion" : t}
                  </option>
                ))}
              </select>
              <span className="ms-caret" aria-hidden>
                ▾
              </span>
            </div>
          </div>

          <div className="ms-right">
            <div className="ms-search">
              <span aria-hidden>
                <img src={search} alt="" style={{ width: 20, height: 20 }} />
              </span>
              <input
                placeholder="Search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="ms-filter"
              onClick={() => alert("Filter panel coming soon")}
            >
              Filter
            </button>
          </div>
        </div>

        {/* Table */}
        {loading && <div className="lr-empty">Loading…</div>}
        {!loading && err && <div className="lr-error">{err}</div>}
        {!loading && !err && displayed.length === 0 && (
          <div className="lr-empty">No submissions yet.</div>
        )}

        {!loading && !err && displayed.length > 0 && (
          <>
            <div className="ms-table-wrap">
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Training Name</th>
                    <th>Submitted On</th>
                    <th>Form Type</th>
                    <th>Status</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r) => (
                    <tr key={`${r.responseId}-${r.formKey}`}>
                      <td>
                        <div className="t-title">
                          {r.title || `Form ${r.formKey}`}
                        </div>
                      </td>
                      <td>
                        {r.submittedAt
                          ? new Date(r.submittedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <span className="pill pill--pink">
                          {r.formType || "External Training Completion"}
                        </span>
                      </td>
                      <td>
                        <span className={pillClass(r.status)}>
                          {r.status || "Completion Submitted"}
                        </span>
                      </td>
                      <td className="t-actions">
                        <button
                          className="ico-btn"
                          title="View submission"
                          onClick={() =>
                            nav(
                              `/learn/submissions/${encodeURIComponent(
                                r.responseId
                              )}`
                            )
                          }
                        >
                          <img
                            src={view}
                            alt=""
                            style={{ width: 20, height: 20 }}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer / Pagination – same as ViewForm footer */}
            <div className="ms-footer">
              <div className="vf-pager">
                <div className="vf-ipp">
                  Items per page{" "}
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(+e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="grow" />
                <div className="vf-page">
                  <button
                    className="btn small pill"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageSafe <= 1}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  <span>
                    {pageSafe} of {pageCount}
                  </span>
                  <button
                    className="btn small pill"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={pageSafe >= pageCount}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}