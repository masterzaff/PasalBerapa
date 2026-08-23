import { Check, Eye, EyeOff } from "lucide-react";
import React from "react";

export default function RedactionDemoCard({ isBisnis }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {isBisnis ? "Simulasi PII Redaction Otomatis (UU PDP)" : "Simulasi Penyamaran Data Otomatis"}
          </span>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          Zero Retention · Disamarkan Otomatis
        </span>
      </div>

      <div className="p-5 sm:p-6 grid gap-5 md:grid-cols-2 items-stretch">
        {/* Sisi Kiri: Yang Anda Lihat */}
        <div className="flex flex-col justify-between rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
              <Eye className="h-4 w-4" />
              <span>Anda Melihat (Data Asli di Layar)</span>
            </div>
            <p className="mt-3 font-mono text-xs sm:text-[13px] leading-relaxed text-foreground/90 bg-background/80 p-3.5 rounded-lg border border-red-500/15 shadow-inner">
              {isBisnis ? (
                <>
                  “PT Solusi Maju (<span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">NPWP: 01.345.678.9-012.000</span>) sepakat membayar total kontrak sebesar <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">Rp 350.000.000</span> via transfer Mandiri <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">137-00-1234567-8</span> a.n. <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">Hendra Wijaya</span>.”
                </>
              ) : (
                <>
                  “Pihak Kedua atas nama <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">Budi Santoso</span> (<span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">NIK: 3171012345670001</span>) menerima gaji bulanan sebesar <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">Rp 12.500.000</span> yang ditransfer ke rekening BCA <span className="bg-red-500/15 text-red-700 dark:text-red-300 px-1 py-0.5 rounded font-semibold">527-123-4567</span>.”
                </>
              )}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            Data rahasia &amp; identitas asli hanya tersimpan di perangkat lokal Anda.
          </p>
        </div>

        {/* Sisi Kanan: Yang Kami / AI Lihat */}
        <div className="flex flex-col justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              <EyeOff className="h-4 w-4" />
              <span>Kami / AI Melihat (Telah Disamarkan)</span>
            </div>
            <p className="mt-3 font-mono text-xs sm:text-[13px] leading-relaxed text-foreground/90 bg-background/80 p-3.5 rounded-lg border border-emerald-500/20 shadow-inner">
              {isBisnis ? (
                <>
                  “PT Solusi Maju (<span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;NOMOR_NPWP&gt;</span>) sepakat membayar total kontrak sebesar <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;NILAI_KONTRAK&gt;</span> via transfer Mandiri <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;NOMOR_REKENING&gt;</span> a.n. <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;DIREKTUR_UTAMA&gt;</span>.”
                </>
              ) : (
                <>
                  “Pihak Kedua atas nama <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;NAMA_LENGKAP&gt;</span> (<span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;NOMOR_NIK&gt;</span>) menerima gaji bulanan sebesar <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;NOMINAL_GAJI&gt;</span> yang ditransfer ke rekening BCA <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-semibold">&lt;NOMOR_REKENING&gt;</span>.”
                </>
              )}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0" />
            AI membedah pasal hukum tanpa pernah menerima data identitas asli Anda.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- PERSONAL MODE CONSTANTS ---
