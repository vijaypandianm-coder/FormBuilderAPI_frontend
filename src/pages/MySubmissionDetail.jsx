// src/pages/MySubmissionDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ResponseService from "../api/responses";
import { FormService } from "../api/forms";
import { AuthService } from "../api/auth";
import "./learner.css";

// tiny helpers
const toStr = (x) => (x == null ? "" : String(x));

export default function MySubmissionDetail() {
  const { responseId } = useParams();
  const nav = useNavigate();

  const [header, setHeader] = useState(null);         // { formKey, submittedAt, ... }
  const [answers, setAnswers] = useState([]);         // [{ fieldId, fieldType, answerValue }]
  const [form, setForm] = useState(null);             // full form (title, description, layout)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Build quick lookup maps once form loads
  const fieldMap = useMemo(() => {
    if (!form?.layout) return new Map();
    const list = [];
    for (const sec of form.layout) {
      for (const f of (sec.fields || [])) list.push(f);
    }
    return new Map(list.map((f) => [f.fieldId, f]));
  }, [form]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // 1) fetch response detail (header + answers)
        const detail = await ResponseService.getDetail(responseId);
        if (!alive) return;

        const h = detail?.header || detail?.Header || {};
        const a = detail?.answers || detail?.Answers || [];
        setHeader({
          ...h,
          submittedAt:
            h.submittedAt || h.SubmittedAt
              ? new Date(h.submittedAt || h.SubmittedAt)
              : null,
        });
        setAnswers(
          a.map((x) => ({
            fieldId: x.fieldId ?? x.FieldId,
            fieldType: (x.fieldType ?? x.FieldType ?? "").toString(),
            answerValue: x.answerValue ?? x.AnswerValue ?? "",
          }))
        );

        // 2) fetch form meta/layout for labels & option texts
        const fk = h.formKey ?? h.FormKey;
        if (fk) {
          const f = await FormService.get(fk);
          // Ensure we have a normalized layout object: { sections:[{ fields:[] }], title, description }
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
                options:
                  (ff.options ?? ff.Options ?? []).map((opt) => ({
                    id: opt.id ?? opt.Id,
                    text: opt.text ?? opt.Text,
                  })) || [],
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
    return () => {
      alive = false;
    };
  }, [responseId]);

  // Resolve display text for a field/value
  function renderValue(fieldId, fieldTypeRaw, valueRaw) {
    const field = fieldMap.get(fieldId);
    const fieldType = (field?.type || fieldTypeRaw || "").toLowerCase();
    const value = toStr(valueRaw);

    // Multi-choice saved as JSON array? try parse
    if ((fieldType.includes("checkbox") || fieldType.includes("multi")) && value) {
      try {
        const arr = JSON.parse(value);
        if (Array.isArray(arr)) {
          const text = arr
            .map((id) => field?.options?.find((o) => o.id === id)?.text || id)
            .join(", ");
          return text || "—";
        }
      } catch {
        /* fall through */
      }
    }

    // Single choice (radio/dropdown)
    if (
      ["radio", "dropdown", "mcq"].some((t) => fieldType.includes(t)) &&
      value
    ) {
      const chosen = field?.options?.find((o) => o.id === value)?.text;
      return chosen || value;
    }

    // File — we only have an ID/path (if you add file API, make it a link)
    if (fieldType.includes("file")) {
      return value ? (
        <a className="vs-file" href={value} target="_blank" rel="noreferrer">
          View Uploaded File
        </a>
      ) : (
        "—"
      );
    }

    // Date — already saved as DD/MM/YYYY by your save validator
    if (fieldType.includes("date")) return value || "—";

    // Default text
    return value || "—";
  }

  // Prepare rows in form order (section/field order from layout)
  const orderedRows = useMemo(() => {
    if (!form?.layout?.length) {
      // No layout available; just dump answers as-is
      return answers.map((a, idx) => ({
        key: `${a.fieldId}-${idx}`,
        label: a.fieldId,
        value: renderValue(a.fieldId, a.fieldType, a.answerValue),
      }));
    }

    const mapAns = new Map(answers.map((a) => [a.fieldId, a]));
    const rows = [];
    for (const sec of form.layout) {
      for (const f of sec.fields || []) {
        const a = mapAns.get(f.fieldId);
        rows.push({
          key: f.fieldId,
          label: f.label || f.fieldId,
          value: a ? renderValue(f.fieldId, a.fieldType, a.answerValue) : "—",
          type: f.type,
        });
      }
    }
    return rows;
  }, [answers, form, fieldMap]);

  return (
    <div className="vs-shell">
      <div className="vs-topline">
        <button className="vs-back" onClick={() => nav(-1)}>←</button>
        <span>Form Builder</span>
        <Link className="vs-link" to="/learn/my-submissions">
          Back to My Submission
        </Link>
      </div>

      {/* Banner */}
      <section className="vs-banner">
        <div className="vs-program">{form?.title || "Form"}</div>
        {form?.description ? (
          <div className="vs-sub">{form.description}</div>
        ) : null}
      </section>

      {/* Card with purple rule */}
      <section className="vs-card">
        <div className="vs-card-head">
          <div className="vs-card-title">Professional Certificate Training</div>
          <div className="vs-rule" />
        </div>

        {/* Submitted badge */}
        <div className="vs-stamp">
          Form Submission
          {header?.submittedAt ? (
            <span className="vs-chip">
              Submitted on{" "}
              {header.submittedAt.toLocaleString()}
            </span>
          ) : null}
        </div>

        {/* Fields */}
        <div className="vs-fields">
          {orderedRows.map((row, idx) => (
            <div key={row.key || idx} className="vs-field">
              <div className="vs-label">
                <span className="vs-qno">{idx + 1}</span>
                {row.label}
              </div>

              {/* Read-only “controls” */}
              {row.type?.toLowerCase().includes("textarea") ? (
                <div className="vs-textarea" aria-readonly>{row.value}</div>
              ) : (
                <div className="vs-input" aria-readonly>{row.value}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}