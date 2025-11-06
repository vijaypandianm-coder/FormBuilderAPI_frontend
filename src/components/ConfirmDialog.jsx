// src/components/ConfirmDialog.jsx
import React from "react";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="dlg-root">
      <div className="dlg-backdrop" onClick={onCancel} />
      <div role="dialog" aria-modal="true" className="dlg">
        <h3 className="dlg-title">{title}</h3>

        <div className="dlg-body">
          {typeof body === "string" ? <p>{body}</p> : body}
        </div>

        <div className="dlg-actions">
          <button className="btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="btn primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}