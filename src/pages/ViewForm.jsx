// src/pages/ViewForm.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FormService } from "../api/forms";
import { ResponsesApi } from "../api/responses";
import "./ViewForm.css";
import short from "../assets/short.png";
import long from "../assets/long.png";
import date from "../assets/date.png";
import dropdown from "../assets/dropdown.png";
import file from "../assets/files.png";
import number from "../assets/number.png";
import search from "../assets/search.png";

const useQuery = () => new URLSearchParams(useLocation().search);

// same base URL that apiFetch uses (configure in .env as VITE_API_BASE_URL)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ---- helper: try to auto-find a JWT in localStorage / sessionStorage (same as MySubmissionDetail) ----
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;

function extractJwtFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const value of Object.values(obj)) {
    if (!value) continue;
    if (typeof value === "string" && jwtRegex.test(value)) return value;
    if (typeof value === "object") {
      const nested = extractJwtFromObject(value);
      if (nested) return nested;
    }
  }
  return null;
}

function findJwtToken() {
  const scanStore = (store) => {
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        const val = store.getItem(key);
        if (!val) continue;

        // raw string token
        if (jwtRegex.test(val)) return val;

        // token hidden in JSON
        const first = val[0];
        if (first === "{" || first === "[") {
          try {
            const parsed = JSON.parse(val);
            const found = extractJwtFromObject(parsed);
            if (found) return found;
          } catch {
            // ignore JSON parse errors
          }
        }
      }
    } catch {
      // some browsers can throw on access, ignore
    }
    return null;
  };

  return scanStore(window.localStorage) || scanStore(window.sessionStorage);
}

/* ---------- AUTHENTICATED FILE DOWNLOAD: uses Id from formresponsefiles (file:{Id}) ---------- */
async function downloadFileFromToken(tokenRaw) {
  if (!tokenRaw) return;
  const token = String(tokenRaw);

  // expected format from backend: "file:{Id}" (Id is 1,2,3,... from formresponsefiles)
  const match = /^file:(\d+)$/.exec(token);
  const fileIdRaw = match ? match[1] : token; // fallback if format differs

  const url = `${API_BASE}/api/Response/file/${encodeURIComponent(fileIdRaw)}`;

  const jwt = findJwtToken();
  if (!jwt) {
    console.warn("No JWT token found in storage – download will be 401");
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: jwt
        ? {
            Authorization: `Bearer ${jwt}`,
          }
        : {},
    });

    if (!res.ok) {
      const msg = `Download failed (${res.status})`;
      console.error(msg);
      alert(msg);
      return;
    }

    const blob = await res.blob();

    // Try to extract filename from Content-Disposition
    let filename = "download";
    const cd =
      res.headers.get("Content-Disposition") ||
      res.headers.get("content-disposition");
    if (cd) {
      const matchName =
        /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
      if (matchName) {
        try {
          filename = decodeURIComponent(matchName[1] || matchName[2]);
        } catch {
          filename = (matchName[1] || matchName[2] || "").trim() || filename;
        }
      }
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (e) {
    console.error("Download error", e);
    alert("Failed to download file");
  }
}

/* ---------- helpers for labels & choice options ---------- */

const normalizeType = (t = "") => t.toString().trim().toLowerCase();

const isChoiceType = (t = "") => {
  const lt = normalizeType(t);
  return (
    lt === "dropdown" ||
    lt === "radio" ||
    lt === "checkbox" ||
    lt === "multiselect" ||
    lt === "multi-select" ||
    lt === "multi select" ||
    lt === "mcq" ||
    lt === "multiple"
  );
};

// build map: fieldId -> { type, isChoice, optionsById }
function buildFieldMetaIndex(lyt) {
  const meta = {};
  const sections = Array.isArray(lyt?.sections)
    ? lyt.sections
    : Array.isArray(lyt)
    ? lyt
    : [];

  sections.forEach((s) => {
    (s.fields || []).forEach((f) => {
      const fieldId =
        f.fieldId ||
        f.id ||
        f.key ||
        f.name ||
        f.slug ||
        f.dbKey ||
        f.code ||
        f.uuid;
      if (!fieldId) return;

      const type = normalizeType(f.type || "");
      const isChoice = isChoiceType(type);

      let optionsById = {};
      if (isChoice) {
        const src =
          f.options ??
          f.Options ??
          f.choices ??
          f.Choices ??
          f.items ??
          f.Items ??
          [];
        const arr = Array.isArray(src) ? src : [];
        optionsById = {};
        arr.forEach((o, i) => {
          if (!o) return;
          const id =
            o.id ??
            o.Id ??
            o.value ??
            o.Value ??
            `opt_${i + 1}`;
          const text =
            o.text ??
            o.Text ??
            o.label ??
            o.Label ??
            o.value ??
            o.Value ??
            id;
          optionsById[String(id)] = String(text);
        });
      }

      meta[String(fieldId)] = { type, isChoice, optionsById };
    });
  });

  return meta;
}

/* ---------- label key helpers ---------- */

const normalizeKey = (k) => {
  if (k == null) return "";
  const s = String(k);
  const last = s.split(/[\/:\.]/).pop();
  const hexTail = last.match(/[a-f0-9]{24,32}$/i);
  return (hexTail ? hexTail[0] : last).toLowerCase();
};

const buildLabelIndex = (lyt) => {
  const idx = {};
  const sections = Array.isArray(lyt?.sections)
    ? lyt.sections
    : Array.isArray(lyt)
    ? lyt
    : [];
  sections.forEach((s) => {
    const fields = Array.isArray(s?.fields) ? s.fields : [];
    fields.forEach((f) => {
      const label = f.label || f.name || "Untitled";
      const candidates = [
        f.fieldId,
        f.id,
        f.key,
        f.name,
        f.slug,
        f.dbKey,
        f.code,
        f.uuid,
      ].filter(Boolean);
      candidates.forEach((k) => {
        const raw = String(k);
        idx[raw] = label;
        idx[raw.toLowerCase()] = label;
        idx[normalizeKey(raw)] = label;
      });
    });
  });
  return idx;
};

const resolveLabel = (fieldId, fallbacks, labelIndex, lyt) => {
  const raw = fieldId != null ? String(fieldId) : "";
  const norm = normalizeKey(raw);

  if (labelIndex[raw]) return labelIndex[raw];
  if (labelIndex[raw.toLowerCase()]) return labelIndex[raw.toLowerCase()];
  if (labelIndex[norm]) return labelIndex[norm];

  const hit = Object.keys(labelIndex).find((k) => {
    const kn = normalizeKey(k);
    return (
      raw.endsWith(k) ||
      raw.toLowerCase().endsWith(k.toLowerCase()) ||
      norm === kn ||
      norm.endsWith(kn)
    );
  });
  if (hit) return labelIndex[hit];

  const sections = Array.isArray(lyt?.sections)
    ? lyt.sections
    : Array.isArray(lyt)
    ? lyt
    : [];
  for (const s of sections) {
    for (const f of s?.fields || []) {
      const keys = [
        f.fieldId,
        f.id,
        f.key,
        f.name,
        f.slug,
        f.dbKey,
        f.code,
        f.uuid,
      ]
        .filter(Boolean)
        .map(String);
      if (
        keys.some((k) => {
          const kn = normalizeKey(k);
          return (
            raw.endsWith(k) ||
            raw.toLowerCase().endsWith(k.toLowerCase()) ||
            norm === kn ||
            norm.endsWith(kn)
          );
        })
      ) {
        return f.label || f.name || "Untitled";
      }
    }
  }
  return (
    fallbacks.fieldLabel ||
    fallbacks.label ||
    fallbacks.questionLabel ||
    raw
  );
};

/* ---------- username helpers ---------- */

const safeJson = async (url, signal) => {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
};

const normalizeBulkUsers = (data) => {
  if (!data) return {};
  if (Array.isArray(data)) {
    const out = {};
    data.forEach((u) => {
      if (u && u.id !== undefined) {
        out[u.id] = u.name || u.username || `User ${u.id}`;
      }
    });
    return out;
  }
  const out = {};
  Object.entries(data).forEach(([id, name]) => {
    const n =
      typeof name === "string"
        ? name
        : name?.name || name?.username;
    out[Number(id)] = n || `User ${id}`;
  });
  return out;
};

export default function ViewForm() {
  const { formKey } = useParams();
  const q = useQuery();
  const navigate = useNavigate();

  const [tab, setTab] = useState(q.get("tab") || "config");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [form, setForm] = useState(null);
  const layout = form?.layout || null;

  // responses state
  const [activeRespTab, setActiveRespTab] = useState("summary");
  const [respQ, setRespQ] = useState("");
  const [respPage, setRespPage] = useState(1);
  const [respPageSize, setRespPageSize] = useState(10);
  const [respRows, setRespRows] = useState([]);
  const [respTotal, setRespTotal] = useState(0);
  const respPages = Math.max(1, Math.ceil(respTotal / respPageSize));
  const [selectedRespId, setSelectedRespId] = useState(null);

  // username cache
  const [userNameMap, setUserNameMap] = useState({});

  /* ---------------- URL sync ---------------- */
  useEffect(() => {
    const s = new URLSearchParams(window.location.search);
    if (s.get("tab") !== tab) {
      s.set("tab", tab);
      navigate({ search: `?${s.toString()}` }, { replace: true });
    }
  }, [tab, navigate]);

  /* ---------------- form fetch ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const dto = await FormService.get(formKey);
        if (!alive) return;
        setForm(dto);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [formKey]);

  const fetchUsernamesIfMissing = async (ids, signal) => {
    const missing = ids.filter((id) => !(id in userNameMap));
    if (!missing.length) return;

    const bulkCandidates = [
      `/api/users/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
      `/api/admin/users/by-ids?ids=${encodeURIComponent(
        missing.join(",")
      )}`,
      `/users/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
      `/admin/users/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
    ];
    for (const url of bulkCandidates) {
      const data = await safeJson(url, signal);
      if (data) {
        const add = normalizeBulkUsers(data);
        if (Object.keys(add).length) {
          setUserNameMap((m) => ({ ...m, ...add }));
          return;
        }
      }
    }

    const perIdCandidates = (id) => [
      `/api/users/${id}`,
      `/api/admin/users/${id}`,
      `/users/${id}`,
      `/admin/users/${id}`,
      `/api/user/${id}`,
    ];

    await Promise.allSettled(
      missing.map(async (id) => {
        for (const url of perIdCandidates(id)) {
          const u = await safeJson(url, signal);
          if (u) {
            setUserNameMap((m) => ({
              ...m,
              [id]: u.name || u.username || `User ${id}`,
            }));
            return;
          }
        }
      })
    );
  };

  /* ---------------- responses fetch ---------------- */
  useEffect(() => {
    if (tab !== "responses") return;
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setErr("");

        const flat = await ResponsesApi.list(Number(formKey));

        // indexes from layout
        const labelIdx = buildLabelIndex(layout);
        const fieldMetaIndex = buildFieldMetaIndex(layout);

        const byId = new Map();
        flat.forEach((row) => {
          if (!byId.has(row.responseId)) {
            byId.set(row.responseId, {
              id: row.responseId,
              userId: row.userId,
              submittedOn: row.submittedAt,
              fields: [],
            });
          }

          const meta =
            fieldMetaIndex[String(row.fieldId)] ||
            fieldMetaIndex[row.fieldId] ||
            {};
          const rawVal = row.answerValue ?? "";
          let displayValue = rawVal;

          // Convert stored option IDs -> option text(s) for choice fields
          if (meta.isChoice && rawVal) {
            let ids = [];

            const trimmed = String(rawVal).trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  ids = parsed.map((x) => String(x));
                } else if (parsed != null) {
                  ids = [String(parsed)];
                }
              } catch {
                ids = [trimmed];
              }
            } else if (trimmed.includes(",")) {
              ids = trimmed
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            } else {
              ids = [trimmed];
            }

            const texts = ids.map(
              (id) => meta.optionsById?.[String(id)] || id
            );
            displayValue = texts.join(", ");
          }

          byId.get(row.responseId).fields.push({
            fieldId: row.fieldId,
            label: resolveLabel(
              row.fieldId,
              row,
              labelIdx,
              layout
            ),
            value: displayValue,
            rawValue: rawVal,
          });
        });

        const query = respQ.trim().toLowerCase();
        let subs = Array.from(byId.values()).sort(
          (a, b) =>
            new Date(b.submittedOn) - new Date(a.submittedOn)
        );

        if (query) {
          subs = subs.filter(
            (s) =>
              String(s.userId).includes(query) ||
              s.fields.some(
                (f) =>
                  String(f.label || "")
                    .toLowerCase()
                    .includes(query) ||
                  String(f.value || "")
                    .toLowerCase()
                    .includes(query)
              )
          );
        }

        const total = subs.length;
        const start = (respPage - 1) * respPageSize;
        const pageRows = subs.slice(start, start + respPageSize);

        const idsOnPage = [
          ...new Set(
            pageRows
              .map((r) => r.userId)
              .filter((v) => v != null)
          ),
        ];
        fetchUsernamesIfMissing(idsOnPage, ctrl.signal);

        // Used In = Form title
        const rows =
          activeRespTab === "summary"
            ? pageRows.map((s) => ({
                id: s.id,
                userId: s.userId,
                userName:
                  userNameMap[s.userId] || `User ${s.userId}`,
                submittedOn: s.submittedOn,
                usedIn: form?.title || "—",
                email: "—",
              }))
            : pageRows;

        if (!alive) return;
        setRespRows(rows);
        setRespTotal(total);

        if (activeRespTab === "individual") {
          const ids = pageRows.map((r) => r.id);
          if (!ids.includes(selectedRespId)) {
            setSelectedRespId(pageRows[0]?.id ?? null);
          }
        }
      } catch (e) {
        if (!alive) return;
        setRespRows([]);
        setRespTotal(0);
        setErr(e?.message || "Failed to load responses");
      }
    })();

    return () => {
      ctrl.abort();
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    activeRespTab,
    respPage,
    respPageSize,
    respQ,
    formKey,
    layout,
    userNameMap,
    form?.title,
  ]);

  /* ---------------- renderers ---------------- */
  const FIELD_TYPES = [
    {
      id: "short",
      label: "Short Text",
      placeholder: "Short Text (Up to 100 Characters)",
      icon: short,
    },
    {
      id: "long",
      label: "Long Text",
      placeholder: "Long Text (Up to 500 Characters)",
      icon: long,
    },
    {
      id: "date",
      label: "Date Picker",
      placeholder: "DD/MM/YYYY",
      icon: date,
    },
    {
      id: "dropdown",
      label: "Dropdown",
      placeholder: "Option 1",
      icon: dropdown,
    },
    {
      id: "file",
      label: "File Upload",
      placeholder: "Upload your file",
      icon: file,
    },
    {
      id: "number",
      label: "Number",
      placeholder: "Numeric value",
      icon: number,
    },
  ];

  const renderConfig = () => (
    <div className="vf-card">
      <div className="vf-card-head">Form Details</div>

      <div className="vf-field">
        <label className="vf-label">Form Name</label>
        <input className="vf-input" value={form?.title || ""} disabled />
      </div>

      <div className="vf-field">
        <label className="vf-label">Form Description</label>
        <textarea
          className="vf-input"
          rows={3}
          value={form?.description || ""}
          disabled
        />
      </div>

      <div className="vf-field">
        <label className="vf-label">Form Visibility</label>

        {/* Figma toggle (read-only) */}
        <label className="vf-switch" aria-label="Form visibility">
          <input
            type="checkbox"
            checked={
              String(form?.status).toLowerCase() === "published"
            }
            readOnly
          />
          <span aria-hidden />
        </label>

        <p className="vf-hint">
          Turn on to allow new workflows to use this form. Turn off to
          hide it; existing workflows keep working.
        </p>
      </div>
    </div>
  );

  /* ---------- Form Layout ---------- */
  const renderLayout = () => {
    const sections = Array.isArray(layout?.sections)
      ? layout.sections
      : Array.isArray(layout)
      ? layout
      : [];

    return (
      <div className="vf-layout">
        {/* LEFT: palette (read-only) */}
        <aside className="vf-left">
          <div className="vf-pane">
            <div className="vf-pane-title">Input Fields</div>
            <div className="vf-list">
              <div className="vf-item">
                <img
                  src={short}
                  style={{
                    height: "40px",
                    width: "40px",
                    borderRadius: "5.13px",
                    marginRight: "8px",
                  }}
                  alt="Short Text"
                />
                Short Text
              </div>
              <div className="vf-item">
                <img
                  src={long}
                  style={{
                    height: "40px",
                    width: "40px",
                    borderRadius: "5.13px",
                    marginRight: "8px",
                  }}
                  alt="Long Text"
                />
                Long Text
              </div>
              <div className="vf-item">
                <img
                  src={date}
                  style={{
                    height: "40px",
                    width: "40px",
                    borderRadius: "5.13px",
                    marginRight: "8px",
                  }}
                  alt="Date Picker"
                />
                Date Picker
              </div>
              <div className="vf-item">
                <img
                  src={dropdown}
                  style={{
                    height: "40px",
                    width: "40px",
                    borderRadius: "5.13px",
                    marginRight: "8px",
                  }}
                  alt="Dropdown"
                />
                Dropdown
              </div>
              <div className="vf-item">
                <img
                  src={file}
                  style={{
                    height: "40px",
                    width: "40px",
                    borderRadius: "5.13px",
                    marginRight: "8px",
                  }}
                  alt="File Upload"
                />
                File Upload
              </div>
              <div className="vf-item">
                <img
                  src={number}
                  style={{
                    height: "40px",
                    width: "40px",
                    borderRadius: "5.13px",
                    marginRight: "8px",
                  }}
                  alt="File Upload"
                />
                Number
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT: header card + section cards */}
        <section className="vf-right">
          <div className="vf-formhead vfl">
            <div className="title">{form?.title || "Form Header"}</div>
            {form?.description ? (
              <div className="desc">{form.description}</div>
            ) : null}
          </div>

          {sections.length === 0 ? (
            <div className="vf-empty">Not Found</div>
          ) : (
            sections.map((s, si) => (
              <section key={si} className="vfl-sec">
                {(s.fields || []).map((f, fi) => {
                  const label =
                    f.label ||
                    f.name ||
                    f.fieldId ||
                    f.id ||
                    `Untitled Question ${fi + 1}`;
                  const typeTxt = (f.type || "")
                    .toString()
                    .toLowerCase();

                  return (
                    <div key={fi} className="vfl-row">
                      <div className="vfl-row-inner">
                        <div className="vfl-row-title">
                          {label}
                          {(f.isRequired || f.required) ? (
                            <span className="req">*</span>
                          ) : null}
                        </div>
                        <div className="vfl-row-sub">{typeTxt}</div>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </section>
      </div>
    );
  };

  const renderResponses = () => (
    <div className="vf-resp">
      <div className="vf-resp-tabs">
        <button
          className={`chip ${
            activeRespTab === "summary" ? "active" : ""
          }`}
          onClick={() => {
            setActiveRespTab("summary");
            setRespPage(1);
          }}
        >
          Response Summary
        </button>
        <button
          className={`chip ${
            activeRespTab === "individual" ? "active" : ""
          }`}
          onClick={() => {
            setActiveRespTab("individual");
            setRespPage(1);
          }}
        >
          Individual Response
        </button>

        <div className="grow" />
        <div className="vf-search">
          <input
            placeholder="Search by Name/User ID"
            value={respQ}
            onChange={(e) => {
              setRespQ(e.target.value);
              setRespPage(1);
            }}
          />
          <span aria-hidden>
            <img src={search} alt="" style={{ width: 20, height: 20 }} />
          </span>
        </div>
        <button
          className="btn outline-primary pill"
          onClick={() => window.alert("Filter UI TBD")}
        >
          Filter
        </button>
        <button
          className="btn primary pill"
          onClick={() => window.alert("Export API TBD")}
        >
          Export to Excel
        </button>
      </div>

      {activeRespTab === "summary" ? (
        <>
          <div className="vf-table-wrap">
            {err ? (
              <div className="vf-alert">{err}</div>
            ) : respRows.length === 0 ? (
              <div className="vf-empty">Not Found</div>
            ) : (
              <table className="vf-table">
                <thead>
                  <tr>
                    <th>Submitted By</th>
                    <th>User Id</th>
                    <th>Used In</th>
                    <th>Submitted On</th>
                    {/* Email column removed */}
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {respRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {userNameMap[r.userId] ||
                          r.userName ||
                          `User ${r.userId}`}
                      </td>
                      <td>{r.userId}</td>
                      <td>{r.usedIn}</td>
                      <td>
                        {r.submittedOn
                          ? new Date(
                              r.submittedOn
                            ).toLocaleString()
                          : "—"}
                      </td>
                      {/* Email cell removed */}
                      <td>
                        <button
                          className="btn small pill btn-view"
                          onClick={() => {
                            setActiveRespTab("individual");
                            setSelectedRespId(r.id);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* This pager is the design copied to other pages */}
          <div className="vf-pager">
            <div className="vf-ipp">
              Items per page{" "}
              <select
                value={respPageSize}
                onChange={(e) => {
                  setRespPageSize(Number(e.target.value));
                  setRespPage(1);
                }}
              >
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
            </div>
            <div className="grow" />
            <div className="vf-page">
              <button
                className="btn small pill"
                disabled={respPage <= 1}
                onClick={() =>
                  setRespPage((p) => Math.max(1, p - 1))
                }
              >
                ‹
              </button>
              <span>
                {respPage} of {respPages}
              </span>
              <button
                className="btn small pill"
                disabled={respPage >= respPages}
                onClick={() =>
                  setRespPage((p) => Math.min(respPages, p + 1))
                }
              >
                ›
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="vf-indiv">
          <aside className="vf-indiv-list">
            {respRows.length === 0 ? (
              <div className="vf-empty" style={{ padding: 16 }}>
                No responses
              </div>
            ) : (
              respRows.map((r) => (
                <button
                  key={r.id}
                  className={`vf-indiv-item ${
                    selectedRespId === r.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedRespId(r.id)}
                >
                  <div className="name">
                    {userNameMap[r.userId] || `User ${r.userId}`}
                  </div>
                  <div className="meta">
                    Submitted •{" "}
                    {r.submittedOn
                      ? new Date(
                          r.submittedOn
                        ).toLocaleString()
                      : "—"}
                  </div>
                  <div className="tag">
                    Response ID: {r.id}
                  </div>
                </button>
              ))
            )}
            <div className="vf-mini-pager">
              <button
                className="btn small pill"
                disabled={respPage <= 1}
                onClick={() =>
                  setRespPage((p) => Math.max(1, p - 1))
                }
              >
                ‹
              </button>
              <span>
                {respPage} / {respPages}
              </span>
              <button
                className="btn small pill"
                disabled={respPage >= respPages}
                onClick={() =>
                  setRespPage((p) => Math.min(respPages, p + 1))
                }
              >
                ›
              </button>
            </div>
          </aside>

          <section className="vf-indiv-detail">
            <div className="vf-formbox">
              <div className="vf-formbox-topbar" />
              <div className="vf-formbox-head">
                <div className="title">
                  {form?.title || "Form"}
                </div>
                <div className="hint">
                  {form?.description || ""}
                </div>
              </div>

              <div className="vf-formbox-body">
                {(() => {
                  const current =
                    respRows.find(
                      (r) => r.id === selectedRespId
                    ) || respRows[0];
                  if (!current)
                    return (
                      <div className="vf-empty">
                        Select a response on the left
                      </div>
                    );
                  return (current.fields || []).map((f, i) => (
                    <div key={i} className="vf-formbox-q">
                      <div className="qnum">{i + 1}</div>
                      <div className="qmain">
                        <div className="qlabel">
                          {f.label}
                        </div>
                        <div className="qvalue">
                          {(() => {
                            const v = String(f.value ?? "");
                            if (v.startsWith("file:")) {
                              return (
                                <button
                                  type="button"
                                  className="btn small pill"
                                  onClick={() =>
                                    downloadFileFromToken(v)
                                  }
                                >
                                  Download file
                                </button>
                              );
                            }
                            // At this point, for dropdown/checkbox/etc.,
                            // v is already the human-readable option text(s)
                            return v;
                          })()}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );

  /* ---------------- render root ---------------- */
  return (
    <div className="vf-root">
      <div className="vf-tabs" role="tablist" aria-label="View Form Tabs">
        <button
          role="tab"
          aria-selected={tab === "config"}
          className={`tab ${tab === "config" ? "active" : ""}`}
          onClick={() => setTab("config")}
        >
          Form Configuration
        </button>
        <button
          role="tab"
          aria-selected={tab === "layout"}
          className={`tab ${tab === "layout" ? "active" : ""}`}
          onClick={() => setTab("layout")}
        >
          Form Layout
        </button>
        <button
          role="tab"
          aria-selected={tab === "responses"}
          className={`tab ${tab === "responses" ? "active" : ""}`}
          onClick={() => setTab("responses")}
        >
          Responses
        </button>
      </div>

      {loading ? (
        <div className="vf-skel">Loading…</div>
      ) : err && tab !== "responses" ? (
        <div className="vf-alert">{err}</div>
      ) : tab === "config" ? (
        renderConfig()
      ) : tab === "layout" ? (
        renderLayout()
      ) : (
        renderResponses()
      )}
    </div>
  );
}