// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminFormCard from "../components/AdminFormCard";
import "./AdminDashboard.css";
import { FormService } from "../api/forms";
import { AuthService } from "../api/auth";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [usingLocal, setUsingLocal] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [isAuthed, setIsAuthed] = useState(AuthService.isAuthenticated());

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setUsingLocal(false);
        setAuthError(false);

        if (!AuthService.isAuthenticated()) {
          setIsAuthed(false);
          setForms([]);
          setTotal(0);
          return;
        }
        setIsAuthed(true);

        // hit backend with page + search
        const data = await FormService.list({
          page,
          pageSize,
          status: "All",
          q,
        });

        const items = Array.isArray(data)
          ? data
          : data?.items || data?.Items || [];

        const totalFromApi = data?.total ?? data?.Total ?? items.length;

        if (!alive) return;

        const ui = items.map((f) => {
          const formKey = f.formKey ?? f.FormKey ?? f.key;
          const title = f.title ?? f.Title ?? "Untitled Form";
          const status = f.status ?? f.Status ?? "Draft";
          const publishedAt = f.publishedAt ?? f.PublishedAt ?? null;
          const createdAt =
            f.createdAt ?? f.CreatedAt ?? f.created_on ?? null;
          const createdByRaw =
            f.createdByName ??
            f.CreatedByName ??
            f.ownerName ??
            f.OwnerName ??
            f.createdBy ??
            f.CreatedBy ??
            f.ownerEmail ??
            null;

          const createdBy =
            createdByRaw === 0 ||
            createdByRaw === "0" ||
            createdByRaw == null ||
            String(createdByRaw).trim() === ""
              ? "Admin"
              : String(createdByRaw);

          const meta = [];
          meta.push({
            k: "Created Date",
            v: createdAt
              ? new Date(createdAt).toLocaleDateString()
              : "—",
          });
          if (publishedAt) {
            meta.push({
              k: "Published Date",
              v: new Date(publishedAt).toLocaleDateString(),
            });
          }
          meta.push({ k: "Created By", v: createdBy });

          return {
            id: formKey ?? f.id,
            formKey,
            title,
            status,
            meta,
            _from: "api",
          };
        });

        setTotal(totalFromApi);
        setForms(ui);
      } catch (e) {
        const msg = e?.message || "";
        if (
          msg.includes("Unauthorized") ||
          msg.includes("401") ||
          msg.includes("403")
        ) {
          setAuthError(true);
          setIsAuthed(false);
          setForms([]);
          setTotal(0);
        } else {
          console.warn(
            "List API failed; using local drafts. Reason:",
            msg
          );
          setUsingLocal(true);
          const raw = localStorage.getItem("fb_forms");
          const drafts = raw ? JSON.parse(raw) : [];
          const nowStr = new Date().toLocaleDateString();
          const ui = drafts.map((d) => ({
            id: d.id,
            formKey: null,
            title: d.title || "Untitled Form",
            status: d.status || "Draft",
            meta: [
              {
                k: "Created Date",
                v: d.createdAt
                  ? new Date(d.createdAt).toLocaleDateString()
                  : nowStr,
              },
              { k: "Created By", v: d.createdBy || "Admin" },
            ],
            _from: "local",
          }));
          setForms(ui);
          setTotal(ui.length);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAuthed, page, pageSize, q]);

  // reset to page 1 when search/pageSize changes
  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  // search applies only for local drafts; for API we already send q
  const filtered = useMemo(() => {
    if (!usingLocal) return forms;
    const text = q.trim().toLowerCase();
    return forms.filter(
      (f) => !text || (f.title || "").toLowerCase().includes(text)
    );
  }, [forms, q, usingLocal]);

  // pagination calculations
  const effectiveTotal = usingLocal ? filtered.length : total;
  const pageCount = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const pageSafe = Math.min(page, pageCount);

  const visible = useMemo(() => {
    if (!usingLocal) return filtered; // already a single page from API
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, usingLocal, pageSafe, pageSize]);

  const handleCreateForm = () => {
    navigate("/create-form", { state: { tab: "config" } });
  };

  const handleViewResponses = (form) => {
    if (form._from !== "api" || !form.formKey) {
      alert(
        "This form is a local draft. Publish or refresh after API is reachable to view."
      );
      return;
    }
    navigate(
      `/admin/forms/${encodeURIComponent(form.formKey)}?tab=responses`
    );
  };

  const openConfigView = (form) => {
    if (form._from !== "api" || !form.formKey) {
      alert(
        "This form is a local draft. Publish or refresh after API is reachable to view."
      );
      return;
    }
    navigate(
      `/admin/forms/${encodeURIComponent(form.formKey)}?tab=config`
    );
  };

  const openEditor = (form) => {
    navigate("/create-form", {
      state: { tab: "layout", formKey: form.formKey || null },
    });
  };

  const handleClone = async (form) => {
    if (form._from === "api" && form.formKey) {
      try {
        const res = await FormService.clone?.(form.formKey);
        const key = res?.formKey ?? `${form.formKey}-copy`;
        setForms((prev) => [
          {
            id: key,
            formKey: key,
            title: `${form.title} (Copy)`,
            status: "Draft",
            meta: [
              { k: "Created Date", v: new Date().toLocaleDateString() },
              { k: "Created By", v: "Admin" },
            ],
            _from: "api",
          },
          ...prev,
        ]);
        return;
      } catch (e) {
        console.warn("API clone failed, falling back to local:", e);
      }
    }
    const copy = {
      ...form,
      id: Date.now(),
      formKey: null,
      title: `${form.title} (Copy)`,
      status: "Draft",
      _from: "local",
      meta: [
        { k: "Created Date", v: new Date().toLocaleDateString() },
        { k: "Created By", v: "Admin" },
      ],
    };
    const next = [copy, ...forms];
    setForms(next);
    localStorage.setItem("fb_forms", JSON.stringify(next));
  };

  const handleDelete = async (form) => {
    if (!window.confirm(`Delete form "${form.title}"?`)) return;
    if (form._from === "api" && form.formKey) {
      try {
        await FormService.remove(form.formKey);
      } catch (e) {
        console.warn("Delete via API failed:", e);
      }
    }
    const next = forms.filter((x) => x.id !== form.id);
    setForms(next);
    if (form._from === "local")
      localStorage.setItem("fb_forms", JSON.stringify(next));
  };

  const signIn = () => navigate("/login", { state: { from: "/" } });

  return (
    <div className="adb-main container">
      {!isAuthed && (
        <div className="adb-banner">
          You are not authenticated (401). Log in to list forms. After
          logging in, refresh this page.&nbsp;
          <button className="adb-primary" onClick={signIn}>
            Sign in
          </button>
        </div>
      )}

      {usingLocal && isAuthed && (
        <div className="adb-banner">
          API not reachable — showing local drafts. “View Form” is disabled
          for drafts.
        </div>
      )}

      <div className="adb-header-row">
        <h2 className="adb-page-title">Form List</h2>
        <div className="adb-actions">
          <div className="adb-search">
            <input
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={!isAuthed && !usingLocal}
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

      <div className="adb-box">
        {loading ? (
          <section className="adb-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" />
            ))}
          </section>
        ) : !isAuthed && !usingLocal ? (
          <div className="adb-empty">Sign in to view forms.</div>
        ) : (
          <>
            <section className="adb-grid">
              {visible.map((f) => (
                <AdminFormCard
                  key={f.id}
                  form={f}
                  onView={() => handleViewResponses(f)} // Responses tab
                  onConfig={() => openConfigView(f)} // Config tab
                  onEdit={() => openEditor(f)} // Builder for drafts
                  onClone={() => handleClone(f)}
                  onDelete={() => handleDelete(f)}
                />
              ))}
              {visible.length === 0 && (
                <div className="adb-empty">No forms found.</div>
              )}
            </section>

            {/* pagination footer – same layout as ViewForm footer */}
            <div className="adb-footer">
              <div className="vf-pager">
                <div className="vf-ipp">
                  Items per page{" "}
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="grow" />
                <div className="vf-page">
                  <button
                    className="btn small pill"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageSafe <= 1}
                  >
                    ‹
                  </button>
                  <span>
                    {pageSafe} of {pageCount}
                  </span>
                  <button
                    className="btn small pill"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={pageSafe >= pageCount}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}