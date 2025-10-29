// src/components/PrivateRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthService } from "../api/auth";

export default function PrivateRoute() {
  const authed = AuthService.isAuthenticated();
  return authed ? <Outlet /> : <Navigate to="/login" replace />;
}