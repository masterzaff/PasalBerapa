import { Check, Shield, TriangleAlert } from "lucide-react";
import React from "react";

export default function ReviewSimulationCard() {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Simulasi Review: Klausul Denda &amp; Terminasi
          </span>
        </div>
        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">
          Skor Risiko: 85 (Tinggi)
        </span>
      </div>

      <div className="p-5 sm:p-6 grid gap-5 md:grid-cols-2 items-stretch">
        {/* Sisi Kiri: Klausul Asli */}
        <div className="flex flex-col justify-between rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
              <TriangleAlert className="h-4 w-4" />
              <span>Klausul Asli pada Draf Kontrak</span>
            </div>
            <div className="mt-3 rounded-lg bg-background/80 p-3.5 border border-red-500/15 shadow-inner text-xs sm:text-[13px] leading-relaxed text-foreground/90 font-mono">
              <p className="text-[11px] font-sans font-medium text-muted-foreground mb-1.5">Pasal 7 (Denda Keterlambatan):</p>
              <p>
                “Pihak Kedua wajib membayar ganti rugi <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">100% dari total nilai proyek</span> secara tunai dalam waktu <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">24 jam</span> jika terjadi keterlambatan tanpa klausul force majeure.”
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            Penalti tidak proporsional &amp; meniadakan hak keadaan memaksa.
          </p>
        </div>

        {/* Sisi Kanan: Bedah & Solusi AI */}
        <div className="flex flex-col justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              <Shield className="h-4 w-4" />
              <span>Bedah Risiko &amp; Solusi AI</span>
            </div>
            <div className="mt-3 space-y-2 text-xs sm:text-[12px] leading-relaxed">
              <div className="rounded-lg bg-background/80 p-2.5 border border-emerald-500/15 shadow-inner">
                <p className="font-semibold text-foreground">⚠️ Risiko Berat Sebelah</p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">Denda 100% melanggar azas proporsionalitas &amp; itikad baik berkontrak.</p>
              </div>

              <div className="rounded-lg bg-background/80 p-2.5 border border-emerald-500/15 shadow-inner text-[11px]">
                <p className="font-semibold text-foreground">⚖️ Rujukan: Pasal 1244–1245 KUHPerdata</p>
                <p className="text-muted-foreground mt-0.5">Ganti rugi wajib mengecualikan keadaan memaksa (*overmacht*).</p>
              </div>

              <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-emerald-800 dark:text-emerald-300">
                <p className="font-semibold">💡 Rekomendasi Revisi (Redline)</p>
                <p className="mt-0.5 text-[11px]">Usulkan batas ganti rugi <strong>maks. 10%</strong> + tambahkan <strong>masa tenggang 7 hari</strong>.</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0" />
            AI memberikan pasal rujukan &amp; klausul penyeimbang otomatis.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- REDACTION COMPARISON DEMO CARD ---
