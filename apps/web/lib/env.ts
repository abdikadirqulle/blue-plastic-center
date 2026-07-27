const developmentApiUrl =
  typeof window === "undefined"
    ? "http://localhost:4000"
    : `${window.location.protocol}//${window.location.hostname}:4000`

export const webEnv = {
  apiUrl:
    import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? developmentApiUrl : "/api"),
  dataSource: import.meta.env.VITE_DATA_SOURCE ?? "api",
} as const;
