// src/pages/CreateForm.jsx
import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate, useLocation } from "react-router-dom";
import "./CreateForm.css";
import duplicate from "./../assets/duplicate.png";
import Trash from "./../assets/Trash.png";
import { AuthService } from "../api/auth";        // ✅ use JWT + helper
import { FormService } from "../api/forms";       // ✅ use service that does meta→layout→status

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const FIELD_TYPES = [
  { id: "short", label: "Short Text", placeholder: "Short Text (Up to 100 Characters)" },
  { id: "long", label: "Long Text", placeholder: "Long Text (Up to 500 Characters)" },
  { id: "date", label: "Date Picker", placeholder: "DD/MM/YYYY" },
  { id: "dropdown", label: "Dropdown", placeholder: "Option 1" },
  { id: "file", label: "File Upload", placeholder: "Upload your file" },
  { id: "number", label: "Number", placeholder: "Numeric value" },
];

// ---- helpers to build API payload ----
function mapField(q) {
  // Map builder question -> backend field schema
  const base = {
    fieldId: q.id,
    label: q.label || "Untitled Question",
    type:
      q.type === "short" ? "text" :
      q.type === "long" ? "textarea" :
      q.type === "date" ? "date" :
      q.type === "dropdown" ? "select" :
      q.type === "file" ? "file" :
      q.type === "number" ? "number" : "text",
    isRequired: !!q.required,
  };

  if (q.type === "dropdown") {
    base.options = Array.isArray(q.options) && q.options.length ? q.options : ["Option 1"];
    base.multi = !!q.multi;
  }
  if (q.type === "date" && q.dateFormat) {
    base.dateFormat = q.dateFormat;
  }
  if (q.type === "file") {
    base.fileNote = q.fileNote || "File Upload (Only one file allowed)";
    base.fileHelp = q.fileHelp || "Supported files : PDF, PNG, JPG | Max file size 2 MB";
  }
  return base;
}

function buildPayload({ name, desc, visible, questions, status }) {
  return {
    title: (name || "Untitled Form").trim() || "Untitled Form",
    description: (desc || "").trim(),
    visible: !!visible,
    status: status || "Draft", // "Draft" | "Published"
    // Keep layout compatible with ViewForm (layout.sections[].fields[])
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

// ---- component ----
export default function CreateForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(location.state?.tab || "config");

  const [cfgName, setCfgName] = useState("Course Feedback Form");
  const [cfgDesc, setCfgDesc] = useState(
    "Help us improve! Share your feedback on your learning experience."
  );
  const [cfgVisible, setCfgVisible] = useState(true);

  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    const raw = localStorage.getItem("fb_create");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (typeof data?.name === "string") setCfgName(data.name);
      if (typeof data?.desc === "string") setCfgDesc(data.desc);
      if (typeof data?.visible === "boolean") setCfgVisible(data.visible);
      if (Array.isArray(data?.questions)) setQuestions(data.questions);
      if (location.state?.tab) setActiveTab(location.state.tab);
    } catch (e) {
      console.warn("Failed to parse fb_create:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    if (source.droppableId === "FIELDS" && destination.droppableId === "CANVAS") {
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
        q.fileHelp = "Supported files : PDF, PNG, JPG | Max file size 2 MB";
      }
      const next = [...questions];
      next.splice(destination.index, 0, q);
      setQuestions(next);
      return;
    }

    if (source.droppableId === "CANVAS" && destination.droppableId === "CANVAS") {
      const next = Array.from(questions);
      const [removed] = next.splice(source.index, 1);
      next.splice(destination.index, 0, removed);
      setQuestions(next);
    }
  };

  const updateQ = (id, key, value) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [key]: value } : q)));

  const duplicateQ = (id) =>
    setQuestions((prev) => {
      const q = prev.find((x) => x.id === id);
      if (!q) return prev;
      return [...prev, { ...q, id: uid() }];
    });

  const deleteQ = (id) => setQuestions((prev) => prev.filter((q) => q.id !== id));

  const ph = (type) => FIELD_TYPES.find((f) => f.id === type)?.placeholder || "";

  // Dropdown helpers
  const addOption = (qid) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, options: [...(q.options || []), `Option ${(q.options?.length ?? 0) + 1}`] }
          : q
      )
    );

  const updateOption = (qid, idx, value) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, options: (q.options || []).map((o, i) => (i === idx ? value : o)) }
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
                style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}
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
                  onChange={(e) => updateOption(q.id, i, e.target.value)}
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

            <button type="button" className="btn text" onClick={() => addOption(q.id)}>
              + Add Option
            </button>

            <div className="dd-select-type" style={{ marginTop: 12, fontSize: 14, color: "#374151" }}>
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
              <input className="q-preview" placeholder={q.dateFormat || "DD/MM/YYYY"} disabled />
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

            <div className="date-format" style={{ marginTop: 12, fontSize: 14, color: "#374151" }}>
              <span style={{ marginRight: 10 }}>Date Format:</span>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  name={`df-${q.id}`}
                  checked={(q.dateFormat || "DD/MM/YYYY") === "DD/MM/YYYY"}
                  onChange={() => updateQ(q.id, "dateFormat", "DD/MM/YYYY")}
                />{" "}
                DD/MM/YYYY
              </label>
              <label>
                <input
                  type="radio"
                  name={`df-${q.id}`}
                  checked={q.dateFormat === "MM-DD-YYYY"}
                  onChange={() => updateQ(q.id, "dateFormat", "MM-DD-YYYY")}
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
              {q.fileNote || "File Upload (Only one file allowed)"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {q.fileHelp || "Supported files : PDF, PNG, JPG | Max file size 2 MB"}
            </div>
          </div>
        );

      default:
        return <input className="q-preview" placeholder={ph(q.type)} disabled />;
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

  // ---- local-only fallback writers ----
  function writeLocal(kind /* "Draft" | "Published" */) {
    const formsRaw = localStorage.getItem("fb_forms");
    let forms = formsRaw ? JSON.parse(formsRaw) : [];

    const title = (cfgName || "Untitled Form").trim() || "Untitled Form";
    const item = {
      id: Date.now(),
      title,
      status: kind,
      meta:
        kind === "Published"
          ? [
              { k: "Published By", v: "You" },
              { k: "Published Date", v: new Date().toLocaleDateString() },
            ]
          : [{ k: "Last Saved", v: new Date().toLocaleDateString() }],
      hasWorkflowLink: false,
      _from: "local",
    };

    // Replace same-title same-status item
    forms = forms.filter((f) => !(f.title === title && f.status === kind));
    localStorage.setItem("fb_forms", JSON.stringify([item, ...forms]));
  }

  const saveDraft = async () => {
    const payload = buildPayload({
      name: cfgName,
      desc: cfgDesc,
      visible: cfgVisible,
      questions,
      status: "Draft",
    });

    // Try API first if authenticated; fallback to local
    if (AuthService.isAuthenticated()) {
      try {
        await FormService.create(payload);       // ✅ meta→layout→status(Draft)
        navigate("/", { replace: true });
        setTimeout(() => window.location.reload(), 0);
        return;
      } catch (e) {
        console.warn("Draft save via API failed, using local:", e?.message || e);
      }
    }

    writeLocal("Draft");
    navigate("/", { replace: true });
    setTimeout(() => window.location.reload(), 0);
  };

  const publishForm = async () => {
    const payload = buildPayload({
      name: cfgName,
      desc: cfgDesc,
      visible: cfgVisible,
      questions,
      status: "Published",
    });

    // Try API first if authenticated; fallback to local
    if (AuthService.isAuthenticated()) {
      try {
        await FormService.create(payload);       // ✅ meta→layout→status(Published)
        localStorage.removeItem("fb_create");
        navigate("/", { replace: true });
        setTimeout(() => window.location.reload(), 0);
        return;
      } catch (e) {
        console.warn("Publish via API failed, using local:", e?.message || e);
      }
    }

    writeLocal("Published");
    // also clear builder cache for a clean slate
    localStorage.removeItem("fb_create");
    navigate("/", { replace: true });
    setTimeout(() => window.location.reload(), 0);
  };

  return (
    <main className="cfp">
      {/* duplicate breadcrumb/header removed */}

      <div className="cfp-tabs" role="tablist" aria-label="Form sections">
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
          <h2 id="cfg-title" className="cfg-title">Form Details</h2>

          <div className="cfg-field">
            <label className="cfg-label">
              Form Name <span className="req">*</span>
            </label>
            <input
              className="cfg-input"
              value={cfgName}
              onChange={(e) => setCfgName(e.target.value)}
              maxLength={150}
              placeholder="Enter Form Name"
            />
            <span className="cfg-count">{cfgName.length}/150</span>
          </div>

          <div className="cfg-field">
            <label className="cfg-label">Form Description</label>
            <textarea
              className="cfg-textarea"
              value={cfgDesc}
              onChange={(e) => setCfgDesc(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Summarize the form’s purpose for internal reference."
            />
            <span className="cfg-count">{cfgDesc.length}/200</span>
          </div>

          <div className="cfg-field">
            <label className="cfg-label">Form Visibility</label>
            <label className="cfg-switch">
              <input
                type="checkbox"
                checked={cfgVisible}
                onChange={(e) => setCfgVisible(e.target.checked)}
              />
              <span aria-hidden />
            </label>
            <p className="cfg-hint">
              Turn on to allow new workflows to use this form. Turn off to hide it; existing
              workflows keep working.
            </p>
          </div>
        </section>
      )}

      {activeTab === "layout" && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="fb">
            <Droppable droppableId="FIELDS" isDropDisabled>
              {(prov) => (
                <aside className="fb-left" ref={prov.innerRef} {...prov.droppableProps}>
                  <div className="pillrow">
                    <span className="pill primary">Input Fields</span>
                    <span className="pill gray">UDF Fields</span>
                  </div>

                  {FIELD_TYPES.map((f, i) => (
                    <Draggable key={f.id} draggableId={f.id} index={i}>
                      {(p) => (
                        <div
                          className="tile"
                          ref={p.innerRef}
                          {...p.draggableProps}
                          {...p.dragHandleProps}
                        >
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
                  className={`fb-canvas ${snap.isDraggingOver ? "is-over" : ""}`}
                  ref={prov.innerRef}
                  {...prov.droppableProps}
                >
                  <div className="fh-card">
                    <div className="fh-tab">Form Header</div>
                    <input
                      className="fh-input"
                      value={cfgName}
                      onChange={(e) => setCfgName(e.target.value)}
                      maxLength={150}
                    />
                    <input
                      className="fh-input"
                      value={cfgDesc}
                      onChange={(e) => setCfgDesc(e.target.value)}
                      maxLength={200}
                    />
                  </div>

                  {questions.length === 0 ? (
                    <div className="drop-empty">Drag fields from the left panel</div>
                  ) : (
                    <div className="sec-hd">Section 1 of 1</div>
                  )}

                  {questions.map((q, index) => (
                    <Draggable key={q.id} draggableId={q.id} index={index}>
                      {(p) => (
                        <div className="q-card" ref={p.innerRef} {...p.draggableProps}>
                          <div className="q-handle" {...p.dragHandleProps}>⋮⋮</div>

                          <input
                            className="q-title"
                            placeholder="Untitled Question"
                            value={q.label}
                            maxLength={150}
                            onChange={(e) => updateQ(q.id, "label", e.target.value)}
                          />

                          {q.showDescription && (
                            <input
                              className="q-desc"
                              placeholder="Description"
                              value={q.description}
                              maxLength={300}
                              onChange={(e) => updateQ(q.id, "description", e.target.value)}
                            />
                          )}

                          {renderPreview(q)}

                          <div className="q-actions">
                            <div className="q-actions-right">
                              <button
                                type="button"
                                className="icon-btn"
                                title="Duplicate"
                                onClick={() => duplicateQ(q.id)}
                                style={iconBtnNeutral}
                              >
                                <img src={duplicate} alt="Duplicate" />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                title="Delete"
                                onClick={() => deleteQ(q.id)}
                                style={iconBtnNeutral}
                              >
                                <img src={Trash} alt="Delete" />
                              </button>

                              <label className="toggle-label">
                                <span>Description</span>
                                <input
                                  type="checkbox"
                                  className="switch"
                                  checked={q.showDescription}
                                  onChange={(e) => updateQ(q.id, "showDescription", e.target.checked)}
                                />
                              </label>

                              <label className="toggle-label">
                                <span>Required</span>
                                <input
                                  type="checkbox"
                                  className="switch"
                                  checked={q.required}
                                  onChange={(e) => updateQ(q.id, "required", e.target.checked)}
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
                    <span className="add-icon">≡</span> Add Section <span className="info">ⓘ</span>
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
              <span className="eye">○</span>Preview Form
            </button>
            <div className="ff-right">
              <button className="ghost" onClick={saveDraft}>Save as draft</button>
              <button className="primary" onClick={publishForm}>Publish Form</button>
            </div>
          </>
        ) : (
          <>
            <span />
            <div className="ff-right">
              <button className="ghost" onClick={saveDraft}>Save as draft</button>
              <button
                className="primary"
                disabled={!cfgName.trim()}
                aria-disabled={!cfgName.trim()}
                onClick={() => setActiveTab("layout")}
                title={!cfgName.trim() ? "Enter a Form Name to continue" : "Next"}
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