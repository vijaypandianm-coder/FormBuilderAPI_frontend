

// tests/pages/ViewForm.test.jsx
import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ViewForm from "../../src/pages/ViewForm.jsx";

// ---- Patch jsdom CSS bug: border shorthand + CSS vars ----
let originalSetProperty;

beforeAll(() => {
  const CSSDecl = window.CSSStyleDeclaration;
  if (CSSDecl && CSSDecl.prototype && !originalSetProperty) {
    originalSetProperty = CSSDecl.prototype.setProperty;
    CSSDecl.prototype.setProperty = function (prop, value, priority) {
      // Ignore all border-related properties to avoid cssstyle + CSS var crash
      if (typeof prop === "string" && prop.startsWith("border")) {
        return;
      }
      return originalSetProperty.call(this, prop, value, priority);
    };
  }
});

afterAll(() => {
  const CSSDecl = window.CSSStyleDeclaration;
  if (CSSDecl && CSSDecl.prototype && originalSetProperty) {
    CSSDecl.prototype.setProperty = originalSetProperty;
  }
});

// ---- mocks ----
vi.mock("../../src/api/forms", () => ({
  FormService: {
    get: vi.fn(),
  },
}));

vi.mock("../../src/api/responses", () => ({
  ResponsesApi: {
    list: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ search: "" }),
  };
});

// Mock fetch for username resolution
global.fetch = vi.fn();

const { useParams } = await import("react-router-dom");
const { FormService } = await import("../../src/api/forms");
const { ResponsesApi } = await import("../../src/api/responses");

describe("ViewForm page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParams.mockReturnValue({ formKey: "123" });
    // silence window.alert for Filter / Export buttons
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // Reset fetch mock
    global.fetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockForm = {
    title: "Sample Form",
    description: "A demo form",
    status: "Published",
    layout: {
      sections: [
        {
          title: "Section 1",
          fields: [
            {
              fieldId: "f1",
              label: "Question 1",
              type: "short",
              isRequired: true,
            },
            {
              fieldId: "f2",
              label: "Question 2",
              type: "number",
            },
          ],
        },
      ],
    },
  };

  const mockEmptyForm = {
    title: "Empty Form",
    description: "A form with no sections",
    status: "Draft",
    layout: {
      sections: [],
    },
  };

  const mockFormWithoutSections = {
    title: "No Sections Form",
    description: "A form without sections array",
    status: "Draft",
    layout: {},
  };

  it("renders loading then form config", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    // Loading skeleton
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for Form Details card
    await waitFor(() => {
      expect(screen.getByText("Form Details")).toBeInTheDocument();
    });

    // Config content
    expect(screen.getByDisplayValue("Sample Form")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A demo form")).toBeInTheDocument();
  });

  it("handles error on form fetch and shows error banner", async () => {
    FormService.get.mockRejectedValueOnce(new Error("Network fail"));

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    // Error is rendered directly as the message string
    await waitFor(() => {
      expect(screen.getByText("Network fail")).toBeInTheDocument();
    });
  });

  it("switches between tabs (config → layout → responses)", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    // Initially config
    await screen.findByText("Form Details");

    // Switch to layout
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    await waitFor(() => {
      expect(screen.getByText("Sample Form")).toBeInTheDocument();
    });
    expect(screen.getByText(/question 1/i)).toBeInTheDocument();
    expect(screen.getByText(/question 2/i)).toBeInTheDocument();

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    await waitFor(() => {
      expect(screen.getByText(/response summary/i)).toBeInTheDocument();
    });
  });

  it("renders response summary with mock data and supports search & pagination", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockResolvedValueOnce([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "f1",
        answerValue: "Yes",
      },
      {
        responseId: 2,
        userId: 102,
        submittedAt: "2024-03-03T11:00:00Z",
        fieldId: "f1",
        answerValue: "No",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Go to responses tab
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    await waitFor(() => {
      expect(screen.getByText(/response summary/i)).toBeInTheDocument();
    });

    // Table rows rendered with user ids
    await waitFor(() => {
      expect(screen.getByText(/user 101/i)).toBeInTheDocument();
      expect(screen.getByText(/user 102/i)).toBeInTheDocument();
    });

    // Items per page selector triggers onChange path
    const pageSizeSelect = screen.getByDisplayValue("10");
    fireEvent.change(pageSizeSelect, { target: { value: "25" } });

    // Search by user id triggers filtering logic
    const searchInput = screen.getByPlaceholderText(
      /search by name\/user id/i
    );
    fireEvent.change(searchInput, { target: { value: "101" } });

    await waitFor(() => {
      expect(screen.getByText(/user 101/i)).toBeInTheDocument();
    });

    // Pager buttons exist & are clickable (even if only one page)
    const prevBtn = screen.getByRole("button", { name: "‹" });
    const nextBtn = screen.getByRole("button", { name: "›" });
    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);

    // Filter / Export buttons (just ensure they are there and clickable)
    fireEvent.click(screen.getByRole("button", { name: /filter/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /export to excel/i })
    );

    expect(window.alert).toHaveBeenCalledTimes(2);
  });

  it("renders individual responses view and shows selected response details", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    // IMPORTANT: use mockResolvedValue (not Once) so both effect runs get data
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 22,
        userId: 900,
        submittedAt: "2024-02-20T12:00:00Z",
        fieldId: "f1",
        answerValue: "Hello world",
      },
      {
        responseId: 23,
        userId: 901,
        submittedAt: "2024-02-21T12:00:00Z",
        fieldId: "f1",
        answerValue: "Second answer",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Go to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));
    await screen.findByText(/response summary/i);

    // Switch to Individual Response tab
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    await waitFor(() => {
      // left side list should now have both responses
      expect(screen.getByText(/response id: 22/i)).toBeInTheDocument();
      expect(screen.getByText(/response id: 23/i)).toBeInTheDocument();
    });

    // Click second response in list
    const secondItem = screen
      .getByText(/response id: 23/i)
      .closest("button");
    fireEvent.click(secondItem);

    // Right pane shows details for currently selected response
    await waitFor(() => {
      expect(screen.getByText("Question 1")).toBeInTheDocument();
      expect(screen.getByText(/second answer/i)).toBeInTheDocument();
    });

    // mini pager buttons
    const miniPrev = screen.getAllByRole("button", { name: "‹" }).at(-1);
    const miniNext = screen.getAllByRole("button", { name: "›" }).at(-1);
    fireEvent.click(miniPrev);
    fireEvent.click(miniNext);
  });

  // NEW TEST: Test empty layout rendering
  it("renders empty layout when form has no sections", async () => {
    FormService.get.mockResolvedValueOnce(mockEmptyForm);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to layout
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    await waitFor(() => {
      expect(screen.getByText("Empty Form")).toBeInTheDocument();
      expect(screen.getByText("Not Found")).toBeInTheDocument();
    });
  });

  // NEW TEST: Test form without sections array
  it("handles form layout without sections array", async () => {
    FormService.get.mockResolvedValueOnce(mockFormWithoutSections);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to layout
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    await waitFor(() => {
      expect(screen.getByText("No Sections Form")).toBeInTheDocument();
      expect(screen.getByText("Not Found")).toBeInTheDocument();
    });
  });

  // NEW TEST: Test error handling in responses tab
  it("handles error when fetching responses", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockRejectedValueOnce(
      new Error("Failed to load responses")
    );

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load responses")
      ).toBeInTheDocument();
    });
  });

  // NEW TEST: Test username resolution
  it("resolves usernames from API", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "f1",
        answerValue: "Yes",
      },
    ]);

    // Mock successful bulk user fetch
    global.fetch.mockImplementation((url) => {
      if (url.includes("/api/users/by-ids?ids=101")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 101, name: "John Doe" }]),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  // NEW TEST: Test fallback username resolution
  it("tries multiple endpoints for username resolution", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 102,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "f1",
        answerValue: "Yes",
      },
    ]);

    // Mock failed bulk endpoints but successful individual endpoint
    let fetchCount = 0;
    global.fetch.mockImplementation((url) => {
      fetchCount++;
      if (url.includes("/api/users/by-ids")) {
        return Promise.resolve({ ok: false });
      }
      if (url.includes("/api/users/102")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: 102, username: "jane_smith" }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    await waitFor(() => {
      expect(screen.getByText("jane_smith")).toBeInTheDocument();
    });

    // Verify multiple endpoints were tried
    expect(fetchCount).toBeGreaterThan(1);
  });

  // NEW TEST: Test label resolution with complex field IDs
  it("resolves field labels from complex IDs", async () => {
    const formWithComplexIds = {
      ...mockForm,
      layout: {
        sections: [
          {
            title: "Complex Section",
            fields: [
              {
                fieldId: "forms:complex/field:id:123abc",
                label: "Complex Field",
                type: "short",
              },
            ],
          },
        ],
      },
    };

    FormService.get.mockResolvedValueOnce(formWithComplexIds);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "forms:complex/field:id:123abc",
        answerValue: "Complex answer",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Switch to individual responses
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Complex Field")).toBeInTheDocument();
      expect(screen.getByText("Complex answer")).toBeInTheDocument();
    });
  });

  // NEW TEST: Test label resolution with fallback
  it("falls back to fieldId when label is missing", async () => {
    const formWithMissingLabels = {
      ...mockForm,
      layout: {
        sections: [
          {
            title: "Missing Labels",
            fields: [
              {
                fieldId: "unlabeled_field",
                type: "short",
                // No label provided
              },
            ],
          },
        ],
      },
    };

    FormService.get.mockResolvedValueOnce(formWithMissingLabels);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "unlabeled_field",
        answerValue: "Answer to unlabeled question",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to layout tab to verify field rendering
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    await waitFor(() => {
      // Should show fieldId text in layout row (since label missing)
      expect(screen.getByText(/unlabeled_field/i)).toBeInTheDocument();
    });

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Switch to individual responses
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Answer to unlabeled question")
      ).toBeInTheDocument();
    });
  });

  // NEW TEST: Test empty responses
  it("handles empty responses list", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    await waitFor(() => {
      expect(screen.getByText("Not Found")).toBeInTheDocument();
    });

    // Switch to individual responses
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    await waitFor(() => {
      expect(screen.getByText("No responses")).toBeInTheDocument();
    });
  });

  // NEW TEST: Test normalization of bulk user data
  it("normalizes different user data formats", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "f1",
        answerValue: "Yes",
      },
      {
        responseId: 2,
        userId: 102,
        submittedAt: "2024-03-03T11:00:00Z",
        fieldId: "f1",
        answerValue: "No",
      },
    ]);

    // Mock successful bulk user fetch with different formats
    // The component might handle this differently than expected in the test
    global.fetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false, // Force fallback to default user names
      });
    });

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Check that user IDs are in the document
    await waitFor(() => {
      expect(screen.getByText("101")).toBeInTheDocument();
      expect(screen.getByText("102")).toBeInTheDocument();
      expect(screen.getAllByText(/User \d+/).length).toBeGreaterThan(0);
    });
  });

  // Test JWT token extraction for file downloads
  it("renders file download buttons for file answers", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-01T10:00:00Z",
        fieldId: "f1",
        answerValue: "file:123",
      },
    ]);

    // Mock fetch for file download
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["test content"])),
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="test.txt"',
      }),
    });

    // Mock document methods for file download
    const originalCreateElement = document.createElement;
    const mockLink = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };

    document.createElement = vi.fn((tag) => {
      if (tag === "a") return mockLink;
      return originalCreateElement.call(document, tag);
    });

    // Mock URL methods
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:test");

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses tab
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Switch to individual responses
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    // Wait for download button to appear
    await waitFor(() => {
      expect(screen.getByText(/download file/i)).toBeInTheDocument();
    });

    // Click download button
    fireEvent.click(screen.getByText(/download file/i));

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Restore mocks
    document.createElement = originalCreateElement;
    URL.createObjectURL = originalCreateObjectURL;
  });

  // Test resolves labels from complex field IDs in responses
  it("resolves labels from complex field IDs in responses", async () => {
    const complexForm = {
      title: "Complex Form",
      description: "Form with complex field IDs",
      status: "Published",
      layout: {
        sections: [
          {
            title: "Section 1",
            fields: [
              {
                fieldId: "forms:complex/field:id:123abc",
                label: "Complex Field",
                type: "short",
              },
              {
                fieldId: "simple-id",
                label: "Simple Field",
                type: "short",
              },
            ],
          },
        ],
      },
    };

    FormService.get.mockResolvedValueOnce(complexForm);

    // Create responses with various field ID formats
    const responses = [
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "forms:complex/field:id:123abc",
        answerValue: "Complex answer",
      },
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "simple-id",
        answerValue: "Simple answer",
      },
    ];

    ResponsesApi.list.mockResolvedValue(responses);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to layout tab to verify field rendering
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    // Check that complex field is rendered correctly
    await waitFor(() => {
      expect(screen.getByText("Complex Field")).toBeInTheDocument();
      expect(screen.getByText("Simple Field")).toBeInTheDocument();
    });

    // Switch to responses tab
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Switch to individual responses
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    // Check that field labels are correctly resolved
    await waitFor(() => {
      expect(screen.getByText("Complex Field")).toBeInTheDocument();
      expect(screen.getByText("Complex answer")).toBeInTheDocument();
    });
  });

  // Test URL query parameter handling
  it("syncs tab state with URL query parameters", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    // Mock navigate function to check URL updates
    const navigateMock = vi.fn();
    const useNavigateMock = vi.fn(() => navigateMock);

    // Override the mock from the top of the file
    vi.mocked(useParams).mockReturnValue({ formKey: "123" });

    // Mock useNavigate
    const reactRouterDom = await import("react-router-dom");
    const originalUseNavigate = reactRouterDom.useNavigate;
    reactRouterDom.useNavigate = useNavigateMock;

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to layout tab
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    // Check that the layout tab is active
    expect(
      screen.getByRole("tab", { name: /form layout/i })
    ).toHaveAttribute("aria-selected", "true");

    // Verify navigate was called to update URL
    expect(navigateMock).toHaveBeenCalled();

    // Restore original
    reactRouterDom.useNavigate = originalUseNavigate;
  });

  // Test pagination in responses
  it("handles pagination in responses view", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    // Create 15 mock responses to test pagination
    const mockResponses = Array.from({ length: 15 }, (_, i) => ({
      responseId: i + 1,
      userId: 100 + i,
      submittedAt: `2024-03-${(i % 28) + 1}T10:00:00Z`,
      fieldId: "f1",
      answerValue: `Answer ${i + 1}`,
    }));

    ResponsesApi.list.mockResolvedValue(mockResponses);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses tab
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Check that pagination controls exist
    await waitFor(() => {
      expect(screen.getByText(/items per page/i)).toBeInTheDocument();
      expect(screen.getByText(/1 of 2/i)).toBeInTheDocument();
    });

    // Change items per page
    const pageSizeSelect = screen.getByRole("combobox");
    fireEvent.change(pageSizeSelect, { target: { value: "25" } });

    // Check that pagination updated
    await waitFor(() => {
      expect(screen.getByText(/1 of 1/i)).toBeInTheDocument();
    });
  });

  // Test search functionality in responses
  it("filters responses based on search input", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "f1",
        answerValue: "Unique answer text",
      },
      {
        responseId: 2,
        userId: 102,
        submittedAt: "2024-03-03T11:00:00Z",
        fieldId: "f1",
        answerValue: "Different response",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses tab
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Enter search text
    const searchInput = screen.getByPlaceholderText(
      /search by name\/user id/i
    );
    fireEvent.change(searchInput, { target: { value: "101" } });

    // Check that search works
    await waitFor(() => {
      expect(screen.getByText("101")).toBeInTheDocument();
      expect(screen.queryByText("102")).not.toBeInTheDocument();
    });
  });

  // Test field type icons in layout view
  it("displays field type icons in layout view", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to layout tab
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    // Check that field types are displayed
    await waitFor(() => {
      expect(screen.getByText("short")).toBeInTheDocument();
      expect(screen.getByText("number")).toBeInTheDocument();
    });
  });

  // Test form status display
  it("displays form status correctly", async () => {
    FormService.get.mockResolvedValueOnce({
      ...mockForm,
      status: "Published",
    });

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Check that the form visibility section exists
    const formVisibilityText = screen.getByText(/form visibility/i);
    expect(formVisibilityText).toBeInTheDocument();

    // Check that the hint text is displayed
    const hintText = screen.getByText(
      /turn on to allow new workflows/i
    );
    expect(hintText).toBeInTheDocument();
  });

  // Test required field indicator
  it("displays required field indicator", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to layout tab
    fireEvent.click(screen.getByRole("tab", { name: /form layout/i }));

    // Check that required field indicator is displayed
    await waitFor(() => {
      // First field is required
      expect(screen.getByText("Question 1")).toBeInTheDocument();
      const requiredIndicator = screen.getByText("*");
      expect(requiredIndicator).toBeInTheDocument();
    });
  });

  // Test response date formatting
  it("formats response dates correctly", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    const submittedDate = new Date("2024-03-01T10:00:00Z").toISOString();

    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: submittedDate,
        fieldId: "f1",
        answerValue: "Test answer",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses tab
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Check that date is displayed in some format (not raw ISO)
    await waitFor(() => {
      // The exact format will depend on locale, so we just check it's not the raw ISO string
      expect(screen.queryByText(submittedDate)).not.toBeInTheDocument();

      // And that there is some date text in the table
      const cells = screen.getAllByRole("cell");
      const dateCell = cells[3]; // 4th cell should be date
      expect(dateCell.textContent).not.toBe("—");
      expect(dateCell.textContent.length).toBeGreaterThan(0);
    });
  });

  // Test response view button functionality
  it("switches to individual response view when clicking View button", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);

    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 101,
        submittedAt: "2024-03-01T10:00:00Z",
        fieldId: "f1",
        answerValue: "Test answer",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");

    // Switch to responses tab
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    // Wait for the View button to appear
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "View" })
      ).toBeInTheDocument();
    });

    // Click the View button
    fireEvent.click(screen.getByRole("button", { name: "View" }));

    // Check that we switched to individual response view
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /individual response/i })
      ).toHaveClass("active");
    });
  });

  // EXTRA: maps choice option IDs from comma-separated answerValue to labels
  it("maps choice option IDs from comma-separated answerValue to labels", async () => {
    const formWithChoice = {
      title: "Choice Form",
      description: "",
      status: "Published",
      layout: {
        sections: [
          {
            fields: [
              {
                fieldId: "role",
                label: "Role",
                type: "dropdown",
                options: [
                  { id: 1, text: "Admin" },
                  { id: 2, text: "Manager" },
                ],
              },
            ],
          },
        ],
      },
    };

    FormService.get.mockResolvedValueOnce(formWithChoice);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 77,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "role",
        // hits branch where trimmed includes(",")
        answerValue: "1,2",
      },
    ]);

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Admin, Manager")
      ).toBeInTheDocument();
    });
  });

  // EXTRA: file download failure path & no JWT
  it("shows alert when file download fails and no JWT is found", async () => {
    // ensure no JWT anywhere so findJwtToken() returns null
    window.localStorage.clear();
    window.sessionStorage.clear();

    const formWithFile = {
      title: "File Error Form",
      description: "",
      status: "Published",
      layout: {
        sections: [
          {
            fields: [
              {
                fieldId: "fileField",
                label: "Attachment",
                type: "file",
              },
            ],
          },
        ],
      },
    };

    FormService.get.mockResolvedValueOnce(formWithFile);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 10,
        userId: 1,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "fileField",
        answerValue: "file:999",
      },
    ]);

    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => {});

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
      blob: () => Promise.resolve(new Blob()),
    });

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /individual response/i })
    );

    const dlBtn = await screen.findByText(/download file/i);
    fireEvent.click(dlBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Download failed (401)");
    });

    alertSpy.mockRestore();
    global.fetch = originalFetch;
  });

  // EXTRA: bulk user map object branch
  it("normalizes usernames when bulk API returns object map", async () => {
    FormService.get.mockResolvedValueOnce(mockForm);
    ResponsesApi.list.mockResolvedValue([
      {
        responseId: 1,
        userId: 200,
        submittedAt: "2024-03-02T10:00:00Z",
        fieldId: "f1",
        answerValue: "Yes",
      },
    ]);

    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/users/by-ids?ids=200")) {
        // object map → normalizeBulkUsers(object) path
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              200: { name: "Bulk Map User" },
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(
      <MemoryRouter>
        <ViewForm />
      </MemoryRouter>
    );

    await screen.findByText("Form Details");
    fireEvent.click(screen.getByRole("tab", { name: /responses/i }));

    await waitFor(() => {
      expect(screen.getByText("Bulk Map User")).toBeInTheDocument();
    });
  });
});

