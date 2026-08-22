"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/context/SessionContext";
import { AuthProvider } from "@/context/AuthContext";
import { ConnectionProvider } from "@/context/ConnectionContext";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { UIProvider } from "@/context/UIContext";

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AuthProvider>
          <ConnectionProvider>
            <AnalysisProvider>
              <UIProvider>
                <TooltipProvider delayDuration={150}>
                  {children}
                </TooltipProvider>
              </UIProvider>
            </AnalysisProvider>
          </ConnectionProvider>
        </AuthProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
