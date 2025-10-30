// src/api/users.js
export const UsersApi = {
  async byIds(ids) {
    const qs = encodeURIComponent(ids.join(","));
    const candidates = [
      `/api/users/by-ids?ids=${qs}`,
      `/api/admin/users/by-ids?ids=${qs}`,
      `/users/by-ids?ids=${qs}`,
      `/admin/users/by-ids?ids=${qs}`
    ];
    for (const url of candidates) {
      try {
        const r = await fetch(url);
        if (r.ok) return await r.json();
      } catch {}
    }
    return null;
  },
  async get(id) {
    const candidates = [
      `/api/users/${id}`,
      `/api/admin/users/${id}`,
      `/users/${id}`,
      `/admin/users/${id}`,
      `/api/user/${id}`,
    ];
    for (const url of candidates) {
      try {
        const r = await fetch(url);
        if (r.ok) return await r.json();
      } catch {}
    }
    return null;
  }
};