"use client";

import React from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";

export default function ChatPage() {
  const params = useParams();
  const rawId = params?.sessionId;
  const sessionId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  return <AppShell sessionId={sessionId} />;
}
