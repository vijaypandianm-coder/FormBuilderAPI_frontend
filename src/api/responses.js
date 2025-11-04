// src/api/responses.js
import { apiFetch } from "./http";

/**
 * Learner/Admin response API.
 * Keeps old .list(formKey) AND adds paged helpers.
 */
const ResponseService = {
  /**
   * Legacy: flat list for a specific form (optionally ?userId=).
   * Used by some existing admin pages.
   */
  async list(formKey, userId) {
    if (formKey == null) throw new Error("formKey is required");
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return await apiFetch(`/api/responses/${encodeURIComponent(formKey)}${qs}`);
  },

  /**
   * Learner tab: list MY submissions (headers across all forms).
   * Backend route: GET /api/Response/my-submissions
   * (non-paged fallback still works)
   */
  async listMy() {
    return await apiFetch(`/api/Response/my-submissions`);
  },

  /**
   * NEW: paged “my submissions” list.
   * Backend route (expected): GET /api/Response/my-submissions?page=&pageSize=&q=
   */
  async listMyPaged({ page = 1, pageSize = 10, q = "" } = {}) {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (q?.trim()) p.set("q", q.trim());
    return await apiFetch(`/api/Response/my-submissions?${p.toString()}`);
  },

  /**
   * (Optional helper if you want admin paged list by formKey later)
   * Backend route (expected): GET /api/Response/form/{formKey}/responses?page=&pageSize=&q=
   */
  async listByFormPaged(formKey, { page = 1, pageSize = 20, q = "" } = {}) {
    if (formKey == null) throw new Error("formKey is required");
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (q?.trim()) p.set("q", q.trim());
    return await apiFetch(
      `/api/Response/form/${encodeURIComponent(formKey)}/responses?${p.toString()}`
    );
  },

  /**
   * Read a single submission (header + answers).
   * Backend route: GET /api/Response/{responseId}
   */
  async getDetail(responseId) {
    if (!responseId) throw new Error("responseId is required");
    return await apiFetch(`/api/Response/${encodeURIComponent(responseId)}`);
  },
};

export { ResponseService };                 // named export
export const ResponsesApi = ResponseService; // legacy name (safe)
export default ResponseService;              // default export  