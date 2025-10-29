// src/api/responses.js
import { apiFetch } from "./http";

/**
 * Learner-facing response API.
 * Keeps the old .list(formKey) used elsewhere AND adds .listMy() and .getDetail().
 */
const ResponseService = {
  /**
   * List answers for a specific form (optionally server will filter by user).
   * Used by ViewForm / admin pages you already have.
   */
  async list(formKey, userId) {
    if (formKey == null) throw new Error("formKey is required");
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return await apiFetch(`/api/responses/${encodeURIComponent(formKey)}${qs}`);
  },

  /**
   * Learner tab: list MY submissions (headers across all forms).
   * Backend route: GET /api/Response/my-submissions
   */
  async listMy() {
    return await apiFetch(`/api/Response/my-submissions`);
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

export { ResponseService };                // named export
export const ResponsesApi = ResponseService; // legacy name (safe)
export default ResponseService;              // default export