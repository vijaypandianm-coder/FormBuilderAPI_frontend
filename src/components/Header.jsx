// src/components/Header.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Home from "../assets/Home.png";           // ensure this file exists
import { AuthService } from "../api/auth";       // <-- correct import
import "./Header.css";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const crumbs = (() => {
    const p = location.pathname;
    if (p === "/" || p === "/forms") return ["Form Builder"];
    if (p.startsWith("/create-form")) return ["Form Builder", "Create Form"];
    if (p.startsWith("/preview")) return ["Form Builder", "Preview"];
    return ["Form Builder"];
  })();

  const handleSignOut = () => {
    AuthService.logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="crumb-home" aria-label="Home">
          <img src={Home} alt="Home" />
        </Link>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className={`crumb ${i === crumbs.length - 1 ? "cur" : ""}`}>
              {c}{i < crumbs.length - 1 ? <span className="crumb-sep">›</span> : null}
            </span>
          ))}
        </nav>
      </div>

      <div className="header-right">
        <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
      </div>
    </header>
  );
}