// tests/pages/LearnerForms.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ---- Mocks ----

// static asset
vi.mock("../../src/assets/Search.png", () => ({ default: "search.png" }), {
  virtual: true,
});

// FormService.list
vi.mock("../../src/api/forms.js", () => {
  return {
    FormService: {
      list: vi.fn(),
    },
  };
});

// ResponseService.listMy (default export)
vi.mock("../../src/api/responses.js", () => {
  return {
    __esModule: true,
    default: {
      listMy: vi.fn(),
    },
  };
});

// ConfirmDialog – simplified, but keeps behaviour for open/confirm/cancel
vi.mock("../../src/components/ConfirmDialog.jsx", () => ({
  __esModule: true,
  default: ({ open, title, body, cancelLabel, confirmLabel, onCancel, onConfirm }) => {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <div>{body}</div>
        <button onClick={onCancel}>{cancelLabel}</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    );
  },
}));

import { FormService } from "../../src/api/forms.js";
import ResponseService from "../../src/api/responses.js";
import LearnerForms from "../../src/pages/LearnerForms.jsx";

function renderAt(path = "/learn") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn" element={<LearnerForms />} />
        <Route path="/forms/:key" element={<div>OPENED</div>} />
        <Route
          path="/learn/my-submissions"
          element={<div>MY SUBMISSIONS</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("<LearnerForms />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // default: 2 published + 1 draft (filtered out)
    FormService.list.mockResolvedValue({
      items: [
        {
          formKey: 2,
          title: "Zeta",
          description: "zzz",
          status: "Published",
          publishedAt: "2024-03-01",
        },
        {
          formKey: 1,
          title: "Alpha",
          description: "aaa",
          status: "Published",
          publishedAt: "2024-05-01",
        },
        {
          formKey: 3,
          title: "Drafty",
          status: "Draft",
        },
      ],
      total: 2,
    });

    // default: no previous submissions
    ResponseService.listMy.listMy?.mockResolvedValue?.([]) ??
      (ResponseService.listMy = vi.fn().mockResolvedValue([]));
  });

  it("loads, sorts Published forms, filters by search, and opens form when no previous submission", async () => {
    renderAt("/learn");

    // initial API call on mount – note pageSize: 1000 (client-side paging)
    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith({
        status: "Published",
        page: 1,
        pageSize: 1000,
        q: "",
      });
    });

    // Alpha (May) then Zeta (Mar) – sorted by publishedAt desc
    const alphaCard = await screen.findByLabelText("Alpha");
    const zetaCard = screen.getByLabelText("Zeta");
    expect(alphaCard).toBeInTheDocument();
    expect(zetaCard).toBeInTheDocument();

    // Filter by search (refetch with q = "zeta")
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "zeta" },
    });

    await waitFor(() => {
      expect(FormService.list).toHaveBeenLastCalledWith({
        status: "Published",
        page: 1,
        pageSize: 1000,
        q: "zeta",
      });
    });

    // after search, only Zeta should remain
    await waitFor(() => {
      expect(screen.queryByLabelText("Alpha")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Zeta")).toBeInTheDocument();
    });

    // start submission: no previous submissions -> direct navigation to /forms/2
    fireEvent.click(
      screen.getByRole("button", { name: /start submission/i })
    );

    expect(await screen.findByText("OPENED")).toBeInTheDocument();
  });

  it("shows empty state when no results after search", async () => {
    // first call: no items
    FormService.list.mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    renderAt("/learn");

    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith({
        status: "Published",
        page: 1,
        pageSize: 1000,
        q: "",
      });
    });

    // empty state visible
    expect(await screen.findByText(/no forms found/i)).toBeInTheDocument();

    // type a search – refetch with q
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "nope" },
    });

    await waitFor(() => {
      expect(FormService.list).toHaveBeenLastCalledWith({
        status: "Published",
        page: 1,
        pageSize: 1000,
        q: "nope",
      });
    });

    // still empty
    expect(screen.getByText(/no forms found/i)).toBeInTheDocument();
  });

  it("renders error state when API fails and handles ResponseService failure", async () => {
    // Form list fails
    FormService.list.mockRejectedValueOnce(new Error("Backend down"));
    // My submissions also fails -> warning branch
    ResponseService.listMy.mockRejectedValueOnce(
      new Error("Submissions API down")
    );

    renderAt("/learn");

    const errorEl = await screen.findByText(/backend down/i);
    expect(errorEl).toBeInTheDocument();

    // no cards or empty state when err is set
    expect(screen.queryByLabelText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zeta")).not.toBeInTheDocument();
    expect(screen.queryByText(/no forms found/i)).not.toBeInTheDocument();
  });

  it("treats item without status as published, and exercises pagination footer (page & pageSize changes)", async () => {
    // 30 items -> pageCount: ceil(30/10) = 3
    const manyItems = Array.from({ length: 30 }).map((_, i) => ({
      FormKey: `F-${i + 1}`,          // tests norm() fallback for FormKey/Title
      Title: `Mystery ${i + 1}`,
      Description: "no status",
      PublishedAt: "2024-01-01",
      // no status -> treated as published
    }));

    FormService.list.mockResolvedValueOnce({
      items: manyItems,
      total: 30,
    });

    renderAt("/learn");

    // one of the cards rendered
    const firstCard = await screen.findByLabelText("Mystery 1");
    expect(firstCard).toBeInTheDocument();

    // pagination footer: 1 of 3
    expect(screen.getByText(/1\s*of\s*3/)).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "›" });
    const prevBtn = screen.getByRole("button", { name: "‹" });

    // first page: prev disabled, next enabled
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // go to page 2 (client-side only – no new API call expected)
    fireEvent.click(nextBtn);
    expect(screen.getByText(/2\s*of\s*3/)).toBeInTheDocument();

    // now prev enabled
    expect(prevBtn).not.toBeDisabled();

    // change pageSize to 25 -> page reset to 1; pageCount = ceil(30/25) = 2
    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "25" },
    });

    // footer updated to "1 of 2"
    expect(screen.getByText(/1\s*of\s*2/)).toBeInTheDocument();
  });

  it("shows 'already submitted' dialog when previous submission exists and navigates on confirm", async () => {
    FormService.list.mockResolvedValueOnce({
      items: [
        {
          formKey: "REPEAT",
          title: "Repeatable",
          description: "desc",
          status: "Published",
          publishedAt: "2024-07-01",
        },
      ],
      total: 1,
    });

    // one previous submission for this form
    ResponseService.listMy.mockResolvedValueOnce([
      {
        formKey: "REPEAT",
        submittedAt: "2024-08-01T00:00:00Z",
      },
    ]);

    renderAt("/learn");

    const card = await screen.findByLabelText("Repeatable");
    expect(card).toBeInTheDocument();

    // click Start Submission -> should open "Already Submitted" dialog (no navigation yet)
    fireEvent.click(
      screen.getByRole("button", { name: /start submission/i })
    );

    const dialog = await screen.findByTestId("confirm-dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/already submitted/i)).toBeInTheDocument();
    // last submitted date shown in body
    expect(screen.getByText(/submit this form again/i)).toBeInTheDocument();

    // cancel once to exercise handleAlreadyCancel
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });

    // open again
    fireEvent.click(
      screen.getByRole("button", { name: /start submission/i })
    );
    await screen.findByTestId("confirm-dialog");

    // confirm -> navigate to /forms/REPEAT
    fireEvent.click(screen.getByText("Yes, Continue"));
    expect(await screen.findByText("OPENED")).toBeInTheDocument();
  });
});