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

// --- helper: read file -> base64 (WITHOUT prefix)
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Failed to read file"));
    fr.onload = () => {
      const result = String(fr.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    fr.readAsDataURL(file);
  });

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

  // NEW: file input handler
  const onChangeFile = (f) => async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      setValue(f.fieldId, null);
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setValue(f.fieldId, {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileBase64: base64,
      });
    } catch {
      setErr(`Failed to read '${f.label}'. Please try a different file.`);
    }
  };

  const validate = () => {
    for (const f of flatFields) {
      const t = (f.type || "").toLowerCase();
      if (!f.isRequired) continue;

      if (t === "file" || t === "upload") {
        const fv = values[f.fieldId];
        if (!fv || !fv.fileBase64) return `'${f.label}' is required.`;
        continue;
      }

      if (isChoiceType(t)) {
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
      const answers = flatFields.map((f) => {
        const t = (f.type || "").toLowerCase();

        if (t === "file" || t === "upload") {
          const fv = values[f.fieldId] || {};
          return {
            fieldId: f.fieldId,
            fileName: fv.fileName || "",
            contentType: fv.contentType || "",
            fileBase64: fv.fileBase64 || "",
          };
        }

        return isChoiceType(t)
          ? {
              fieldId: f.fieldId,
              optionIds: Array.isArray(values[f.fieldId])
                ? values[f.fieldId].map(String)
                : [],
            }
          : { fieldId: f.fieldId, answerValue: (values[f.fieldId] ?? "").toString() };
      });

      await apiFetch(`/api/Responses/${encodeURIComponent(formKey)}`, {
        method: "POST",
        body: JSON.stringify({ Answers: answers }),
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
    const t = (f.type || "").toLowerCase();

    switch (t) {
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
                <div className="fs-hint">Supported: PDF/JPEG/PNG. Max 10 MB.</div>
              </div>
            </div>
            <input className="fs-input" type="file" onChange={onChangeFile(f)} />
            {v?.fileName && (
              <div className="fs-file-pill" style={{ marginTop: 6 }}>
                Selected: <strong>{v.fileName}</strong>
              </div>
            )}
          </div>
        );

      // (other field renderers unchanged… text, textarea, number, date, dropdown, radio, checkbox)
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
      <div className="fs-hero">
        <div className="fs-hero-title">{formMeta.title}</div>
        {formMeta.description && (
          <div className="fs-hero-desc">{formMeta.description}</div>
        )}
      </div>

      <div className="fs-card">
        <div className="fs-card-header">
          <div className="fs-card-title">{formMeta.title}</div>
        </div>

        <div className="fs-card-body">
          {err && <div className="lr-error">{err}</div>}
          {sections.map((s, si) => (
            <section key={si} className="fs-section">
              {s.fields.map((f, idx) => renderField(f, idx + 1))}
            </section>
          ))}
        </div>

        <div className="fs-card-footer">
          <button className="ghost" type="button" onClick={onClear}>Clear Form</button>
          <div className="fs-spacer" />
          <button className="lr-primary" type="button" disabled={submitting} onClick={onSubmit}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}