import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Briefcase, Building2, Check, CheckCircle2, ChevronDown, Clock, Coins, FileLock2, FileSpreadsheet, Home, Loader2, Lock, ScanText, Server, Shield, Sparkles, TriangleAlert, UploadCloud, Users } from "lucide-react";
import { toast } from "sonner";
import ChatComposer from "@/components/app/ChatComposer";
import GlitchingTagChip from "@/components/app/landing/GlitchingTagChip";
import ReviewSimulationCard from "@/components/app/landing/ReviewSimulationCard";
import RedactionDemoCard from "@/components/app/landing/RedactionDemoCard";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { navigateToChat } from "@/lib/navigation";

// --- GLITCHING REDACT CHIP COMPONENT ---
const PERSONAL_TRUST = [
  { icon: Shield, title: "Privasi dulu, no login", desc: "Dokumen kamu nggak disimpen. Refresh = hilang.", color: "var(--vault)" },
  { icon: ScanText, title: "Bisa baca hasil scan", desc: "PDF foto/scan tetap kebaca lewat OCR di browser kamu.", color: "var(--primary)" },
  { icon: TriangleAlert, title: "Bongkar red flags", desc: "Pasal berisiko ditandai & dijelasin simpel.", color: "var(--risk-warn)" },
];

const PERSONAL_QUESTIONS = [
  { q: "Apa itu wanprestasi?", slug: "wanprestasi" },
  { q: "Bedanya PKWT sama PKWTT?", slug: "pkwt" },
  { q: "Deposit sewa boleh hangus nggak?", slug: "deposit" },
  { q: "Aku boleh resign kapan aja?", slug: "resign" },
];

const PERSONAL_STEPS = [
  { n: "01", title: "Tanya atau lampirin", desc: "Ketik pertanyaan hukum, atau tarik & lepas PDF-nya." },
  { n: "02", title: "Pakai bahasa kamu", desc: "Nggak perlu istilah hukum yang ribet." },
  { n: "03", title: "Dapet jawaban + pasal", desc: "Kalau ada dokumen, kita tunjukin bagiannya." },
];

const PERSONAL_FLOAT_TAGS = [
  { original: "Budi Santoso, S.Kom", redacted: "<NAMA_LENGKAP>", cls: "-left-6 lg:-left-16 top-[10%]", d: 0 },
  { original: "3171012345670001", redacted: "<NOMOR_NIK>", cls: "-right-6 lg:-right-16 top-[6%]", d: 0.9 },
  { original: "Gaji: Rp 8.500.000/bln", redacted: "<NOMINAL_GAJI>", cls: "-right-4 lg:-right-12 bottom-[14%]", d: 1.6 },
  { original: "0812-3456-7890", redacted: "<NOMOR_HP>", cls: "-left-4 lg:-left-12 bottom-[12%]", d: 2.3 },
];

// --- BUSINESS MODE CONSTANTS ---
const BUSINESS_METRICS = [
  {
    icon: Clock,
    val: "< 30 Detik",
    label: "Review Kontrak Instan",
    desc: "Pangkas waktu negosiasi & legal review dari 3-5 hari jadi hitungan detik.",
    color: "var(--primary)",
  },
  {
    icon: Coins,
    val: "Hemat 85%",
    label: "Efisiensi Biaya Legal",
    desc: "Cegah ketergantungan retainer pengacara mahal untuk review dokumen rutin.",
    color: "var(--vault)",
  },
  {
    icon: Lock,
    val: "100% Aman",
    label: "UU PDP & Privacy-First",
    desc: "PII Redaction Layer: NIK, NPWP, nilai kontrak, nama & rekening disamarkan sebelum ke AI.",
    color: "var(--risk-safe)",
  },
  {
    icon: Sparkles,
    val: "RAG Terverifikasi",
    label: "Rujukan Regulasi Resmi",
    desc: "Didukung basis data hukum KUHPerdata, UU Ketenagakerjaan/Ciptaker, & UU ITE.",
    color: "var(--risk-warn)",
  },
];

const BUSINESS_QUESTIONS = [
  { q: "Ada klausul denda/penalti sepihak yang merugikan?", slug: "denda-sepihak" },
  { q: "Apakah PKWT ini sesuai aturan UU Cipta Kerja?", slug: "pkwt" },
  { q: "Bagaimana batasan liabilitas (liability cap) di kontrak ini?", slug: "liabilitas" },
  { q: "Siapa pemegang hak kekayaan intelektual (IP)?", slug: "hak-ip" },
  { q: "Apa saja syarat pemutusan sewa atau terminasi kerja sama?", slug: "terminasi" },
];

const BUSINESS_SEGMENTS = [
  {
    icon: Building2,
    title: "UMKM & Startup Founders",
    tagline: "Proteksi Bisnis dari Klausul Jebakan",
    points: [
      "Review kontrak vendor & kemitraan sebelum tanda tangan.",
      "Deteksi penalti keterlambatan sepihak & terminasi memberatkan.",
      "Hemat jutaan rupiah biaya konsultasi hukum di tahap awal bisnis.",
    ],
  },
  {
    icon: Users,
    title: "HR & People Operations",
    tagline: "Kepatuhan Regulasi Ketenagakerjaan",
    points: [
      "Audit klausul PKWT / PKWTT sesuai UU Cipta Kerja.",
      "Pastikan hak kompensasi, jam kerja, & uang pesangon sesuai aturan.",
      "Cegah risiko sengketa hubungan industrial sejak awal.",
    ],
  },
  {
    icon: FileSpreadsheet,
    title: "Procurement & B2B Sales",
    tagline: "Percepat Closing & Negosiasi Deal",
    points: [
      "Percepat deal cycle tanpa menunggu antrian review legal berminggu-minggu.",
      "Audit Service Level Agreement (SLA) & batasan tanggung jawab hukum.",
      "Standarisasi tinjauan B2B NDA untuk keamanan aset data perusahaan.",
    ],
  },
];

const PRICING_TIERS = [
  {
    name: "Gratis",
    price: "Rp 0",
    period: "Akses Awal",
    desc: "Akses penuh fitur audit kontrak, deteksi risiko red flags, dan konsultasi pasal hukum.",
    features: [
      "Review & audit kontrak dokumen PDF",
      "Deteksi red flags & kalkulasi skor risiko",
      "Penyamaran PII 100% di browser (E2EE)",
      "Rujukan pasal hukum & regulasi Indonesia",
      "Mode percakapan & ringkasan otomatis",
    ],
    cta: "Mulai Gratis",
    popular: true,
    comingSoon: false,
    badge: "Akses Awal",
  },
  {
    name: "Pro & Bisnis",
    price: "Coming Soon",
    period: "Paket Berlangganan",
    desc: "Didesain untuk UMKM, startup, dan tim yang membutuhkan kolaborasi & fitur lanjutan.",
    features: [
      "Percakapan multi-turn tanpa batas",
      "Ekspor laporan PDF & rekomendasi redline",
      "Workspace tim & manajemen kontrak",
      "Prioritas latency AI Node & integrasi API",
      "Dukungan custom peraturan internal",
    ],
    cta: "Segera Hadir",
    popular: false,
    comingSoon: true,
    badge: "Coming Soon",
  },
];

const BUSINESS_FLOAT_TAGS = [
  { original: "Rp 250.000.000 (DP 30%)", redacted: "<NILAI_TRANSAKSI>", cls: "-left-6 lg:-left-16 top-[10%]", d: 0 },
  { original: "01.345.678.9-012.000", redacted: "<NOMOR_NPWP>", cls: "-right-6 lg:-right-16 top-[6%]", d: 0.8 },
  { original: "PT Solusi Digital Bersama", redacted: "<NAMA_KORPORAT>", cls: "-left-4 lg:-left-14 bottom-[12%]", d: 1.4 },
  { original: "Denda: 2% per hari kalender", redacted: "<KLAUSUL_DENDA>", cls: "-right-4 lg:-right-14 bottom-[14%]", d: 2.1 },
];

const EXAMPLES = [
  {
    icon: Briefcase,
    name: "Kontrak Kerja",
    file: "kontrak_kerja.pdf",
    slug: "kontrak-kerja",
  },
  {
    icon: Home,
    name: "Perjanjian Sewa",
    file: "perjanjian_sewa.pdf",
    slug: "perjanjian-sewa",
  },
  {
    icon: FileLock2,
    name: "NDA / Kerahasiaan",
    file: "nda.pdf",
    slug: "nda",
  },
];

export default function Landing({ onOpenAuth }) {
  const { uploadFile, busy, progress } = useDocumentUpload();
  const { audienceMode } = useUI();
  const { resetSession } = useSession();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [seed, setSeed] = useState(null);
  const depth = useRef(0);

  // A successful upload has to take you into the chat. Dropping a PDF (or
  // clicking a sample) used to load it silently and leave you on the landing
  // page, with the only hint being a chip in the composer.
  //
  // resetSession() FIRST, always: Landing is reachable while a previous
  // conversation is still sitting in SessionContext (going "home" doesn't
  // clear it), so without this a sample/dropped PDF would attach itself to
  // whatever stale sessionId/convId/messages were left over and silently
  // append onto that old conversation instead of starting a new one.
  const ingest = useCallback(
    async (f) => {
      const id = resetSession();
      const ok = await uploadFile(f);
      if (ok) {
        navigateToChat(id);
      }
      return ok;
    },
    [uploadFile, resetSession]
  );

  const isBisnis = audienceMode === "bisnis";
  const activeQuestions = isBisnis ? BUSINESS_QUESTIONS : PERSONAL_QUESTIONS;
  const activeFloatTags = isBisnis ? BUSINESS_FLOAT_TAGS : PERSONAL_FLOAT_TAGS;

  useEffect(() => {
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    const onOver = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const onEnter = (e) => { if (hasFiles(e)) { depth.current += 1; setDragging(true); } };
    const onLeave = () => { depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false); };
    const onDrop = async (e) => {
      e.preventDefault(); depth.current = 0; setDragging(false);
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await ingest(f);
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
  }, [ingest]);

  const loadSample = async (file) => {
    if (busy) return;
    try {
      const res = await fetch(`/samples/${file}`);
      if (!res.ok) throw new Error("not found");
      const blob = await res.blob();
      await ingest(new File([blob], file, { type: "application/pdf" }));
    } catch (e) {
      toast.error("Gagal memuat contoh.");
    }
  };

  const MIXED = [];
  const maxLen = Math.max(activeQuestions.length, EXAMPLES.length);
  for (let i = 0; i < maxLen; i++) {
    if (activeQuestions[i]) MIXED.push({ type: "q", ...activeQuestions[i] });
    if (EXAMPLES[i]) MIXED.push({ type: "doc", ...EXAMPLES[i] });
  }

  const renderItem = (item, i) => {
    if (item.type === "doc") {
      const Icon = item.icon;
      return (
        <button
          key={`d-${item.slug}-${i}`} data-testid={`example-${item.slug}-button`} disabled={busy}
          onClick={() => loadSample(item.file)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/30 bg-accent/60 px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:border-primary hover:bg-accent disabled:opacity-50 sm:text-sm"
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          {item.name}
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">+PDF</span>
        </button>
      );
    }
    return (
      <button
        key={`q-${item.slug}-${i}`} data-testid={`example-question-${item.slug}-chip`}
        onClick={() => setSeed({ text: item.q, id: Date.now() })}
        className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:bg-accent sm:text-sm"
      >
        “{item.q}”
      </button>
    );
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <AnimatePresence>
        {dragging && (
          <motion.div
            data-testid="pdf-dropzone-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
          >
            <div className="mx-auto mt-28 max-w-xl rounded-3xl border-2 border-dashed border-primary/50 bg-card/80 p-10 text-center shadow-lg">
              <UploadCloud className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-2xl font-semibold">
                {isBisnis ? "Lepaskan PDF/Foto Kontrak Bisnis di Sini" : "Lepasin PDF atau foto dokumen di sini"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isBisnis
                  ? "Privasi terjamin — data sensitif disamarkan otomatis sebelum dianalisis AI (UU PDP)."
                  : "Tenang, dokumen kamu nggak disimpen."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO SECTION */}
      <section className="relative flex min-h-[calc(100dvh-57px)] flex-col justify-center px-4 py-10 sm:px-6">
        <div className="pointer-events-none absolute inset-0 hero-mist" aria-hidden />

        <div className="relative mx-auto w-full max-w-4xl text-center">

          {/* Ambient floating chips */}
          {activeFloatTags.map((f, i) => (
            <GlitchingTagChip
              key={`${audienceMode}-${f.original}-${i}`}
              original={f.original}
              redacted={f.redacted}
              cls={f.cls}
              delay={f.d}
            />
          ))}

          {/* Top Trust Badge for Business Mode */}
          {isBisnis && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative z-10 mb-4 inline-flex items-center justify-center gap-2 rounded-full border border-primary/25 bg-accent/50 px-3.5 py-1.5 text-xs font-semibold text-accent-foreground backdrop-blur-sm leading-none"
            >
              <Shield className="h-3.5 w-3.5 text-primary shrink-0 self-center" />
              <span className="leading-none self-center">AI Legal Risk Platform untuk Bisnis &amp; UMKM</span>
            </motion.div>
          )}

          <motion.div
            key={audienceMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-10"
          >
            {isBisnis ? (
              <>
                <h1 className="font-display text-[2.2rem] sm:text-[2.75rem] lg:text-[3.5rem] font-semibold leading-[1.12] tracking-tight text-balance">
                  Review Kontrak Bisnis{" "}
                  <span className="whitespace-nowrap">10x Lebih Cepat.</span>{" "}
                  <span className="marker-underline whitespace-nowrap">100% Data Terlindungi.</span>
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Bedah klausul penalti sepihak, red flags, dan pasal berisiko pada <strong>PKWT, Vendor Agreement, NDA, &amp; Sewa Ruko</strong> secara instan. Tanpa biaya retainer jutaan rupiah, dengan proteksi data pribadi berbasis client-side masking.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display text-[2.7rem] font-semibold leading-[1.03] tracking-tight sm:text-6xl">
                  Urusan hukum, dijelasin<br className="hidden sm:block" /> kayak <span className="marker-underline">ngobrol.</span>
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                  Kontrak, perjanjian, surat, atau sekadar penasaran soal hak kamu — tanya pakai
                  bahasa sehari-hari. Mau lebih dalam? Lampirin PDF-nya, nanti kita bedah pasal
                  penting &amp; red flags-nya. Tanpa login, tanpa nyimpen dokumen.
                </p>
              </>
            )}
          </motion.div>

          {/* Interactive Hero Composer */}
          <div className="relative z-10 mx-auto mt-8 max-w-2xl">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, delay: 0.1 }}
              className="paper-grain relative overflow-hidden rounded-[calc(var(--radius)+0.35rem)] border bg-card/90 p-3 text-left shadow-[0_18px_50px_-30px_hsl(var(--foreground)/0.35)] backdrop-blur-md"
            >
              <ChatComposer variant="hero" seed={seed} onOpenAuth={onOpenAuth} />
            </motion.div>
          </div>

          {busy && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> {progress?.message || "Membaca contoh…"}
            </div>
          )}

          {/* Interactive Marquee */}
          <div className="marquee-pause mt-8">
            <div className="marquee-mask overflow-hidden">
              <div className="animate-marquee flex w-max gap-2.5 py-1">
                {[...MIXED, ...MIXED].map((item, i) => renderItem(item, i))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-10 flex justify-center">
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="flex flex-col items-center gap-1 text-muted-foreground">
            <span className="text-[11px]">
              {isBisnis ? "Scroll untuk analisis dampak bisnis & keamanan" : "Scroll buat lihat cara kerjanya"}
            </span>
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </section>

      {/* BELOW THE FOLD */}
      {isBisnis ? (
        /* --- BUSINESS IMPACT BELOW THE FOLD --- */
        <>
          {/* SECTION 1: BUSINESS IMPACT & ROI METRICS */}
          <section className="border-t bg-card/60 py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  Dampak Terukur untuk Operasional &amp; Finansial Bisnis
                </h2>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                  Menghilangkan hambatan birokrasi hukum, menghemat anggaran, dan mengamankan kepatuhan regulasi.
                </p>
              </div>

              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {BUSINESS_METRICS.map((m, idx) => (
                  <motion.div
                    key={m.label}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="relative rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className="grid h-12 w-12 place-items-center rounded-xl"
                      style={{ background: `hsl(${m.color} / 0.12)`, color: `hsl(${m.color})` }}
                    >
                      <m.icon className="h-6 w-6" />
                    </div>
                    <div className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
                      {m.val}
                    </div>
                    <p className="mt-1 font-semibold text-sm text-foreground">{m.label}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 2: BUSINESS USE CASES / WHO IT'S FOR */}
          <section className="border-t py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Solusi Terfokus</span>
                  <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    Dirancang untuk Kebutuhan Nyata Perusahaan
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground max-w-md">
                  Mulai dari tahap inkubasi UMKM hingga skala tim yang membutuhkan mitigasi risiko kontrak secara cepat.
                </p>
              </div>

              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {BUSINESS_SEGMENTS.map((seg) => (
                  <div key={seg.title} className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm">
                    <div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <seg.icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-display text-lg font-semibold">{seg.title}</h3>
                      <p className="mt-1 text-xs font-medium text-primary">{seg.tagline}</p>
                      <div className="my-4 h-px bg-border" />
                      <ul className="space-y-2.5">
                        {seg.points.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 3: LIVE RED FLAG SHOWCASE DEMO */}
          <section className="border-t bg-card/40 py-16">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="text-center max-w-xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-destructive">Deteksi Red Flags Otomatis</span>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  Bagaimana PasalBerapa Menyelamatkan Bisnis Anda
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Contoh nyata pembongkaran klausul berat sebelah pada Kontrak Kerja Sama Vendor B2B.
                </p>
              </div>

              <ReviewSimulationCard />
            </div>
          </section>

          {/* SECTION 4: ENTERPRISE MOAT & PRIVACY ARCHITECTURE */}
          <section className="border-t py-16">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Kerahasiaan Tingkat Tinggi</span>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  Keamanan Data &amp; Arsitektur Tanpa Kebocoran
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Solusi AI hukum dengan proteksi tokenisasi PII otomatis sebelum kontrak dianalisis oleh model AI.
                </p>
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-3">
                <div className="rounded-2xl border bg-card p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Shield className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">PII Redaction Layer</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Presidio engine memindai NIK, NPWP, nama, nomor rekening, dan nilai kontrak. Model AI hanya memproses tag data yang sudah disamarkan.
                  </p>
                </div>

                <div className="rounded-2xl border bg-card p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-risk-safe/10 text-risk-safe">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">Stateless &amp; Zero Retention</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Dokumen kontrak tidak disimpan permanen di database publik. Analisis berjalan secara *ephemeral* tanpa retensi data.
                  </p>
                </div>

                <div className="rounded-2xl border bg-card p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-vault/10 text-vault">
                    <Server className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">Private Node Deployable</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Dukungan image Docker siap pakai untuk deploy AI Node langsung di private VPC atau intranet korporat Anda.
                  </p>
                </div>
              </div>

              {/* Redaction comparison demo for Business */}
              <RedactionDemoCard isBisnis={true} />
            </div>
          </section>

          {/* SECTION 5: PRICING & MONETIZATION TIERS */}
          <section className="border-t bg-card/50 py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="text-center max-w-xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Paket Layanan</span>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  Model Bisnis Transparan &amp; Terukur
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Gunakan akses gratis saat ini. Paket berbayar dan fitur kolaborasi tim segera hadir.
                </p>
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
                {PRICING_TIERS.map((tier) => (
                  <div
                    key={tier.name}
                    className={`relative flex flex-col justify-between rounded-3xl border bg-card p-7 shadow-sm transition-all hover:shadow-lg ${
                      tier.popular ? "border-primary ring-2 ring-primary/20 shadow-md" : ""
                    } ${tier.comingSoon ? "bg-card/70" : ""}`}
                  >
                    {tier.badge && (
                      <div
                        className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          tier.comingSoon
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                            : "bg-primary text-primary-foreground shadow-sm"
                        }`}
                      >
                        {tier.badge}
                      </div>
                    )}
                    <div>
                      <h3 className="font-display text-xl font-bold">{tier.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{tier.desc}</p>
                      <div className="mt-5 mb-4">
                        <span className={`font-display text-2xl sm:text-3xl font-extrabold ${tier.comingSoon ? "text-primary" : "text-foreground"}`}>
                          {tier.price}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">{tier.period}</span>
                      </div>
                      <div className="my-5 h-px bg-border" />
                      <ul className="space-y-3">
                        {tier.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-center gap-2.5 text-xs text-foreground/90">
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-8">
                      {tier.comingSoon ? (
                        <button
                          type="button"
                          disabled
                          className="w-full rounded-full py-2.5 text-xs font-semibold border border-dashed border-border bg-muted/60 text-muted-foreground cursor-not-allowed"
                        >
                          {tier.cta}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                          className="w-full rounded-full py-2.5 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-all"
                        >
                          {tier.cta}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 6: BOTTOM CTA */}
          <section className="border-t py-16">
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              <div className="rounded-3xl border bg-gradient-to-br from-card to-accent/30 p-8 sm:p-12 text-center shadow-sm">
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Siap Mengamankan Kontrak Bisnis Anda Hari Ini?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Uji langsung dokumen Anda tanpa registrasi atau buat akun gratis untuk menyimpan riwayat analisis tim Anda secara aman.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-transform hover:-translate-y-0.5"
                  >
                    Coba Upload Kontrak <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onOpenAuth}
                    data-testid="landing-cta-daftar"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
                  >
                    Daftar Akun Bisnis Gratis
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* --- PERSONAL / ORIGINAL BELOW THE FOLD --- */
        <>
          <section className="border-t bg-card/40">
            <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Kenapa aman dipakai</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">Dibikin privacy-first. Kamu pegang kendali penuh atas datamu.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {PERSONAL_TRUST.map((t) => (
                  <div key={t.title} className="rounded-2xl border bg-card p-5">
                    <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `hsl(${t.color} / 0.12)`, color: `hsl(${t.color})` }}>
                      <t.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 font-display text-base font-semibold">{t.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                  </div>
                ))}
              </div>

              {/* Redaction comparison demo for Personal */}
              <RedactionDemoCard isBisnis={false} />
            </div>
          </section>

          <section className="border-t">
            <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Cara kerjanya</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">Tiga langkah, tanpa ribet.</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                {PERSONAL_STEPS.map((st) => (
                  <div key={st.n} className="flex items-start gap-3">
                    <span className="font-mono-plex text-2xl font-semibold text-primary">{st.n}</span>
                    <div>
                      <p className="font-display text-base font-semibold">{st.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{st.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-10 rounded-2xl border bg-accent/40 p-5 text-center">
                <p className="font-display text-lg font-semibold">Mau riwayat obrolanmu kesimpen?</p>
                <p className="mt-1 text-sm text-muted-foreground">Daftar gratis — tetap private, cuma buat nyimpen percakapan.</p>
                <button onClick={onOpenAuth} data-testid="landing-cta-daftar" className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
                  Daftar sekarang
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
