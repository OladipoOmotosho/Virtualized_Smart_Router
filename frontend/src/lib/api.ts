const BASE_URL = "/api";

function friendlyStatusMessage(status: number): string {
  if (status >= 500) return "Server error — please try again in a moment.";
  if (status === 404) return "Not found.";
  if (status === 401 || status === 403) return "You're not authorized to do that.";
  if (status === 408 || status === 504) return "The server took too long to respond.";
  if (status === 429) return "Too many requests — slow down and try again.";
  if (status >= 400) return "The request was invalid.";
  return `Unexpected response (HTTP ${status}).`;
}

function formatErrorDetail(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const location = Array.isArray(record.loc)
            ? record.loc.join(".")
            : null;
          const message =
            typeof record.msg === "string"
              ? record.msg
              : JSON.stringify(record);
          return location ? `${location}: ${message}` : message;
        }

        return String(item);
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }

  // FastAPI returned no detail (common on 500 / unhandled exceptions) — fall
  // back to a user-friendly message based on the status code.
  return friendlyStatusMessage(status);
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    throw new ApiError(
      0,
      "Cannot reach the server — check that the backend is running.",
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      formatErrorDetail(body.detail, res.status),
    );
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiError };
