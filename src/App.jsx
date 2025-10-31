// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React from "react";
import AdminDashboard from "./pages/AdminDashboard";
import CreateForm from "./pages/CreateForm";
import PreviewForm from "./pages/PreviewForm";
import ViewForm from "./pages/ViewForm";                 // admin responses page
import Login from "./pages/Login";
import Register from "./pages/Register";
import LearnerForms from "./pages/LearnerForms";
import MySubmissions from "./pages/MySubmissions";
import MySubmissionDetail from "./pages/MySubmissionDetail";
import FormSubmissionPage from "./pages/FormSubmissionPage"; // learner submit page
import { AuthService } from "./api/auth";
import Layout from "./components/Layout";                   // global header + outlet

function b64urlToStr(b64url) {
  try {
    return atob((b64url || "").replace(/-/g, "+").replace(/_/g, "/"));
  } catch { return ""; }
}

function getRole() {
  try {
    const token = AuthService.getToken?.();
    if (!token) return null;
    const payload = JSON.parse(b64urlToStr(token.split(".")[1]) || "{}");
    return (
      payload?.role ||
      (Array.isArray(payload?.roles) ? payload.roles[0] : payload?.roles) ||
      payload?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      null
    );
  } catch {
    return null;
  }
}

function RoleHome() {
  const role = (getRole() || "").toString();
  if (role.toLowerCase() === "admin") return <AdminDashboard />;
  return <Navigate to="/learn" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RoleHome />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />

          {/* Admin */}
          <Route path="/create-form" element={<CreateForm />} />
          <Route path="/preview" element={<PreviewForm />} />
          <Route path="/admin/forms/:formKey" element={<ViewForm />} />

          {/* Learner */}
          <Route path="/forms/:formKey" element={<FormSubmissionPage />} />
          <Route path="/learn" element={<LearnerForms />} />
          <Route path="/learn/my-submissions" element={<MySubmissions />} />
          <Route path="/learn/submissions/:responseId" element={<MySubmissionDetail />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}