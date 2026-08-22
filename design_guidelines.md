{
  "design_system_name": "PasalBerapa? Landing (Front Door) — Fresh, Paper-Editorial, Redaction Motif",
  "scope": {
    "only_redesign": "Landing/entry screen before upload",
    "do_not_touch": ["Post-upload conversational chat view"],
    "must_keep_features": [
      "Central ChatGPT-style input bar with attach-PDF icon + send button",
      "Template cards: Kontrak Kerja, Perjanjian Sewa, NDA / Kerahasiaan",
      "Question chips that prefill input",
      "Trust signals: privacy-first/stateless, OCR, red flags",
      "Full-window drag-and-drop PDF"
    ]
  },
  "brand_attributes": {
    "personality": [
      "ramah (bahasa santai, kayak jelasin ke anak SMP)",
      "tepercaya (legal)",
      "ringan & nggak bikin takut",
      "berani tapi rapi (out of the box tanpa rame)",
      "privacy-first sebagai ‘superpower’"
    ],
    "visual_metaphor": [
      "kertas hangat + tinta rapi",
      "redaction/masking (blok hitam/teal yang ‘nutupin data sensitif’)",
      "anotasi dokumen (underline, bracket, highlight) tapi minimal",
      "tag entity ala <NAMA_ORANG> / <NOMOR_KTP> (pakai font mono)"
    ]
  },
  "layout_blueprint": {
    "overall_composition": {
      "concept": "Editorial asymmetry + ‘Spotlight Composer’: input bar jadi pusat panggung, dikelilingi potongan dokumen yang ‘di-redact’ dan chip entity yang melayang. Kanan jadi ‘Proof Lane’ berisi trust signals + template cards. Mobile tetap 1 kolom, tapi terasa seperti majalah.",
      "grid": {
        "desktop": "12-col grid; kiri 7 kolom (headline + composer), kanan 5 kolom (proof lane)",
        "mobile": "single column stack; composer tetap di atas fold"
      },
      "section_order": [
        "Top bar (logo + 2 trust pills)",
        "Hero split: Left = headline + composer spotlight + chips; Right = proof lane (privacy/OCR/red flags) + template cards",
        "Secondary strip: ‘Cara kerja 1-2-3’ mini steps (horizontal on desktop, vertical on mobile)",
        "Footer micro: stateless note + keyboard hint"
      ],
      "spacing": {
        "page_padding": "px-4 sm:px-6 lg:px-10",
        "hero_vertical": "pt-8 sm:pt-10 lg:pt-14 pb-10 lg:pb-14",
        "section_gaps": "gap-6 lg:gap-8",
        "max_width": "max-w-6xl mx-auto"
      }
    },
    "hero_left_lane": {
      "headline_treatment": {
        "style": "Oversized Fraunces, editorial, dengan 1 kata di-highlight pakai ‘marker underline’ (bukan gradient).",
        "copy_suggestion": {
          "h1": "Baca kontrak kayak ngobrol.",
          "sub": "Upload PDF, tanya apa aja. Kita tunjukin pasal penting + red flags — tanpa nyimpen dokumen kamu."
        },
        "tailwind": {
          "h1": "font-display tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.02]",
          "sub": "mt-3 text-sm sm:text-base text-muted-foreground max-w-[52ch]"
        },
        "marker_underline_motif": {
          "implementation": "Wrap kata kunci (mis. ‘ngobrol’) dalam span relative; pakai ::after sebagai underline tebal semi-transparan.",
          "tailwind_span": "relative inline-block",
          "css_hint": ".marker-underline::after { content:''; position:absolute; left:-0.05em; right:-0.05em; bottom:0.08em; height:0.55em; background: hsl(var(--accent)); border-radius: 999px; z-index:-1; transform: rotate(-1.2deg); }"
        }
      },
      "composer_spotlight": {
        "frame": "Composer ditempatkan di dalam ‘spotlight card’ (Card shadcn) dengan border halus + shadow lembut + noise/paper grain. Di belakangnya ada 2-3 ‘redaction strips’ dekoratif (div absolute) yang bergerak pelan.",
        "structure": [
          "Dropzone overlay (full window)",
          "Spotlight Card",
          "Inside: input pill (Textarea/Input) + attach icon button + send button",
          "Below: question chips row"
        ],
        "tailwind_container": "relative",
        "tailwind_spotlight_card": "relative overflow-hidden rounded-[calc(var(--radius)+0.35rem)] border bg-card/80 backdrop-blur-sm shadow-[0_18px_50px_-30px_hsl(var(--foreground)/0.35)]",
        "spotlight_bg": {
          "implementation": "Use existing .hero-mist + .paper-grain on a wrapper behind content; keep gradients decorative and <20% viewport.",
          "tailwind": "paper-grain hero-mist"
        },
        "input_bar_spec": {
          "must_feel": "ChatGPT-style long pill, center of attention, not cramped.",
          "recommended_components": [
            "shadcn Input or Textarea (prefer Textarea with auto-resize feel)",
            "shadcn Button for send",
            "shadcn Tooltip for attach"
          ],
          "layout": "flex items-end gap-2; input grows; attach icon inside left; send button right",
          "tailwind_pill_wrapper": "flex items-end gap-2 rounded-full border bg-background/70 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring",
          "attach_button": {
            "data_testid": "attach-pdf-button",
            "tailwind": "h-9 w-9 rounded-full border bg-card hover:bg-accent transition-colors",
            "icon": "lucide-react Paperclip"
          },
          "input": {
            "data_testid": "chat-composer-input",
            "tailwind": "min-h-[44px] w-full resize-none border-0 bg-transparent px-1 py-2 text-sm sm:text-base focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder": "Tempel pertanyaan kamu… (mis. ‘Ada denda tersembunyi nggak?’)"
          },
          "send_button": {
            "data_testid": "chat-send-button",
            "variant": "default",
            "tailwind": "h-9 rounded-full px-4 shadow-sm transition-colors",
            "icon": "lucide-react ArrowUp"
          },
          "keyboard_hint": {
            "tailwind": "mt-2 text-xs text-muted-foreground",
            "copy": "Enter untuk kirim • Shift+Enter untuk baris baru"
          }
        },
        "question_chips": {
          "placement": "Di bawah composer, tapi dibuat ‘orbit’ ringan: sebagian chips rata kiri, sebagian offset kanan (asymmetry).",
          "component": "shadcn Button variant=secondary/outline (small)",
          "data_testid_pattern": "example-question-<slug>-chip",
          "tailwind_wrap": "mt-4 flex flex-wrap gap-2",
          "chip_style": "rounded-full text-xs sm:text-sm",
          "microcopy_examples": [
            "Ada denda tersembunyi nggak?",
            "Kontrak ini bisa diputus sepihak?",
            "Deposit hangus kalau apa?",
            "Ada pasal yang bikin rugi banget?"
          ]
        }
      }
    },
    "hero_right_proof_lane": {
      "concept": "Kolom kanan terasa seperti ‘catatan editor’: trust signals + template cards seperti kliping dokumen.",
      "trust_signals": {
        "layout": "Stack 3 mini cards (atau 1 card dengan 3 rows) dengan ikon kecil + judul + 1 kalimat.",
        "components": ["Card", "Badge", "Separator"],
        "items": [
          {
            "title": "Stateless & privacy-first",
            "desc": "Nggak perlu login. Dokumen kamu nggak disimpen.",
            "accent": "vault",
            "icon": "lucide-react Shield"
          },
          {
            "title": "Bisa baca scan (OCR)",
            "desc": "PDF hasil foto/scan tetap kebaca.",
            "accent": "primary",
            "icon": "lucide-react ScanText"
          },
          {
            "title": "Bongkar red flags",
            "desc": "Kita tandain pasal berisiko + jelasin simpel.",
            "accent": "risk-warn",
            "icon": "lucide-react TriangleAlert"
          }
        ],
        "tailwind_card": "rounded-2xl border bg-card/70 backdrop-blur-sm",
        "badge_style": "font-mono-plex text-[11px]"
      },
      "template_cards": {
        "layout": "3 cards dalam grid 1 kolom (mobile) / 1 kolom (desktop) tapi dengan offset/rotation halus biar terasa ‘stack of papers’.",
        "component": "shadcn Card + Button",
        "data_testid": {
          "kontrak": "example-kontrak-kerja-button",
          "sewa": "example-perjanjian-sewa-button",
          "nda": "example-nda-button"
        },
        "card_motif": {
          "implementation": "Setiap card punya ‘redaction bar’ kecil (div) di header + 2-3 garis skeleton sebagai preview.",
          "tailwind": "relative overflow-hidden",
          "redaction_bar": "absolute left-4 top-4 h-2 w-16 rounded-full bg-foreground/10"
        },
        "tailwind_grid": "mt-6 grid gap-3",
        "card_hover": "hover:shadow-[0_18px_40px_-28px_hsl(var(--foreground)/0.35)] hover:-translate-y-0.5 transition-[box-shadow,transform]"
      }
    },
    "secondary_how_it_works_strip": {
      "concept": "Strip tipis seperti ‘timeline editor’ (1-2-3) dengan garis putus-putus mono.",
      "layout": "3 steps; each step has number badge (mono) + title + desc",
      "tailwind_wrapper": "mt-10 rounded-2xl border bg-card/60 backdrop-blur-sm p-4 sm:p-6",
      "steps": [
        {"n": "01", "title": "Tarik & lepas PDF", "desc": "Bisa kontrak kerja, sewa, NDA, dll."},
        {"n": "02", "title": "Tanya pakai bahasa kamu", "desc": "Nggak perlu istilah hukum."},
        {"n": "03", "title": "Dapet jawaban + pasal", "desc": "Kita tunjukin bagian dokumennya."}
      ]
    }
  },
  "drag_and_drop": {
    "full_window_dropzone": {
      "behavior": "Saat user drag file ke window: tampil overlay halus (bukan gelap) dengan border dashed besar + copy singkat.",
      "tailwind_overlay": "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm",
      "drop_panel": "mx-auto mt-24 max-w-xl rounded-3xl border-2 border-dashed border-primary/40 bg-card/70 p-8 text-center shadow-sm",
      "copy": {
        "title": "Lepasin PDF di sini",
        "sub": "Tenang, dokumen nggak disimpen."
      },
      "data_testid": "pdf-dropzone-overlay"
    }
  },
  "decorative_graphics_no_external_assets": {
    "redaction_strips": {
      "what": "3–5 strip rounded (seperti teks disensor) di belakang spotlight card.",
      "how": "absolute divs with bg-foreground/8 or bg-primary/10; animate x drift slowly.",
      "tailwind_example": "absolute -z-10 left-6 top-6 h-3 w-40 rounded-full bg-foreground/10"
    },
    "annotation_brackets": {
      "what": "Bracket tipis di sisi composer (seperti markup editor).",
      "how": "SVG inline sederhana (path) atau div border-l + border-t combos.",
      "tailwind_example": "absolute -left-3 top-10 h-16 w-6 border-l border-t border-border rounded-tl-xl"
    },
    "entity_tags_float": {
      "what": "Chip mono kecil seperti <NAMA_ORANG>, <NOMINAL>, <TANGGAL> melayang pelan.",
      "how": "Use existing .tag-chip class; position absolute around hero; hide on small screens.",
      "tailwind": "hidden lg:block absolute"
    }
  },
  "motion_microinteractions": {
    "library": "framer-motion (already available)",
    "principles": [
      "Motion harus bantu fokus (ngarahin mata ke composer)",
      "Durasi pendek 180–260ms untuk hover; 420–650ms untuk entrance",
      "Gunakan spring ringan untuk cards (stiffness 260–320, damping 26–32)",
      "Respect prefers-reduced-motion"
    ],
    "entrance_sequence": [
      "Logo + trust pills fade/slide",
      "Headline reveal (y: 10 -> 0)",
      "Composer spotlight scale 0.98 -> 1",
      "Proof lane cards stagger",
      "Floating entity tags start slow drift"
    ],
    "hover_states": {
      "template_cards": "lift -2px + shadow deepen",
      "question_chips": "bg-accent + border-primary/30",
      "send_button": "slight brighten + press scale 0.98 on tap",
      "attach_button": "ring on focus + subtle bg shift"
    },
    "scroll_effect": {
      "optional": "Very subtle parallax on decorative redaction strips only (translateY 6–12px across viewport). No heavy scroll-jank."
    }
  },
  "typography": {
    "fonts": {
      "display": "Fraunces via --font-display",
      "body": "Plus Jakarta Sans via --font-body",
      "mono": "IBM Plex Mono via --font-mono"
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl (Fraunces)",
      "h2": "text-base md:text-lg (Plus Jakarta Sans)",
      "body": "text-sm sm:text-base",
      "small": "text-xs",
      "mono_tags": "text-[11px] uppercase tracking-wide"
    },
    "usage_rules": [
      "Fraunces hanya untuk headline/pull-quote (biar terasa editorial)",
      "Plus Jakarta Sans untuk semua paragraf & UI labels",
      "IBM Plex Mono untuk tags, step numbers, trust badges"
    ]
  },
  "color_system_tokens_usage": {
    "keep_existing_palette": true,
    "rules": [
      "Background utama: hsl(var(--background)) (warm paper)",
      "Primary action: hsl(var(--primary)) teal",
      "Accent surfaces: hsl(var(--accent))",
      "Risk colors hanya untuk label/indikator kecil (bukan background besar)",
      "Vault (ocean-blue) untuk privacy/stateless cues"
    ],
    "semantic_mapping": {
      "primary": "--primary",
      "paper": "--background",
      "ink": "--foreground",
      "muted_text": "--muted-foreground",
      "privacy": "--vault / --vault-bg",
      "warning": "--risk-warn / --risk-warn-bg",
      "high_risk": "--risk-high / --risk-high-bg"
    }
  },
  "component_path": {
    "shadcn_primary": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "separator": "/app/frontend/src/components/ui/separator.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx"
    }
  },
  "implementation_notes_js": {
    "landing_component_structure": [
      "components/LandingHero.js (default export)",
      "components/ComposerBar.js (named export)",
      "components/TemplateCard.js (named export)",
      "components/TrustItem.js (named export)",
      "components/DropzoneOverlay.js (named export)"
    ],
    "data_testid_required": [
      "attach-pdf-button",
      "chat-composer-input",
      "chat-send-button",
      "example-kontrak-kerja-button",
      "example-perjanjian-sewa-button",
      "example-nda-button",
      "pdf-dropzone-overlay",
      "example-question-<slug>-chip"
    ],
    "tailwind_patterns": {
      "page_wrapper": "min-h-screen bg-background text-foreground",
      "background_texture": "paper-grain",
      "hero_mist": "hero-mist",
      "no_centered_app": "Do not add text-align:center to .App"
    }
  },
  "image_urls": {
    "note": "No external images required. Use CSS/SVG motifs (redaction strips, brackets, entity tags).",
    "categories": []
  },
  "accessibility": {
    "rules": [
      "Focus ring wajib terlihat: focus-visible:ring-2 focus-visible:ring-ring",
      "Kontras teks di atas paper background harus jelas (gunakan text-foreground / text-muted-foreground)",
      "Clickable area minimal 44px (attach/send/buttons)",
      "prefers-reduced-motion: matikan drift/parallax"
    ]
  },
  "instructions_to_main_agent": [
    "Bangun landing dengan split editorial 7/5 kolom (desktop) dan stack (mobile).",
    "Jadikan composer sebagai ‘spotlight card’ pusat hero; jangan bikin layout rame.",
    "Gunakan motif redaction strips + annotation brackets + floating entity tags (tanpa asset eksternal).",
    "Template cards dibuat seperti tumpukan kertas (offset/rotate kecil) tapi tetap rapi.",
    "Pertahankan palette & fonts yang sudah ada; jangan tambah warna baru.",
    "Pastikan semua elemen interaktif punya data-testid sesuai daftar.",
    "Ikuti GRADIENT RESTRICTION RULE: gradient hanya dekoratif (hero-mist) dan tidak >20% viewport."
  ]
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
