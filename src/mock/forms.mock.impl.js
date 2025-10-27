const seed = [
  { id:'f1', formKey: 101, title:'Post-Course Experience',
    meta:[{k:'Published By',v:'Aarav Sharma'},{k:'Published Date',v:'Apr 25, 2025'},{k:'Workflow Usage',v:'25'}],
    status:'Published', hasWorkflowLink:false },
  { id:'f2', formKey: 102, title:'Employee Onboarding',
    meta:[{k:'Published By',v:'Aarav Sharma'},{k:'Published Date',v:'Apr 25, 2025'},{k:'Workflow Usage',v:'21'}],
    status:'Published', hasWorkflowLink:true },
  { id:'f3', formKey: 103, title:'Learning Path Design',
    meta:[{k:'Created By',v:'Ishaan Verma'},{k:'Created Date',v:'Apr 15, 2025'}],
    status:'Draft', hasWorkflowLink:true },
  { id:'f4', formKey: 104, title:'Internal Transfer Request',
    meta:[{k:'Created By',v:'Sanvi Reddy'},{k:'Created Date',v:'May 08, 2025'}],
    status:'Draft' },
  { id:'f5', formKey: 105, title:'Software Requisition',
    meta:[{k:'Published By',v:'Aarav Vimaan Joshi'},{k:'Published Date',v:'May 08, 2025'},{k:'Workflow Usage',v:'06'}],
    status:'Published' },
  { id:'f6', formKey: 106, title:'Resource Access Request',
    meta:[{k:'Published By',v:'Karan Patel'},{k:'Published Date',v:'May 20, 2025'},{k:'Workflow Usage',v:'12'}],
    status:'Published' }
];

let db = [...seed];

export async function mockList({ page, pageSize, status }) {
  let rows = db;
  if (status) rows = rows.filter(r => r.status.toLowerCase() === status.toLowerCase());
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { total, page, pageSize, items: rows.slice(start, start + pageSize) };
}
export async function mockToggleStatus(formKey, status) {
  db = db.map(f => f.formKey === formKey ? { ...f, status } : f);
  return { formKey, status };
}
export async function mockSetAccess(formKey, access) {
  return { formKey, access };
}
export async function mockClone(formKey) {
  const src = db.find(f => f.formKey === formKey);
  const copy = { ...src, id: `copy-${Date.now()}`, formKey: Math.floor(Math.random()*9000)+1000, title: src.title + ' (Copy)' };
  db = [copy, ...db];
  return copy;
}
export async function mockDelete(formKey) {
  db = db.filter(f => f.formKey !== formKey);
  return { formKey };
}