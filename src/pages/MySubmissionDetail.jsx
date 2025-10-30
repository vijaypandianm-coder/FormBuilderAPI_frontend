import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ResponseService from "../api/responses";
import { FormService } from "../api/forms";
import "./learner.css";

const toStr = (x) => (x == null ? "" : String(x));

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

  /** Render a value according to field type & options */
  function renderValue(fieldId, fieldTypeRaw, raw) {
    const field = fieldMap.get(fieldId);
    const fieldType = (field?.type || fieldTypeRaw || "").toLowerCase();

    // optionIds array or JSON string? normalize to string[]
    let optionIds = [];
    if (Array.isArray(raw)) optionIds = raw.map(toStr);
    else if (typeof raw === "string" && (fieldType.includes("checkbox") || fieldType.includes("multi"))) {
      try { optionIds = JSON.parse(raw); } catch { /* keep empty */ }
    }

    // multi choice
    if (optionIds.length && (fieldType.includes("checkbox") || fieldType.includes("multi"))) {
      const names = optionIds.map(id => field?.options?.find(o => o.id === id)?.text || id);
      return names.join(", ") || "—";
    }

    // single choice
    const value = Array.isArray(raw) ? raw[0] : raw;
    const str = toStr(value);

    if (["radio", "dropdown", "mcq"].some(t => fieldType.includes(t))) {
      const opt = field?.options?.find(o => o.id === str)?.text;
      return opt || str || "—";
    }

    // file
    if (fieldType.includes("file")) {
      return str ? (
        <a className="vs-file" href={str} target="_blank" rel="noreferrer">View Uploaded File</a>
      ) : "—";
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
        {/* <div className="crumbs">
          <button className="btn" onClick={() => nav(-1)} aria-label="Back" style={{padding:"6px 10px"}}>←</button>
          <span className="crumb-sep">/</span>
          <Link className="crumb" to="/learn/my-submissions">My Submissions</Link>
          <span className="crumb-sep">/</span>
          <span className="crumb is-last">View submission</span>
        </div> */}
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

          {!loading && !err && orderedRows.map((row, idx) => (
            <div key={row.key ?? idx} className="fs-field">
              <div className="fs-qrow">
                <span className="fs-idx">{idx + 1}</span>
                <div className="fs-label">{row.label}</div>
              </div>

              {row.type.toLowerCase().includes("textarea") ? (
                <textarea className="fs-input" readOnly value={toStr(row.value)} />
              ) : (
                <div className="fs-input" aria-readonly>{toStr(row.value)}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* small info banner under card (optional) */}
      {/* <div className="fs-info-banner">
        ✅ Your submission was recorded successfully.
        <Link to="/learn/my-submissions" style={{marginLeft:8}}>Back to My Submissions</Link>
      </div> */}
    </div>
  );
}