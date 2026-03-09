import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  ) : (
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
);
