import { getAnonKey } from "@/lib/anonKey";

const API = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "") + "/api";

async function req(path, { method = "GET", body, token, signal } = {}) {
  const anonKey = getAnonKey();
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Ignored server-side once a token resolves to a real user — sent
      // unconditionally so an anonymous conversation stays gated to the
      // browser that created it.
      ...(anonKey ? { "X-Anon-Key": anonKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

export const authApi = {
  // Which KDF this account uses, so the client knows whether to send a derived
  // authSecret (v1) or the raw password (v0, pre-split-KDF accounts).
  authParams: (email) => req(`/auth/params?email=${encodeURIComponent(email)}`),
  register: (b) => req("/auth/register", { method: "POST", body: b }),
  login: (b) => req("/auth/login", { method: "POST", body: b }),
  upgradeKdf: (authSecret, currentPassword, token) =>
    req("/auth/upgrade-kdf", { method: "POST", body: { auth_secret: authSecret, current_password: currentPassword }, token }),
  // Encrypted mappings only, for a client-side key rotation.
  conversationSecrets: (token) => req("/conversations/secrets", { token }),
  changePassword: (b, token) => req("/auth/change-password", { method: "POST", body: b, token }),
  me: (token) => req("/auth/me", { token }),
  listConversations: (token) => req("/conversations", { token }),
  getConversation: (id, token) => req(`/conversations/${id}`, { token }),
  deleteConversation: (id, token) => req(`/conversations/${id}`, { method: "DELETE", token }),
  // Title only — everything else about a conversation changes through the
  // message-action routes below or updateMapping, never a blob PUT here.
  renameConversation: (id, title, token) =>
    req(`/conversations/${id}`, { method: "PATCH", body: { title }, token }),
  // The client only ever ASKS the server to send/edit/regenerate a message —
  // the server appends to / mutates the stored conversation and calls
  // ai_node itself. `convId` is the client-minted session id (the
  // conversation's PK from its first message); the server creates the row
  // on the first call for a given id, ownerless if `token` is absent.
  sendMessage: (convId, b, token, signal) =>
    req(`/conversations/${convId}/messages`, { method: "POST", body: b, token, signal }),
  editMessage: (convId, messageId, b, token, signal) =>
    req(`/conversations/${convId}/messages/${messageId}`, { method: "PATCH", body: b, token, signal }),
  regenerateMessage: (convId, messageId, token, signal) =>
    req(`/conversations/${convId}/messages/${messageId}/regenerate`, { method: "POST", token, signal }),
  // Narrow write for the one thing the server can't compute itself: the
  // client-encrypted PII mapping.
  updateMapping: (convId, b, token) => req(`/conversations/${convId}/mapping`, { method: "PUT", body: b, token }),
  // Thumbs up/down/report on a message. `messageId` is the client-generated
  // msg_xxx id (or the pii_review_<sessionId> sentinel for a HITL report).
  // `token` is optional here — logged-out visitors may react/report too.
  setMessageFeedback: (messageId, b, token) => req(`/messages/${messageId}/feedback`, { method: "PUT", body: b, token }),
  clearMessageFeedback: (messageId, token) => req(`/messages/${messageId}/feedback`, { method: "DELETE", token }),
  getConversationFeedback: (convId, token) => req(`/conversations/${convId}/feedback`, { token }),
};
