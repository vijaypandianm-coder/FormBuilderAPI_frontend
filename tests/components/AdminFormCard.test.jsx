import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminFormCard from "@src/components/AdminFormCard.jsx";

function makeForm(overrides = {}) {
  return {
    title: "Safety Audit",
    status: "Published",
    meta: [{ k: "Owner", v: "QA" }, { k: "Updated", v: "2025-03-01" }],
    ...overrides,
  };
}

describe("<AdminFormCard />", () => {
  it("renders title, meta and Published pill", () => {
    render(<AdminFormCard form={makeForm()} />);
    expect(screen.getByRole("region", { name: /safety audit card/i })).toBeInTheDocument();
    expect(screen.getByText("Owner:")).toBeInTheDocument();
    expect(screen.getByText("QA")).toBeInTheDocument();
    expect(screen.getByText(/Published/i)).toBeInTheDocument();
  });

  it("shows Draft pill for non-published forms", () => {
    render(<AdminFormCard form={makeForm({ status: "Draft" })} />);
    expect(screen.getByText(/Draft/i)).toBeInTheDocument();
  });

it("kebab opens/closes and routes clicks correctly: published → View Form (Config)", () => {
  const onConfig = vi.fn();
  const onDelete = vi.fn();

  render(
    <AdminFormCard
      form={makeForm({ status: "Published" })}
      onConfig={onConfig}
      onDelete={onDelete}
    />
  );

  const kebabBtn = screen.getByRole("button", { name: /more options/i });
  fireEvent.click(kebabBtn);

  // Primary label for published is "View Form"
  fireEvent.click(screen.getByRole("menuitem", { name: "View Form" }));
  expect(onConfig).toHaveBeenCalledTimes(1);

  // Re-open and click Delete
  fireEvent.click(kebabBtn);
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

  it("published/draft primary action: draft → Edit Form (builder)", () => {
    const onEdit = vi.fn();
    render(<AdminFormCard form={makeForm({ status: "Draft" })} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: /more options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit Form" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("clicking outside closes the kebab menu", () => {
    render(<AdminFormCard form={makeForm()} />);
    const kebabBtn = screen.getByRole("button", { name: /more options/i });
    fireEvent.click(kebabBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Click outside (document)
    fireEvent.mouseDown(document.body);
    // menu should close
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("View Responses button calls onView(form)", () => {
    const onView = vi.fn();
    const form = makeForm();
    render(<AdminFormCard form={form} onView={onView} />);
    fireEvent.click(screen.getByRole("button", { name: /view responses/i }));
    expect(onView).toHaveBeenCalledWith(form);
  });
});