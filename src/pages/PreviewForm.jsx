import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./PreviewForm.css";

/**
 * This page expects data in localStorage under "fb_preview":
 * {
 *   header: { name: string, desc: string, title: string }, // title is the big page title
 *   questions: [{ id, type, label, description, showDescription, required }]
 * }
 *
 * We already write this from CreateForm before navigating here.
 */
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

  const renderField = (q) => {
    switch (q.type) {
      case "short":
        return (
          <input
            className="pf-input"
            placeholder="Your Answer"
            disabled
            aria-label={q.label}
          />
        );
      case "long":
        return (
          <textarea
            className="pf-input pf-textarea"
            placeholder="Your Answer"
            rows={3}
            disabled
            aria-label={q.label}
          />
        );
      case "date":
        return (
          <div className="pf-input pf-date" aria-label={q.label}>
            <span className="cal" aria-hidden>📅</span>
            <input placeholder="DD/MM/YYYY" disabled />
          </div>
        );
      case "dropdown":
        return (
          <div className="pf-input pf-select" aria-label={q.label}>
            <select disabled defaultValue="">
              <option value="" disabled>
                Select Answer
              </option>
              <option value="opt1">Option 1</option>
              <option value="opt2">Option 2</option>
            </select>
            <span className="chev" aria-hidden>▾</span>
          </div>
        );
      case "file":
        return (
          <div className="pf-upload" aria-label={q.label}>
            <div className="pf-upload-icon">📎</div>
            <div className="pf-upload-text">
              Drop files here or <span className="link">Browse</span>
              <div className="pf-upload-hint">
                Supported files: PDF, JPEG, PNG | Max file size: 2 MB | Only
                one file allowed
              </div>
            </div>
          </div>
        );
      case "number":
        return (
          <input
            className="pf-input"
            placeholder="Numeric value"
            disabled
            aria-label={q.label}
          />
        );
      default:
        return (
          <input
            className="pf-input"
            placeholder="Your Answer"
            disabled
            aria-label={q.label}
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
                <div className="pf-q" key={q.id}>
                  <div className="pf-qnum" aria-hidden>
                    {i + 1}
                  </div>

                  <div className="pf-qbody">
                    <div className="pf-qtitle">
                      {q.label || "Untitled Question"}
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
          <button
            className="pf-ghost"
            onClick={() => {
              // just a demo clear; doesn't affect builder data
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Clear Form
          </button>

          <div className="pf-actions">
            <Link to="/" className="pf-btn">
              Back to Form List
            </Link>
            <button className="pf-btn pf-primary" onClick={() => navigate("/create-form")}>
              Back to Create Form
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}