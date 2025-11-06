// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminFormCard from "../components/AdminFormCard";
import "./AdminDashboard.css";
import { AuthService } from "../api/auth";
import ConfirmDialog from "../components/ConfirmDialog";
import { apiFetch } from "../api/http";
import { FormService } from "../api/forms"; // 👈 use real clone/delete

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [usingLocal, setUsingLocal] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [isAuthed, setIsAuthed] = useState(AuthService.isAuthenticated());

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cloneTarget, setCloneTarget] = useState(null);
  const [cloneName, setCloneName] = useState("");

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // bump this to force a refetch (after clone/delete)
  const [refreshTick, setRefreshTick] = useState(0);

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

        // ✅ CALL /api/Admin/forms (AdminController) with pagination + search
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (q.trim()) params.set("search", q.trim());

        const data = await apiFetch(`/api/Admin/forms?${params.toString()}`);

        const items = Array.isArray(data)
          ? data
          : data?.items || data?.Items || [];

        const totalFromApi = data?.total ?? data?.Total ?? items.length;

        if (!alive) return;

        const apiForms = items.map((f, idx) => {
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
            // include idx so React keys are unique even if backend reuses ids
            id: `${formKey ?? f.id ?? "row"}-${idx}`,
            formKey,
            title,
            status,
            meta,
            _from: "api",
          };
        });

        setForms(apiForms);
        setTotal(totalFromApi);
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
          const ui = drafts.map((d, idx) => ({
            id: d.id ?? `local-${idx}`,
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
  }, [page, pageSize, q, refreshTick]);

  // reset to page 1 when search/pageSize changes
  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  // search – client-side text filter over whatever we have in `forms`
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return forms;
    return forms.filter(
      (f) => (f.title || "").toLowerCase().includes(text)
    );
  }, [forms, q]);

  // pagination:
  // - when usingLocal: client-side pagination over filtered
  // - when using API: server-side pagination, only use `total` for pageCount
  const effectiveTotal = usingLocal ? filtered.length : total;
  const pageCount = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const pageSafe = Math.min(page, pageCount);

  const visible = useMemo(() => {
    if (!usingLocal) {
      // API already returned just this page; filtered only reduces, never adds.
      return filtered;
    }
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

  const handleClone = (form) => {
    setCloneTarget(form);
    setCloneName(`Clone of ${form.title}`);
  };

  const performClone = async () => {
    const form = cloneTarget;
    if (!form) return;

    const name = cloneName.trim() || `Clone of ${form.title}`;
    setCloneTarget(null);

    // If we don't have a real backend formKey, we can't use the API clone.
    if (!form.formKey) {
      alert("This form cannot be cloned because it is a local-only draft.");
      return;
    }

    try {
      // 1) Ask backend to clone the form (this should copy meta + layout)
      const res = await FormService.clone(form.formKey);

      const newKey =
        res?.formKey ?? res?.FormKey ?? res?.data?.formKey ?? null;

      // 2) Optionally rename the clone and force it to Draft
      if (newKey) {
        try {
          await FormService.updateMeta(newKey, {
            title: name,
            description: form.description ?? "",
            access: "Open",
          });
        } catch (e) {
          console.warn("Rename cloned form failed:", e);
        }

        try {
          await FormService.updateStatus(newKey, "Draft");
        } catch (e) {
          console.warn("Update cloned form status failed:", e);
        }
      }

      // 3) Re-fetch list so the cloned form appears correctly and persists
      setRefreshTick((t) => t + 1);
    } catch (e) {
      console.warn("Clone via API failed:", e);
      alert("Failed to clone form. Please try again.");
    }
  };

  const handleDelete = (form) => {
    setDeleteTarget(form);
  };

  const performDelete = async () => {
    const form = deleteTarget;
    if (!form) return;

    setDeleteTarget(null);

    if (form._from === "api" && form.formKey) {
      try {
        await FormService.remove(form.formKey);
      } catch (e) {
        console.warn("Delete via API failed:", e);
        alert("Failed to delete form.");
        return;
      }
    } else if (form._from === "local") {
      try {
        const raw = localStorage.getItem("fb_forms");
        let drafts = raw ? JSON.parse(raw) : [];
        drafts = drafts.filter((d) => d.id !== form.id);
        localStorage.setItem("fb_forms", JSON.stringify(drafts));
      } catch {
        // ignore
      }
    }

    // immediately update UI
    const next = forms.filter((x) => x.id !== form.id);
    setForms(next);

    // let next fetch recalc total + pagination
    setRefreshTick((t) => t + 1);
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
                    onClick={() =>
                      setPage((p) => Math.min(pageCount, p + 1))
                    }
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

      {/* Delete Form dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Form"
        body={
          <>
            <p>Are you sure you want to delete the form?</p>
            <p>
              This will permanently remove all related data and cannot be
              undone.
            </p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={performDelete}
      />

      {/* Clone Form dialog */}
      <ConfirmDialog
        open={!!cloneTarget}
        title="Clone Form"
        body={
          <>
            <p>Do you want to clone this form?</p>
            <p>
              This action will generate a copy of the form that you can edit
              separately.
            </p>

            <label className="clone-body-label">
              Form Name<span className="req">*</span>
            </label>
            <input
              className="clone-body-input"
              value={cloneName}
              maxLength={80}
              onChange={(e) => setCloneName(e.target.value)}
            />
            <div className="clone-body-count">
              {cloneName.length}/80
            </div>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Clone"
        onCancel={() => setCloneTarget(null)}
        onConfirm={performClone}
      />
    </div>
  );
}


