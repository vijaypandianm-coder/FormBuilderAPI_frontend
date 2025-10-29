// src/api/forms.js
import { AuthService } from "./auth";

const API_FORMS =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_BASE_URL_MONGO?.trim() ||
  "http://localhost:5211";

async function api(path, init = {}) {
  const res = await fetch(`${API_FORMS}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...AuthService.authHeader(),
      ...(init.headers || {}),
    },
    credentials: "omit",
    ...init,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  try { return await res.json(); } catch { return null; }
}

function normalizeForm(f = {}) {
  const formKey = f.formKey ?? f.FormKey ?? f.key ?? f.Key ?? null;
  const title = f.title ?? f.Title ?? "Untitled";
  const description = f.description ?? f.Description ?? "";
  const status = (f.status ?? f.Status ?? "").toString();
  const publishedAt =
    f.publishedAt ??
    f.PublishedAt ??
    f.updatedAt ??
    f.UpdatedAt ??
    f.createdAt ??
    f.CreatedAt ??
    null;

  return { formKey, title, description, status, publishedAt };
}

export const FormService = {
  async list({ status = "All", page = 1, pageSize = 20, q = "" } = {}) {
    const p = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
    if (q?.trim()) p.set("q", q.trim());
    return await api(`/api/forms?${p.toString()}`);
  },

  async get(formKey) {
    return await api(`/api/forms/${encodeURIComponent(formKey)}`);
  },

  async layout(formKey) {
    const dto = await api(`/api/forms/${encodeURIComponent(formKey)}`);
    return { sections: dto?.layout || dto?.Layout || [] };
  },

  async remove(formKey) {
    return await api(`/api/forms/${encodeURIComponent(formKey)}`, { method: "DELETE" });
  },

  // ------ CREATE (new form) ------
  async create(payload) {
    const metaBody = {
      title: payload.title,
      description: payload.description ?? "",
      access: payload.access || "Open",
    };
    const metaRes = await api(`/api/forms/meta`, {
      method: "POST",
      body: JSON.stringify(metaBody),
    });

    const formKey = metaRes?.formKey ?? metaRes?.FormKey ?? metaRes?.data?.formKey;
    if (!formKey) throw new Error("Create meta failed: formKey not returned");

    const sections = (payload.layout || []).map((s, si) => ({
      title: s.title || `Section ${si + 1}`,
      description: s.description || "",
      fields: (s.fields || []).map((f, i) => ({
        fieldId: f.fieldId || f.id || `f_${si + 1}_${i + 1}`,
        label: f.label || `Question ${i + 1}`,
        type: (f.type || "text").toString(),
        isRequired: !!(f.isRequired ?? f.required),
        options: Array.isArray(f.options) ? f.options : undefined,
        choices: Array.isArray(f.options)
          ? f.options.map((t, idx) => ({ id: String(idx + 1), text: String(t) }))
          : undefined,
        dateFormat: f.dateFormat,
      })),
    }));

    await api(`/api/forms/${encodeURIComponent(formKey)}/layout`, {
      method: "PUT",
      body: JSON.stringify({ sections }),
    });

    const status = payload.status || (payload.visible ? "Published" : "Draft");
    await api(`/api/forms/${encodeURIComponent(formKey)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });

    return { formKey };
  },

  async clone(formKey) {
    return await api(`/api/forms/${encodeURIComponent(formKey)}/clone`, { method: "POST" });
  },

  // ------ UPDATE (edit existing without creating a copy) ------
  async updateMeta(formKey, { title, description, access = "Open" }) {
    return await api(`/api/forms/${encodeURIComponent(formKey)}/meta`, {
      method: "PUT",
      body: JSON.stringify({ title, description, access }),
    });
  },

  async updateLayout(formKey, sections) {
    return await api(`/api/forms/${encodeURIComponent(formKey)}/layout`, {
      method: "PUT",
      body: JSON.stringify({ sections }),
    });
  },

  async updateStatus(formKey, status) {
    return await api(`/api/forms/${encodeURIComponent(formKey)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  // Combined helper used by CreateForm when editing an existing form
  async update(formKey, payload) {
    await this.updateMeta(formKey, {
      title: payload.title,
      description: payload.description ?? "",
      access: payload.access || "Open",
    });

    const sections = (payload.layout || []).map((s, si) => ({
      title: s.title || `Section ${si + 1}`,
      description: s.description || "",
      fields: (s.fields || []).map((f, i) => ({
        fieldId: f.fieldId || f.id || `f_${si + 1}_${i + 1}`,
        label: f.label || `Question ${i + 1}`,
        type: (f.type || "text").toString(),
        isRequired: !!(f.isRequired ?? f.required),
        options: Array.isArray(f.options) ? f.options : undefined,
        choices: Array.isArray(f.options)
          ? f.options.map((t, idx) => ({ id: String(idx + 1), text: String(t) }))
          : undefined,
        dateFormat: f.dateFormat,
      })),
    }));

    await this.updateLayout(formKey, sections);
    await this.updateStatus(formKey, payload.status || "Draft");
    return { formKey };
  },

  // Learner helpers (unchanged)
  async listPublished({ page = 1, pageSize = 100, q = "" } = {}) {
    const p = new URLSearchParams({
      status: "Published",
      page: String(page),
      pageSize: String(pageSize),
    });
    if (q?.trim()) p.set("q", q.trim());

    const data = await api(`/api/forms?${p.toString()}`);
    const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? [];

    const normalized = (items || [])
      .map(normalizeForm)
      .filter((x) => x.status.toLowerCase() === "published");

    normalized.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });

    return normalized;
  },

  async getPublishedCards({ q = "" } = {}) {
    const list = await this.listPublished({ q });
    return list.map(({ formKey, title, description, publishedAt }) => ({
      formKey,
      title,
      description,
      publishedAt,
    }));
  },
};