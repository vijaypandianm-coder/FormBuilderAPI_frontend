import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";   // <-- you already have this
import CreateForm from "./pages/CreateForm";            // <-- your CreateForm.jsx
import PreviewForm from "./pages/PreviewForm";          // <-- new file below
import React from "react";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Land on the Form List (AdminDashboard) */}
        <Route path="/" element={<AdminDashboard />} />

        {/* Create & Preview */}
        <Route path="/create-form" element={<CreateForm />} />
        <Route path="/preview" element={<PreviewForm />} />

        {/* Anything unknown -> Form List */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}