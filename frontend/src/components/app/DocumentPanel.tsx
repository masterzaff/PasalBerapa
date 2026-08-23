import React, { useMemo, useRef, useState, useEffect } from "react";
import { FileText, Search, Copy, EyeOff, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { TAG_REGEX } from "@/lib/pii";

function renderParagraph(text, search) {
  if (!search) return text;
  try {
    const re = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(re);
    return parts.map((p, i) =>
      re.test(p) ? (
        <mark key={i} className="rounded bg-[hsl(var(--risk-warn-bg))] px-0.5 text-foreground">
          {p}
        </mark>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      )
    );
  } catch (_) {
    return text;
  }
}

function renderMasked(text) {
  const re = new RegExp(TAG_REGEX.source, "g");
  const nodes = [];
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    nodes.push(
      <span key={key++} className="tag-chip mx-0.5 align-baseline">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<span key={key++}>{text.slice(last)}</span>);
  return nodes;
}

export default function DocumentPanel() {
  const { rawText, maskedText, extractInfo, highlightExcerpt } = useSession();
  const [search, setSearch] = useState("");
  // A restored conversation has no rawText (the unmasked original is never
  // persisted), only the masked copy — so there is nothing to un-censor and the
  // toggle must start on, or the panel renders blank.
  const hasRaw = Boolean(rawText && rawText.trim());
  const [showCensored, setShowCensored] = useState(!hasRaw);
  const bodyRef = useRef(null);
  const highlightRef = useRef(null);

  useEffect(() => {
    if (!hasRaw) setShowCensored(true);
  }, [hasRaw]);

  const activeText = (showCensored || !hasRaw) && maskedText ? maskedText : rawText;
  const paragraphs = useMemo(
    () => activeText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [activeText]
  );

  useEffect(() => {
    if (highlightExcerpt && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightExcerpt]);

  const copy = async () => {
    await navigator.clipboard.writeText(activeText);
    toast.success(showCensored ? "Teks tersensor disalin." : "Teks dokumen disalin.");
  };

  const excerptKey = (highlightExcerpt || "").slice(0, 60).toLowerCase();

  return (
    <Card data-testid="document-preview-panel" className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">Teks Dokumen</span>
          {extractInfo && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {extractInfo.totalPages} hlm{extractInfo.usedOcr ? " · OCR" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Nothing to toggle when the original was never stored. */}
          {maskedText && hasRaw && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="toggle-censored-button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCensored((v) => !v)}
                >
                  {showCensored ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showCensored ? "Lihat versi asli" : "Lihat versi tersensor"}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button data-testid="copy-masked-text-button" variant="ghost" size="icon" onClick={copy}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Salin teks</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="document-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari di dokumen…"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div ref={bodyRef} className="scroll-slim min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3 text-sm leading-7">
          {paragraphs.map((p, i) => {
            const isHighlight = excerptKey && p.toLowerCase().includes(excerptKey);
            return (
              <p
                key={i}
                ref={isHighlight ? highlightRef : null}
                className={
                  isHighlight
                    ? "rounded-md bg-[hsl(var(--accent))] p-2 ring-2 ring-primary/60 transition-shadow"
                    : ""
                }
              >
                {showCensored && maskedText ? renderMasked(p) : renderParagraph(p, search)}
              </p>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
