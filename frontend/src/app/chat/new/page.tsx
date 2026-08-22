"use client";

import React, { useEffect, useRef } from "react";
import { useSession } from "@/context/SessionContext";
import AppShell from "@/components/app/AppShell";

export default function NewChatPage() {
  const { resetSession, sessionId } = useSession();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      resetSession();
    }
  }, [resetSession]);

  return <AppShell sessionId={sessionId || "new"} isNewChat />;
}
