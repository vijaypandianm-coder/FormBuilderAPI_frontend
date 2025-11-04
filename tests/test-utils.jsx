import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// If you truly need AuthContext, leave it; otherwise remove it to avoid coupling.
// import { AuthProvider as RealAuthProvider } from "@src/auth/AuthContext.jsx";

function Providers({ children }) {
  return (
    // <RealAuthProvider>
      <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>
    // </RealAuthProvider>
  );
}

export function renderWithProviders(ui, { 
  skipRouter = false,  // Add this option
  // other options...
  ...renderOptions 
} = {}) {
  function Wrapper({ children }) {
    // Only wrap with Router if skipRouter is false
    return skipRouter ? (
      <Provider store={store}>
        {children}
      </Provider>
    ) : (
      <Provider store={store}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </Provider>
    );
  }
  
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export * from "@testing-library/react";