import React, { useEffect, useRef, useState } from 'react';


export default function KebabMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);
  return (
    <div className="kebab" ref={ref}>
      <button className="kebab-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o=>!o)}>⋮</button>
      {open && (
        <div role="menu" className="kebab-menu">
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              className={`kebab-item ${it.disabled ? 'disabled' : ''}`}
              title={it.title || ''}
              onClick={() => {
                if (it.disabled) return;
                it.onSelect?.();
                setOpen(false);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}