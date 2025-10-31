import { http, HttpResponse } from "msw";

// Adjust endpoints to match src/api/http.js base + routes you use
export const handlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const b = await request.json();
    if (b.email === "user@example.com" && b.password === "pass") {
      return HttpResponse.json({ token: "fake-jwt", user: { id: 1, name: "User" } });
    }
    return new HttpResponse("Unauthorized", { status: 401 });
  }),

  http.get("/api/forms", () =>
    HttpResponse.json([
      { id: 1, title: "Safety Audit", description: "Quarterly safety checks" },
      { id: 2, title: "Feedback", description: "General feedback form" },
    ])
  ),

  http.get("/api/forms/:id", ({ params }) =>
    HttpResponse.json({
      id: Number(params.id),
      title: `Form ${params.id}`,
      fields: [{ id: "name", type: "text", label: "Name" }],
    })
  ),

  http.post("/api/responses/:formId", () =>
    HttpResponse.json({ ok: true, submissionId: 123 })
  ),
];