// src/pages/FormSubmissionPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormService } from "../api/forms";
import { apiFetch } from "../api/http";
import "./learner.css";

const isChoiceType = (t = "") =>
  ["radio", "dropdown", "checkbox", "multiselect"].includes(t.toLowerCase());

function normalizeOptions(field) {
  if (Array.isArray(field.options) && field.options.length > 0) {
    if (typeof field.options[0] === "string") {
      return field.options.map((txt, i) => ({ id: String(i + 1), text: String(txt) }));
    }
    return field.options.map((o) => ({
      id: String(o.id ?? o.Id ?? o.value ?? o.Value ?? o.text),
      text: String(o.text ?? o.label ?? o.value ?? o.id),
    }));
  }
  if (Array.isArray(field.choices) && field.choices.length > 0) {
    return field.choices.map((o) => ({
      id: String(o.id ?? o.value),
      text: String(o.text ?? o.label ?? o.value),
    }));
  }
  return [];
}

export default function FormSubmissionPage() {
  const { formKey } = useParams();
  const nav = useNavigate();

  const [formMeta, setFormMeta] = useState({
    id: "",
    key: null,
    title: "",
    description: "",
  });

  const [sections, setSections] = useState([]);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        const meta = await FormService.get(formKey);
        const { sections: secs } = await FormService.layout(formKey);

        if (!alive) return;
        setFormMeta({
          id: meta?.id ?? meta?.Id ?? "",
          key: meta?.formKey ?? meta?.FormKey ?? (Number(formKey) || null),
          title: meta?.title ?? meta?.Title ?? "Untitled Form",
          description: meta?.description ?? meta?.Description ?? "",
        });

        const mapped = (secs || []).map((s, si) => ({
          title: s.title ?? "",
          description: s.description || "",
          fields: (s.fields || []).map((f, i) => ({
            fieldId: f.fieldId || f.id || `f_${si + 1}_${i + 1}`,
            label: f.label || `Question ${i + 1}`,
            helpText: f.helpText || f.placeholder || "",
            type: (f.type || "text").toString(),
            isRequired: !!(f.isRequired ?? f.required),
            options: normalizeOptions(f),
            dateFormat: f.dateFormat,
          })),
        }));

        setSections(mapped);
      } catch (e) {
        setErr(e?.message || "Failed to load form");
      }
    })();
    return () => { alive = false; };
  }, [formKey]);

  const flatFields = useMemo(() => sections.flatMap((s) => s.fields), [sections]);

  const setValue = (fieldId, v) => setValues((prev) => ({ ...prev, [fieldId]: v }));
  const onChangeText = (f) => (e) => setValue(f.fieldId, e.target.value);
  const onChangeNumber = (f) => (e) => setValue(f.fieldId, e.target.value);
  const onChangeDate = (f) => (e) => setValue(f.fieldId, e.target.value);
  const onChangeRadio = (f) => (e) =>
    setValue(f.fieldId, e.target.value ? [String(e.target.value)] : []);
  const onChangeDropdown = (f) => (e) =>
    setValue(f.fieldId, e.target.value ? [String(e.target.value)] : []);
  const onChangeCheckbox = (f, optId) => (e) => {
    const cur = Array.isArray(values[f.fieldId]) ? values[f.fieldId] : [];
    const idStr = String(optId);
    setValue(f.fieldId, e.target.checked ? [...cur, idStr] : cur.filter((x) => x !== idStr));
  };

  const validate = () => {
    for (const f of flatFields) {
      if (!f.isRequired) continue;
      if (isChoiceType(f.type)) {
        const arr = values[f.fieldId];
        if (!Array.isArray(arr) || arr.length === 0) return `'${f.label}' is required.`;
      } else {
        const v = (values[f.fieldId] ?? "").toString().trim();
        if (!v) return `'${f.label}' is required.`;
      }
    }
    return null;
  };

  const onClear = () => setValues({});

  const onSubmit = async () => {
    const vErr = validate();
    if (vErr) { setErr(vErr); return; }

    setErr("");
    setSubmitting(true);
    try {
      const answers = flatFields.map((f) =>
        isChoiceType(f.type)
          ? {
              fieldId: f.fieldId,
              optionIds: Array.isArray(values[f.fieldId])
                ? values[f.fieldId].map(String)
                : [],
            }
          : { fieldId: f.fieldId, answerValue: (values[f.fieldId] ?? "").toString() }
      );

      // Build payload with correct casing
      await apiFetch(`/api/Responses/${encodeURIComponent(formKey)}`, {
        method: "POST",
        body: JSON.stringify({ Answers: answers }),   // ✅ FIXED: "Answers" not "answers"
        headers: { "Content-Type": "application/json" },
      });

      nav("/learn/my-submissions", { replace: true });
    } catch (e) {
      const msg = (e?.message || "Submit failed").toLowerCase().includes("foreign key")
        ? "Submit failed: server rejected the submission due to a form key linkage. Please refresh and try again."
        : e?.message || "Submit failed";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f, idx) => {
    const v = values[f.fieldId];

    switch ((f.type || "").toLowerCase()) {
      case "textarea":
      case "longtext":
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                {f.helpText && <div className="fs-hint">{f.helpText}</div>}
              </div>
            </div>
            <textarea
              className="fs-input"
              placeholder="Your Answer"
              value={v || ""}
              onChange={onChangeText(f)}
            />
          </div>
        );

      case "number":
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                {f.helpText && <div className="fs-hint">{f.helpText}</div>}
              </div>
            </div>
            <input
              className="fs-input"
              type="number"
              value={v || ""}
              onChange={onChangeNumber(f)}
              placeholder="Your Answer"
            />
          </div>
        );

      case "date":
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                <div className="fs-hint">Select the date</div>
              </div>
            </div>
            <input
              className="fs-input"
              type="date"
              value={v || ""}
              onChange={onChangeDate(f)}
              placeholder={f.dateFormat || "DD/MM/YYYY"}
            />
          </div>
        );

      case "dropdown":
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                <div className="fs-hint">Choose your level of satisfaction</div>
              </div>
            </div>
            <select
              className="fs-input"
              value={(Array.isArray(v) && v[0]) || ""}
              onChange={onChangeDropdown(f)}
            >
              <option value="">Select Answer</option>
              {f.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>
        );

      case "radio":
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                {f.helpText && <div className="fs-hint">{f.helpText}</div>}
              </div>
            </div>
            <div className="fs-list">
              {f.options.map((o) => (
                <label key={o.id} className="fs-opt">
                  <input
                    type="radio"
                    name={f.fieldId}
                    value={o.id}
                    checked={Array.isArray(values[f.fieldId]) && values[f.fieldId][0] === o.id}
                    onChange={onChangeRadio(f)}
                  />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "checkbox":
      case "multiselect":
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                {f.helpText && <div className="fs-hint">{f.helpText}</div>}
              </div>
            </div>
            <div className="fs-list">
              {f.options.map((o) => (
                <label key={o.id} className="fs-opt">
                  <input
                    type="checkbox"
                    checked={
                      Array.isArray(values[f.fieldId])
                        ? values[f.fieldId].includes(o.id)
                        : false
                    }
                    onChange={onChangeCheckbox(f, o.id)}
                  />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "file":
      case "upload":
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                <div className="fs-hint">
                  Drop files here or Browse (filename only is stored for now)
                </div>
              </div>
            </div>
            <input
              className="fs-input"
              type="text"
              placeholder="e.g., screenshot.png"
              value={v || ""}
              onChange={onChangeText(f)}
            />
          </div>
        );

      default:
        return (
          <div className="fs-field" key={f.fieldId}>
            <div className="fs-qrow">
              <span className="fs-idx">{idx}</span>
              <div className="fs-q">
                <label className="fs-label">
                  {f.label} {f.isRequired && <span className="req">*</span>}
                </label>
                {f.helpText && <div className="fs-hint">{f.helpText}</div>}
              </div>
            </div>
            <input
              className="fs-input"
              placeholder="Your Answer"
              value={v || ""}
              onChange={onChangeText(f)}
            />
          </div>
        );
    }
  };

  return (
    <div className="fs-shell">
      {/* HERO */}
      <div className="fs-hero">
        <div className="fs-hero-title">{formMeta.title}</div>
        {formMeta.description && (
          <div className="fs-hero-desc">{formMeta.description}</div>
        )}
      </div>

      {/* CARD */}
      <div className="fs-card">
        <div className="fs-card-header">
          <div className="fs-card-title">{formMeta.title}</div>
          <div className="fs-card-sub">
            Help us improve! Share your feedback on your learning experience.
          </div>
        </div>

        <div className="fs-card-body">
          {err && <div className="lr-error" style={{ marginBottom: 16 }}>{err}</div>}
          {sections.length === 0 && (
            <div className="lr-empty">No fields configured for this form.</div>
          )}

          {sections.map((s, si) => (
            <section key={si} className="fs-section">
              {s.fields.map((f, idx) => renderField(f, idx + 1))}
            </section>
          ))}
        </div>

        <div className="fs-card-footer">
          <button className="ghost" type="button" onClick={onClear}>
            Clear Form
          </button>
          <div className="fs-spacer" />
          <button
            className="lr-primary"
            type="button"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>

      {/* INFO BANNER */}
      <div className="fs-info-banner">
        This form cannot be saved temporarily; please submit once completed.
      </div>
    </div>
  );
}