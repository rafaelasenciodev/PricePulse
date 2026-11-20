import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { createApiClient } from "./api";
import { SessionProvider } from "./session";
import { App } from "./ui/App";
import "./ui/styles.css";

// The page gives its own `fetch` to the client, the only place that makes requests. The addresses are relative,
// so the browser sends the cookie of the Session by itself.
const client = createApiClient({ fetch: window.fetch.bind(window) });

const root = document.getElementById("root");
if (root === null) throw new Error("The page has no element with the id root");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename="/app">
      <SessionProvider client={client}>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
