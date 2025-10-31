import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import KebabMenu from "@src/components/KebabMenu.jsx";

describe("<KebabMenu />", () => {
  it("toggles open and lists items", () => {
    const onSelect = vi.fn();
    render(<KebabMenu items={[{ label: "Edit", onSelect }]} />);

    const btn = screen.getByRole("button", { name: /⋮|menu/i });
    fireEvent.click(btn);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(); // closed after click
  });

  it("disabled item doesn't call onSelect", () => {
    const onSelect = vi.fn();
    render(<KebabMenu items={[{ label: "Delete", onSelect, disabled: true }]} />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking outside closes the menu", () => {
    render(<KebabMenu items={[{ label: "A" }]} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});