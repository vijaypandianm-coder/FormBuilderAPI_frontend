import React from 'react';

export default function ConfirmDialog({ open, title, body, confirmLabel='Yes, Delete', cancelLabel='Cancel', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="dlg-root">
      <div className="dlg-backdrop" onClick={onCancel} />
      <div role="dialog" aria-modal="true" className="dlg">
        <h3 className="dlg-title">{title}</h3>
        <p className="dlg-body">{body}</p>
        <div className="dlg-actions">
          <button className="btn ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}