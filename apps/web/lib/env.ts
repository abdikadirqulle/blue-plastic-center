export const webEnv = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  dataSource: import.meta.env.VITE_DATA_SOURCE ?? "api",
} as const;
