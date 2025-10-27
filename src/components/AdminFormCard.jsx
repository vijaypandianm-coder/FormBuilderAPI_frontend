import React, { useEffect, useRef, useState } from "react";
import "./AdminFormCard.css";

/**
 * Props
 * - form: {
 *     id, title, status: "Published" | "Draft",
 *     meta: [{k, v}, ...]
 *   }
 * - onView, onEdit, onClone, onDelete
 */
export default function AdminFormCard({
  form,
  onView = () => {},
  onEdit = () => {},
  onClone = () => {},
  onDelete = () => {},
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [menuOpen]);

  // Helpers for menu item depending on status
  const isPublished = form.status === "Published";
  const primaryLabel = isPublished ? "View Form" : "Edit Form";
  const primaryHandler = isPublished ? () => onView(form) : () => onEdit(form);

  return (
    <article
      className="fc"
      role="region"
      aria-label={`${form.title} card`}
      ref={wrapRef}
    >
      {/* HEADER with lavender strip + title + 3-dot */}
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
            &#8942; {/* vertical ellipsis */}
          </button>

          {menuOpen && (
            <div
              className="kebab-menu"
              role="menu"
              // keep menu open while interacting
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="kebab-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  primaryHandler();
                }}
              >
                {primaryLabel}
              </button>

              <button
                className="kebab-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onClone(form); // ✅ clone reliably
                }}
              >
                Clone
              </button>

              <button
                className="kebab-item danger"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
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

      {/* BODY: meta info */}
      <div className="fc-meta">
        {form.meta?.map((m, i) => (
          <div className="meta-row" key={i}>
            <span className="k">{m.k}:</span>
            <span className="v">{m.v}</span>
          </div>
        ))}
      </div>

      {/* FOOTER: status + responses */}
      <div className="fc-ft">
        {isPublished ? (
          <span className="pill pill-green">Published</span>
        ) : (
          <span className="pill pill-amber">Draft</span>
        )}

        <button
          className="btn primary"
          onClick={() => (isPublished ? onView(form) : onEdit(form))}
        >
          View Responses
        </button>
      </div>
    </article>
  );
}