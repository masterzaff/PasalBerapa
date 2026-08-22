import React from "react";
import { motion } from "framer-motion";
import { Lock, ScanSearch, ShieldAlert, Sparkles, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import UploadDropzone from "@/components/app/UploadDropzone";
import { useConnection } from "@/context/ConnectionContext";

const TRUST = [
  { icon: Lock, title: "Privacy-first", desc: "Data sensitif dimasking dulu sebelum dikirim ke AI." },
  { icon: ScanSearch, title: "Baca PDF & scan", desc: "Teks maupun hasil scan (OCR) langsung di browser kamu." },
  { icon: ShieldAlert, title: "Bongkar Red Flags", desc: "Nemuin pasal yang berpotensi ngerugiin kamu." },
];

export default function HeroUpload({ onOpenSettings }) {
  const { status } = useConnection();
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 hero-mist" aria-hidden />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-8 px-4 py-10 md:grid-cols-2 md:px-6 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Asisten hukum yang ngomong manusiawi
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Bingung isi kontrak?
            <br />
            <span className="text-primary">Kita jelasin kayak ke anak SMP.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Upload dokumen legal-mu. PasalBerapa? bakal nyamarin data pribadi, bedah
            risikonya, ringkas isinya, dan jelasin pasal-pasal pentingnya — pakai bahasa
            sehari-hari tapi tetap akurat.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.title} className="rounded-xl border bg-card p-3">
                <t.icon className="h-5 w-5 text-primary" />
                <p className="mt-2 text-sm font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>

          {status !== "connected" && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-[hsl(var(--risk-warn))]/40 bg-[hsl(var(--risk-warn-bg))] p-3">
              <Server className="mt-0.5 h-4 w-4 text-[hsl(var(--risk-warn))]" />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold">Server AI belum tersambung.</p>
                <p className="text-muted-foreground">
                  Kamu tetap bisa upload & baca dokumen sekarang. Buat analisis AI &
                  masking, sambungkan endpoint di{" "}
                  <button onClick={onOpenSettings} className="font-semibold text-primary underline">
                    Settings
                  </button>
                  .
                </p>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <UploadDropzone />
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Semua ekstraksi PDF berjalan di perangkatmu. Nggak ada file yang diunggah
            sampai kamu klik analisis.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
