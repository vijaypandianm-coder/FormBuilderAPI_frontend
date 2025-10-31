import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@src/api/responses.js", () => ({
  __esModule: true,
  default: {
    getDetail: vi.fn(async () => ({
      header: { formKey: 55, submittedAt: new Date("2025-01-01").toISOString() },
      answers: [
        { fieldId: "f1", fieldType: "text", answerValue: "Alice" },
        { fieldId: "f2", fieldType: "dropdown", answerValue: "2" },
        { fieldId: "f3", fieldType: "checkbox", answerValue: ["1","3"] },
      ],
    })),
  },
}));

vi.mock("@src/api/forms.js", () => ({
  FormService: {
    get: vi.fn(async () => ({
      title: "Employee Feedback", description: "desc",
      layout: [
        { fields: [
          { fieldId: "f1", label: "Name", type: "text" },
          { fieldId: "f2", label: "Color", type: "dropdown", options: [{ id: "1", text: "Red" }, { id: "2", text: "Blue" }] },
          { fieldId: "f3", label: "Choices", type: "checkbox", options: [{ id: "1", text: "One" }, { id: "3", text: "Three" }] },
        ] }
      ]
    })),
  },
}));

import MySubmissionDetail from "@src/pages/MySubmissionDetail.jsx";

function renderApp(id = "abc") {
  return render(
    <MemoryRouter initialEntries={[`/learn/detail/${id}`]}>
      <Routes>
        <Route path="/learn/detail/:responseId" element={<MySubmissionDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("<MySubmissionDetail />", () => {
  it("renders header and resolved answer labels", async () => {
    renderApp("123");
    expect(await screen.findByText("Employee Feedback")).toBeInTheDocument();

    // Rows rendered in layout order; values resolved via options
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();

    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();

    expect(screen.getByText("Choices")).toBeInTheDocument();
    expect(screen.getByText("One, Three")).toBeInTheDocument();
  });
});