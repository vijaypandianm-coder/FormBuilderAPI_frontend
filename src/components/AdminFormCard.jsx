// src/components/AdminFormCard.jsx
import React, { useEffect, useRef, useState } from "react";
import "./AdminFormCard.css";

export default function AdminFormCard({
  form,
  onView = () => {},    // → View Form » Responses
  onConfig = () => {},  // → View Form » Form Configuration
  onEdit = () => {},    // → Builder (for drafts)
  onDelete = () => {},
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleDocClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
    };
  }, [menuOpen]);

  const isPublished = String(form.status).toLowerCase() === "published";
  const primaryLabel = isPublished ? "View Form" : "Edit Form";

  return (
    <article
      className="fc"
      role="region"
      aria-label={`${form.title} card`}
      ref={wrapRef}
    >
      <div className="fc-hd-strip">
        <h4 className="fc-title" title={form.title}>
          {form.title}
        </h4>

        <div className="kebab">
          <button
            className="kebab-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((s) => !s);
            }}
          >
            &#8942;
          </button>

          {menuOpen && (
            <div
              className="kebab-menu"
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* If published → View Form (Config tab); if draft → Edit (builder) */}
              <button
                className="kebab-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  if (isPublished) onConfig(form);
                  else onEdit(form);
                }}
              >
                {primaryLabel}
              </button>

              <button
                className="kebab-item danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(form);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="fc-meta">
        {form.meta?.map((m, i) => (
          <div className="meta-row" key={i}>
            <span className="k">{m.k}:</span>
            <span className="v">{m.v}</span>
          </div>
        ))}
      </div>

      <div className="fc-ft">
        {isPublished ? (
          <span
            className="pill pill-green"
            style={{
              border: "solid 1px #3AB876",
              color: "#3AB876",
              backgroundColor: "#80D8BC40",
            }}
          >
            Published
          </span>
        ) : (
          <span
            className="pill pill-amber"
            style={{
              border: "solid 1px #F6A609",
              color: "#F6A609",
              backgroundColor: "#FEF4E1",
            }}
          >
            Draft
          </span>
        )}
        <button className="btn primary" onClick={() => onView(form)}>
          View Responses
        </button>
      </div>
    </article>
  );
}