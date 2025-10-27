import { apiFetch } from './http';
const USE_MOCK = (import.meta.env.VITE_USE_MOCK || '').toString() === 'true';

export const FormService = {
  async list({ page = 1, pageSize = 9, status = '' }, { signal } = {}) {
    if (USE_MOCK) {
      const { mockList } = await import('../mock/forms.mock.impl.js');
      return mockList({ page, pageSize, status });
    }
    const q = new URLSearchParams({ page, pageSize, ...(status ? { status } : {}) });
    return apiFetch(`/api/Admin/forms?${q.toString()}`, { signal });
  },
  async toggleStatus(formKey, status) {
    if (USE_MOCK) {
      const { mockToggleStatus } = await import('../mock/forms.mock.impl.js');
      return mockToggleStatus(formKey, status);
    }
    return apiFetch(`/api/Forms/${formKey}/status`, { method: 'PATCH', body: { status } });
  },
  async setAccess(formKey, access) {
    if (USE_MOCK) {
      const { mockSetAccess } = await import('../mock/forms.mock.impl.js');
      return mockSetAccess(formKey, access);
    }
    return apiFetch(`/api/Forms/${formKey}/access`, { method: 'PATCH', body: { access } });
  },
  async clone(formKey) {
    if (USE_MOCK) {
      const { mockClone } = await import('../mock/forms.mock.impl.js');
      return mockClone(formKey);
    }
    return apiFetch(`/api/Forms/${formKey}/clone`, { method: 'POST' });
  },
  async remove(formKey) {
    if (USE_MOCK) {
      const { mockDelete } = await import('../mock/forms.mock.impl.js');
      return mockDelete(formKey);
    }
    return apiFetch(`/api/Forms/${formKey}`, { method: 'DELETE' });
  }
};