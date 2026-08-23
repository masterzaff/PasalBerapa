// Unified navigation helper for CDN / Static export & hash routing support

export interface RouteState {
  sessionId?: string;
  isNewChat: boolean;
  isHome: boolean;
}

export function parseRoute(): RouteState {
  if (typeof window === "undefined") {
    return { sessionId: undefined, isNewChat: false, isHome: true };
  }

  const rawHash = window.location.hash || "";
  const hash = rawHash.replace(/^#\/?/, "").replace(/\/+$/, "").trim();
  const search = new URLSearchParams(window.location.search);
  const cleanPath = window.location.pathname.replace(/\/+$/, "") || "/";

  // 1. Check Hash: #new, #id=123, #chat=123, #/chat/123, #123
  if (hash) {
    if (hash === "new" || hash === "chat/new" || hash === "/chat/new") {
      return { sessionId: undefined, isNewChat: true, isHome: false };
    }
    if (hash.startsWith("id=")) {
      const id = decodeURIComponent(hash.replace(/^id=/, "").replace(/\/+$/, ""));
      return { sessionId: id, isNewChat: false, isHome: false };
    }
    if (hash.startsWith("chat=")) {
      const id = decodeURIComponent(hash.replace(/^chat=/, "").replace(/\/+$/, ""));
      return { sessionId: id, isNewChat: false, isHome: false };
    }
    if (hash.startsWith("chat/")) {
      const id = decodeURIComponent(hash.replace(/^chat\//, "").replace(/\/+$/, ""));
      if (id === "new") return { sessionId: undefined, isNewChat: true, isHome: false };
      if (id && id !== "_") return { sessionId: id, isNewChat: false, isHome: false };
    }
    // Any direct hash identifier like #session_abc
    if (hash && hash !== "_" && !hash.includes("=")) {
      return { sessionId: decodeURIComponent(hash), isNewChat: false, isHome: false };
    }
  }

  // 2. Check Search params: ?id=123 or ?chat=123
  const qId = search.get("id") || search.get("chat") || search.get("sessionId");
  if (qId) {
    const cleanQId = qId.replace(/\/+$/, "");
    if (cleanQId === "new") return { sessionId: undefined, isNewChat: true, isHome: false };
    return { sessionId: cleanQId, isNewChat: false, isHome: false };
  }

  // 3. Check Pathname: /chat/123/ or /chat/new/
  if (cleanPath === "/chat") {
    return { sessionId: undefined, isNewChat: true, isHome: false };
  }
  if (cleanPath.startsWith("/chat/")) {
    const seg = cleanPath.replace(/^\/chat\//, "").split("/")[0].trim();
    if (seg === "new") return { sessionId: undefined, isNewChat: true, isHome: false };
    if (seg && seg !== "_") return { sessionId: decodeURIComponent(seg), isNewChat: false, isHome: false };
  }

  return { sessionId: undefined, isNewChat: false, isHome: true };
}

export function navigateToChat(sessionId: string) {
  if (typeof window === "undefined" || !sessionId) return;
  const hash = `id=${encodeURIComponent(sessionId)}`;
  if (window.location.hash !== `#${hash}`) {
    window.location.hash = hash;
  }
}

export function navigateToNewChat() {
  if (typeof window === "undefined") return;
  if (window.location.hash !== "#new") {
    window.location.hash = "new";
  }
}

export function navigateToHome() {
  if (typeof window === "undefined") return;
  if (window.location.hash) {
    history.pushState("", document.title, window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}
