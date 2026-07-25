export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (message = "Record not found") => new ApiError(404, "NOT_FOUND", message);
export const forbidden = (message = "You do not have permission to perform this action") => new ApiError(403, "FORBIDDEN", message);
export const conflict = (message: string) => new ApiError(409, "CONFLICT", message);
export const validation = (message: string, details?: unknown) => new ApiError(422, "VALIDATION_ERROR", message, details);
