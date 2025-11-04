import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import PreviewForm from "@src/pages/PreviewForm.jsx";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/preview"]}>
      <Routes>
        <Route path="/preview" element={<PreviewForm />} />
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/create-form" element={<div>CREATE FORM</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "fb_preview",
    JSON.stringify({
      header: { title: "Employee Onboarding", name: "Course Feedback Form", desc: "desc" },
      questions: [
        { id: "m", type: "multiselect", label: "Pick many", options: ["One", "Two"] },
        { id: "f", type: "file", label: "Upload" },
        { id: "n", type: "number", label: "Num" },
        { id: "d", type: "date", label: "Date" },
      ],
    })
  );
});

describe("<PreviewForm /> branches", () => {
  it("renders fields, toggles multiselect chips, accepts file, clears values, and navigates", async () => {
    renderPage();

    // multiselect open/choose
    fireEvent.click(screen.getByText(/Select Answer/i)); // open dropdown
    fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: "One" } });
    fireEvent.click(screen.getByRole("option", { name: /One/i }));
    // close by clicking header
    fireEvent.click(screen.getByText(/Employee Onboarding/i));

    // file input (present but preview doesn't send anywhere)
    const fileInput = screen.getByLabelText("Upload").querySelector("input[type='file']");
    const f = new File(["x"], "x.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [f] } });

    // clear all
    fireEvent.click(screen.getByRole("button", { name: /Clear Form/i }));

    // nav back buttons
    fireEvent.click(screen.getByRole("link", { name: /Back to Form List/i }));
    await screen.findByText("HOME");

    // go to create form
    window.history.pushState({}, "", "/preview");
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Back to Create Form/i }));
    await screen.findByText("CREATE FORM");
  });
});