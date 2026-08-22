"use client";

import React from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";

export default function ChatPage() {
  const params = useParams();
  const sessionId = params?.sessionId;
  return <AppShell sessionId={sessionId} />;
}
