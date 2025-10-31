import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./PreviewForm.css";
import File_Upload from "../assets/File_Upload.PNG";
/**
 * Expected localStorage("fb_preview"):
 * {
 *   header: { name, desc, title },
 *   questions: [{
 *     id, type, label, description, showDescription, required,
 *     options | choices | items: (string[] | {id|value,text|label}[])
 *   }]
 * }
 */

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, onClose]);
}

const toOptions = (q) => {
  const src = q?.options ?? q?.choices ?? q?.items ?? [];
  if (Array.isArray(src)) {
    if (src.length && typeof src[0] === "string") {
      return src.map((t, i) => ({ id: String(i + 1), text: String(t) }));
    }
    return src.map((o, i) => ({
      id: String(o.id ?? o.value ?? i + 1),
      text: String(o.text ?? o.label ?? o.value ?? o.id ?? `Option ${i + 1}`),
    }));
  }
  if (typeof src === "string") {
    return src
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((t, i) => ({ id: String(i + 1), text: t }));
  }
  return [];
};

/** Lightweight multi-select with chips + dropdown. */
function MultiSelect({ placeholder = "Select", value = [], onChange, options = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef(null);

  useOutsideClose(rootRef, () => setOpen(false));

  const selected = useMemo(
    () => options.filter((o) => value.includes(String(o.id))),
    [options, value]
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.text.toLowerCase().includes(needle));
  }, [q, options]);

  const toggle = (id) => {
    const idStr = String(id);
    if (value.includes(idStr)) onChange(value.filter((x) => x !== idStr));
    else onChange([...value, idStr]);
  };

  const removeChip = (id) => onChange(value.filter((x) => x !== String(id)));

  return (
    <div className="pf-input pf-multi" ref={rootRef}>
      <div className="pf-multi-row" onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 ? (
          <span className="pf-placeholder">{placeholder}</span>
        ) : (
          selected.map((o) => (
            <span className="pf-chip" key={o.id}>
              {o.text}
              <button
                type="button"
                className="pf-chip-x"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChip(o.id);
                }}
                aria-label={`Remove ${o.text}`}
              >
                ×
              </button>
            </span>
          ))
        )}
        <span className="chev" aria-hidden>▾</span>
      </div>

      {open && (
        <div className="pf-menu" role="listbox">
          <div className="pf-menu-search">
            <input
              type="text"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="pf-menu-body">
            {filtered.length === 0 ? (
              <div className="pf-opt empty">No options</div>
            ) : (
              filtered.map((o) => {
                const checked = value.includes(String(o.id));
                return (
                  <button
                    type="button"
                    key={o.id}
                    className={`pf-opt ${checked ? "checked" : ""}`}
                    onClick={() => toggle(o.id)}
                    role="option"
                    aria-selected={checked}
                  >
                    <span className={`pf-check ${checked ? "on" : ""}`} />
                    <span className="pf-opt-text">{o.text}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviewForm() {
  const navigate = useNavigate();

  const data = useMemo(() => {
    try {
      const raw = localStorage.getItem("fb_preview");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const title = data?.header?.title || "Employee Onboarding";
  const formName = data?.header?.name || "Course Feedback Form";
  const formDesc =
    data?.header?.desc ||
    "Help us improve! Share your feedback on your learning experience.";
  const questions = Array.isArray(data?.questions) ? data.questions : [];

  // editable state just for preview
  const [vals, setVals] = useState({});
  const [fileNames, setFileNames] = useState({});

  const setVal = (qid, v) => setVals((m) => ({ ...m, [qid]: v }));
  const clearAll = () => {
    setVals({});
    setFileNames({});
    // scroll back to top like Figma demo
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onFileChange = (q) => (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      setVal(q.id, null);
      setFileNames((m) => ({ ...m, [q.id]: "" }));
      return;
    }
    setVal(q.id, f);
    setFileNames((m) => ({ ...m, [q.id]: f.name }));
  };

  const renderField = (q) => {
    const t = String(q.type || "").toLowerCase();
    const label = q.label || "Untitled Question";
    const req = !!q.required;

    if (t === "multiselect" || t === "checkbox" || q.allowMultiple === true) {
      const options = toOptions(q);
      return (
        <MultiSelect
          placeholder="Select Answer"
          options={options}
          value={Array.isArray(vals[q.id]) ? vals[q.id] : []}
          onChange={(v) => setVal(q.id, v)}
        />
      );
    }

    switch (t) {
      case "short":
      case "text":
      case "input":
        return (
          <input
            className="pf-input"
            placeholder="Your Answer"
            value={vals[q.id] ?? ""}
            onChange={(e) => setVal(q.id, e.target.value)}
            aria-label={label}
          />
        );
      case "long":
      case "textarea":
        return (
          <textarea
            className="pf-input pf-textarea"
            placeholder="Your Answer"
            rows={3}
            value={vals[q.id] ?? ""}
            onChange={(e) => setVal(q.id, e.target.value)}
            aria-label={label}
          />
        );
      case "number":
        return (
          <input
            className="pf-input"
            placeholder="Numeric value"
            inputMode="numeric"
            value={vals[q.id] ?? ""}
            onChange={(e) => setVal(q.id, e.target.value.replace(/[^\d.-]/g, ""))}
            aria-label={label}
          />
        );
      case "date":
        return (
          <div className="pf-input pf-date" aria-label={label}>
            <span className="cal" aria-hidden>📅</span>
            <input
              type="date"
              value={vals[q.id] ?? ""}
              onChange={(e) => setVal(q.id, e.target.value)}
            />
          </div>
        );
      case "dropdown":
      case "select": {
        const options = toOptions(q);
        return (
          <div className="pf-input pf-select" aria-label={label}>
            <select
              value={vals[q.id] ?? ""}
              onChange={(e) => setVal(q.id, e.target.value)}
            >
              <option value="" disabled>
                Select Answer
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.text}
                </option>
              ))}
            </select>
            <span className="chev" aria-hidden>▾</span>
          </div>
        );
      }
      case "file":
      case "upload": {
        const accept =
          q.accept ||
          (Array.isArray(q.allowedTypes) ? q.allowedTypes.join(",") : null) ||
          ".pdf,.png,.jpg,.jpeg";
        const fileLabel = fileNames[q.id] || "Drop files here or Browse";
        const hint =
          q.fileHint ||
          "Supported files: PDF, JPEG, PNG | Max file size: 10 MB | Only one file allowed";
        return (
          <div className="pf-upload" aria-label={label}>
            <div className="pf-upload-icon"></div>
            <img src={File_Upload} alt="File Upload" className="FileUpload" />
            <div className="pf-upload-text">
              <label className="pf-file-trigger">
                {fileNames[q.id] ? (
                  <span className="chosen">{fileLabel}</span>
                ) : (
                  <>
                    Drop files here or <span className="link">Browse</span>
                  </>
                )}
                <input type="file" accept={accept} onChange={onFileChange(q)} />
              </label>
              <div className="pf-upload-hint">{hint}</div>
            </div>
          </div>
        );
      }
      default:
        return (
          <input
            className="pf-input"
            placeholder="Your Answer"
            value={vals[q.id] ?? ""}
            onChange={(e) => setVal(q.id, e.target.value)}
            aria-label={label}
          />
        );
    }
  };

  return (
    <div className="pf-root">
      {/* Top page bar (title centered) */}
      <header className="pf-topbar">
        <h1 className="pf-top-title">{title}</h1>
      </header>

      <main className="pf-main">
        {/* Form Card */}
        <section className="pf-card" aria-label="Preview form">
          <div className="pf-cap" aria-hidden />
          <div className="pf-card-inner">
            {/* Header text inside card */}
            <h2 className="pf-form-name">{formName}</h2>
            <p className="pf-form-desc">{formDesc}</p>

            {/* Questions */}
            <div className="pf-qs">
              {questions.map((q, i) => (
                <div className="pf-q" key={q.id ?? i}>
                  <div className="pf-qnum" aria-hidden>
                    {i + 1}
                  </div>

                  <div className="pf-qbody">
                    <div className="pf-qtitle">
                      {(q.label || "Untitled Question")}
                      {q.required ? <span className="req">*</span> : null}
                    </div>
                    {q.showDescription && q.description ? (
                      <div className="pf-qdesc">{q.description}</div>
                    ) : null}

                    <div className="pf-field">{renderField(q)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom toolbar */}
        <footer className="pf-footer">
          <button className="pf-ghost" type="button" onClick={clearAll}>
            Clear Form
          </button>

          <div className="pf-actions">
            <Link to="/" className="pf-btn">Back to Form List</Link>
            <button className="pf-btn pf-primary" onClick={() => navigate("/create-form")}>
              Back to Create Form
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}