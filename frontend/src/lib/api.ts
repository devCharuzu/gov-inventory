import axios from "axios";

export const TOKEN_KEY = "token";

export const api = axios.create({
  // Same-origin in the built app; Vite proxies /api during frontend development.
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the bearer token (if any) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear auth state and bounce to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
