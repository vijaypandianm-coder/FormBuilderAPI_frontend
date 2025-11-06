// tests/pages/CreateForm.test.jsx
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import CreateForm from "../../src/pages/CreateForm.jsx";

// ------- Mocks -------

// Keep track of navigation + location state
const mockNavigate = vi.fn();
let mockLocationState = {};

// Mock react-router-dom hooks
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: "/create-form",
      state: mockLocationState,
    }),
  };
});

// Mock AuthService
import { AuthService } from "../../src/api/auth";
vi.mock("../../src/api/auth", () => ({
  AuthService: {
    isAuthenticated: vi.fn(),
  },
}));

// Mock FormService
import { FormService } from "../../src/api/forms";
vi.mock("../../src/api/forms", () => ({
  FormService: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock @hello-pangea/dnd in a safe, test-friendly way
let latestOnDragEnd = null;

vi.mock("@hello-pangea/dnd", () => {
  const React = require("react");
  return {
    DragDropContext: ({ children, onDragEnd }) => {
      latestOnDragEnd = onDragEnd;
      return <div data-testid="dd-context">{children}</div>;
    },
    Droppable: ({ children, droppableId }) => {
      const provided = {
        innerRef: () => {},
        droppableProps: {},
        placeholder: null,
      };
      const snapshot = { isDraggingOver: false };
      return (
        <div data-testid={`droppable-${droppableId}`}>
          {children(provided, snapshot)}
        </div>
      );
    },
    Draggable: ({ children, draggableId, index }) => {
      const provided = {
        innerRef: () => {},
        draggableProps: {
          "data-draggable-id": draggableId,
          "data-draggable-index": index,
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

// Small helper to flush microtasks if needed
const flushPromises = () => new Promise((res) => setTimeout(res, 0));

// ------- Shared setup / teardown -------

let warnSpy;

beforeEach(() => {
  localStorage.clear();
  mockLocationState = {};
  mockNavigate.mockReset();

  AuthService.isAuthenticated.mockReset();
  FormService.get.mockReset();
  FormService.create.mockReset();
  FormService.update.mockReset();

  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

// ------- Tests -------

describe("<CreateForm />", () => {
  it("restores existing fb_create draft for new create instead of clearing it", async () => {
    // Seed an old draft
    localStorage.setItem(
      "fb_create",
      JSON.stringify({
        name: "Old Name",
        desc: "Old desc",
        visible: false,
        questions: [{ id: "q1" }],
      })
    );

    AuthService.isAuthenticated.mockReturnValue(true);

    render(<CreateForm />);

    // On config tab by default
    expect(screen.getByText("Form Details")).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    const descInput = screen.getByPlaceholderText(
      "Enter the form description (optional)"
    );

    // Values should be restored from fb_create
    expect(nameInput).toHaveValue("Old Name");
    expect(descInput).toHaveValue("Old desc");

    // Visibility restored (false)
    const visibilityCheckbox = screen.getByRole("checkbox", { hidden: true });
    expect(visibilityCheckbox).not.toBeChecked();

    // fb_create should still reflect the same draft (or an updated version with same core values)
    const draft = JSON.parse(localStorage.getItem("fb_create"));
    expect(draft.name).toBe("Old Name");
    expect(draft.desc).toBe("Old desc");
    expect(draft.visible).toBe(false);
    expect(Array.isArray(draft.questions)).toBe(true);
    expect(draft.questions[0].id).toBe("q1");
  });

  it("loads existing form for editing from API and maps fields correctly", async () => {
    mockLocationState = { formKey: "edit-key", tab: "layout" };
    AuthService.isAuthenticated.mockReturnValue(true);

    FormService.get.mockResolvedValue({
      title: "Edit Form",
      description: "Edit Description",
      visible: false,
      layout: [
        {
          title: "Section 1",
          fields: [
            { fieldId: "f1", type: "text", label: "Short Q", isRequired: true },
            {
              fieldId: "f2",
              type: "textarea",
              label: "Long Q",
              isRequired: false,
            },
            {
              fieldId: "f3",
              type: "date",
              label: "Date Q",
              isRequired: false,
              dateFormat: "MM-DD-YYYY",
            },
            {
              fieldId: "f4",
              type: "select",
              label: "Dropdown Q",
              isRequired: true,
              options: ["A", "B"],
              multi: true,
            },
            {
              fieldId: "f5",
              type: "file",
              label: "File Q",
              isRequired: false,
            },
            {
              fieldId: "f6",
              type: "number",
              label: "Number Q",
              isRequired: true,
            },
          ],
        },
      ],
    });

    const { container } = render(<CreateForm />);

    await waitFor(() =>
      expect(FormService.get).toHaveBeenCalledWith("edit-key")
    );

    // Layout tab header values
    expect(screen.getByDisplayValue("Edit Form")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Edit Description")
    ).toBeInTheDocument();

    // We should have 6 question cards
    const qCards = container.querySelectorAll(".q-card");
    expect(qCards.length).toBe(6);

    // Date format mapped
    expect(screen.getByPlaceholderText("MM-DD-YYYY")).toBeInTheDocument();

    // Dropdown options mapped
    expect(screen.getByDisplayValue("A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("B")).toBeInTheDocument();
  });

  it("handles error when loading existing form for editing without crashing", async () => {
    mockLocationState = { formKey: "bad-key" };
    AuthService.isAuthenticated.mockReturnValue(true);

    FormService.get.mockRejectedValue(new Error("Boom"));

    render(<CreateForm />);

    await flushPromises();

    // Component still renders config view
    expect(screen.getByText("Form Details")).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to load form for editing:",
      "Boom"
    );
  });

  it("stores preview payload and navigates to /preview", async () => {
    mockLocationState = { tab: "layout" };
    AuthService.isAuthenticated.mockReturnValue(true);

    render(<CreateForm />);

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    const descInput = screen.getByPlaceholderText(
      "Enter the form description (optional)"
    );

    fireEvent.change(nameInput, { target: { value: "Preview Name" } });
    fireEvent.change(descInput, { target: { value: "Preview Desc" } });

    fireEvent.click(screen.getByText("Preview Form"));

    const stored = JSON.parse(localStorage.getItem("fb_preview"));
    expect(stored).toBeTruthy();
    expect(stored.header.name).toBe("Preview Name");
    expect(stored.header.desc).toBe("Preview Desc");
    expect(stored.header.title).toBe("Employee Onboarding");

    expect(mockNavigate).toHaveBeenCalledWith("/preview");
  });

  it("supports dragging new fields and reordering within canvas", async () => {
    mockLocationState = { tab: "layout" };
    AuthService.isAuthenticated.mockReturnValue(true);

    render(<CreateForm />);

    // Add two fields via onDragEnd:
    // index 0 = short text, index 1 = long text
    await act(async () => {
      latestOnDragEnd({
        source: { droppableId: "FIELDS", index: 0 },
        destination: { droppableId: "CANVAS", index: 0 },
      });
    });

    await act(async () => {
      latestOnDragEnd({
        source: { droppableId: "FIELDS", index: 1 },
        destination: { droppableId: "CANVAS", index: 1 },
      });
    });

    // Two question title inputs
    let titleInputs = await screen.findAllByPlaceholderText("Untitled Question");
    expect(titleInputs.length).toBe(2);

    // Give them distinct labels
    fireEvent.change(titleInputs[0], {
      target: { value: "First Question" },
    });
    fireEvent.change(titleInputs[1], {
      target: { value: "Second Question" },
    });

    // Reorder: move second to the top
    await act(async () => {
      latestOnDragEnd({
        source: { droppableId: "CANVAS", index: 1 },
        destination: { droppableId: "CANVAS", index: 0 },
      });
    });

    titleInputs = await screen.findAllByPlaceholderText("Untitled Question");
    expect(titleInputs[0]).toHaveValue("Second Question");
    expect(titleInputs[1]).toHaveValue("First Question");
  });

  it("allows dropdown option add/update/remove and toggling description/required", async () => {
    mockLocationState = { tab: "layout" };
    AuthService.isAuthenticated.mockReturnValue(true);

    render(<CreateForm />);

    // index 3 in FIELD_TYPES is "dropdown"
    await act(async () => {
      latestOnDragEnd({
        source: { droppableId: "FIELDS", index: 3 },
        destination: { droppableId: "CANVAS", index: 0 },
      });
    });

    // One question title
    const titleInput = await screen.findByPlaceholderText("Untitled Question");
    fireEvent.change(titleInput, { target: { value: "Dropdown Q" } });
    expect(titleInput).toHaveValue("Dropdown Q");

    // Default option "Option 1"
    const optionInput = screen.getByDisplayValue("Option 1");
    fireEvent.change(optionInput, {
      target: { value: "Updated Opt" },
    });
    expect(optionInput).toHaveValue("Updated Opt");

    // Add second option
    fireEvent.click(screen.getByText("+ Add Option"));
    await flushPromises();

    // Should now have at least two option inputs
    const optionInputs = screen
      .getAllByRole("textbox")
      .filter((el) => el.classList.contains("q-preview"));
    expect(optionInputs.length).toBeGreaterThanOrEqual(2);

    // Remove the second option via its ✕ button
    const removeButtons = screen.getAllByTitle("Remove option");
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(removeButtons[1]);

    // Still at least one option remains
    const remainingOptions = screen
      .getAllByRole("textbox")
      .filter((el) => el.classList.contains("q-preview"));
    expect(remainingOptions.length).toBe(1);

    // Toggle description & required
    const descToggle = screen.getByLabelText("Description");
    const reqToggle = screen.getByLabelText("Required");

    // Description starts off hidden
    expect(
      screen.queryByPlaceholderText("Description")
    ).not.toBeInTheDocument();

    fireEvent.click(descToggle);
    expect(
      screen.getByPlaceholderText("Description")
    ).toBeInTheDocument();

    expect(reqToggle).not.toBeChecked();
    fireEvent.click(reqToggle);
    expect(reqToggle).toBeChecked();
  });

  it("saveDraft when authed creates new draft via API for new forms", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.create.mockResolvedValue({});

    render(<CreateForm />);

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "Draft Form" } });

    fireEvent.click(screen.getByText("Save as draft"));

    await waitFor(() => {
      expect(FormService.create).toHaveBeenCalledTimes(1);
    });

    const payload = FormService.create.mock.calls[0][0];
    expect(payload.status).toBe("Draft");
    expect(payload.title).toBe("Draft Form");
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("saveDraft when editing calls FormService.update", async () => {
    mockLocationState = { formKey: "edit-key" };
    AuthService.isAuthenticated.mockReturnValue(true);

    FormService.get.mockResolvedValue({
      title: "Existing",
      description: "",
      layout: [{ title: "Section 1", fields: [] }],
    });
    FormService.update.mockResolvedValue({});

    render(<CreateForm />);

    await waitFor(() =>
      expect(FormService.get).toHaveBeenCalledWith("edit-key")
    );

    fireEvent.click(screen.getByText("Save as draft"));

    await waitFor(() => {
      expect(FormService.update).toHaveBeenCalledTimes(1);
    });

    const [key, payload] = FormService.update.mock.calls[0];
    expect(key).toBe("edit-key");
    expect(payload.status).toBe("Draft");
  });

  it("saveDraft falls back to local drafts when API fails", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.create.mockRejectedValue(new Error("Network"));

    render(<CreateForm />);

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "Local Draft" } });

    fireEvent.click(screen.getByText("Save as draft"));

    await flushPromises();

    expect(FormService.create).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "Draft save via API failed, using local:",
      "Network"
    );

    const stored = JSON.parse(localStorage.getItem("fb_forms"));
    expect(Array.isArray(stored)).toBe(true);
    expect(stored[0].title).toBe("Local Draft");
    expect(stored[0].status).toBe("Draft");
  });

  it("saveDraft without auth uses local drafts and never hits API", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);

    render(<CreateForm />);

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "No Auth Draft" } });

    fireEvent.click(screen.getByText("Save as draft"));

    await flushPromises();

    expect(FormService.create).not.toHaveBeenCalled();
    expect(FormService.update).not.toHaveBeenCalled();

    const stored = JSON.parse(localStorage.getItem("fb_forms"));
    expect(stored[0].title).toBe("No Auth Draft");
    expect(stored[0].status).toBe("Draft");
  });

  it("publishForm when authed creates new published form via API", async () => {
    mockLocationState = { tab: "layout" };
    AuthService.isAuthenticated.mockReturnValue(true);

    FormService.create.mockResolvedValue({});

    // fb_create present (should be removed on success)
    localStorage.setItem("fb_create", JSON.stringify({}));

    render(<CreateForm />);

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "Published Form" } });

    fireEvent.click(screen.getByText("Publish Form"));

    await waitFor(() => {
      expect(FormService.create).toHaveBeenCalledTimes(1);
    });

    const payload = FormService.create.mock.calls[0][0];
    expect(payload.status).toBe("Published");

    expect(localStorage.getItem("fb_create")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("publishForm falls back to local when API fails", async () => {
    mockLocationState = { tab: "layout" };
    AuthService.isAuthenticated.mockReturnValue(true);

    FormService.create.mockRejectedValue(new Error("PublishFail"));
    localStorage.setItem("fb_create", JSON.stringify({}));

    render(<CreateForm />);

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "Local Pub" } });

    fireEvent.click(screen.getByText("Publish Form"));

    await flushPromises();

    expect(FormService.create).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "Publish via API failed, using local:",
      "PublishFail"
    );

    const stored = JSON.parse(localStorage.getItem("fb_forms"));
    expect(stored[0].title).toBe("Local Pub");
    expect(stored[0].status).toBe("Published");
    // fb_create also removed after local publish
    expect(localStorage.getItem("fb_create")).toBeNull();
  });

  it("publishForm without auth uses local storage and removes fb_create", async () => {
    mockLocationState = { tab: "layout" };
    AuthService.isAuthenticated.mockReturnValue(false);

    localStorage.setItem("fb_create", JSON.stringify({ draft: true }));

    render(<CreateForm />);

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "No Auth Pub" } });

    fireEvent.click(screen.getByText("Publish Form"));

    await flushPromises();

    expect(FormService.create).not.toHaveBeenCalled();
    expect(FormService.update).not.toHaveBeenCalled();

    const stored = JSON.parse(localStorage.getItem("fb_forms"));
    expect(stored[0].title).toBe("No Auth Pub");
    expect(stored[0].status).toBe("Published");

    expect(localStorage.getItem("fb_create")).toBeNull();
  });

  it("disables Next button without form name and enables when name is set", () => {
    AuthService.isAuthenticated.mockReturnValue(true);

    render(<CreateForm />);

    const nextButton = screen.getByText("Next");
    expect(nextButton).toBeDisabled();

    const nameInput = screen.getByPlaceholderText("Enter the form name");
    fireEvent.change(nameInput, { target: { value: "Config Name" } });

    expect(nextButton).not.toBeDisabled();
  });
});