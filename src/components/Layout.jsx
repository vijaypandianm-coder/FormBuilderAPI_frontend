import React from "react";
import Header from "./Header";
import { Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  // hide header on login/register pages
  const hideHeader = ["/login", "/register"].includes(location.pathname);

  return (
    <div>
      {!hideHeader && <Header />}
      <main>
        <Outlet />
      </main>
    </div>
  );
}