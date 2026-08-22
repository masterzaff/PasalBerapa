import React from "react";
import { ShieldAlert, TriangleAlert, ShieldCheck, Gauge, Lightbulb, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSession } from "@/context/SessionContext";
import EmptyState from "@/components/app/EmptyState";

const LEVEL = {
  high: { label: "Risiko Tinggi", icon: ShieldAlert, cls: "border-[hsl(var(--risk-high))] bg-[hsl(var(--risk-high-bg))]", dot: "bg-[hsl(var(--risk-high))]", text: "text-[hsl(var(--risk-high))]" },
  warning: { label: "Peringatan", icon: TriangleAlert, cls: "border-[hsl(var(--risk-warn))] bg-[hsl(var(--risk-warn-bg))]", dot: "bg-[hsl(var(--risk-warn))]", text: "text-[hsl(var(--risk-warn))]" },
  safe: { label: "Aman", icon: ShieldCheck, cls: "border-[hsl(var(--risk-safe))] bg-[hsl(var(--risk-safe-bg))]", dot: "bg-[hsl(var(--risk-safe))]", text: "text-[hsl(var(--risk-safe))]" },
};

function ScoreRing({ score }) {
  const s = Math.max(0, Math.min(100, score));
  const color = s >= 66 ? "var(--risk-high)" : s >= 33 ? "var(--risk-warn)" : "var(--risk-safe)";
  return (
    <div
      className="relative grid h-16 w-16 place-items-center rounded-full"
      style={{ background: `conic-gradient(hsl(${color}) ${s * 3.6}deg, hsl(var(--muted)) 0deg)` }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-card">
        <span data-testid="risk-score-value" className="font-display text-lg font-semibold">{s}</span>
      </div>
    </div>
  );
}

export default function RiskDashboard() {
  const { risks, riskScore, setHighlightExcerpt } = useSession();

  const counts = risks.reduce(
    (acc, r) => {
      acc[r.level] = (acc[r.level] || 0) + 1;
      return acc;
    },
    { high: 0, warning: 0, safe: 0 }
  );

  return (
    <Card data-testid="risk-dashboard-panel" className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Gauge className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Dashboard Risiko</span>
      </div>

      {risks.length === 0 ? (
        <div className="flex-1 p-4">
          <EmptyState
            icon={ShieldAlert}
            title="Belum ada hasil bedah risiko"
            description="Klik 'Bedah Risiko (Red Flags)' di panel analisis buat munculin poin-poin berisiko di sini."
            testId="risk-empty-state"
          />
        </div>
      ) : (
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-center gap-4 rounded-xl border bg-card p-3">
            {typeof riskScore === "number" && <ScoreRing score={riskScore} />}
            <div className="flex flex-wrap gap-1.5">
              <Badge className="gap-1 bg-[hsl(var(--risk-high-bg))] text-[hsl(var(--risk-high))] hover:bg-[hsl(var(--risk-high-bg))]">
                {counts.high} Tinggi
              </Badge>
              <Badge className="gap-1 bg-[hsl(var(--risk-warn-bg))] text-[hsl(var(--risk-warn))] hover:bg-[hsl(var(--risk-warn-bg))]">
                {counts.warning} Peringatan
              </Badge>
              <Badge className="gap-1 bg-[hsl(var(--risk-safe-bg))] text-[hsl(var(--risk-safe))] hover:bg-[hsl(var(--risk-safe-bg))]">
                {counts.safe} Aman
              </Badge>
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {risks.map((r) => {
              const meta = LEVEL[r.level] || LEVEL.warning;
              const Icon = meta.icon;
              return (
                <AccordionItem
                  key={r.id}
                  value={r.id}
                  data-testid="risk-item-card"
                  className={`overflow-hidden rounded-xl border ${meta.cls}`}
                >
                  <AccordionTrigger
                    onClick={() => r.source_excerpt && setHighlightExcerpt(r.source_excerpt)}
                    className="px-3 py-3 hover:no-underline"
                  >
                    <span className="flex items-start gap-2 text-left">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.text}`} />
                      <span>
                        <span className="block text-sm font-semibold">{r.title}</span>
                        <span className={`text-[11px] font-medium ${meta.text}`}>{meta.label}</span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-3">
                    <p className="text-sm leading-6 text-foreground">{r.explanation}</p>
                    {Array.isArray(r.article_refs) && r.article_refs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.article_refs.map((a, i) => (
                          <span key={i} className="font-mono-plex rounded-md bg-card px-2 py-0.5 text-[11px]">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.suggestion && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-card/70 p-2 text-xs">
                        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{r.suggestion}</span>
                      </div>
                    )}
                    {r.source_excerpt && (
                      <div className="mt-2 flex items-start gap-1.5 border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground">
                        <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>“{r.source_excerpt}”</span>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
    </Card>
  );
}
