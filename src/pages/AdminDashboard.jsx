import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminFormCard from "../components/AdminFormCard";
import "./AdminDashboard.css";
import Home from "./../assets/Home.png";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Load from localStorage (fb_forms) on mount and keep in sync
  useEffect(() => {
    const read = () => {
      const raw = localStorage.getItem("fb_forms");
      setForms(raw ? JSON.parse(raw) : []);
      setLoading(false);
    };
    setLoading(true);
    read();

    const onStorage = (e) => {
      if (e.key === "fb_forms") {
        const r = e.newValue;
        setForms(r ? JSON.parse(r) : []);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return forms.filter((f) => !text || (f.title || "").toLowerCase().includes(text));
  }, [forms, q]);

  const handleCreateForm = () =>
    navigate("/create-form", { state: { tab: "config" } });

  const handleClone = (form) => {
    const copy = {
      ...form,
      id: Date.now(),
      title: `${form.title} (Copy)`,
      status: "Draft",
      meta: [{ k: "Last Saved", v: new Date().toLocaleDateString() }],
    };
    const next = [copy, ...forms];
    setForms(next);
    localStorage.setItem("fb_forms", JSON.stringify(next));
  };

  const handleDelete = (form) => {
    const next = forms.filter((x) => x.id !== form.id);
    setForms(next);
    localStorage.setItem("fb_forms", JSON.stringify(next));
  };

  const noop = () => {};

  return (
    <div className="adb-root">
      {/* Thin breadcrumb bar (Figma-like) */}
      <div className="adb-breadcrumb">
        <span className="crumb-home" aria-hidden>
          <img src={Home} alt="Home" />
        </span>
        <span className="crumb">Form Builder</span>
      </div>

      <main className="adb-main">
        {/* Header row */}
        <div className="adb-header-row">
          <h2 className="adb-page-title">Form List</h2>

          <div className="adb-actions">
            <div className="adb-search">
              <input
                placeholder="Search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search"
              />
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <button className="adb-primary" onClick={handleCreateForm}>
              Create Form
            </button>
          </div>
        </div>

        {/* Enclosing box that wraps the whole grid area (matches Figma) */}
        <div className="adb-box">
          {loading ? (
            <section className="adb-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" />
              ))}
            </section>
          ) : (
            <section className="adb-grid">
              {filtered.map((f) => (
                <AdminFormCard
                  key={f.id}
                  form={f}
                  onView={noop}
                  onEdit={noop}
                  onClone={() => handleClone(f)}
                  onDelete={() => handleDelete(f)}
                />
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}