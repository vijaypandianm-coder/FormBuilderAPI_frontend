// src/pages/LearnerForms.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FormService } from "../api/forms";
import ResponseService from "../api/responses";
import ConfirmDialog from "../components/ConfirmDialog";
import "./learner.css";
import search from "../assets/Search.png";

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

  // pagination state (purely client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // map of formKey -> { submittedAt, ts }
  const [submittedByForm, setSubmittedByForm] = useState({});

  // "Already submitted" dialog state
  const [alreadyState, setAlreadyState] = useState({
    open: false,
    form: null,
    lastDate: "",
  });

  /* ---------- load available forms (self-service) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Fetch a large page once; we handle paging on the client
        const res = await FormService.list({
          status: "Published",
          page: 1,
          pageSize: 1000,
          q,
        });

        const raw =
          (res && (res.items || res.Items)) ??
          (Array.isArray(res) ? res : []) ??
          [];

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

        if (alive) {
          setItems(normalized);
        }
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]); // only refetch when search text changes

  // reset to first page on search/pageSize change
  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  /* ---------- load ALL my submissions once ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await ResponseService.listMy();
        const headers = Array.isArray(res)
          ? res
          : res?.items || res?.Items || res?.data || [];

        const map = {};

        headers.forEach((h) => {
          const formKey =
            h.formKey ?? h.FormKey ?? h.form_id ?? h.FormId ?? null;
          if (!formKey) return;

          const submittedAt =
            h.submittedAt ??
            h.SubmittedAt ??
            h.submitted_on ??
            h.SubmittedOn ??
            null;
          if (!submittedAt) return;

          const ts = new Date(submittedAt).getTime();
          const existing = map[formKey];
          if (!existing || ts > existing.ts) {
            map[formKey] = { submittedAt, ts };
          }
        });

        if (alive) {
          setSubmittedByForm(map);
        }
      } catch (e) {
        console.warn("Failed to load my submissions for pre-check:", e);
        if (alive) setSubmittedByForm({});
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- filtering & paging (client-side) ---------- */

  // First apply search filter
  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (x) =>
        (x.title || "").toLowerCase().includes(needle) ||
        (x.description || "").toLowerCase().includes(needle) ||
        String(x.formKey || "").includes(needle)
    );
  }, [items, q]);

  // Then compute page count from the filtered list
  const pageCount = Math.max(1, Math.ceil(searched.length / pageSize));
  const pageSafe = Math.min(page, pageCount);

  // Finally slice exactly pageSize items for the current page
  const filtered = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    const end = start + pageSize;
    return searched.slice(start, end);
  }, [searched, pageSafe, pageSize]);

  const goToForm = (key) => {
    if (!key) return;
    nav(`/forms/${encodeURIComponent(key)}`);
  };

  /* ---------- Start Submission click ---------- */

  const handleStartSubmission = (form) => {
    if (!form?.formKey) return;

    const info = submittedByForm[form.formKey];

    // no previous submissions -> go straight to form
    if (!info) {
      goToForm(form.formKey);
      return;
    }

    const lastDate = info.submittedAt
      ? new Date(info.submittedAt).toLocaleDateString()
      : "";

    setAlreadyState({
      open: true,
      form,
      lastDate,
    });
  };

  const handleAlreadyCancel = () => {
    setAlreadyState({ open: false, form: null, lastDate: "" });
  };

  const handleAlreadyConfirm = () => {
    const f = alreadyState.form;
    setAlreadyState({ open: false, form: null, lastDate: "" });
    if (f?.formKey) goToForm(f.formKey);
  };

  return (
    <div className="learner-shell">
      <nav className="lr-tabs" role="tablist" aria-label="Forms">
        <span className="lr-tab active" role="tab" aria-selected="true">
          Self-Service Forms
        </span>
        <span
          className="lr-tab disabled"
          role="tab"
          aria-disabled="true"
          title="Coming soon"
        >
          Mandated Forms
        </span>
        <Link
          className="lr-tab"
          role="tab"
          aria-selected="false"
          to="/learn/my-submissions"
        >
          My Submission
        </Link>
      </nav>

      <div className="lr-toolbar">
        <div className="lr-banner">
          <span className="lr-info-icon" aria-hidden>
            ℹ️
          </span>
          These forms are optional and can be submitted multiple times if
          needed.
        </div>
        <div className="lr-tools">
          <div className="lr-search">
            <img src={search} alt="" style={{ width: 20, height: 20 }} />
            <input
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="lr-filter" type="button" title="Filter">
            Filter
          </button>
        </div>
      </div>

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

        {!loading &&
          !err &&
          filtered.map((f) => (
            <article key={f.formKey} className="lr-card" aria-label={f.title}>
              <div className="lr-card-body">
                <h3 className="lr-card-title">{f.title}</h3>
                <p className="lr-card-desc">{f.description || "—"}</p>
                <div className="lr-meta-row">
                  <span className="lr-meta-k">Published Date:</span>
                  <span className="lr-meta-v">
                    {f.publishedAt
                      ? new Date(f.publishedAt).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="lr-card-cta">
                <button
                  className="lr-primary"
                  onClick={() => handleStartSubmission(f)}
                  disabled={!f.formKey}
                >
                  Start Submission
                </button>
              </div>
            </article>
          ))}
      </section>

      {/* pagination footer – same layout as ViewForm footer */}
      {!loading && !err && (
        <div className="vf-pager">
          <div className="vf-ipp">
            Items per page{" "}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
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
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <span>
              {pageSafe} of {pageCount}
            </span>
            <button
              className="btn small pill"
              disabled={pageSafe >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* ===== Already Submitted dialog ===== */}
      <ConfirmDialog
        open={alreadyState.open}
        title="Already Submitted"
        body={
          <>
            <p>
              You last submitted this form on{" "}
              <strong>{alreadyState.lastDate || "DD/MM/YYYY"}</strong>.
            </p>
            <p>Do you want to submit this form again?</p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Continue"
        onCancel={handleAlreadyCancel}
        onConfirm={handleAlreadyConfirm}
      />
    </div>
  );
}