import axios, { AxiosHeaders } from "axios";

const DEFAULT_BASE_URL = "http://localhost:8000/api/v1";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;

export const api = axios.create({
    baseURL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers = AxiosHeaders.from(config.headers ?? {});
        config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
});

// Global 401 handler — clear token and redirect to login.
// Skips auth endpoints to avoid redirect loops on bad credentials.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (
            axios.isAxiosError(error) &&
            error.response?.status === 401 &&
            !error.config?.url?.includes("/auth/")
        ) {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);