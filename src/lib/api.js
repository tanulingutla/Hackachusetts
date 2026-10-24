// Single place for talking to the API server. Sessions are HttpOnly cookies,
// so this code never reads or stores a token.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, csv } = {}) {
  const headers = {};
  let payload;
  if (csv !== undefined) {
    headers["content-type"] = "text/csv";
    payload = csv;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Can't reach the server. Start it with npm run api.");
  }

  const data = await res.json().catch(() => ({}));

  // Login and signup return 401 for bad credentials, which is not an expired session.
  const isAuthCall = path === "/login" || path === "/signup";
  if (res.status === 401 && !isAuthCall) {
    window.dispatchEvent(new Event("session-expired"));
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data;
}
