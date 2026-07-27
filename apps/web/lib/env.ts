export const webEnv = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  apiToken: import.meta.env.VITE_API_TOKEN ?? "admin-demo-token",
  dataSource: import.meta.env.VITE_DATA_SOURCE ?? "mock",
} as const;
