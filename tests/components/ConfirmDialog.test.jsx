import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDialog from "@src/components/ConfirmDialog.jsx";

describe("<ConfirmDialog />", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(<ConfirmDialog open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows title/body and triggers cancel/confirm/backdrop", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete form?"
        body="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Back"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete form?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // backdrop click also cancels
    fireEvent.click(screen.getByText((_, el) => el?.className === "dlg-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});