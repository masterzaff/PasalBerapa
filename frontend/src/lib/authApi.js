const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "") + "/api";

async function req(path, { method = "GET", body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

export const authApi = {
  register: (b) => req("/auth/register", { method: "POST", body: b }),
  login: (b) => req("/auth/login", { method: "POST", body: b }),
  me: (token) => req("/auth/me", { token }),
  listConversations: (token) => req("/conversations", { token }),
  saveConversation: (b, token) => req("/conversations", { method: "POST", body: b, token }),
  updateConversation: (id, b, token) => req(`/conversations/${id}`, { method: "PUT", body: b, token }),
  getConversation: (id, token) => req(`/conversations/${id}`, { token }),
  deleteConversation: (id, token) => req(`/conversations/${id}`, { method: "DELETE", token }),
};
