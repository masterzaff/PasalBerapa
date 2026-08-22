import React from "react";
import { Gavel, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@/context/SessionContext";

export default function TopBar() {
  const { resetSession, hasDocument } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <Gavel className="h-6 w-6 -rotate-12 text-primary" />
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight md:text-xl">
              PasalBerapa?
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground md:inline-flex">
            Data nggak disimpen · refresh = hilang
          </span>
          {hasDocument && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="reset-session-button" variant="outline" size="sm" onClick={resetSession} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline">Sesi baru</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mulai lagi dengan dokumen baru</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
}
