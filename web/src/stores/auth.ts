import axios, { type AxiosInstance } from "axios";

const TOKEN_KEY = "vohub_token";

function readToken() {
  try {
    return (
      localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || ""
    );
  } catch {
    return "";
  }
}

export const api: AxiosInstance = axios.create({ baseURL: "/api" });

let token = readToken();
if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const authStore = {
  getToken: () => token,
  isAuthenticated: () => Boolean(token),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async login(username: string, password: string) {
    const response = await api.post<{ token?: string }>("/auth/login", {
      username,
      password,
    });
    const nextToken = String(response.data?.token || "");
    if (!nextToken) throw new Error("登录响应缺少 token");
    token = nextToken;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem("token");
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    notify();
  },
  logout() {
    token = "";
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
    notify();
  },
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      authStore.logout();
      const current = `${window.location.hash}`.replace(/^#/, "") || "/";
      if (!current.startsWith("/login")) {
        sessionStorage.setItem("post_login_redirect", current);
      }
      window.location.hash = "#/login";
    }
    return Promise.reject(error);
  },
);
