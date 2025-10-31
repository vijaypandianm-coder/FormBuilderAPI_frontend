import React from "react";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// If you have a real AuthContext, import it:
import { AuthProvider as RealAuthProvider } from "@src/auth/AuthContext.jsx";

function Providers({ children }) {
  return (
    <RealAuthProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </RealAuthProvider>
  );
}

export function renderWithProviders(ui, options) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";