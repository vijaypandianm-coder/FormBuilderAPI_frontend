// src/pages/CreateForm.jsx
import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate, useLocation } from "react-router-dom";
import "./CreateForm.css";
import duplicate from "./../assets/duplicate.png";
import Trash from "./../assets/Trash.png";
import { AuthService } from "../api/auth";
import { FormService } from "../api/forms";
import short from "../assets/short.png";
import long from "../assets/long.png";
import date from "../assets/date.png";
import dropdown from "../assets/dropdown.png";
import file from "../assets/files.png";
import number from "../assets/number.png";

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const FIELD_TYPES = [
  { id: "short", label: "Short Text", placeholder: "Short Text (Up to 100 Characters)", icon: short },
  { id: "long", label: "Long Text", placeholder: "Long Text (Up to 500 Characters)", icon: long },
  { id: "date", label: "Date Picker", placeholder: "DD/MM/YYYY", icon: date },
  { id: "dropdown", label: "Dropdown", placeholder: "Option 1", icon: dropdown },
  { id: "file", label: "File Upload", placeholder: "Upload your file", icon: file },
  { id: "number", label: "Number", placeholder: "Numeric value", icon: number },
];

function mapField(q) {
  const base = {
    fieldId: q.id,
    label: q.label || "Untitled Question",
    type:
      q.type === "short"
        ? "text"
        : q.type === "long"
        ? "textarea"
        : q.type === "date"
        ? "date"
        : q.type === "dropdown"
        ? "select"
        : q.type === "file"
        ? "file"
        : q.type === "number"
        ? "number"
        : "text",
    isRequired: !!q.required,
  };
  if (q.type === "dropdown") {
    base.options =
      Array.isArray(q.options) && q.options.length ? q.options : ["Option 1"];
    base.multi = !!q.multi;
  }
  if (q.type === "date" && q.dateFormat) base.dateFormat = q.dateFormat;
  if (q.type === "file") {
    base.fileNote = q.fileNote || "File Upload (Only one file allowed)";
    base.fileHelp =
      q.fileHelp || "Supported files : PDF, PNG, JPG | Max file size 2 MB";
  }
  return base;
}

// 🔹 Map backend field → builder question
function fromBackendField(f) {
  const rawType = (f.type || f.Type || "text").toString().toLowerCase();
  let type = "short";

  if (rawType === "text") type = "short";
  else if (rawType === "textarea") type = "long";
  else if (rawType === "date") type = "date";
  else if (rawType === "select") type = "dropdown";
  else if (rawType === "file") type = "file";
  else if (rawType === "number") type = "number";

  const q = {
    id: f.fieldId || f.id || uid(),
    type,
    label: f.label || f.Label || "Untitled Question",
    description: "",
    showDescription: false,
    required: !!(f.isRequired ?? f.required ?? f.Required),
  };

  if (type === "dropdown") {
    q.options =
      (Array.isArray(f.options) && f.options.length
        ? f.options
        : []) || ["Option 1"];
    q.multi = !!(f.multi ?? f.Multi ?? false);
  }

  if (type === "date") {
    q.dateFormat = f.dateFormat || f.DateFormat || "DD/MM/YYYY";
  }

  if (type === "file") {
    q.fileNote =
      f.fileNote || f.FileNote || "File Upload (Only one file allowed)";
    q.fileHelp =
      f.fileHelp ||
      f.FileHelp ||
      "Supported files : PDF, PNG, JPG | Max file size 2 MB";
  }

  return q;
}

function buildPayload({ name, desc, visible, questions, status }) {
  return {
    title: (name || "Untitled Form").trim() || "Untitled Form",
    description: (desc || "").trim(),
    visible: !!visible,
    status: status || "Draft",
    layout: [
      {
        title: "Section 1",
        fields: (questions || []).map(mapField),
      },
    ],
    createdAt: new Date().toISOString(),
    access: "Open",
  };
}

export default function CreateForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(
    location.state?.tab || "config"
  );

  // 👉 if this is present, we are editing an existing form
  const editingFormKey = location.state?.formKey || null;

  const [cfgName, setCfgName] = useState("");
  const [cfgDesc, setCfgDesc] = useState("");
  const [cfgVisible, setCfgVisible] = useState(true);

  const [questions, setQuestions] = useState([]);

  // ---------- INITIAL LOAD (with fb_create restore) ----------
  useEffect(() => {
    // If editing: fetch from API and populate
    if (editingFormKey) {
      (async () => {
        try {
          const dto = await FormService.get(editingFormKey);

          const title = dto?.title ?? dto?.Title ?? "";
          const desc = dto?.description ?? dto?.Description ?? "";

          setCfgName(title);
          setCfgDesc(desc);
          // Visibility – fall back to true if not present
          setCfgVisible(
            dto?.visible ??
              dto?.Visible ??
              true
          );

          // Layout/sections/fields
          let sections =
            dto?.layout ??
            dto?.Layout ??
            dto?.sections ??
            dto?.Sections ??
            [];

          if (!Array.isArray(sections) && Array.isArray(sections?.sections)) {
            sections = sections.sections;
          }

          const firstSection =
            Array.isArray(sections) && sections.length ? sections[0] : null;
          const fields =
            firstSection?.fields || firstSection?.Fields || [];

          const qs = (fields || []).map(fromBackendField);
          setQuestions(qs);

          if (location.state?.tab) setActiveTab(location.state.tab);
        } catch (e) {
          console.warn(
            "Failed to load form for editing:",
            e?.message || e
          );
        }
      })();
      return; // 👉 don't load from localStorage when editing
    }

    // NEW form: try to restore any existing fb_create draft; if none, start fresh
    const draftRaw = localStorage.getItem("fb_create");
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        setCfgName(draft.name || "");
        setCfgDesc(draft.desc || "");
        setCfgVisible(
          draft.visible !== undefined ? !!draft.visible : true
        );
        setQuestions(
          Array.isArray(draft.questions) ? draft.questions : []
        );
      } catch {
        // invalid JSON → clear and start clean
        localStorage.removeItem("fb_create");
        setCfgName("");
        setCfgDesc("");
        setCfgVisible(true);
        setQuestions([]);
      }
    } else {
      // no draft present → fresh form
      setCfgName("");
      setCfgDesc("");
      setCfgVisible(true);
      setQuestions([]);
    }

    if (location.state?.tab) setActiveTab(location.state.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingFormKey]);

  // 🔹 Clear fb_create only when user leaves CreateForm page (not when previewing)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const path = window.location.pathname;
      // Don't delete if going to preview
      if (!path.includes("/preview")) {
        localStorage.removeItem("fb_create");
      }
    };

    // Clear on page unload (refresh or navigation away)
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Clear when navigating away via router (except preview)
    return () => {
      const nextPath = window.location.pathname;
      if (!nextPath.includes("/preview")) {
        localStorage.removeItem("fb_create");
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Persist builder state into fb_create while on the page
  useEffect(() => {
    localStorage.setItem(
      "fb_create",
      JSON.stringify({
        name: cfgName,
        desc: cfgDesc,
        visible: cfgVisible,
        questions,
      })
    );
  }, [cfgName, cfgDesc, cfgVisible, questions]);

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    if (
      source.droppableId === "FIELDS" &&
      destination.droppableId === "CANVAS"
    ) {
      const type = FIELD_TYPES[source.index];
      const q = {
        id: uid(),
        type: type.id,
        label: "Untitled Question",
        description: "",
        showDescription: false,
        required: false,
      };
      if (type.id === "dropdown") {
        q.options = ["Option 1"];
        q.multi = false;
      } else if (type.id === "date") {
        q.dateFormat = "DD/MM/YYYY";
      } else if (type.id === "file") {
        q.fileNote = "File Upload (Only one file allowed)";
        q.fileHelp =
          "Supported files : PDF, PNG, JPG | Max file size 2 MB";
      }
      const next = [...questions];
      next.splice(destination.index, 0, q);
      setQuestions(next);
      return;
    }

    if (
      source.droppableId === "CANVAS" &&
      destination.droppableId === "CANVAS"
    ) {
      const next = Array.from(questions);
      const [removed] = next.splice(source.index, 1);
      next.splice(destination.index, 0, removed);
      setQuestions(next);
    }
  };

  const updateQ = (id, key, value) =>
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [key]: value } : q))
    );

  const duplicateQ = (id) =>
    setQuestions((prev) => {
      const q = prev.find((x) => x.id === id);
      if (!q) return prev;
      return [...prev, { ...q, id: uid() }];
    });

  const deleteQ = (id) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));

  const ph = (type) =>
    FIELD_TYPES.find((f) => f.id === type)?.placeholder || "";

  const addOption = (qid) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? {
              ...q,
              options: [
                ...(q.options || []),
                `Option ${(q.options?.length ?? 0) + 1}`,
              ],
            }
          : q
      )
    );

  const updateOption = (qid, idx, value) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? {
              ...q,
              options: (q.options || []).map((o, i) =>
                i === idx ? value : o
              ),
            }
          : q
      )
    );

  const removeOption = (qid, idx) =>
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const cur = q.options || [];
        if (cur.length <= 1) return q;
        return { ...q, options: cur.filter((_, i) => i !== idx) };
      })
    );

  const iconBtnNeutral = {
    background: "transparent",
    border: "none",
    padding: 6,
    outline: "none",
    boxShadow: "none",
    color: "inherit",
    cursor: "pointer",
  };

  const renderPreview = (q) => {
    switch (q.type) {
      case "dropdown":
        return (
          <div className="dd-wrap">
            {(q.options || ["Option 1"]).map((opt, i) => (
              <div
                key={i}
                className="dd-option-row"
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  className="dd-index"
                  style={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#6B7280",
                  }}
                >
                  {i + 1}
                </span>
                <input
                  className="q-preview"
                  value={opt}
                  onChange={(e) =>
                    updateOption(q.id, i, e.target.value)
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove option"
                  onClick={() => removeOption(q.id, i)}
                  disabled={(q.options || []).length <= 1}
                  style={iconBtnNeutral}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn text"
              onClick={() => addOption(q.id)}
            >
              + Add Option
            </button>
            <div
              className="dd-select-type"
              style={{ marginTop: 12, fontSize: 14, color: "#374151" }}
            >
              <span style={{ marginRight: 10 }}>Selection Type:</span>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  name={`seltype-${q.id}`}
                  checked={!q.multi}
                  onChange={() => updateQ(q.id, "multi", false)}
                />{" "}
                Single Select
              </label>
              <label>
                <input
                  type="radio"
                  name={`seltype-${q.id}`}
                  checked={!!q.multi}
                  onChange={() => updateQ(q.id, "multi", true)}
                />{" "}
                Multi Select
              </label>
            </div>
          </div>
        );
      case "date":
        return (
          <div className="date-wrap">
            <div style={{ position: "relative" }}>
              <input
                className="q-preview"
                placeholder={q.dateFormat || "DD/MM/YYYY"}
                disabled
              />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#6B7280",
                }}
              >
                📅
              </span>
            </div>
            <div
              className="date-format"
              style={{ marginTop: 12, fontSize: 14, color: "#374151" }}
            >
              <span style={{ marginRight: 10 }}>Date Format:</span>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  name={`df-${q.id}`}
                  checked={
                    (q.dateFormat || "DD/MM/YYYY") === "DD/MM/YYYY"
                  }
                  onChange={() =>
                    updateQ(q.id, "dateFormat", "DD/MM/YYYY")
                  }
                />{" "}
                DD/MM/YYYY
              </label>
              <label>
                <input
                  type="radio"
                  name={`df-${q.id}`}
                  checked={q.dateFormat === "MM-DD-YYYY"}
                  onChange={() =>
                    updateQ(q.id, "dateFormat", "MM-DD-YYYY")
                  }
                />{" "}
                MM-DD-YYYY
              </label>
            </div>
          </div>
        );
      case "file":
        return (
          <div className="file-wrap">
            <div
              className="upload-box"
              style={{
                border: "1px dashed #D1D5DB",
                background: "#FAFAFB",
                borderRadius: 8,
                padding: 14,
                marginBottom: 6,
                color: "#374151",
                fontSize: 14,
              }}
            >
              {q.fileNote ||
                "File Upload (Only one file allowed)"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {q.fileHelp ||
                "Supported files : PDF, PNG, JPG | Max file size 2 MB"}
            </div>
          </div>
        );
      default:
        return (
          <input
            className="q-preview"
            style={{
              height: "64px",
              backgroundColor: "#F3F2F3",
              border: "1px solid #D8D8D8",
            }}
            placeholder={ph(q.type)}
            disabled
          />
        );
    }
  };

  const handlePreview = () => {
    const payload = {
      header: {
        title: "Employee Onboarding",
        name: cfgName,
        desc: cfgDesc,
        visible: cfgVisible,
      },
      questions,
    };
    localStorage.setItem("fb_preview", JSON.stringify(payload));
    navigate("/preview");
  };

  function writeLocal(kind) {
    const formsRaw = localStorage.getItem("fb_forms");
    let forms = formsRaw ? JSON.parse(formsRaw) : [];
    const title =
      (cfgName || "Untitled Form").trim() || "Untitled Form";
    const item = {
      id: Date.now(),
      title,
      status: kind,
      meta:
        kind === "Published"
          ? [
              { k: "Published By", v: "You" },
              {
                k: "Published Date",
                v: new Date().toLocaleDateString(),
              },
            ]
          : [
              {
                k: "Last Saved",
                v: new Date().toLocaleDateString(),
              },
            ],
      hasWorkflowLink: false,
      _from: "local",
    };
    forms = forms.filter(
      (f) => !(f.title === title && f.status === kind)
    );
    localStorage.setItem("fb_forms", JSON.stringify([item, ...forms]));
  }

  // ---- SAVE DRAFT: create new OR update existing (no duplicates)
  const saveDraft = async () => {
    const payload = buildPayload({
      name: cfgName,
      desc: cfgDesc,
      visible: cfgVisible,
      questions,
      status: "Draft",
    });

    if (AuthService.isAuthenticated()) {
      try {
        if (editingFormKey) {
          // UPDATE in place
          await FormService.update(editingFormKey, payload);
        } else {
          // CREATE new draft
          await FormService.create(payload);
        }
        navigate("/", { replace: true });
        setTimeout(() => window.location.reload(), 0);
        return;
      } catch (e) {
        console.warn(
          "Draft save via API failed, using local:",
          e?.message || e
        );
      }
    }

    writeLocal("Draft");
    navigate("/", { replace: true });
    setTimeout(() => window.location.reload(), 0);
  };

  // ---- PUBLISH: create new OR update existing (no duplicates)
  const publishForm = async () => {
    const payload = buildPayload({
      name: cfgName,
      desc: cfgDesc,
      visible: cfgVisible,
      questions,
      status: "Published",
    });

    if (AuthService.isAuthenticated()) {
      try {
        if (editingFormKey) {
          // UPDATE in place
          await FormService.update(editingFormKey, payload);
        } else {
          // CREATE new published form
          await FormService.create(payload);
        }
        localStorage.removeItem("fb_create");
        navigate("/", { replace: true });
        setTimeout(() => window.location.reload(), 0);
        return;
      } catch (e) {
        console.warn(
          "Publish via API failed, using local:",
          e?.message || e
        );
      }
    }

    writeLocal("Published");
    localStorage.removeItem("fb_create");
    navigate("/", { replace: true });
    setTimeout(() => window.location.reload(), 0);
  };

  return (
    <main className="cfp">
      <div
        className="cfp-tabs"
        role="tablist"
        aria-label="Form sections"
      >
        <button
          role="tab"
          aria-selected={activeTab === "config"}
          className={`tab ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          Form Configuration
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "layout"}
          className={`tab ${activeTab === "layout" ? "active" : ""}`}
          onClick={() => setActiveTab("layout")}
        >
          Form Layout
        </button>
      </div>

      {activeTab === "config" && (
        <section className="cfg-card" aria-labelledby="cfg-title">
          <h2 id="cfg-title" className="cfg-title">
            Form Details
          </h2>

          <div className="cfg-field">
            <label className="cfg-label">
              Form Name <span className="req">*</span>
            </label>
            <input
              className="cfg-input"
              value={cfgName}
              onChange={(e) => setCfgName(e.target.value)}
              maxLength={150}
              placeholder="Enter the form name"
            />
            <span className="cfg-count">
              {cfgName.length}/150
            </span>
          </div>

          <div className="cfg-field">
            <label className="cfg-label">Form Description</label>
            <textarea
              className="cfg-textarea"
              value={cfgDesc}
              onChange={(e) => setCfgDesc(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Enter the form description (optional)"
            />
            <span className="cfg-count">
              {cfgDesc.length}/200
            </span>
          </div>

          <div className="cfg-field">
            <label className="cfg-label">Form Visibility</label>
            <label className="cfg-switch">
              <input
                type="checkbox"
                checked={cfgVisible}
                onChange={(e) =>
                  setCfgVisible(e.target.checked)
                }
              />
              <span aria-hidden />
            </label>
            <p className="cfg-hint">
              Turn on to allow new workflows to use this form.
              Turn off to hide it; existing workflows keep
              working.
            </p>
          </div>
        </section>
      )}

      {activeTab === "layout" && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="fb">
            <Droppable droppableId="FIELDS" isDropDisabled>
              {(prov) => (
                <aside
                  className="fb-left"
                  ref={prov.innerRef}
                  {...prov.droppableProps}
                >
                  <div className="pillrow">
                    <span className="pill primary">Input Fields</span>
                    <span className="pill gray">UDF Fields</span>
                  </div>

                  {FIELD_TYPES.map((f, i) => (
                    <Draggable
                      key={f.id}
                      draggableId={f.id}
                      index={i}
                    >
                      {(p) => (
                        <div
                          className="tile"
                          ref={p.innerRef}
                          {...p.draggableProps}
                          {...p.dragHandleProps}
                        >
                          <img
                            src={f.icon}
                            alt={f.label}
                            style={{
                              height: "40px",
                              width: "40px",
                              borderRadius: "5.13px",
                              marginRight: "8px",
                            }}
                          />
                          {f.label}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {prov.placeholder}
                </aside>
              )}
            </Droppable>

            <Droppable droppableId="CANVAS">
              {(prov, snap) => (
                <section
                  className={`fb-canvas ${
                    snap.isDraggingOver ? "is-over" : ""
                  }`}
                  ref={prov.innerRef}
                  {...prov.droppableProps}
                >
                  <div className="fh-card">
                    <div className="fh-tab">Form Header</div>
                    <div
                      style={{
                        position: "relative",
                        marginBottom: 12,
                      }}
                    >
                      <input
                        className="fh-input"
                        value={cfgName}
                        onChange={(e) =>
                          setCfgName(e.target.value)
                        }
                        maxLength={80}
                        placeholder="Enter the form name"
                      />
                      <span
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 12,
                          color: "#6B7280",
                          pointerEvents: "none",
                        }}
                      >
                        {`${cfgName.length}/80`}
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        className="fh-input"
                        value={cfgDesc}
                        onChange={(e) =>
                          setCfgDesc(e.target.value)
                        }
                        maxLength={200}
                        placeholder="Enter the form description (optional)"
                      />
                      <span
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 12,
                          color: "#6B7280",
                          pointerEvents: "none",
                        }}
                      >
                        {`${cfgDesc.length}/200`}
                      </span>
                    </div>
                  </div>

                  {questions.map((q, index) => (
                    <Draggable
                      key={q.id}
                      draggableId={q.id}
                      index={index}
                    >
                      {(p) => (
                        <div
                          className="q-card"
                          ref={p.innerRef}
                          {...p.draggableProps}
                        >
                          <div
                            className="q-handle"
                            {...p.dragHandleProps}
                          >
                            ⋮⋮
                          </div>

                          <input
                            className="q-title"
                            placeholder="Untitled Question"
                            value={q.label}
                            maxLength={150}
                            onChange={(e) =>
                              updateQ(
                                q.id,
                                "label",
                                e.target.value
                              )
                            }
                          />

                          {q.showDescription && (
                            <input
                              className="q-desc"
                              placeholder="Description"
                              value={q.description}
                              maxLength={300}
                              onChange={(e) =>
                                updateQ(
                                  q.id,
                                  "description",
                                  e.target.value
                                )
                              }
                            />
                          )}

                          {renderPreview(q)}

                          <div className="q-actions">
                            <div className="q-actions-right">
                              <button
                                type="button"
                                className="icon-btn"
                                title="Duplicate"
                                onClick={() =>
                                  duplicateQ(q.id)
                                }
                                style={iconBtnNeutral}
                              >
                                <img
                                  src={duplicate}
                                  alt="Duplicate"
                                />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Delete"
                                onClick={() =>
                                  deleteQ(q.id)
                                }
                                style={iconBtnNeutral}
                              >
                                <img
                                  src={Trash}
                                  alt="Delete"
                                />
                              </button>
                              <label className="toggle-label">
                                <span>Description</span>
                                <input
                                  type="checkbox"
                                  className="switch"
                                  checked={q.showDescription}
                                  onChange={(e) =>
                                    updateQ(
                                      q.id,
                                      "showDescription",
                                      e.target.checked
                                    )
                                  }
                                />
                              </label>
                              <label className="toggle-label">
                                <span>Required</span>
                                <input
                                  type="checkbox"
                                  className="switch"
                                  checked={q.required}
                                  onChange={(e) =>
                                    updateQ(
                                      q.id,
                                      "required",
                                      e.target.checked
                                    )
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}

                  {prov.placeholder}

                  <button className="add-section">
                    <span className="add-icon">≡</span> Add Section{" "}
                    <span className="info">ⓘ</span>
                  </button>
                </section>
              )}
            </Droppable>
          </div>
        </DragDropContext>
      )}

      <footer className="cfp-footer">
        {activeTab === "layout" ? (
          <>
            <button className="preview" onClick={handlePreview}>
              <span className="eye">○</span>
              Preview Form
            </button>
            <div className="ff-right">
              <button className="ghost" onClick={saveDraft}>
                Save as draft
              </button>
              <button className="primary" onClick={publishForm}>
                Publish Form
              </button>
            </div>
          </>
        ) : (
          <>
            <span />
            <div className="ff-right">
              <button className="ghost" onClick={saveDraft}>
                Save as draft
              </button>
              <button
                className="primary"
                disabled={!cfgName.trim()}
                aria-disabled={!cfgName.trim()}
                onClick={() => setActiveTab("layout")}
                title={
                  !cfgName.trim()
                    ? "Enter a Form Name to continue"
                    : "Next"
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </footer>
    </main>
  );
}