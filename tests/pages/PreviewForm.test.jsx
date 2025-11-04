import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// This component reads from localStorage("fb_preview"), so set it up
import PreviewForm from "@src/pages/PreviewForm.jsx";

function withPreviewData(data) {
  localStorage.setItem("fb_preview", JSON.stringify(data));
}

function renderAt(path = "/forms/preview") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/forms/preview" element={<PreviewForm />} />
        <Route path="/" element={<div>Form List</div>} />
        <Route path="/create-form" element={<div>Create Form</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => localStorage.clear());

test("renders header, form name/desc, and questions (no disabled requirement)", async () => {
  withPreviewData({
    header: {
      title: "Employee Onboarding",
      name: "Course Feedback Form",
      desc: "Help us improve! Share your feedback on your learning experience.",
    },
    questions: [
      { id: "q1", type: "text", label: "Full Name", required: true },
      { id: "q2", type: "number", label: "Years of Exp" },
      { id: "q3", type: "date", label: "Date of Joining" },
      {
        id: "q4",
        type: "select",
        label: "Department",
        options: ["Admin", "Sales", "Tech"],
      },
      { id: "q5", type: "file", label: "Resume" },
    ],
  });

  renderAt();

  // top title
  expect(await screen.findByText(/employee onboarding/i)).toBeInTheDocument();
  // form name & desc
  expect(screen.getByText(/course feedback form/i)).toBeInTheDocument();
  expect(
    screen.getByText(/help us improve! share your feedback/i)
  ).toBeInTheDocument();

  // fields present
  expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/years of exp/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/date of joining/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/resume/i)).toBeInTheDocument();

  // do NOT assert disabled — current Preview is interactive
  // just ensure inputs render with expected placeholders
  expect(screen.getAllByPlaceholderText(/your answer|numeric value/i).length).toBeGreaterThan(0);
});

test("handles missing or invalid localStorage data", async () => {
  // Don't set any preview data
  renderAt();
  
  // Should use default values
  expect(await screen.findByText(/employee onboarding/i)).toBeInTheDocument();
  expect(screen.getByText(/course feedback form/i)).toBeInTheDocument();
});

test("handles invalid JSON in localStorage", async () => {
  localStorage.setItem("fb_preview", "invalid json");
  renderAt();
  
  // Should use default values
  expect(await screen.findByText(/employee onboarding/i)).toBeInTheDocument();
});

test("renders and interacts with text input fields", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "text", label: "Full Name", required: true },
      { id: "q2", type: "short", label: "Nickname" },
      { id: "q3", type: "input", label: "Email" },
    ],
  });

  renderAt();
  
  const fullNameInput = screen.getByLabelText(/full name/i);
  const nicknameInput = screen.getByLabelText(/nickname/i);
  const emailInput = screen.getByLabelText(/email/i);
  
  await userEvent.type(fullNameInput, "John Doe");
  await userEvent.type(nicknameInput, "Johnny");
  await userEvent.type(emailInput, "john@example.com");
  
  expect(fullNameInput).toHaveValue("John Doe");
  expect(nicknameInput).toHaveValue("Johnny");
  expect(emailInput).toHaveValue("john@example.com");
});

test("renders and interacts with textarea fields", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "long", label: "Comments", required: true },
      { id: "q2", type: "textarea", label: "Feedback" },
    ],
  });

  renderAt();
  
  const commentsInput = screen.getByLabelText(/comments/i);
  const feedbackInput = screen.getByLabelText(/feedback/i);
  
  await userEvent.type(commentsInput, "These are my comments");
  await userEvent.type(feedbackInput, "This is my feedback");
  
  expect(commentsInput).toHaveValue("These are my comments");
  expect(feedbackInput).toHaveValue("This is my feedback");
});

test("renders and interacts with number fields", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "number", label: "Age" },
    ],
  });

  renderAt();
  
  const ageInput = screen.getByLabelText(/age/i);
  
  await userEvent.type(ageInput, "abc25def");
  // Should filter out non-numeric characters
  expect(ageInput).toHaveValue("25");
});

test("renders and interacts with date fields", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "date", label: "Birth Date" },
    ],
  });

  renderAt();
  
  const dateInput = screen.getByLabelText(/birth date/i).querySelector('input');
  
  // Set date value
  fireEvent.change(dateInput, { target: { value: "2023-01-15" } });
  expect(dateInput).toHaveValue("2023-01-15");
});

test("renders and interacts with select/dropdown fields", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "select", 
        label: "Country", 
        options: ["USA", "Canada", "UK"] 
      },
      { 
        id: "q2", 
        type: "dropdown", 
        label: "City", 
        options: [
          { id: "nyc", text: "New York" },
          { id: "lon", text: "London" },
          { id: "tor", text: "Toronto" }
        ] 
      },
    ],
  });

  renderAt();
  
  const countrySelect = screen.getByLabelText(/country/i).querySelector('select');
  const citySelect = screen.getByLabelText(/city/i).querySelector('select');
  
  // Select options
  fireEvent.change(countrySelect, { target: { value: "2" } }); // "Canada" (index 1 + 1)
  fireEvent.change(citySelect, { target: { value: "lon" } });
  
  expect(countrySelect.value).toBe("2");
  expect(citySelect.value).toBe("lon");
});

test("renders and interacts with file upload fields", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "file", label: "Resume" },
      { id: "q2", type: "upload", label: "Profile Picture", accept: ".jpg,.png" },
    ],
  });

  renderAt();
  
  const resumeInput = screen.getByLabelText(/resume/i).querySelector('input[type="file"]');
  const profileInput = screen.getByLabelText(/profile picture/i).querySelector('input[type="file"]');
  
  // Create a mock file
  const file = new File(['dummy content'], 'resume.pdf', { type: 'application/pdf' });
  
  // Upload file
  fireEvent.change(resumeInput, { target: { files: [file] } });
  
  // Check if filename appears
  expect(screen.getByText('resume.pdf')).toBeInTheDocument();
  
  // Test removing a file by setting empty files array
  fireEvent.change(resumeInput, { target: { files: [] } });
  expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument();
});

test("renders and interacts with MultiSelect/checkbox fields", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "multiselect", 
        label: "Hobbies", 
        options: ["Reading", "Sports", "Music", "Travel"] 
      },
      { 
        id: "q2", 
        type: "checkbox", 
        label: "Languages", 
        options: ["English", "Spanish", "French"] 
      },
      {
        id: "q3",
        type: "select",
        label: "Skills",
        allowMultiple: true,
        options: [
          { id: "js", text: "JavaScript" },
          { id: "py", text: "Python" },
          { id: "java", text: "Java" }
        ]
      }
    ],
  });

  renderAt();
  
  // Find the first multiselect by its parent question title
  const hobbiesQuestion = screen.getByText("Hobbies").closest(".pf-qbody");
  const hobbiesSelect = hobbiesQuestion.querySelector(".pf-multi-row");
  fireEvent.click(hobbiesSelect);
  
  // Select an option
  const readingOption = screen.getByRole("option", { name: /reading/i });
  fireEvent.click(readingOption);
  
  // Verify selection - use getAllByText and check the first one is a chip
  const readingChips = screen.getAllByText("Reading");
  expect(readingChips.length).toBeGreaterThan(0);
  expect(readingChips[0].classList.contains("pf-chip") || 
         readingChips[0].closest(".pf-chip")).toBeTruthy();
  
  // Test search functionality in multiselect
  const searchInput = screen.getByPlaceholderText("Search…");
  fireEvent.change(searchInput, { target: { value: "Mu" } });
  
  // Only Music should be visible
  expect(screen.getByRole("option", { name: /music/i })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /sports/i })).not.toBeInTheDocument();
  
  // Clear search
  fireEvent.change(searchInput, { target: { value: "" } });
  
  // Select another option
  const musicOption = screen.getByRole("option", { name: /music/i });
  fireEvent.click(musicOption);
  
  // Both options should be selected now - check for chips
  const chips = screen.getAllByRole("button", { name: /remove/i });
  expect(chips.length).toBe(2);
  
  // Test removing a chip
  fireEvent.click(chips[0]);
  
  // Should have one less chip
  expect(screen.getAllByRole("button", { name: /remove/i }).length).toBe(1);
  
  // Click outside to close dropdown
  fireEvent.mouseDown(document.body);
  expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  
  // Test the second multiselect (Languages)
  const languagesQuestion = screen.getByText("Languages").closest(".pf-qbody");
  const languagesSelect = languagesQuestion.querySelector(".pf-multi-row");
  fireEvent.click(languagesSelect);
  
  // Select options
  const englishOption = screen.getByRole("option", { name: /english/i });
  const frenchOption = screen.getByRole("option", { name: /french/i });
  fireEvent.click(englishOption);
  fireEvent.click(frenchOption);
  
  // Verify selections - check for chips
  const languageChips = screen.getAllByRole("button", { name: /remove/i });
  expect(languageChips.length).toBeGreaterThan(1);
  
  // Test the third multiselect (Skills with allowMultiple)
  const skillsQuestion = screen.getByText("Skills").closest(".pf-qbody");
  const skillsSelect = skillsQuestion.querySelector(".pf-multi-row");
  fireEvent.click(skillsSelect);
  
  // Select options
  const jsOption = screen.getByRole("option", { name: /javascript/i });
  const javaOption = screen.getByRole("option", { name: /java$/i });
  fireEvent.click(jsOption);
  fireEvent.click(javaOption);
  
  // Verify selections - check for chips
  const skillChips = screen.getAllByRole("button", { name: /remove/i });
  expect(skillChips.length).toBeGreaterThan(3);
});

test("handles empty options in MultiSelect", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "multiselect", 
        label: "Empty Options", 
        options: [] 
      }
    ],
  });

  renderAt();
  
  // Open the multiselect
  const emptyQuestion = screen.getByText("Empty Options").closest(".pf-qbody");
  const emptySelect = emptyQuestion.querySelector(".pf-multi-row");
  fireEvent.click(emptySelect);
  
  // Should show "No options"
  expect(screen.getByText("No options")).toBeInTheDocument();
});

test("handles string options format in MultiSelect", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "multiselect", 
        label: "String Options", 
        options: "Option1\nOption2,Option3" 
      }
    ],
  });

  renderAt();
  
  // Open the multiselect
  const stringQuestion = screen.getByText("String Options").closest(".pf-qbody");
  const stringSelect = stringQuestion.querySelector(".pf-multi-row");
  fireEvent.click(stringSelect);
  
  // Should parse the options correctly
  expect(screen.getByRole("option", { name: /option1/i })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /option2/i })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /option3/i })).toBeInTheDocument();
});

test("handles unknown field types", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "unknown", label: "Unknown Field" },
    ],
  });

  renderAt();
  
  // Should default to text input
  const unknownInput = screen.getByLabelText(/unknown field/i);
  expect(unknownInput.tagName.toLowerCase()).toBe("input");
  
  await userEvent.type(unknownInput, "Test input");
  expect(unknownInput).toHaveValue("Test input");
});

test("clears form when Clear Form button is clicked", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "text", label: "Name" },
      { id: "q2", type: "number", label: "Age" },
    ],
  });

  renderAt();
  
  const nameInput = screen.getByLabelText(/name/i);
  const ageInput = screen.getByLabelText(/age/i);
  
  // Fill in the form
  await userEvent.type(nameInput, "John Doe");
  await userEvent.type(ageInput, "30");
  
  expect(nameInput).toHaveValue("John Doe");
  expect(ageInput).toHaveValue("30");
  
  // Clear the form
  const clearButton = screen.getByText("Clear Form");
  fireEvent.click(clearButton);
  
  // Form should be cleared
  expect(nameInput).toHaveValue("");
  expect(ageInput).toHaveValue("");
});

test("navigates to correct routes when buttons are clicked", async () => {
  withPreviewData({
    questions: [{ id: "q1", type: "text", label: "Name" }],
  });

  renderAt();
  
  // Click Back to Form List
  const formListButton = screen.getByText("Back to Form List");
  fireEvent.click(formListButton);
  
  // Should navigate to form list
  expect(screen.getByText("Form List")).toBeInTheDocument();
  
  // Go back to preview
  renderAt();
  
  // Click Back to Create Form
  const createFormButton = screen.getByText("Back to Create Form");
  fireEvent.click(createFormButton);
  
  // Should navigate to create form page
  expect(screen.getByText("Create Form")).toBeInTheDocument();
});

// Test for useOutsideClose hook
test("closes MultiSelect when clicking outside", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "multiselect", 
        label: "Hobbies", 
        options: ["Reading", "Sports", "Music"] 
      }
    ],
  });

  renderAt();
  
  // Open the multiselect
  const hobbiesQuestion = screen.getByText("Hobbies").closest(".pf-qbody");
  const hobbiesSelect = hobbiesQuestion.querySelector(".pf-multi-row");
  fireEvent.click(hobbiesSelect);
  
  // Dropdown should be open
  expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  
  // Click outside
  fireEvent.mouseDown(document.body);
  
  // Dropdown should be closed
  expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  
  // Open again and test touchstart event
  fireEvent.click(hobbiesSelect);
  expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  
  // Simulate touchstart outside
  fireEvent.touchStart(document.body);
  
  // Dropdown should be closed
  expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
});

// Test for questions with description
test("renders question descriptions when showDescription is true", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "text", 
        label: "Name", 
        description: "Enter your full name", 
        showDescription: true 
      },
      { 
        id: "q2", 
        type: "text", 
        label: "Email", 
        description: "This description should not show", 
        showDescription: false 
      }
    ],
  });

  renderAt();
  
  // Description should be visible for the first question
  expect(screen.getByText("Enter your full name")).toBeInTheDocument();
  
  // Description should not be visible for the second question
  expect(screen.queryByText("This description should not show")).not.toBeInTheDocument();
});

// Test for required questions
test("renders required indicator for required questions", async () => {
  withPreviewData({
    questions: [
      { id: "q1", type: "text", label: "Required Field", required: true },
      { id: "q2", type: "text", label: "Optional Field", required: false }
    ],
  });

  renderAt();
  
  // Find the required question
  const requiredQuestion = screen.getByText("Required Field").closest(".pf-qtitle");
  
  // It should have a required indicator (*)
  expect(requiredQuestion.querySelector(".req")).toBeInTheDocument();
  
  // Find the optional question
  const optionalQuestion = screen.getByText("Optional Field").closest(".pf-qtitle");
  
  // It should not have a required indicator
  expect(optionalQuestion.querySelector(".req")).toBeNull();
});

// Test for file upload with custom accept attribute
test("renders file upload with custom accept attribute", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "file", 
        label: "Document", 
        accept: ".doc,.docx" 
      },
      {
        id: "q2",
        type: "upload",
        label: "Image",
        allowedTypes: [".jpg", ".png", ".gif"]
      }
    ],
  });

  renderAt();
  
  const documentInput = screen.getByLabelText(/document/i).querySelector('input[type="file"]');
  const imageInput = screen.getByLabelText(/image/i).querySelector('input[type="file"]');
  
  // Check accept attributes
  expect(documentInput.accept).toBe(".doc,.docx");
  expect(imageInput.accept).toBe(".jpg,.png,.gif");
});

// Test for custom file hint
test("renders custom file hint for file upload", async () => {
  withPreviewData({
    questions: [
      { 
        id: "q1", 
        type: "file", 
        label: "Document", 
        fileHint: "Custom file hint text" 
      }
    ],
  });

  renderAt();
  
  // Custom hint should be visible
  expect(screen.getByText("Custom file hint text")).toBeInTheDocument();
});
