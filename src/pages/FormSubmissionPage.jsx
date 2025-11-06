// src/pages/FormSubmissionPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormService } from "../api/forms";
import { apiFetch } from "../api/http";
import "./PreviewForm.css";   // reuse pretty visuals
import "./learner.css";       // errors etc.
import File_Upload from "../assets/File_Upload.png";
import Submit from "../assets/Submit.png"; // success card image

/* ---------------- helpers ---------------- */

const normalizeType = (t = "") => t.toString().trim().toLowerCase();

// dropdown detection (handles a few name variants)
const isDropdownType = (t = "") => {
  const lt = normalizeType(t);
  return (
    lt === "dropdown" ||
    lt === "drop down" ||
    lt === "drop-down" ||
    lt === "select"
  );
};

const isMultiChoice = (t = "") => {
  const lt = normalizeType(t);
  return (
    lt === "checkbox" ||
    lt === "multi" ||
    lt === "multiselect" ||
    lt === "multi select" ||
    lt === "multi-select"
  );
};

const isSingleChoice = (t = "") => {
  const lt = normalizeType(t);
  return lt === "radio" || lt === "single choice" || lt === "single";
};

/** Normalize options -> [{id, text}] from options|choices|items (array or CSV) */
function normalizeOptions(field = {}) {
  const src =
    field.options ??
    field.Options ??
    field.choices ??
    field.Choices ??
    field.items ??
    field.Items ??
    field.choiceItems ??
    field.ChoiceItems ??
    [];

  if (Array.isArray(src)) {
    // [ "A", "B", ... ]
    if (src.length && typeof src[0] === "string") {
      return src.map((txt, i) => ({ id: String(i + 1), text: String(txt) }));
    }

    // [ { id/text/... }, ... ]
    return src.map((o, i) => ({
      id: String(
        o.id ??
          o.Id ??
          o.value ??
          o.Value ??
          o.key ??
          o.Key ??
          i + 1
      ),
      text: String(
        o.text ??
          o.Text ??
          o.label ??
          o.Label ??
          o.value ??
          o.Value ??
          o.id ??
          o.Id ??
          `Option ${i + 1}`
      ),
    }));
  }

  // CSV or newline-separated string
  if (typeof src === "string") {
    return src
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((txt, i) => ({ id: String(i + 1), text: txt }));
  }

  return [];
}

// File -> base64 (no data: prefix)
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Failed to read file"));
    fr.onload = () => {
      const s = String(fr.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    fr.readAsDataURL(file);
  });

/** Convert browser yyyy-MM-dd -> dd/MM/yyyy (your API requires this) */
function toDdMmYyyy(v) {
  if (!v) return v;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
/** Convert stored dd/MM/yyyy -> yyyy-MM-dd so input[type=date] shows it */
function toYyyyMmDd(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Chip group UI (for radio/checkbox style questions)
 *  mode = 'single' | 'multi'
 */
function ChoiceChips({ options = [], value = [], onChange, mode = "multi" }) {
  const sel = Array.isArray(value) ? value.map(String) : [];

  const toggle = (id) => {
    const idStr = String(id);
    if (mode === "single") {
      onChange(sel.length === 1 && sel[0] === idStr ? [] : [idStr]);
    } else {
      onChange(
        sel.includes(idStr)
          ? sel.filter((x) => x !== idStr)
          : [...sel, idStr]
      );
    }
  };

  return (
    <div className="fs-chip-shell">
      <div className="fs-chip-wrap">
        {options.length === 0 ? (
          <div className="lr-hint">No options configured</div>
        ) : (
          options.map((o) => {
            const idStr = String(o.id);
            const checked = sel.includes(idStr);
            return (
              <button
                key={idStr}
                type="button"
                className={`fs-chip ${checked ? "on" : ""}`}
                onClick={() => toggle(idStr)}
                aria-pressed={checked}
              >
                <span className="fs-chip-label">{o.text}</span>
                {checked && (
                  <span className="fs-chip-close" aria-hidden>
                    ✕
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
      {/* chevron on the right like Figma */}
      <span className="fs-chip-caret" aria-hidden>
        ▾
      </span>
    </div>
  );
}

/* ---------------- page ---------------- */

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
  const [fileNames, setFileNames] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // success dialog toggle
  const [showSuccess, setShowSuccess] = useState(false);

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
            type: String(f.type || "text"),
            isRequired: !!(f.isRequired ?? f.required),
            options: normalizeOptions(f),
            dateFormat: f.dateFormat,
            // 🔑 capture multi-select flag from backend in every shape we expect
            isMulti: !!(
              f.multi ??
              f.Multi ??
              f.isMulti ??
              f.IsMulti ??
              f.allowMultiple ??
              f.AllowMultiple ??
              false
            ),
          })),
        }));
        setSections(mapped);
      } catch (e) {
        setErr(e?.message || "Failed to load form");
      }
    })();
    return () => {
      alive = false;
    };
  }, [formKey]);

  const flatFields = useMemo(
    () => sections.flatMap((s) => s.fields),
    [sections]
  );

  const setValue = (id, v) =>
    setValues((m) => ({
      ...m,
      [id]: v,
    }));

  const onChangeText = (f) => (e) => setValue(f.fieldId, e.target.value);
  const onChangeNumber = (f) => (e) =>
    setValue(f.fieldId, e.target.value.replace(/[^\d.-]/g, ""));
  const onChangeDate = (f) => (e) =>
    setValue(f.fieldId, toDdMmYyyy(e.target.value));

  const onChangeFile = (f) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setValue(f.fieldId, null);
      setFileNames((m) => ({ ...m, [f.fieldId]: "" }));
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setValue(f.fieldId, {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileBase64: b64,
      });
      setFileNames((m) => ({ ...m, [f.fieldId]: file.name }));
    } catch {
      setErr(`Failed to read '${f.label}'. Please try a different file.`);
    }
  };

  /* -------- validation & submit -------- */

  const validate = () => {
    for (const f of flatFields) {
      const t = normalizeType(f.type);
      if (!f.isRequired) continue;

      if (t === "file" || t === "upload") {
        const fv = values[f.fieldId];
        if (!fv || !fv.fileBase64) return `'${f.label}' is required.`;
        continue;
      }

      if (isDropdownType(t) || isSingleChoice(t) || isMultiChoice(t)) {
        const raw = values[f.fieldId];
        const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
        if (!arr.length) return `'${f.label}' is required.`;
        continue;
      }

      if (t === "date") {
        const v = String(values[f.fieldId] ?? "").trim();
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v))
          return `'${f.label}' must be in dd/MM/yyyy format.`;
        continue;
      }

      const v = String(values[f.fieldId] ?? "").trim();
      if (!v) return `'${f.label}' is required.`;
    }
    return null;
  };

  const onClear = () => {
    setValues({});
    setFileNames({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async () => {
    const vErr = validate();
    if (vErr) {
      setErr(vErr);
      return;
    }

    setErr("");
    setSubmitting(true);
    try {
      const answers = flatFields.map((f) => {
        const t = normalizeType(f.type);

        if (t === "file" || t === "upload") {
          const fv = values[f.fieldId] || {};
          return {
            fieldId: f.fieldId,
            fileName: fv.fileName || "",
            contentType: fv.contentType || "",
            fileBase64: fv.fileBase64 || "",
          };
        }

        if (t === "date") {
          return {
            fieldId: f.fieldId,
            answerValue: toDdMmYyyy(values[f.fieldId] || ""),
          };
        }

        if (isDropdownType(t) || isSingleChoice(t) || isMultiChoice(t)) {
          const raw = values[f.fieldId];
          const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
          return {
            fieldId: f.fieldId,
            optionIds: arr.map(String),
          };
        }

        return {
          fieldId: f.fieldId,
          answerValue: String(values[f.fieldId] ?? ""),
        };
      });

      await apiFetch(`/api/Responses/${encodeURIComponent(formKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Answers: answers }),
      });

      onClear();
      setShowSuccess(true);
    } catch (e) {
      const msg = (e?.message || "Submit failed")
        .toLowerCase()
        .includes("foreign key")
        ? "Submit failed: server rejected the submission due to a form key linkage. Please refresh and try again."
        : e?.message || "Submit failed";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* -------- renderers -------- */

  const renderField = (f, idx) => {
    const t = normalizeType(f.type);
    const v = values[f.fieldId];
    const opts = f.options || [];
    const req = f.isRequired;
    const isMultiDropdown = isDropdownType(t) && f.isMulti;

    // 🔽 DROPDOWN
    if (isDropdownType(t)) {
      // multi-select dropdown
      if (isMultiDropdown) {
        const selected = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
        return (
          <div className="pf-q" key={f.fieldId}>
            <div className="pf-qnum" aria-hidden>
              {idx}
            </div>
            <div className="pf-qbody">
              <div className="pf-qtitle">
                {f.label} {req && <span className="req">*</span>}
              </div>
              {f.helpText && <div className="pf-qdesc">{f.helpText}</div>}

              <select
                className="pf-input"
                multiple
                value={selected}
                onChange={(e) => {
                  const arr = Array.from(e.target.selectedOptions).map(
                    (o) => o.value
                  );
                  setValue(f.fieldId, arr);
                }}
              >
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.text}
                  </option>
                ))}
              </select>
              <div className="pf-qdesc">
                You can select one or more options.
              </div>
            </div>
          </div>
        );
      }

      // single-select dropdown
      const selected = Array.isArray(v) ? v[0] || "" : v || "";
      return (
        <div className="pf-q" key={f.fieldId}>
          <div className="pf-qnum" aria-hidden>
            {idx}
          </div>
          <div className="pf-qbody">
            <div className="pf-qtitle">
              {f.label} {req && <span className="req">*</span>}
            </div>
            {f.helpText && <div className="pf-qdesc">{f.helpText}</div>}

            <select
              className="pf-input"
              value={selected}
              onChange={(e) =>
                setValue(
                  f.fieldId,
                  e.target.value ? [e.target.value] : []
                )
              }
            >
              <option value="">Select</option>
              {opts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    // RADIO / CHECKBOX style -> chips
    if (isSingleChoice(t) || isMultiChoice(t)) {
      return (
        <div className="pf-q" key={f.fieldId}>
          <div className="pf-qnum" aria-hidden>
            {idx}
          </div>
          <div className="pf-qbody">
            <div className="pf-qtitle">
              {f.label} {req && <span className="req">*</span>}
            </div>
            {f.helpText && <div className="pf-qdesc">{f.helpText}</div>}
            <ChoiceChips
              options={opts}
              value={Array.isArray(v) ? v : []}
              onChange={(ids) => setValue(f.fieldId, ids)}
              mode={isSingleChoice(t) ? "single" : "multi"}
            />
          </div>
        </div>
      );
    }

    if (t === "file" || t === "upload") {
      const hint = "Supported files: PDF, JPEG, PNG | Max 10 MB";
      const accept =
        f.accept ||
        (Array.isArray(f.allowedTypes)
          ? f.allowedTypes.join(",")
          : null) ||
        ".pdf,.png,.jpg,.jpeg";
      const chosen = fileNames[f.fieldId];

      return (
        <div className="pf-q" key={f.fieldId}>
          <div className="pf-qnum" aria-hidden>
            {idx}
          </div>
          <div className="pf-qbody">
            <div className="pf-qtitle">
              {f.label} {req && <span className="req">*</span>}
            </div>
            {f.helpText && <div className="pf-qdesc">{f.helpText}</div>}
            <div
              className="pf-upload"
              style={{
                border: "1px dashed grey",
                padding: "0 !important",
                height: "148px",
              }}
              aria-label={f.label}
            >
              <div className="pf-upload-text">
                <img
                  src={File_Upload}
                  style={{ width: "87.5px", height: "70px" }}
                  className="pf-upload-icon"
                />
              <label className="pf-file-trigger">
                  {chosen ? (
                    <span className="chosen">{chosen}</span>
                  ) : (
                    <span style={{ fontWeight: "400" }}>
                      Drop file or <span className="link">Browse</span>
                    </span>
                  )}
                  <input
                    type="file"
                    accept={accept}
                    onChange={onChangeFile(f)}
                  />
                </label>
                <div className="pf-upload-hint">{hint}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (t === "number") {
      return (
        <div className="pf-q" key={f.fieldId}>
          <div className="pf-qnum" aria-hidden>
            {idx}
          </div>
          <div className="pf-qbody">
            <div className="pf-qtitle">
              {f.label} {req && <span className="req">*</span>}
            </div>
            {f.helpText && <div className="pf-qdesc">{f.helpText}</div>}
            <input
              className="pf-input"
              inputMode="numeric"
              placeholder="Numeric value"
              value={v ?? ""}
              onChange={onChangeNumber(f)}
            />
          </div>
        </div>
      );
    }

    if (t === "date") {
      return (
        <div className="pf-q" key={f.fieldId}>
          <div className="pf-qnum" aria-hidden>
            {idx}
          </div>
          <div className="pf-qbody">
            <div className="pf-qtitle">
              {f.label} {req && <span className="req">*</span>}
            </div>
            {f.helpText && <div className="pf-qdesc">{f.helpText}</div>}
            <div className="pf-input pf-date" aria-label={f.label}>
              <span className="cal" aria-hidden>
                
              </span>
              <input
                type="date"
                value={toYyyyMmDd(v)}
                onChange={onChangeDate(f)}
              />
            </div>
            <div className="pf-qdesc">
              Format sent to server: dd/MM/yyyy
            </div>
          </div>
        </div>
      );
    }

    // short/long text
    const isLong = t === "long" || t === "textarea";
    return (
      <div className="pf-q" key={f.fieldId}>
        <div className="pf-qnum" aria-hidden>
          {idx}
        </div>
        <div className="pf-qbody">
          <div className="pf-qtitle">
            {f.label} {req && <span className="req">*</span>}
          </div>
          {f.helpText && <div className="pf-qdesc">{f.helpText}</div>}
          {isLong ? (
            <textarea
              className="pf-input pf-textarea"
              rows={3}
              placeholder="Your Answer"
              value={v ?? ""}
              onChange={onChangeText(f)}
            />
          ) : (
            <input
              className="pf-input"
              placeholder="Your Answer"
              value={v ?? ""}
              onChange={onChangeText(f)}
            />
          )}
        </div>
      </div>
    );
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    nav("/learn/my-submissions", { replace: true });
  };

  return (
    <div className="pf-root">
      <header className="pf-topbar">
        <h1 className="pf-top-title">
          {formMeta.title || "Start Submission"}
        </h1>
      </header>

      <main className="pf-main">
        <section className="pf-card" aria-label="Submission form">
          <div className="pf-cap" aria-hidden />
          <div className="pf-card-inner">
            <h2 className="pf-form-name">{formMeta.title || "Form"}</h2>
            {formMeta.description && (
              <p className="pf-form-desc">{formMeta.description}</p>
            )}

            {err && (
              <div className="lr-error" style={{ marginBottom: 12 }}>
                {err}
              </div>
            )}

            <div className="pf-qs">
              {sections.flatMap((s) =>
                (s.fields || []).map((f, i) => renderField(f, i + 1))
              )}
            </div>
          </div>
        </section>
      </main>
      
        <footer className="pf-footer">
          <button className="pf-ghost" type="button" onClick={onClear}>
            Clear Form
          </button>
          <div className="pf-actions">
            <button
              className="pf-btn pf-primary"
              type="button"
              disabled={submitting}
              onClick={onSubmit}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </footer>

      {/* ===== Submitted Successfully dialog ===== */}
      {showSuccess && (
        <div className="fs-success-root">
          <div className="fs-success-backdrop" />
          <div
            className="fs-success-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fs-success-title"
          >
            <img src={Submit} alt="" className="fs-success-icon" />
            <h2 id="fs-success-title" className="fs-success-title">
              Submitted Successfully!
            </h2>
            <p className="fs-success-text">
              Thanks for completing the form. We&apos;ve received your
              submission successfully.
            </p>
            <button
              type="button"
              className="fs-success-btn"
              onClick={handleSuccessClose}
            >
              Go back to Skill Assessments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}