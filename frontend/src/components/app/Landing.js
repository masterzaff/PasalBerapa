import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Shield, ScanText, TriangleAlert, UploadCloud, Loader2,
  Briefcase, Home, FileLock2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import ChatComposer from "@/components/app/ChatComposer";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";

const TRUST = [
  { icon: Shield, title: "Privasi dulu, no login", desc: "Dokumen kamu nggak disimpen. Refresh = hilang.", color: "var(--vault)" },
  { icon: ScanText, title: "Bisa baca hasil scan", desc: "PDF foto/scan tetap kebaca lewat OCR.", color: "var(--primary)" },
  { icon: TriangleAlert, title: "Bongkar red flags", desc: "Pasal berisiko ditandai & dijelasin simpel.", color: "var(--risk-warn)" },
];

const EXAMPLES = [
  { icon: Briefcase, name: "Kontrak Kerja", desc: "PKWT, denda resign, pasal lembur", file: "kontrak_kerja.pdf", slug: "kontrak-kerja", rot: "-1.4deg" },
  { icon: Home, name: "Perjanjian Sewa", desc: "Sewa rumah, deposit bisa hangus", file: "perjanjian_sewa.pdf", slug: "perjanjian-sewa", rot: "1deg" },
  { icon: FileLock2, name: "NDA / Kerahasiaan", desc: "Sanksi besar, berlaku selamanya", file: "nda.pdf", slug: "nda", rot: "-0.6deg" },
];

const QUESTIONS = [
  { q: "Apa itu wanprestasi?", slug: "wanprestasi" },
  { q: "Bedanya PKWT sama PKWTT?", slug: "pkwt" },
  { q: "Deposit sewa boleh hangus nggak?", slug: "deposit" },
  { q: "Aku boleh resign kapan aja?", slug: "resign" },
];

const FLOAT_TAGS = [
  { t: "<NAMA_ORANG>", cls: "right-[2%] top-[3%]", d: 0 },
  { t: "<NOMINAL>", cls: "right-[6%] top-[40%]", d: 0.8 },
  { t: "<TANGGAL>", cls: "right-[1%] top-[64%]", d: 1.4 },
];

export default function Landing() {
  const { uploadFile, busy, progress } = useDocumentUpload();
  const [dragging, setDragging] = useState(false);
  const [seed, setSeed] = useState(null);
  const depth = useRef(0);

  useEffect(() => {
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    const onOver = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const onEnter = (e) => { if (hasFiles(e)) { depth.current += 1; setDragging(true); } };
    const onLeave = () => { depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false); };
    const onDrop = async (e) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await uploadFile(f);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [uploadFile]);

  const loadSample = async (file) => {
    if (busy) return;
    try {
      const res = await fetch(`${process.env.PUBLIC_URL || ""}/samples/${file}`);
      if (!res.ok) throw new Error("not found");
      const blob = await res.blob();
      await uploadFile(new File([blob], file, { type: "application/pdf" }));
    } catch (e) {
      toast.error("Gagal memuat contoh.");
    }
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 hero-mist" aria-hidden />

      <AnimatePresence>
        {dragging && (
          <motion.div
            data-testid="pdf-dropzone-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
          >
            <div className="mx-auto mt-28 max-w-xl rounded-3xl border-2 border-dashed border-primary/50 bg-card/80 p-10 text-center shadow-lg">
              <UploadCloud className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-2xl font-semibold">Lepasin PDF di sini</p>
              <p className="mt-1 text-sm text-muted-foreground">Tenang, dokumen kamu nggak disimpen.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-8 sm:px-6 lg:px-10 lg:pt-14">
        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* LEFT LANE */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative lg:col-span-7"
          >
            {/* floating entity tags */}
            {FLOAT_TAGS.map((f) => (
              <motion.span
                key={f.t}
                className={`tag-chip pointer-events-none absolute hidden opacity-70 lg:block ${f.cls}`}
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 5 + f.d, repeat: Infinity, ease: "easeInOut", delay: f.d }}
              >
                {f.t}
              </motion.span>
            ))}

            <h1 className="mt-2 font-display text-[2.7rem] font-semibold leading-[1.03] tracking-tight sm:text-6xl">
              Urusan hukum,
              <br />
              dijelasin kayak{" "}
              <span className="marker-underline">ngobrol.</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-base leading-7 text-muted-foreground">
              Kontrak, perjanjian, surat, atau sekadar penasaran soal hak kamu — tanya
              pakai bahasa sehari-hari. Mau lebih dalam? Lampirin PDF-nya, nanti kita
              bedah pasal penting &amp; red flags-nya. Tanpa login, tanpa nyimpen dokumen.
            </p>

            {/* Spotlight composer */}
            <div className="relative mt-7">
              <div className="absolute -left-2 -top-3 -z-10 h-3 w-40 rounded-full bg-foreground/10" aria-hidden />
              <div className="absolute -right-1 top-6 -z-10 h-3 w-28 rounded-full bg-primary/15" aria-hidden />
              <div className="absolute -bottom-3 left-10 -z-10 h-3 w-36 rounded-full bg-foreground/[0.07]" aria-hidden />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="paper-grain relative overflow-hidden rounded-[calc(var(--radius)+0.35rem)] border bg-card/85 p-3 shadow-[0_18px_50px_-30px_hsl(var(--foreground)/0.35)] backdrop-blur-sm"
              >
                <ChatComposer variant="hero" seed={seed} />
              </motion.div>
            </div>

            {busy && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                {progress?.message || "Membaca contoh…"}
              </div>
            )}

            {/* Question chips — marquee berjalan */}
            <div className="marquee-pause mt-5">
              <div className="marquee-mask overflow-hidden">
                <div className="animate-marquee flex w-max gap-2 py-1">
                  {[...QUESTIONS, ...QUESTIONS].map((item, i) => (
                    <button
                      key={`${item.slug}-${i}`}
                      data-testid={`example-question-${item.slug}-chip`}
                      onClick={() => setSeed({ text: item.q, id: Date.now() })}
                      className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:bg-accent sm:text-sm"
                    >
                      “{item.q}”
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT PROOF LANE */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="lg:col-span-5 lg:mt-12"
          >
            <div className="rounded-2xl border bg-card/70 p-4 backdrop-blur-sm">
              <p className="mb-3 font-mono-plex text-[11px] uppercase tracking-wide text-muted-foreground">
                Kenapa aman dipakai
              </p>
              <div className="space-y-3">
                {TRUST.map((t) => (
                  <div key={t.title} className="flex items-start gap-3">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{ background: `hsl(${t.color} / 0.12)`, color: `hsl(${t.color})` }}
                    >
                      <t.icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <p className="mb-3 font-mono-plex text-[11px] uppercase tracking-wide text-muted-foreground">
                Atau bedah dokumen contoh
              </p>
              <div className="grid gap-3">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.file}
                  data-testid={`example-${ex.slug}-button`}
                  disabled={busy}
                  onClick={() => loadSample(ex.file)}
                  style={{ transform: `rotate(${ex.rot})` }}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:rotate-0 hover:border-primary/40 hover:shadow-[0_18px_40px_-28px_hsl(var(--foreground)/0.35)] disabled:opacity-50"
                >
                  <div className="absolute left-3.5 top-3 h-2 w-14 rounded-full bg-foreground/10" aria-hidden />
                  <div className="mt-3 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                    <ex.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 min-w-0">
                    <div className="font-display text-base font-semibold">{ex.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{ex.desc}</div>
                  </div>
                  <ArrowRight className="ml-auto mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* HOW IT WORKS STRIP */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-16 rounded-2xl border bg-card/60 p-4 backdrop-blur-sm sm:p-6"
        >
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { n: "01", title: "Tanya atau lampirin", desc: "Ketik pertanyaan hukum, atau tarik & lepas PDF-nya." },
              { n: "02", title: "Pakai bahasa kamu", desc: "Nggak perlu istilah hukum yang ribet." },
              { n: "03", title: "Dapet jawaban + pasal", desc: "Kalau ada dokumen, kita tunjukin bagiannya." },
            ].map((st, i) => (
              <div key={st.n} className="flex items-start gap-3">
                <span className="font-mono-plex text-lg font-semibold text-primary">{st.n}</span>
                <div>
                  <p className="text-sm font-semibold">{st.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
