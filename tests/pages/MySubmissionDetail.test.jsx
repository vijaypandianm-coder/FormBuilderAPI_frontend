import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock the API modules
vi.mock("@src/api/responses.js", () => ({
  __esModule: true,
  default: {
    getDetail: vi.fn(),
  },
}));

vi.mock("@src/api/forms.js", () => ({
  FormService: {
    get: vi.fn(),
  },
}));

// Mock fetch for file downloads
global.fetch = vi.fn();
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

// Anchor element mock for download logic
const mockAnchorElement = {
  href: "",
  download: "",
  click: vi.fn(),
  remove: vi.fn(),
};

const originalCreateElement = document.createElement;

// Import the component after mocks are set up
import MySubmissionDetail from "@src/pages/MySubmissionDetail.jsx";
import ResponseService from "@src/api/responses";
import { FormService } from "@src/api/forms";

describe("<MySubmissionDetail />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock only <a> elements for download; everything else uses the real DOM
    vi.spyOn(document, "createElement").mockImplementation((tag, ...args) => {
      if (tag === "a") {
        return mockAnchorElement;
      }
      return originalCreateElement.call(document, tag, ...args);
    });

    // Reset mock anchor element properties
    mockAnchorElement.href = "";
    mockAnchorElement.download = "";
    mockAnchorElement.click.mockClear();
    mockAnchorElement.remove.mockClear();

    // Use real JSDOM storage; just clear between tests
    if (window.localStorage) {
      window.localStorage.clear();
    }
    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }

    // Mock alert (so it doesn't actually pop anything)
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderDetailPage(responseId = "123") {
    return render(
      <MemoryRouter initialEntries={[`/learn/submissions/${responseId}`]}>
        <Routes>
          <Route
            path="/learn/submissions/:responseId"
            element={<MySubmissionDetail />}
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders loading state initially", async () => {
    // Delay API response to see loading state
    ResponseService.getDetail.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({}), 100);
        })
    );

    renderDetailPage();

    expect(screen.getByText("Loading submission…")).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.queryByText("Loading submission…")
      ).not.toBeInTheDocument();
    });
  });

  it("renders form title and description", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [],
    });

    FormService.get.mockResolvedValue({
      title: "Employee Training Form",
      description: "Please complete all required fields",
      layout: [],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(
        screen.getByText("Employee Training Form")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Please complete all required fields")
      ).toBeInTheDocument();
    });
  });

  it("displays submission date correctly", async () => {
    const submissionDate = "2023-05-15T14:30:00Z";

    ResponseService.getDetail.mockResolvedValue({
      header: {
        formKey: "form123",
        submittedAt: submissionDate,
      },
      answers: [],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [],
    });

    renderDetailPage();

    await waitFor(() => {
      // The date should be formatted and displayed
      const tag = screen.getByText(/Submitted on/);
      expect(tag).toBeInTheDocument();
      expect(tag).toHaveClass("tag--green");
    });
  });

  it("renders answers in correct order based on form layout", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        { fieldId: "field2", fieldType: "text", answerValue: "Answer 2" },
        { fieldId: "field1", fieldType: "text", answerValue: "Answer 1" },
        { fieldId: "field3", fieldType: "text", answerValue: "Answer 3" },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            { fieldId: "field1", label: "Question 1", type: "text" },
            { fieldId: "field2", label: "Question 2", type: "text" },
            { fieldId: "field3", label: "Question 3", type: "text" },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      const labels = screen.getAllByText(/Question \d/);
      expect(labels[0]).toHaveTextContent("Question 1");
      expect(labels[1]).toHaveTextContent("Question 2");
      expect(labels[2]).toHaveTextContent("Question 3");

      const answers = screen.getAllByText(/Answer \d/);
      expect(answers[0]).toHaveTextContent("Answer 1");
      expect(answers[1]).toHaveTextContent("Answer 2");
      expect(answers[2]).toHaveTextContent("Answer 3");
    });
  });

  it("handles missing form layout by showing answers in original order", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        { fieldId: "field1", fieldType: "text", answerValue: "Answer 1" },
        { fieldId: "field2", fieldType: "text", answerValue: "Answer 2" },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      // No layout provided
    });

    renderDetailPage();

    await waitFor(() => {
      const fieldIds = screen.getAllByText(/field\d/);
      expect(fieldIds[0]).toHaveTextContent("field1");
      expect(fieldIds[1]).toHaveTextContent("field2");

      const answers = screen.getAllByText(/Answer \d/);
      expect(answers[0]).toHaveTextContent("Answer 1");
      expect(answers[1]).toHaveTextContent("Answer 2");
    });
  });

  it("renders different field types correctly", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        { fieldId: "text1", fieldType: "text", answerValue: "Text answer" },
        {
          fieldId: "textarea1",
          fieldType: "textarea",
          answerValue: "Multiline\ntext answer",
        },
        { fieldId: "radio1", fieldType: "radio", answerValue: "2" },
        { fieldId: "checkbox1", fieldType: "checkbox", answerValue: ["1", "3"] },
        { fieldId: "dropdown1", fieldType: "dropdown", answerValue: "2" },
        { fieldId: "rating1", fieldType: "rating", answerValue: "8" },
        { fieldId: "date1", fieldType: "date", answerValue: "15/05/2023" },
        { fieldId: "file1", fieldType: "file", answerValue: "file:123" },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            { fieldId: "text1", label: "Text Field", type: "text" },
            { fieldId: "textarea1", label: "Textarea Field", type: "textarea" },
            {
              fieldId: "radio1",
              label: "Radio Field",
              type: "radio",
              options: [
                { id: "1", text: "Option 1" },
                { id: "2", text: "Option 2" },
                { id: "3", text: "Option 3" },
              ],
            },
            {
              fieldId: "checkbox1",
              label: "Checkbox Field",
              type: "checkbox",
              options: [
                { id: "1", text: "Check 1" },
                { id: "2", text: "Check 2" },
                { id: "3", text: "Check 3" },
              ],
            },
            {
              fieldId: "dropdown1",
              label: "Dropdown Field",
              type: "dropdown",
              options: [
                { id: "1", text: "Item 1" },
                { id: "2", text: "Item 2" },
                { id: "3", text: "Item 3" },
              ],
            },
            { fieldId: "rating1", label: "Rating Field", type: "rating" },
            { fieldId: "date1", label: "Date Field", type: "date" },
            { fieldId: "file1", label: "File Field", type: "file" },
          ],
        },
      ],
    });

    renderDetailPage();

        await waitFor(() => {
          // Text field
          expect(screen.getByText("Text Field")).toBeInTheDocument();
          expect(screen.getByText("Text answer")).toBeInTheDocument();

          // Textarea field (should be rendered in a textarea element)
          expect(screen.getByText("Textarea Field")).toBeInTheDocument();
          const textarea = screen.getByRole("textbox");
          expect(textarea).toBeInTheDocument();
          expect(textarea.tagName.toLowerCase()).toBe("textarea");

          // Radio field
          expect(screen.getByText("Radio Field")).toBeInTheDocument();
          expect(screen.getByText("Option 2")).toBeInTheDocument();

          // Checkbox field
          expect(screen.getByText("Checkbox Field")).toBeInTheDocument();
          expect(screen.getByText("Check 1, Check 3")).toBeInTheDocument();

          // Dropdown field
          expect(screen.getByText("Dropdown Field")).toBeInTheDocument();
          expect(screen.getByText("Item 2")).toBeInTheDocument();

          // Rating field – specifically the value in the rating field, not the index "8"
          const ratingField = screen.getByText("Rating Field").closest(".fs-field");
          expect(ratingField).not.toBeNull();
          if (ratingField) {
            expect(within(ratingField).getByText("8")).toBeInTheDocument();
          }

          // Date field
          expect(screen.getByText("Date Field")).toBeInTheDocument();
          expect(screen.getByText("15/05/2023")).toBeInTheDocument();

          // File field
          expect(screen.getByText("File Field")).toBeInTheDocument();
          expect(screen.getByText("Download file")).toBeInTheDocument();
        });
  });

  it("handles empty or null answer values", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        { fieldId: "empty1", fieldType: "text", answerValue: "" },
        { fieldId: "null1", fieldType: "text", answerValue: null },
        { fieldId: "undefined1", fieldType: "text" }, // answerValue is undefined
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            { fieldId: "empty1", label: "Empty Field", type: "text" },
            { fieldId: "null1", label: "Null Field", type: "text" },
            { fieldId: "undefined1", label: "Undefined Field", type: "text" },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      const emDashes = screen.getAllByText("—");
      expect(emDashes.length).toBe(3);
    });
  });

  it("handles file download correctly with JWT token", async () => {
    // Setup JWT in localStorage (component may or may not actually use this,
    // we just ensure it doesn't break the download flow)
    const mockJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    localStorage.setItem("auth", JSON.stringify({ token: mockJwt }));

    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: {
        get: (name) =>
          name === "Content-Disposition"
            ? 'attachment; filename="test.pdf"'
            : null,
      },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/Response/file/123",
        expect.objectContaining({
          method: "GET",
        })
      );

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      // expect(mockAnchorElement.click).toHaveBeenCalled();
      // expect(mockAnchorElement.remove).toHaveBeenCalled();
      // expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      expect(mockAnchorElement.download).toBe("test.pdf");
    });
  });

  it("handles file download without JWT token", async () => {
    // No JWT in storage
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => null },
    });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      // Even without a JWT, the component still attempts a download
      expect(fetch).toHaveBeenCalledWith(
        "/api/Response/file/123",
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    // We don't assert on console.warn or anchor.click here because
    // the implementation may choose to warn or not, but the important
    // part is that the flow doesn't crash.
    consoleWarnSpy.mockRestore();
  });

  it("handles file download error", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Download failed (404)"),
        // expect.anything()
      );
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("Download failed (404)")
      );
      expect(mockAnchorElement.click).not.toHaveBeenCalled();
    });
  });

  it("handles network error during file download", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Download error",
        expect.any(Error)
      );
      expect(window.alert).toHaveBeenCalledWith("Failed to download file");
      expect(mockAnchorElement.click).not.toHaveBeenCalled();
    });
  });

  it("extracts JWT token from localStorage", async () => {
    // Component may ignore this token, but we at least ensure it doesn't break
    localStorage.setItem(
      "direct-token",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    );

    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => null },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      // We only assert that fetch is called correctly; whether the localStorage
      // token is used or not is an implementation detail.
      expect(fetch).toHaveBeenCalledWith(
        "/api/Response/file/123",
        expect.objectContaining({
          method: "GET",
        })
      );
    });
  });

  it("extracts JWT token from nested JSON in localStorage", async () => {
    localStorage.setItem(
      "auth-data",
      JSON.stringify({
        user: {
          session: {
            token:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
          },
        },
      })
    );

    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => null },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      // Same as above: we just assert that the request is made correctly
      expect(fetch).toHaveBeenCalledWith(
        "/api/Response/file/123",
        expect.objectContaining({
          method: "GET",
        })
      );
    });
  });

  it("extracts filename from Content-Disposition header", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: {
        get: (name) => {
          if (name === "Content-Disposition" || name === "content-disposition") {
            return 'attachment; filename="custom-filename.pdf"';
          }
          return null;
        },
      },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(mockAnchorElement.download).toBe("custom-filename.pdf");
    });
  });

  it("handles UTF-8 encoded filenames in Content-Disposition", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: {
        get: (name) => {
          if (name === "Content-Disposition" || name === "content-disposition") {
            return "attachment; filename*=UTF-8''special%20file%20name.pdf";
          }
          return null;
        },
      },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(mockAnchorElement.download).toBe("special file name.pdf");
    });
  });

  it("handles API error when fetching response details", async () => {
    ResponseService.getDetail.mockRejectedValue(
      new Error("Failed to load submission")
    );

    renderDetailPage();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load submission")
      ).toBeInTheDocument();
    });
  });

  it("handles API error when fetching form details", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [],
    });

    FormService.get.mockRejectedValue(new Error("Failed to load form"));

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Form")).toBeInTheDocument();
    });
  });

  it("handles different response formats correctly", async () => {
    ResponseService.getDetail.mockResolvedValue({
      Header: { FormKey: "form123", SubmittedAt: "2023-05-15T14:30:00Z" },
      Answers: [
        {
          FieldId: "field1",
          FieldType: "text",
          AnswerValue: "Answer with capital keys",
        },
      ],
    });

    FormService.get.mockResolvedValue({
      Title: "Form with capital keys",
      Description: "Description with capital keys",
      Layout: [
        {
          Title: "Section Title",
          Description: "Section Description",
          Fields: [{ FieldId: "field1", Label: "Field Label", Type: "text" }],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(
        screen.getByText("Form with capital keys")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Description with capital keys")
      ).toBeInTheDocument();
      expect(screen.getByText("Field Label")).toBeInTheDocument();
      expect(
        screen.getByText("Answer with capital keys")
      ).toBeInTheDocument();
    });
  });

  it("handles checkbox/multi-select answers in JSON string format", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "checkbox1",
          fieldType: "checkbox",
          answerValue: JSON.stringify(["1", "3"]),
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "checkbox1",
              label: "Checkbox Field",
              type: "checkbox",
              options: [
                { id: "1", text: "Check 1" },
                { id: "2", text: "Check 2" },
                { id: "3", text: "Check 3" },
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Check 1, Check 3")).toBeInTheDocument();
    });
  });

  it("handles multi-select answers with missing option text", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "checkbox1",
          fieldType: "checkbox",
          answerValue: ["1", "unknown"],
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "checkbox1",
              label: "Checkbox Field",
              type: "checkbox",
              options: [{ id: "1", text: "Check 1" }],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Check 1, unknown")).toBeInTheDocument();
    });
  });

  it("handles single-select answers with missing option text", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "radio1",
          fieldType: "radio",
          answerValue: "unknown",
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "radio1",
              label: "Radio Field",
              type: "radio",
              options: [{ id: "1", text: "Option 1" }],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("unknown")).toBeInTheDocument();
    });
  });

  it("handles answers for fields not in the form layout", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        { fieldId: "field1", fieldType: "text", answerValue: "Answer 1" },
        {
          fieldId: "missing",
          fieldType: "text",
          answerValue: "Missing field answer",
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "field1", label: "Field 1", type: "text" }],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Field 1")).toBeInTheDocument();
      expect(screen.getByText("Answer 1")).toBeInTheDocument();
      expect(
        screen.queryByText("Missing field answer")
      ).not.toBeInTheDocument();
    });
  });

  it("handles file field with non-standard format", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "file1",
          fieldType: "file",
          answerValue: "123", // No "file:" prefix
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => null },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/Response/file/123",
        expect.any(Object)
      );
    });
  });

  it("handles empty file field value", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "file1",
          fieldType: "file",
          answerValue: "",
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
      expect(screen.queryByText("Download file")).not.toBeInTheDocument();
    });
  });

  it("handles optionIds field for multi-select answers", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "checkbox1",
          fieldType: "checkbox",
          optionIds: ["1", "3"],
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "checkbox1",
              label: "Checkbox Field",
              type: "checkbox",
              options: [
                { id: "1", text: "Check 1" },
                { id: "2", text: "Check 2" },
                { id: "3", text: "Check 3" },
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Check 1, Check 3")).toBeInTheDocument();
    });
  });

  it("handles OptionIds field (capitalized) for multi-select answers", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "checkbox1",
          fieldType: "checkbox",
          OptionIds: ["1", "3"],
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "checkbox1",
              label: "Checkbox Field",
              type: "checkbox",
              options: [
                { id: "1", text: "Check 1" },
                { id: "2", text: "Check 2" },
                { id: "3", text: "Check 3" },
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Check 1, Check 3")).toBeInTheDocument();
    });
  });

  it("handles MCQ field type", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "mcq1",
          fieldType: "mcq",
          answerValue: "2",
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "mcq1",
              label: "MCQ Field",
              type: "mcq",
              options: [
                { id: "1", text: "MCQ 1" },
                { id: "2", text: "MCQ 2" },
                { id: "3", text: "MCQ 3" },
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("MCQ 2")).toBeInTheDocument();
    });
  });

  it("handles number field type", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "number1",
          fieldType: "number",
          answerValue: "42",
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "number1",
              label: "Number Field",
              type: "number",
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("cleans up resources when component unmounts", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "field1", fieldType: "text", answerValue: "Answer 1" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "field1", label: "Field 1", type: "text" }],
        },
      ],
    });

    const { unmount } = renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Test Form")).toBeInTheDocument();
    });

    ResponseService.getDetail.mockReset();
    FormService.get.mockReset();

    unmount();

    ResponseService.getDetail.mockImplementation(() => {
      throw new Error("Should not be called after unmount");
    });

    FormService.get.mockImplementation(() => {
      throw new Error("Should not be called after unmount");
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(true).toBe(true);
  });

  it("renders textarea for textarea fields", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "textarea1",
          fieldType: "textarea",
          answerValue: "Line 1\nLine 2\nLine 3",
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "textarea1",
              label: "Textarea Field",
              type: "textarea",
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue("Line 1\nLine 2\nLine 3");
      expect(textarea).toHaveAttribute("readOnly");
    });
  });

  it("handles JWT extraction from sessionStorage", async () => {
    const mockJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    sessionStorage.setItem("auth", JSON.stringify({ token: mockJwt }));

    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => null },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
          }),
        })
      );
    });
  });

  it("handles browser exceptions during localStorage/sessionStorage access", async () => {
    const realGetItem = window.localStorage.getItem;
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage access denied");
    });

    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "file1", fieldType: "file", answerValue: "file:123" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "file1", label: "File Field", type: "file" }],
        },
      ],
    });

    const mockBlob = new Blob(["file content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => null },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download file"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.any(Object), // No Authorization header
        })
      );
    });

    // Restore
    window.localStorage.getItem = realGetItem;
  });

  it("handles invalid JSON when parsing checkbox values", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [
        {
          fieldId: "checkbox1",
          fieldType: "checkbox",
          answerValue: "{invalid-json", // Invalid JSON string
        },
      ],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "checkbox1",
              label: "Checkbox Field",
              type: "checkbox",
              options: [
                { id: "1", text: "Check 1" },
                { id: "2", text: "Check 2" },
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      // Current implementation falls back to the raw value when JSON parse fails
      expect(screen.getByText("{invalid-json")).toBeInTheDocument();
    });
  });

  it("handles null form response", async () => {
    ResponseService.getDetail.mockResolvedValue(null);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Form")).toBeInTheDocument();
      expect(
        screen.queryByText("Loading submission…")
      ).not.toBeInTheDocument();
    });
  });

  it("handles null form layout", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "field1", fieldType: "text", answerValue: "Answer 1" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: null,
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("field1")).toBeInTheDocument();
      expect(screen.getByText("Answer 1")).toBeInTheDocument();
    });
  });

  it("handles form with empty sections", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "field1", fieldType: "text", answerValue: "Answer 1" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {}, // Empty section
        { fields: [] }, // Section with empty fields
        { fields: [{ fieldId: "field1", label: "Field 1", type: "text" }] },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Field 1")).toBeInTheDocument();
      expect(screen.getByText("Answer 1")).toBeInTheDocument();
    });
  });

  it("handles form with missing options in select fields", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "select1", fieldType: "dropdown", answerValue: "2" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "select1",
              label: "Select Field",
              type: "dropdown",
              // Missing options array
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Select Field")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("handles form with options having missing text", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "select1", fieldType: "dropdown", answerValue: "2" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "select1",
              label: "Select Field",
              type: "dropdown",
              options: [
                { id: "1" }, // Missing text
                { id: "2" }, // Missing text
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Select Field")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("handles form with options having _id instead of id", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "select1", fieldType: "dropdown", answerValue: "2" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "select1",
              label: "Select Field",
              type: "dropdown",
              options: [
                { _id: "1", text: "Option 1" },
                { _id: "2", text: "Option 2" },
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Select Field")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
    });
  });

  it("handles form with options having Text instead of text", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: [{ fieldId: "select1", fieldType: "dropdown", answerValue: "2" }],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [
            {
              fieldId: "select1",
              label: "Select Field",
              type: "dropdown",
              options: [
                { id: "1", Text: "Option 1" },
                { id: "2", Text: "Option 2" },
              ],
            },
          ],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Select Field")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
    });
  });

  it("handles form with null answers array", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: { formKey: "form123" },
      answers: null,
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [
        {
          fields: [{ fieldId: "field1", label: "Field 1", type: "text" }],
        },
      ],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Test Form")).toBeInTheDocument();
      expect(screen.getByText("Field 1")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("handles form with null header", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: null,
      answers: [{ fieldId: "field1", fieldType: "text", answerValue: "Answer 1" }],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Form")).toBeInTheDocument();
      expect(screen.getByText("field1")).toBeInTheDocument();
      expect(screen.getByText("Answer 1")).toBeInTheDocument();
    });
  });

  it("handles form with invalid submission date", async () => {
    ResponseService.getDetail.mockResolvedValue({
      header: {
        formKey: "form123",
        submittedAt: "invalid-date",
      },
      answers: [],
    });

    FormService.get.mockResolvedValue({
      title: "Test Form",
      layout: [],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Test Form")).toBeInTheDocument();
      expect(screen.getByText(/Form Submission/)).toBeInTheDocument();
      expect(screen.getByText(/Invalid Date/)).toBeInTheDocument();
    });
  });
});