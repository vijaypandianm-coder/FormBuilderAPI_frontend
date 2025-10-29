// src/routes/learner.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PublishedForms from "../pages/learn/PublishedForms.jsx";
import FillForm from "../pages/learn/FillForm.jsx";
import MySubmissions from "../pages/learn/MySubmissions.jsx";

export default function LearnerRoutes() {
  return (
    <Routes>
      <Route path="/learn" element={<Navigate to="/learn/forms" replace />} />
      <Route path="/learn/forms" element={<PublishedForms />} />
      <Route path="/learn/forms/:formKey" element={<FillForm />} />
      <Route path="/learn/my-submissions" element={<MySubmissions />} />
    </Routes>
  );
}