import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

//
// Mocks
//

const mockNavigate = vi.fn();

// react-router: useParams + useNavigate
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ formKey: "123" }),
  };
});

vi.mock("@src/api/forms", () => ({
  FormService: {
    get: vi.fn(),
    layout: vi.fn(),
  },
}));

vi.mock("@src/api/http", () => ({
  apiFetch: vi.fn(),
}));

const { FormService } = await import("@src/api/forms");
const { apiFetch } = await import("@src/api/http");

describe("FormSubmissionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    window.localStorage.clear();
  });

  async function renderPage() {
    const { default: FormSubmissionPage } = await import(
      "@src/pages/FormSubmissionPage.jsx"
    );
    return render(<FormSubmissionPage />);
  }

  it("loads meta and fields from FormService and renders all field types", async () => {
    FormService.get.mockResolvedValue({
      Id: 7,
      FormKey: 123,
      Title: "My Test Form",
      Description: "Some description",
    });

    // coverage for normalizeOptions: string[], objects, CSV
    FormService.layout.mockResolvedValue({
      sections: [
        {
          title: "Section A",
          fields: [
            {
              fieldId: "t1",
              label: "Short Text Q",
              type: "text",
              isRequired: true,
              helpText: "Short help",
            },
            {
              fieldId: "l1",
              label: "Long Text Q",
              type: "textarea",
              isRequired: false,
            },
            {
              fieldId: "n1",
              label: "Number Q",
              type: "number",
              isRequired: true,
            },
            {
              fieldId: "d1",
              label: "Date Q",
              type: "date",
              isRequired: true,
              dateFormat: "dd/MM/yyyy",
            },
            {
              fieldId: "sc1",
              label: "Single Choice Q",
              type: "dropdown",
              isRequired: false,
              options: ["A", "B", "C"],
            },
            {
              fieldId: "mc1",
              label: "Multi Choice Q",
              type: "checkbox",
              isRequired: false,
              choices: [
                { id: 10, label: "X" },
                { id: 11, label: "Y" },
              ],
            },
            {
              fieldId: "scCsv",
              label: "CSV Single Q",
              type: "radio",
              // CSV string
              options: "One,Two",
            },
            {
              fieldId: "file1",
              label: "Upload Document",
              type: "file",
              isRequired: false,
              allowedTypes: [".pdf", ".png"],
            },
          ],
        },
      ],
    });

    await renderPage();

    // title/description (use findAllByText because there are 2 "My Test Form"s)
    const titles = await screen.findAllByText("My Test Form");
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByText("Some description")).toBeInTheDocument();

    // text fields
    expect(screen.getByText("Short Text Q")).toBeInTheDocument();
    expect(screen.getByText("Long Text Q")).toBeInTheDocument();
    expect(screen.getByText("Number Q")).toBeInTheDocument();
    expect(screen.getByText("Date Q")).toBeInTheDocument();

    // choices as chips
    expect(screen.getByText("Single Choice Q")).toBeInTheDocument();
    expect(screen.getByText("Multi Choice Q")).toBeInTheDocument();
    expect(screen.getByText("CSV Single Q")).toBeInTheDocument();

    // file upload
    expect(screen.getByText("Upload Document")).toBeInTheDocument();
  });

  it("shows load error when FormService throws", async () => {
    FormService.get.mockRejectedValue(new Error("boom"));
    FormService.layout.mockResolvedValue({ sections: [] });

    await renderPage();

    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  it("validates required fields (text, choice, date, file)", async () => {
    FormService.get.mockResolvedValue({
      id: 1,
      formKey: 123,
      title: "Validation Form",
      description: "",
    });

    FormService.layout.mockResolvedValue({
      sections: [
        {
          title: "Sec",
          fields: [
            {
              fieldId: "txt",
              label: "Text Required",
              type: "text",
              isRequired: true,
            },
            {
              fieldId: "opt",
              label: "Choice Required",
              type: "dropdown",
              isRequired: true,
              options: ["A", "B"],
            },
            {
              fieldId: "dt",
              label: "Date Required",
              type: "date",
              isRequired: true,
            },
            {
              fieldId: "fileR",
              label: "File Required",
              type: "file",
              isRequired: true,
            },
          ],
        },
      ],
    });

    await renderPage();

    const submitBtn = await screen.findByRole("button", { name: /Submit/i });

    // click with everything empty -> first required text error
    fireEvent.click(submitBtn);
    expect(
      await screen.findByText(/'Text Required' is required\./i)
    ).toBeInTheDocument();

    // fill text, next error should be Choice
    const textInput = screen.getByPlaceholderText("Your Answer");
    fireEvent.change(textInput, { target: { value: "ok" } });

    fireEvent.click(submitBtn);
    expect(
      await screen.findByText(/'Choice Required' is required\./i)
    ).toBeInTheDocument();

    // ✅ select an option from the dropdown instead of clicking a chip
    const choiceSelect = screen.getByRole("combobox");
    fireEvent.change(choiceSelect, { target: { value: "1" } }); // A

    fireEvent.click(submitBtn);
    expect(
      await screen.findByText(
        /'Date Required' must be in dd\/MM\/yyyy format\./i
      )
    ).toBeInTheDocument();

    // enter invalid date, still error
    const dateWrapper = screen.getByLabelText("Date Required");
    const dateInput = dateWrapper.querySelector("input");
    fireEvent.change(dateInput, { target: { value: "2024-02" } });

    fireEvent.click(submitBtn);
    expect(
      await screen.findByText(
        /'Date Required' must be in dd\/MM\/yyyy format\./i
      )
    ).toBeInTheDocument();

    // enter valid date
    fireEvent.change(dateInput, { target: { value: "2024-02-03" } });

    fireEvent.click(submitBtn);
    expect(
      await screen.findByText(/'File Required' is required\./i)
    ).toBeInTheDocument();
  });

  it("clears form values when Clear Form is clicked", async () => {
    FormService.get.mockResolvedValue({
      id: 1,
      formKey: 123,
      title: "Clear Form",
      description: "",
    });

    FormService.layout.mockResolvedValue({
      sections: [
        {
          title: "Sec",
          fields: [
            { fieldId: "t1", label: "Text Q", type: "text", isRequired: false },
          ],
        },
      ],
    });

    await renderPage();

    const input = await screen.findByPlaceholderText("Your Answer");
    fireEvent.change(input, { target: { value: "something" } });
    expect(input).toHaveValue("something");

    const clearBtn = screen.getByRole("button", { name: /Clear Form/i });
    fireEvent.click(clearBtn);

    expect(input).toHaveValue("");
  });

  it("submits successfully with mapped answers including date & choices", async () => {
    FormService.get.mockResolvedValue({
      id: 1,
      formKey: 123,
      title: "Submit Form",
      description: "",
    });

    FormService.layout.mockResolvedValue({
      sections: [
        {
          title: "S1",
          fields: [
            {
              fieldId: "txt",
              label: "Text Q",
              type: "text",
              isRequired: false,
            },
            {
              fieldId: "dt",
              label: "Date Q",
              type: "date",
              isRequired: false,
            },
            {
              fieldId: "single",
              label: "Single Q",
              type: "dropdown",
              isRequired: false,
              options: ["A", "B"],
            },
            {
              fieldId: "multi",
              label: "Multi Q",
              type: "checkbox",
              isRequired: false,
              options: ["X", "Y"],
            },
          ],
        },
      ],
    });

    apiFetch.mockResolvedValue({ ok: true });

    await renderPage();

    const textInput = await screen.findByPlaceholderText("Your Answer");
    fireEvent.change(textInput, { target: { value: "hello" } });

    // date
    const dateWrapper = screen.getByLabelText("Date Q");
    const dateInput = dateWrapper.querySelector("input");
    fireEvent.change(dateInput, { target: { value: "2024-03-05" } });

    // single choice dropdown: select "A"
    const singleSelect = screen.getByRole("combobox");
    fireEvent.change(singleSelect, { target: { value: "1" } }); // "A"

    // multi choice -> pick both chips X and Y
    const multiChipX = screen.getByRole("button", { name: "X" });
    const multiChipY = screen.getByRole("button", { name: "Y" });
    fireEvent.click(multiChipX);
    fireEvent.click(multiChipY);

    const submitBtn = screen.getByRole("button", { name: /Submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe("/api/Responses/123");
    const body = JSON.parse(opts.body);

    expect(body.Answers).toEqual(
      expect.arrayContaining([
        { fieldId: "txt", answerValue: "hello" },
        { fieldId: "dt", answerValue: "05/03/2024" },
        { fieldId: "single", optionIds: ["1"] },
        { fieldId: "multi", optionIds: ["1", "2"] },
      ])
    );

    // success dialog should appear
    const successTitle = await screen.findByText(/Submitted Successfully!/i);
    expect(successTitle).toBeInTheDocument();

    // click "Go back to Skill Assessments" to trigger navigate
    const backBtn = screen.getByRole("button", {
      name: /Go back to Skill Assessments/i,
    });
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/learn/my-submissions", {
      replace: true,
    });
  });
  it("maps file upload to base64 payload and shows filename", async () => {
    FormService.get.mockResolvedValue({
      id: 1,
      formKey: 123,
      title: "File Form",
      description: "",
    });

    FormService.layout.mockResolvedValue({
      sections: [
        {
          title: "S1",
          fields: [
            {
              fieldId: "file1",
              label: "Resume",
              type: "file",
              isRequired: false,
            },
          ],
        },
      ],
    });

    // mock FileReader
    class FakeFileReader {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.result = null;
      }
      readAsDataURL(file) {
        // simulate base64
        this.result = "data:application/pdf;base64,ABC123";
        if (this.onload) this.onload();
      }
    }
    // @ts-ignore runtime only
    global.FileReader = FakeFileReader;

    apiFetch.mockResolvedValue({ ok: true });

    await renderPage();

    // IMPORTANT: await first, then call querySelector on the resolved element
    const uploadRegion = await screen.findByLabelText("Resume");
    const input = uploadRegion.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const file = new File(["dummy"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    // filename appears
    await screen.findByText("cv.pdf");

    const submitBtn = screen.getByRole("button", { name: /Submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(apiFetch.mock.calls[0][1].body);
    const answer = body.Answers.find((a) => a.fieldId === "file1");
    expect(answer).toMatchObject({
      fieldId: "file1",
      fileName: "cv.pdf",
      contentType: "application/pdf",
      fileBase64: "ABC123",
    });
  });

  it("shows foreign-key specific error message when apiFetch fails that way", async () => {
    FormService.get.mockResolvedValue({
      id: 1,
      formKey: 123,
      title: "Error Form",
      description: "",
    });

    FormService.layout.mockResolvedValue({
      sections: [
        {
          title: "S1",
          fields: [
            { fieldId: "t1", label: "Text", type: "text", isRequired: false },
          ],
        },
      ],
    });

    apiFetch.mockRejectedValue(new Error("foreign key constraint violation"));

    await renderPage();

    const input = await screen.findByPlaceholderText("Your Answer");
    fireEvent.change(input, { target: { value: "x" } });

    const submitBtn = screen.getByRole("button", { name: /Submit/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/form key linkage/i)
    ).toBeInTheDocument();
  });
});