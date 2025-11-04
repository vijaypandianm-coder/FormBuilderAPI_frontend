// src/pages/MySubmissionDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ResponseService from "../api/responses";
import { FormService } from "../api/forms";
import "./learner.css";

const toStr = (x) => (x == null ? "" : String(x));

// same base URL that apiFetch uses (configure in .env as VITE_API_BASE_URL)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ---- helper: try to auto-find a JWT in localStorage / sessionStorage ----
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;

function extractJwtFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const value of Object.values(obj)) {
    if (!value) continue;
    if (typeof value === "string" && jwtRegex.test(value)) return value;
    if (typeof value === "object") {
      const nested = extractJwtFromObject(value);
      if (nested) return nested;
    }
  }
  return null;
}

function findJwtToken() {
  const scanStore = (store) => {
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        const val = store.getItem(key);
        if (!val) continue;

        // raw string token
        if (jwtRegex.test(val)) return val;

        // token hidden in JSON
        const first = val[0];
        if (first === "{" || first === "[") {
          try {
            const parsed = JSON.parse(val);
            const found = extractJwtFromObject(parsed);
            if (found) return found;
          } catch {
            // ignore JSON parse errors
          }
        }
      }
    } catch {
      // some browsers can throw on access, ignore
    }
    return null;
  };

  return scanStore(window.localStorage) || scanStore(window.sessionStorage);
}

export default function MySubmissionDetail() {
  const { responseId } = useParams();
  const nav = useNavigate();

  const [header, setHeader] = useState(null);   // { formKey, submittedAt, ... }
  const [answers, setAnswers] = useState([]);   // [{ fieldId, fieldType, answerValue }]
  const [form, setForm] = useState(null);       // { title, description, layout: [sections] }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Build fast lookup for fields by id
  const fieldMap = useMemo(() => {
    if (!form?.layout) return new Map();
    const all = [];
    for (const s of form.layout) for (const f of (s.fields || [])) all.push(f);
    return new Map(all.map((f) => [f.fieldId, f]));
  }, [form]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // 1) response (header + answers)
        const detail = await ResponseService.getDetail(responseId);

        const h = detail?.header ?? detail?.Header ?? {};
        const a = detail?.answers ?? detail?.Answers ?? [];

        const submitted =
          h.submittedAt || h.SubmittedAt
            ? new Date(h.submittedAt || h.SubmittedAt)
            : null;

        if (!alive) return;

        setHeader({
          ...h,
          formKey: h.formKey ?? h.FormKey,
          submittedAt: submitted,
        });

        setAnswers(
          a.map((x) => ({
            fieldId: x.fieldId ?? x.FieldId,
            fieldType: (x.fieldType ?? x.FieldType ?? "").toString(),
            // backend can return optionIds OR normalized value string — keep both
            answerValue:
              x.answerValue ?? x.AnswerValue ?? x.optionIds ?? x.OptionIds ?? "",
          }))
        );

        // 2) form meta+layout
        const fk = h.formKey ?? h.FormKey;
        if (fk) {
          const f = await FormService.get(fk);
          if (!alive) return;

          setForm({
            title: f?.title ?? f?.Title ?? `Form ${fk}`,
            description: f?.description ?? f?.Description ?? "",
            layout: (f?.layout ?? f?.Layout ?? []).map((s) => ({
              title: s.title ?? s.Title ?? "",
              description: s.description ?? s.Description ?? "",
              fields: (s.fields ?? s.Fields ?? []).map((ff) => ({
                fieldId: ff.fieldId ?? ff.FieldId,
                label: ff.label ?? ff.Label ?? "",
                type: (ff.type ?? ff.Type ?? "").toString(),
                isRequired: !!(ff.isRequired ?? ff.IsRequired),
                options: (ff.options ?? ff.Options ?? []).map((opt) => ({
                  id: opt.id ?? opt.Id ?? opt._id,
                  text: opt.text ?? opt.Text,
                })),
              })),
            })),
          });
        }
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load submission");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [responseId]);

  // ---------- AUTHENTICATED FILE DOWNLOAD: uses *Id* from formresponsefiles ----------
  const downloadFile = async (fileIdRaw) => {
    if (!fileIdRaw) return;

    const url = `${API_BASE}/api/Response/file/${encodeURIComponent(fileIdRaw)}`;

    const jwt = findJwtToken();
    if (!jwt) {
      console.warn("No JWT token found in storage – download will be 401");
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: jwt
          ? {
              Authorization: `Bearer ${jwt}`,
            }
          : {},
      });

      if (!res.ok) {
        const msg = `Download failed (${res.status})`;
        console.error(msg);
        alert(msg);
        return;
      }

      const blob = await res.blob();

      // Try to extract filename from Content-Disposition
      let filename = "download";
      const cd =
        res.headers.get("Content-Disposition") ||
        res.headers.get("content-disposition");
      if (cd) {
        const match =
          /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
        if (match) {
          filename = decodeURIComponent(match[1] || match[2]);
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download error", e);
      alert("Failed to download file");
    }
  };

  /** Render a value according to field type & options */
  function renderValue(fieldId, fieldTypeRaw, raw) {
    const field = fieldMap.get(fieldId);
    const fieldType = (field?.type || fieldTypeRaw || "").toLowerCase();

    // optionIds array or JSON string? normalize to string[]
    let optionIds = [];
    if (Array.isArray(raw)) optionIds = raw.map(toStr);
    else if (
      typeof raw === "string" &&
      (fieldType.includes("checkbox") || fieldType.includes("multi"))
    ) {
      try { optionIds = JSON.parse(raw); } catch { /* keep empty */ }
    }

    // multi choice
    if (
      optionIds.length &&
      (fieldType.includes("checkbox") || fieldType.includes("multi"))
    ) {
      const names = optionIds.map(
        (id) => field?.options?.find((o) => o.id === id)?.text || id
      );
      return names.join(", ") || "—";
    }

    // single choice
    const value = Array.isArray(raw) ? raw[0] : raw;
    const str = toStr(value);

    if (["radio", "dropdown", "mcq"].some((t) => fieldType.includes(t))) {
      const opt = field?.options?.find((o) => o.id === str)?.text;
      return opt || str || "—";
    }

    // ---------- FILE FIELD: token "file:{Id}" -> use *Id*, not ResponseId ----------
    if (fieldType.includes("file")) {
      const token = toStr(raw);
      if (!token) return "—";

      // expected format from backend: "file:{Id}"  (Id column: 1,2,3,...)
      const match = /^file:(\d+)$/.exec(token);
      const fileId = match ? match[1] : token; // fallback if format ever changes

      return (
        <button
          type="button"
          onClick={() => downloadFile(fileId)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            color: "#3b82f6",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Download file
        </button>
      );
    }

    // rating (1-10) just show value
    if (fieldType.includes("rating") || fieldType === "number") {
      return str || "—";
    }

    // date already stored/displayed in dd/mm/yyyy by your validator
    if (fieldType.includes("date")) return str || "—";

    // textarea/text
    return str || "—";
  }

  // answers in section/field layout order
  const orderedRows = useMemo(() => {
    if (!form?.layout?.length) {
      return answers.map((a, i) => ({
        key: `${a.fieldId}-${i}`,
        label: a.fieldId,
        value: renderValue(a.fieldId, a.fieldType, a.answerValue),
        type: a.fieldType
      }));
    }
    const mapAns = new Map(answers.map(a => [a.fieldId, a]));
    const rows = [];
    for (const s of form.layout) {
      for (const f of (s.fields || [])) {
        const a = mapAns.get(f.fieldId);
        rows.push({
          key: f.fieldId,
          label: f.label || f.fieldId,
          value: a ? renderValue(f.fieldId, a.fieldType, a.answerValue) : "—",
          type: f.type || ""
        });
      }
    }
    return rows;
  }, [answers, form]);

  return (
    <div className="fs-shell">
      {/* top bar with back link (small, unobtrusive) */}
      <div className="topbar" style={{marginBottom: 12}}>
        {/* back / crumbs if you want later */}
      </div>

      {/* hero strip */}
      <section className="fs-hero">
        <div className="fs-hero-title">{form?.title || "Form"}</div>
        {form?.description ? (
          <div className="fs-hero-desc">{form.description}</div>
        ) : null}
      </section>

      {/* main card */}
      <section className="fs-card">
        <header className="fs-card-header">
          <h3 className="fs-card-title">Professional Certificate Training</h3>
          <div className="fs-card-sub">
            {header?.submittedAt ? (
              <>Form Submission&nbsp;·&nbsp;
                <span className="tag tag--green">
                  Submitted on {header.submittedAt.toLocaleString()}
                </span>
              </>
            ) : "Form Submission"}
          </div>
        </header>

        <div className="fs-card-body">
          {loading && <div className="lr-empty">Loading submission…</div>}
          {err && !loading && <div className="lr-error">{err}</div>}

          {!loading && !err && orderedRows.map((row, idx) => {
            const isTextarea = row.type.toLowerCase().includes("textarea");
            return (
              <div key={row.key ?? idx} className="fs-field">
                <div className="fs-qrow">
                  <span className="fs-idx">{idx + 1}</span>
                  <div className="fs-label">{row.label}</div>
                </div>

                {isTextarea ? (
                  <textarea
                    className="fs-input"
                    readOnly
                    value={toStr(row.value)}
                  />
                ) : (
                  <div className="fs-input" aria-readonly>
                    {row.value}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}