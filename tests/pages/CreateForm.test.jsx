// tests/pages/CreateForm.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

//
// Shared mocks
//

let lastOnDragEnd = null;
let mockLocation = { state: undefined };
const mockNavigate = vi.fn();

// mock react-router hooks
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// mock DnD so we can capture onDragEnd but still render JSX
vi.mock("@hello-pangea/dnd", () => {
  return {
    DragDropContext: ({ children, onDragEnd }) => {
      lastOnDragEnd = onDragEnd;
      return (
        <div data-testid="dnd-root">
          {children}
        </div>
      );
    },
    Droppable: ({ droppableId, children }) => {
      const provided = {
        innerRef: () => {},
        droppableProps: { "data-droppable-id": droppableId },
      };
      const snapshot = { isDraggingOver: false };
      return (
        <div data-testid={`droppable-${droppableId}`}>
          {children(provided, snapshot)}
        </div>
      );
    },
    Draggable: ({ draggableId, index, children }) => {
      const provided = {
        innerRef: () => {},
        draggableProps: {
          "data-draggable-id": draggableId,
          "data-index": index,
        },
        dragHandleProps: {},
      };
      const snapshot = { isDragging: false };
      return (
        <div data-testid={`draggable-${draggableId}`}>
          {children(provided, snapshot)}
        </div>
      );
    },
  };
});

// mock services
vi.mock("@src/api/auth", () => ({
  AuthService: { isAuthenticated: vi.fn() },
}));

vi.mock("@src/api/forms", () => ({
  FormService: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const { AuthService } = await import("@src/api/auth");
const { FormService } = await import("@src/api/forms");

// Mock console.warn to test error handling paths
const originalConsoleWarn = console.warn;
const mockConsoleWarn = vi.fn();

describe("CreateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockLocation = { state: undefined };
    lastOnDragEnd = null;
    window.localStorage.clear();
    console.warn = mockConsoleWarn;
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  async function renderCreateForm() {
    const { default: CreateForm } = await import("@src/pages/CreateForm.jsx");
    return render(<CreateForm />);
  }

  it("shows config tab by default and disables Next when name is empty", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);

    await renderCreateForm();

    expect(
      screen.getByRole("tab", { name: /Form Configuration/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: /Form Layout/i })
    ).toHaveAttribute("aria-selected", "false");

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).toBeDisabled();
    expect(nextBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("enables Next when form name entered and switches to layout tab", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);

    await renderCreateForm();

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "My Form" } });

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);

    expect(
      screen.getByRole("tab", { name: /Form Layout/i })
    ).toHaveAttribute("aria-selected", "true");
  });

  it("loads persisted draft from fb_create and respects location.state.tab", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);

    const draft = {
      name: "Saved Form",
      desc: "Saved description",
      visible: false,
      questions: [{ id: "q1", type: "short", label: "Saved Question" }],
    };
    window.localStorage.setItem("fb_create", JSON.stringify(draft));
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    const nameInputs = screen.getAllByPlaceholderText("Enter the form name");
    expect(nameInputs[0]).toHaveValue("Saved Form");

    expect(
      screen.getByRole("tab", { name: /Form Layout/i })
    ).toHaveAttribute("aria-selected", "true");

    expect(
      screen.getByDisplayValue("Saved Question")
    ).toBeInTheDocument();
  });

  it("handles invalid JSON in localStorage", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    
    // Set invalid JSON in localStorage
    window.localStorage.setItem("fb_create", "{invalid-json");
    
    await renderCreateForm();
    
    // Should log warning about parse failure
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse fb_create:"),
      expect.anything()
    );
  });

  it("handlePreview stores fb_preview and navigates to /preview", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);

    const draft = {
      name: "Preview Form",
      desc: "Preview desc",
      visible: true,
      questions: [{ id: "q1", type: "short", label: "Prev Q" }],
    };
    window.localStorage.setItem("fb_create", JSON.stringify(draft));
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    const previewBtn = screen.getByRole("button", { name: /Preview Form/i });
    fireEvent.click(previewBtn);

    const stored = JSON.parse(
      window.localStorage.getItem("fb_preview") || "{}"
    );
    expect(stored.header?.name).toBe("Preview Form");
    expect(stored.header?.desc).toBe("Preview desc");
    expect(stored.questions).toHaveLength(1);
    expect(mockNavigate).toHaveBeenCalledWith("/preview");
  });

  it("onDragEnd ignores events with no destination", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    expect(typeof lastOnDragEnd).toBe("function");
    // just ensure it doesn't throw
    lastOnDragEnd({
      source: { droppableId: "FIELDS", index: 0 },
      destination: null,
    });
  });

  it("adds a new short-text question when dragging from palette to canvas", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    expect(typeof lastOnDragEnd).toBe("function");

    // FIELDS index 0 is 'short'
    lastOnDragEnd({
      source: { droppableId: "FIELDS", index: 0 },
      destination: { droppableId: "CANVAS", index: 0 },
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Short Text (Up to 100 Characters)")
      ).toBeInTheDocument();
    });
  });

  it("adds a new long-text question when dragging from palette to canvas", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    // FIELDS index 1 is 'long'
    lastOnDragEnd({
      source: { droppableId: "FIELDS", index: 1 },
      destination: { droppableId: "CANVAS", index: 0 },
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Long Text (Up to 500 Characters)")
      ).toBeInTheDocument();
    });
  });

  it("adds a new date question when dragging from palette to canvas", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    // FIELDS index 2 is 'date'
    lastOnDragEnd({
      source: { droppableId: "FIELDS", index: 2 },
      destination: { droppableId: "CANVAS", index: 0 },
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("DD/MM/YYYY")
      ).toBeInTheDocument();
    });
  });

  it("adds a new dropdown question when dragging from palette to canvas", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    // FIELDS index 3 is 'dropdown'
    lastOnDragEnd({
      source: { droppableId: "FIELDS", index: 3 },
      destination: { droppableId: "CANVAS", index: 0 },
    });

    await waitFor(() => {
      expect(
        screen.getByText("+ Add Option")
      ).toBeInTheDocument();
    });
  });

  it("adds a new file upload question when dragging from palette to canvas", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    // FIELDS index 4 is 'file'
    lastOnDragEnd({
      source: { droppableId: "FIELDS", index: 4 },
      destination: { droppableId: "CANVAS", index: 0 },
    });

    await waitFor(() => {
      expect(
        screen.getByText("File Upload (Only one file allowed)")
      ).toBeInTheDocument();
    });
  });

  it("adds a new number question when dragging from palette to canvas", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    // FIELDS index 5 is 'number'
    lastOnDragEnd({
      source: { droppableId: "FIELDS", index: 5 },
      destination: { droppableId: "CANVAS", index: 0 },
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Numeric value")
      ).toBeInTheDocument();
    });
  });

  it("reorders questions when dragging within canvas", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);

    const draft = {
      name: "Reorder Form",
      desc: "",
      visible: true,
      questions: [
        { id: "q1", type: "short", label: "First Q" },
        { id: "q2", type: "short", label: "Second Q" },
      ],
    };
    window.localStorage.setItem("fb_create", JSON.stringify(draft));
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    expect(typeof lastOnDragEnd).toBe("function");

    // initial order
    const initialInputs = screen.getAllByPlaceholderText("Untitled Question");
    expect(initialInputs[0]).toHaveValue("First Q");
    expect(initialInputs[1]).toHaveValue("Second Q");

    // drag q1 (index 0) after q2 (index 1)
    lastOnDragEnd({
      source: { droppableId: "CANVAS", index: 0 },
      destination: { droppableId: "CANVAS", index: 1 },
    });

    await waitFor(() => {
      const inputsAfter = screen.getAllByPlaceholderText("Untitled Question");
      expect(inputsAfter[0]).toHaveValue("Second Q");
      expect(inputsAfter[1]).toHaveValue("First Q");
    });
  });

  it("supports description and required toggles on a question", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);

    const draft = {
      name: "Toggles Form",
      desc: "",
      visible: true,
      questions: [
        {
          id: "q1",
          type: "short",
          label: "Short Q",
          showDescription: false,
          required: false,
        },
      ],
    };
    window.localStorage.setItem("fb_create", JSON.stringify(draft));
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    // enable description
    const descToggle = screen.getByLabelText("Description");
    fireEvent.click(descToggle);

    const descInput = screen.getByPlaceholderText("Description");
    fireEvent.change(descInput, { target: { value: "Help text" } });
    expect(descInput).toHaveValue("Help text");

    // toggle required
    const reqToggle = screen.getByLabelText("Required");
    fireEvent.click(reqToggle);

    // publish and assert isRequired is true in payload
    FormService.create.mockResolvedValue();
    const publishBtn = screen.getByRole("button", { name: /Publish Form/i });
    fireEvent.click(publishBtn);

    expect(FormService.create).toHaveBeenCalledTimes(1);
    const [payload] = FormService.create.mock.calls[0];
    expect(payload.layout[0].fields[0].isRequired).toBe(true);
  });

  it("saveDraft (unauthenticated) writes local Draft and navigates home", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);

    await renderCreateForm();

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, {
      target: { value: "Local Draft Form" },
    });

    const saveBtn = screen.getAllByRole("button", {
      name: /Save as draft/i,
    })[0];
    fireEvent.click(saveBtn);

    const forms = JSON.parse(
      window.localStorage.getItem("fb_forms") || "[]"
    );
    expect(forms).toHaveLength(1);
    expect(forms[0].title).toBe("Local Draft Form");
    expect(forms[0].status).toBe("Draft");
    expect(forms[0]._from).toBe("local");

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("saveDraft updates existing form via API when authenticated and editingFormKey set", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.update.mockResolvedValue();

    mockLocation = { state: { tab: "layout", formKey: "FORM-123" } };

    const draft = {
      name: "Edit Me",
      desc: "Editing",
      visible: true,
      questions: [{ id: "q1", type: "short", label: "Q" }],
    };
    window.localStorage.setItem("fb_create", JSON.stringify(draft));

    await renderCreateForm();

    const saveBtn = screen.getAllByRole("button", {
      name: /Save as draft/i,
    })[0];
    fireEvent.click(saveBtn);

    expect(FormService.update).toHaveBeenCalledTimes(1);
    const [keyArg, payload] = FormService.update.mock.calls[0];
    expect(keyArg).toBe("FORM-123");
    expect(payload.status).toBe("Draft");
    expect(payload.title).toBe("Edit Me");
  });

  it("publishForm creates new form via API and mapField covers all field types", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.create.mockResolvedValue();

    const draft = {
      name: "All Types",
      desc: "desc",
      visible: true,
      questions: [
        { id: "s1", type: "short", label: "Short", required: true },
        { id: "l1", type: "long", label: "Long", required: false },
        { id: "d1", type: "date", label: "Date", dateFormat: "MM-DD-YYYY" },
        {
          id: "dd1",
          type: "dropdown",
          label: "Drop",
          options: ["One", "Two"],
          multi: true,
        },
        { id: "f1", type: "file", label: "File" },
        { id: "n1", type: "number", label: "Number" },
      ],
    };
    window.localStorage.setItem("fb_create", JSON.stringify(draft));
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    const publishBtn = screen.getByRole("button", {
      name: /Publish Form/i,
    });
    fireEvent.click(publishBtn);

    expect(FormService.create).toHaveBeenCalledTimes(1);
    const [payload] = FormService.create.mock.calls[0];

    expect(payload.status).toBe("Published");
    expect(payload.title).toBe("All Types");
    const fields = payload.layout[0].fields;
    expect(fields).toHaveLength(6);

    expect(fields[0]).toMatchObject({
      fieldId: "s1",
      label: "Short",
      type: "text",
      isRequired: true,
    });
    expect(fields[1]).toMatchObject({
      fieldId: "l1",
      label: "Long",
      type: "textarea",
    });
    expect(fields[2]).toMatchObject({
      fieldId: "d1",
      label: "Date",
      type: "date",
      dateFormat: "MM-DD-YYYY",
    });
    expect(fields[3]).toMatchObject({
      fieldId: "dd1",
      label: "Drop",
      type: "select",
      options: ["One", "Two"],
      multi: true,
    });
    expect(fields[4]).toMatchObject({
      fieldId: "f1",
      label: "File",
      type: "file",
    });
    expect(fields[5]).toMatchObject({
      fieldId: "n1",
      label: "Number",
      type: "number",
    });
  });

  it("publishForm falls back to local Published when API fails", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.create.mockRejectedValue(new Error("publish failed"));

    const draft = {
      name: "Local Publish",
      desc: "",
      visible: true,
      questions: [],
    };
    window.localStorage.setItem("fb_create", JSON.stringify(draft));
    mockLocation = { state: { tab: "layout" } };

    await renderCreateForm();

    const publishBtn = screen.getByRole("button", {
      name: /Publish Form/i,
    });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      const forms = JSON.parse(
        window.localStorage.getItem("fb_forms") || "[]"
      );
      expect(forms.length).toBeGreaterThan(0);
      expect(forms[0].title).toBe("Local Publish");
      expect(forms[0].status).toBe("Published");
    });
  });
});