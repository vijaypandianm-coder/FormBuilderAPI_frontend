// tests/pages/MySubmissions.test.jsx
import React from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import MySubmissions from "../../src/pages/MySubmissions.jsx";

// Mock navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return { 
    ...actual, 
    useNavigate: () => mockNavigate 
  };
});

// Mock assets
vi.mock("../../src/assets/ViewSub.png", () => ({
  default: "view.png"
}));

vi.mock("../../src/assets/Search.png", () => ({
  default: "search.png"
}));

// Mock API services
const mockListMy = vi.fn();
const mockGetForm = vi.fn();

vi.mock("../../src/api/responses", () => ({
  default: {
    listMy: (...args) => mockListMy(...args)
  }
}));

vi.mock("../../src/api/forms", () => ({
  FormService: {
    get: (...args) => mockGetForm(...args)
  }
}));

// Sample data for tests
const sampleResponses = [
  { 
    responseId: "r1", 
    formKey: "f1", 
    title: "Training Form 1", 
    submittedAt: "2023-05-10T10:00:00Z", 
    formType: "External Training Completion", 
    status: "Completion Submitted" 
  },
  { 
    responseId: "r2", 
    formKey: "f2", 
    title: "Training Form 2", 
    submittedAt: "2023-05-11T10:00:00Z", 
    formType: "Internal Training", 
    status: "Approved" 
  },
  { 
    ResponseId: "r3", 
    FormKey: "f3", 
    FormTitle: "Training Form 3", 
    SubmittedAt: "2023-05-12T10:00:00Z", 
    FormType: "Certification", 
    Status: "Rejected" 
  }
];

describe("MySubmissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <MySubmissions />
      </MemoryRouter>
    );
  }

  it("renders loading state initially", async () => {
    // Delay API response to see loading state
    mockListMy.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve([]), 100);
    }));
    
    renderPage();
    
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });
  });

  it("renders table and rows with correct data mapping", async () => {
    mockListMy.mockResolvedValue(sampleResponses);
    
    renderPage();
    
    // Wait for table to appear
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Check table headers
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Training Name");
    expect(headers[1]).toHaveTextContent("Submitted On");
    expect(headers[2]).toHaveTextContent("Form Type");
    expect(headers[3]).toHaveTextContent("Status");
    
    // Check data rows - note that the component sorts by date descending
    // so the order will be: Form 3, Form 2, Form 1
    const rows = screen.getAllByRole("row").slice(1); // Skip header row
    expect(rows).toHaveLength(3);
    
    // Check for the presence of each form title in any row
    expect(screen.getByText("Training Form 3")).toBeInTheDocument();
    expect(screen.getByText("Training Form 2")).toBeInTheDocument();
    expect(screen.getByText("Training Form 1")).toBeInTheDocument();
    
    // Check for the presence of each status in any row
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Completion Submitted")).toBeInTheDocument();
    
    // Check for the presence of each form type in the table rows
    // Use within() to scope the search to the table body only
    const tableBody = screen.getAllByRole("rowgroup")[1]; // Get the tbody element
    expect(within(tableBody).getByText("Certification")).toBeInTheDocument();
    expect(within(tableBody).getByText("Internal Training")).toBeInTheDocument();
    expect(within(tableBody).getByText("External Training Completion")).toBeInTheDocument();
  });

  it("handles missing titles by fetching form details", async () => {
    const responsesWithMissingTitles = [
      { responseId: "r4", formKey: "f4", submittedAt: "2023-05-13T10:00:00Z" },
      { responseId: "r5", formKey: "f5", submittedAt: "2023-05-14T10:00:00Z" }
    ];
    
    mockListMy.mockResolvedValue(responsesWithMissingTitles);
    mockGetForm.mockImplementation((key) => {
      if (key === "f4") return Promise.resolve({ title: "Fetched Title 4" });
      if (key === "f5") return Promise.resolve({ Title: "Fetched Title 5" });
      return Promise.resolve({});
    });
    
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByText("Fetched Title 4")).toBeInTheDocument();
      expect(screen.getByText("Fetched Title 5")).toBeInTheDocument();
    });
    
    expect(mockGetForm).toHaveBeenCalledWith("f4");
    expect(mockGetForm).toHaveBeenCalledWith("f5");
  });

  it("handles form fetch errors gracefully", async () => {
    mockListMy.mockResolvedValue([
      { responseId: "r6", formKey: "f6", submittedAt: "2023-05-15T10:00:00Z" }
    ]);
    
    mockGetForm.mockRejectedValue(new Error("Failed to fetch form"));
    
    renderPage();
    
    await waitFor(() => {
      // Should show fallback title with formKey
      expect(screen.getByText("Form f6")).toBeInTheDocument();
    });
  });

  it("handles API error when fetching submissions", async () => {
    mockListMy.mockRejectedValue(new Error("Failed to load submissions"));
    
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByText("Failed to load submissions")).toBeInTheDocument();
    });
  });

  it("shows empty state when no submissions are found", async () => {
    mockListMy.mockResolvedValue([]);
    
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
    });
  });

  it("filters submissions by type", async () => {
    mockListMy.mockResolvedValue(sampleResponses);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Initially should show all 3 rows
    expect(screen.getAllByRole("row").length).toBe(4); // 3 data rows + 1 header row
    
    // Select Internal Training type
    const typeSelect = screen.getByLabelText("Form Type");
    fireEvent.change(typeSelect, { target: { value: "Internal Training" } });
    
    // Should only show the Internal Training row
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(2); // 1 data row + 1 header row
      expect(screen.getByText("Training Form 2")).toBeInTheDocument();
      expect(screen.queryByText("Training Form 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Training Form 3")).not.toBeInTheDocument();
    });
  });

  it("filters submissions by search term", async () => {
    mockListMy.mockResolvedValue(sampleResponses);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Search for "Form 3"
    const searchInput = screen.getByPlaceholderText("Search");
    fireEvent.change(searchInput, { target: { value: "Form 3" } });
    
    // Should only show Form 3
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(2); // 1 data row + 1 header row
      expect(screen.getByText("Training Form 3")).toBeInTheDocument();
      expect(screen.queryByText("Training Form 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Training Form 2")).not.toBeInTheDocument();
    });
  });

  it("handles combined type and search filtering", async () => {
    mockListMy.mockResolvedValue([
      ...sampleResponses,
      { 
        responseId: "r7", 
        formKey: "f7", 
        title: "Advanced Internal Training", 
        submittedAt: "2023-05-16T10:00:00Z", 
        formType: "Internal Training", 
        status: "Completion Submitted" 
      }
    ]);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Select Internal Training type
    const typeSelect = screen.getByLabelText("Form Type");
    fireEvent.change(typeSelect, { target: { value: "Internal Training" } });
    
    // Search for "Advanced"
    const searchInput = screen.getByPlaceholderText("Search");
    fireEvent.change(searchInput, { target: { value: "Advanced" } });
    
    // Should only show the Advanced Internal Training row
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(2); // 1 data row + 1 header row
      expect(screen.getByText("Advanced Internal Training")).toBeInTheDocument();
      expect(screen.queryByText("Training Form 2")).not.toBeInTheDocument();
    });
  });

  it("navigates to submission details when clicking view button", async () => {
    mockListMy.mockResolvedValue([sampleResponses[0]]); // Just use the first response
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Click view button on first row
    const viewButton = screen.getByTitle("View submission");
    fireEvent.click(viewButton);
    
    // Should navigate to submission details
    expect(mockNavigate).toHaveBeenCalledWith("/learn/submissions/r1");
  });

  it("handles pagination correctly", async () => {
    // Create 15 sample responses to test pagination
    // Note: The component sorts by date descending, so we need to create the data accordingly
    const manyResponses = Array.from({ length: 15 }, (_, i) => ({
      responseId: `rid${15-i}`, // Reverse the IDs to match the expected sort order
      formKey: `fid${15-i}`,
      title: `Training ${15-i}`, // Reverse the titles to match the expected sort order
      submittedAt: `2023-05-${String(15-i).padStart(2, '0')}T10:00:00Z`, // Newest first
      formType: "External Training Completion",
      status: "Completion Submitted"
    }));
    
    mockListMy.mockResolvedValue(manyResponses);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Initially should show first 10 items (default page size)
    // Due to sorting, we'll see Training 15, 14, 13, etc.
    expect(screen.getByText("Training 15")).toBeInTheDocument();
    expect(screen.getByText("Training 6")).toBeInTheDocument();
    expect(screen.queryByText("Training 5")).not.toBeInTheDocument();
    
    // Go to next page
    const nextButton = screen.getByLabelText("Next page");
    fireEvent.click(nextButton);
    
    // Should show remaining items
    await waitFor(() => {
      expect(screen.queryByText("Training 15")).not.toBeInTheDocument();
      expect(screen.getByText("Training 5")).toBeInTheDocument();
      expect(screen.getByText("Training 1")).toBeInTheDocument();
    });
    
    // Go back to previous page
    const prevButton = screen.getByLabelText("Previous page");
    fireEvent.click(prevButton);
    
    // Should show first page again
    await waitFor(() => {
      expect(screen.getByText("Training 15")).toBeInTheDocument();
      expect(screen.queryByText("Training 5")).not.toBeInTheDocument();
    });
  });

  it("changes page size correctly", async () => {
    // Create 30 sample responses to test different page sizes
    const manyResponses = Array.from({ length: 30 }, (_, i) => ({
      responseId: `rid${30-i}`, // Reverse the IDs to match the expected sort order
      formKey: `fid${30-i}`,
      title: `Training ${30-i}`, // Reverse the titles to match the expected sort order
      submittedAt: `2023-05-${String(30-i).padStart(2, '0')}T10:00:00Z` // Newest first
    }));
    
    mockListMy.mockResolvedValue(manyResponses);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Initially should show 10 items
    expect(screen.getAllByRole("row").length).toBe(11); // 10 data rows + 1 header
    
    // Change page size to 25
    // Use getAllByRole to get the select elements and pick the second one (page size)
    const pageSizeSelect = screen.getAllByRole("combobox")[1]; 
    fireEvent.change(pageSizeSelect, { target: { value: "25" } });
    
    // Should show 25 items
    await waitFor(() => {
      expect(screen.getAllByRole("row").length).toBe(26); // 25 data rows + 1 header
    });
    
    // Change page size to 50
    fireEvent.change(pageSizeSelect, { target: { value: "50" } });
    
    // Should show all 30 items
    await waitFor(() => {
      expect(screen.getAllByRole("row").length).toBe(31); // 30 data rows + 1 header
    });
  });

  it("handles different date formats and missing dates", async () => {
    const responsesWithDifferentDates = [
      { responseId: "d1", formKey: "f1", title: "With ISO Date", submittedAt: "2023-05-10T10:00:00Z" },
      { responseId: "d2", formKey: "f2", title: "With Different Format", submitted_on: "2023/05/11" },
      { responseId: "d3", formKey: "f3", title: "With SubmittedOn", SubmittedOn: "2023-05-12" },
      { responseId: "d4", formKey: "f4", title: "No Date" }
    ];
    
    mockListMy.mockResolvedValue(responsesWithDifferentDates);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Check that dates are displayed in some format
    // Use getAllByText with a function and check that we have at least one date cell
    const dateCells = screen.getAllByText((content, element) => {
      return element.tagName.toLowerCase() === 'td' && 
             (content.includes('2023') || content.includes('/') || content.includes('-'));
    });
    expect(dateCells.length).toBeGreaterThan(0);
    
    // Last row should have placeholder for missing date
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("handles different status values with correct pill styling", async () => {
    const responsesWithDifferentStatuses = [
      { responseId: "s1", formKey: "f1", title: "Submitted", status: "Completion Submitted" },
      { responseId: "s2", formKey: "f2", title: "Approved", status: "Approved" },
      { responseId: "s3", formKey: "f3", title: "Rejected", status: "Rejected" }
    ];
    
    mockListMy.mockResolvedValue(responsesWithDifferentStatuses);
    
    const { container } = renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Check for amber pill for submitted
    const amberPill = container.querySelector(".tag--amber");
    expect(amberPill).toBeInTheDocument();
    expect(amberPill).toHaveTextContent("Completion Submitted");
    
    // Check for green pill for approved
    const greenPill = container.querySelector(".tag--green");
    expect(greenPill).toBeInTheDocument();
    expect(greenPill).toHaveTextContent("Approved");
    
    // Check for red pill for rejected
    const redPill = container.querySelector(".tag--red");
    expect(redPill).toBeInTheDocument();
    expect(redPill).toHaveTextContent("Rejected");
  });

  it("shows filter alert when clicking filter button", async () => {
    mockListMy.mockResolvedValue([]);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    
    renderPage();
    
    // Wait for component to load
    await waitFor(() => expect(screen.getByText("Filter")).toBeInTheDocument());
    
    // Click filter button
    fireEvent.click(screen.getByText("Filter"));
    
    expect(alertSpy).toHaveBeenCalledWith("Filter panel coming soon");
  });

  it("sorts submissions by date with newest first", async () => {
    const unsortedResponses = [
      { responseId: "u1", formKey: "f1", title: "Oldest", submittedAt: "2023-01-01T10:00:00Z" },
      { responseId: "u2", formKey: "f2", title: "Newest", submittedAt: "2023-12-31T10:00:00Z" },
      { responseId: "u3", formKey: "f3", title: "Middle", submittedAt: "2023-06-15T10:00:00Z" }
    ];
    
    mockListMy.mockResolvedValue(unsortedResponses);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    const rows = screen.getAllByRole("row").slice(1); // Skip header row
    
    // First row should be newest
    expect(within(rows[0]).getByText("Newest")).toBeInTheDocument();
    
    // Second row should be middle
    expect(within(rows[1]).getByText("Middle")).toBeInTheDocument();
    
    // Third row should be oldest
    expect(within(rows[2]).getByText("Oldest")).toBeInTheDocument();
  });

  it("handles responses with same date by sorting alphabetically by title", async () => {
    const sameDateResponses = [
      { responseId: "sd1", formKey: "f1", title: "Z Training", submittedAt: "2023-05-10T10:00:00Z" },
      { responseId: "sd2", formKey: "f2", title: "A Training", submittedAt: "2023-05-10T10:00:00Z" },
      { responseId: "sd3", formKey: "f3", title: "M Training", submittedAt: "2023-05-10T10:00:00Z" }
    ];
    
    mockListMy.mockResolvedValue(sameDateResponses);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    const rows = screen.getAllByRole("row").slice(1); // Skip header row
    
    // Should be sorted alphabetically when dates are the same
    expect(within(rows[0]).getByText("A Training")).toBeInTheDocument();
    expect(within(rows[1]).getByText("M Training")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Z Training")).toBeInTheDocument();
  });

  it("handles different response formats correctly", async () => {
    const mixedFormatResponses = [
      { id: "mf1", FormKey: "f1", FormTitle: "Format 1" },
      { Id: "mf2", formKey: "f2", title: "Format 2" },
      { responseId: "mf3", formKey: "f3", Title: "Format 3" }
    ];
    
    mockListMy.mockResolvedValue(mixedFormatResponses);
    
    renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // All formats should be displayed
    expect(screen.getByText("Format 1")).toBeInTheDocument();
    expect(screen.getByText("Format 2")).toBeInTheDocument();
    expect(screen.getByText("Format 3")).toBeInTheDocument();
  });

  it("handles API response in items/Items/data format", async () => {
    mockListMy.mockResolvedValue({
      items: [
        { responseId: "i1", formKey: "f1", title: "Items Format" }
      ]
    });
    
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByText("Items Format")).toBeInTheDocument();
    });
    
    // Reset and try with Items (capitalized)
    mockListMy.mockReset();
    mockListMy.mockResolvedValue({
      Items: [
        { responseId: "i2", formKey: "f2", title: "Items Capitalized Format" }
      ]
    });
    
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByText("Items Capitalized Format")).toBeInTheDocument();
    });
    
    // Reset and try with data property
    mockListMy.mockReset();
    mockListMy.mockResolvedValue({
      data: [
        { responseId: "i3", formKey: "f3", title: "Data Property Format" }
      ]
    });
    
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByText("Data Property Format")).toBeInTheDocument();
    });
  });

  it("cleans up resources when component unmounts", async () => {
    mockListMy.mockResolvedValue(sampleResponses);
    
    const { unmount } = renderPage();
    
    // Wait for data to load
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Unmount component
    unmount();
    
    // Render again with different data
    mockListMy.mockResolvedValue([
      { responseId: "new1", formKey: "f1", title: "New Response" }
    ]);
    
    renderPage();
    
    // Should show new data without interference from previous render
    await waitFor(() => {
      expect(screen.getByText("New Response")).toBeInTheDocument();
      expect(screen.queryByText("Training Form 1")).not.toBeInTheDocument();
    });
  });

  // Simple test for pagination component
  it("renders pagination controls correctly", async () => {
    mockListMy.mockResolvedValue(sampleResponses);
    
    renderPage();
    
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    
    // Check pagination elements
    expect(screen.getByText("Items per page")).toBeInTheDocument();
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    
    // Previous button should be disabled when on first page
    const prevButton = screen.getByLabelText("Previous page");
    expect(prevButton).toBeDisabled();
    
    // Next button should be disabled when only one page
    const nextButton = screen.getByLabelText("Next page");
    expect(nextButton).toBeDisabled();
  });
});