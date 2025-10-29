// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminFormCard from "../components/AdminFormCard";
import "./AdminDashboard.css";
import Home from "./../assets/Home.png";
import { FormService } from "../api/forms";      // ✅ correct
import { AuthService } from "../api/auth";       // ✅ correct

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [usingLocal, setUsingLocal] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [isAuthed, setIsAuthed] = useState(AuthService.isAuthenticated()); // ✅

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setUsingLocal(false);
        setAuthError(false);

        if (!AuthService.isAuthenticated()) {     // ✅
          setIsAuthed(false);
          setForms([]);
          return;
        }
        setIsAuthed(true);

        const { items = [] } = await FormService.list({ page: 1, pageSize: 50, status: "All" });

        if (!alive) return;

        const ui = items.map((f) => ({
          id: f.formKey,
          formKey: f.formKey,
          title: f.title || "Untitled Form",
          status: f.status || "Draft",
          meta: f.publishedAt ? [{ k: "Published Date", v: new Date(f.publishedAt).toLocaleDateString() }] : [],
          _from: "api",
        }));
        setForms(ui);
      } catch (e) {
        const msg = e?.message || "";
        if (msg.includes("Unauthorized") || msg.includes("401") || msg.includes("403")) {
          setAuthError(true);
          setIsAuthed(false);
          setForms([]);
        } else {
          console.warn("List API failed; using local drafts. Reason:", msg);
          setUsingLocal(true);
          const raw = localStorage.getItem("fb_forms");
          const drafts = raw ? JSON.parse(raw) : [];
          const ui = drafts.map((d) => ({
            id: d.id,
            formKey: null,
            title: d.title || "Untitled Form",
            status: d.status || "Draft",
            meta: d.meta || [],
            _from: "local",
          }));
          setForms(ui);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [isAuthed]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return forms.filter((f) => !text || (f.title || "").toLowerCase().includes(text));
  }, [forms, q]);

  /* ──────────────────────────────────────────────────────────
     🔧 CREATE PART (only this changed)
     - Always allow navigating to the builder.
     - No auth gating here; if API isn’t available, your builder
       already saves to localStorage and you’ll still be able to continue.
     ────────────────────────────────────────────────────────── */
  const handleCreateForm = () => {
    navigate("/create-form", { state: { tab: "config" } });
  };

  const handleView = (form) => {
    if (form._from !== "api" || !form.formKey) {
      alert("This form is a local draft. Publish or refresh after API is reachable to view.");
      return;
    }
    navigate(`/forms/${encodeURIComponent(form.formKey)}?tab=responses`);
  };

  const handleClone = async (form) => {
    if (form._from === "api" && form.formKey) {
      try {
        const res = await FormService.clone?.(form.formKey);
        const key = res?.formKey ?? `${form.formKey}-copy`;
        setForms((prev) => [
          { id: key, formKey: key, title: `${form.title} (Copy)`, status: "Draft",
            meta: [{ k: "Last Saved", v: new Date().toLocaleDateString() }], _from: "api" },
          ...prev,
        ]);
        return;
      } catch (e) {
        console.warn("API clone failed, falling back to local:", e);
      }
    }
    const copy = {
      ...form, id: Date.now(), formKey: null, title: `${form.title} (Copy)`, status: "Draft",
      _from: "local", meta: [{ k: "Last Saved", v: new Date().toLocaleDateString() }],
    };
    const next = [copy, ...forms];
    setForms(next);
    localStorage.setItem("fb_forms", JSON.stringify(next));
  };

  const handleDelete = async (form) => {
    if (!window.confirm(`Delete form "${form.title}"?`)) return;
    if (form._from === "api" && form.formKey) {
      try { await FormService.remove(form.formKey); } catch (e) { console.warn("Delete via API failed:", e); }
    }
    const next = forms.filter((x) => x.id !== form.id);
    setForms(next);
    if (form._from === "local") localStorage.setItem("fb_forms", JSON.stringify(next));
  };

  const signIn = () => navigate("/login", { state: { from: "/" } });
  const signOut = () => { AuthService.logout(); setIsAuthed(false); setForms([]); };

  return (
    <div className="adb-root">
      <div className="adb-breadcrumb">
        <span className="crumb-home" aria-hidden><img src={Home} alt="Home" /></span>
        <span className="crumb">Form Builder</span>
        <div style={{ marginLeft: "auto" }}>
          {isAuthed ? (
            <button className="adb-secondary" onClick={signOut}>Sign out</button>
          ) : (
            <button className="adb-primary" onClick={signIn}>Sign in</button>
          )}
        </div>
      </div>

      <main className="adb-main container">
        {!isAuthed && (
          <div className="adb-banner">
            You are not authenticated (401). Log in to list forms. After logging in, refresh this page.
          </div>
        )}
        {usingLocal && isAuthed && (
          <div className="adb-banner">
            API not reachable — showing local drafts. “View Form” is disabled for drafts.
          </div>
        )}

        <div className="adb-header-row">
          <h2 className="adb-page-title">Form List</h2>
          <div className="adb-actions">
            <div className="adb-search">
              <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} disabled={!isAuthed && !usingLocal} />
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            {/* 🔧 Create button is now ALWAYS enabled */}
            <button className="adb-primary" onClick={handleCreateForm}>
              Create Form
            </button>
          </div>
        </div>

        <div className="adb-box">
          {loading ? (
            <section className="adb-grid">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}
            </section>
          ) : !isAuthed && !usingLocal ? (
            <div className="adb-empty">Sign in to view forms.</div>
          ) : (
            <section className="adb-grid">
              {filtered.map((f) => (
                <AdminFormCard
                  key={f.id}
                  form={f}
                  onView={() => handleView(f)}
                  onEdit={() => navigate("/create-form", { state: { tab: "layout" } })}
                  onClone={() => handleClone(f)}
                  onDelete={() => handleDelete(f)}
                />
              ))}
              {filtered.length === 0 && <div className="adb-empty">No forms found.</div>}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}