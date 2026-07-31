import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "../saidy.jsx";

// window.storage mock via localStorage (ersetzt Claude-Artefakt-API)
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
