{
  "product": {
    "name": "PasalBerapa?",
    "one_liner": "Upload kontrak → otomatis dimasking → dibedah pasal & risikonya (tanpa login, tanpa nyimpen data).",
    "design_personality": [
      "Trustworthy tapi nggak mengintimidasi",
      "Casual Bahasa Indonesia (kayak ngobrol), tetap akurat saat nyebut pasal",
      "Privacy-first sebagai ‘hero feature’ (bukan catatan kaki)",
      "Dense-text friendly (kontrak panjang tetap enak dibaca)"
    ],
    "north_star_actions": [
      "Upload PDF (drag & drop)",
      "Lihat hasil ekstraksi + progres OCR",
      "Klik quick actions (Bedah Risiko / Ringkas / Jelaskan Pasal)",
      "Buka Privacy Vault untuk cek masking",
      "Baca Risk Dashboard dan expand kartu risiko"
    ]
  },

  "visual_style": {
    "style_fusion": {
      "layout_principle": "Bento + workspace split-view (dokumen kiri, analisis kanan) ala ‘AI contract reviewer’",
      "surface_language": "Soft paper-canvas + crisp cards (off-white background, border halus, shadow tipis)",
      "accent_language": "Ocean-teal sebagai trust/privacy + warm amber untuk warning + coral-red untuk high risk (solid, bukan gradient)",
      "texture": "Noise/paper grain sangat halus di background (maks 10–15% opacity)"
    },
    "do_not": [
      "Jangan pakai vibe ‘law firm’ yang kaku (navy + serif berat + terlalu formal)",
      "Jangan pakai ungu untuk AI/chat",
      "Jangan bikin layout serba center",
      "Jangan pakai gradient gelap/saturated; gradient hanya dekoratif dan <20% viewport"
    ]
  },

  "typography": {
    "font_pairing": {
      "display": {
        "name": "Space Grotesk",
        "usage": "Brand wordmark, H1/H2, angka skor risiko",
        "google_fonts_import": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
      },
      "body": {
        "name": "Figtree",
        "usage": "Body text, UI labels, chat, tabel vault",
        "google_fonts_import": "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap"
      },
      "mono": {
        "name": "IBM Plex Mono",
        "usage": "Tag masking (<PERSON_1>), endpoint URLs, technical snippets",
        "google_fonts_import": "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      }
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "section_title": "text-lg font-semibold",
      "body": "text-sm md:text-base leading-7",
      "small": "text-xs text-muted-foreground",
      "mono": "font-mono text-xs"
    },
    "content_rules": [
      "Kontrak/pasal: gunakan leading-7, max-w-none di panel dokumen, dan spacing antar paragraf (space-y-3)",
      "Gunakan istilah casual untuk aksi: ‘Bedah’, ‘Ringkas’, ‘Jelasin’, tapi untuk rujukan hukum tetap formal: ‘Pasal 1320 KUHPerdata’"
    ]
  },

  "color_system": {
    "notes": [
      "Base UI pakai off-white canvas supaya mata nggak capek baca teks panjang.",
      "Aksen utama teal (privacy/trust). Warning amber. High risk coral-red. Semua solid (bukan gradient)."
    ],
    "tokens_css": {
      "add_to": "/app/frontend/src/index.css",
      "css_variables": {
        "--background": "36 33% 98%",
        "--foreground": "222 47% 11%",
        "--card": "0 0% 100%",
        "--card-foreground": "222 47% 11%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "222 47% 11%",

        "--primary": "174 72% 28%",
        "--primary-foreground": "0 0% 100%",

        "--secondary": "210 20% 96%",
        "--secondary-foreground": "222 47% 11%",

        "--muted": "210 20% 96%",
        "--muted-foreground": "215 16% 40%",

        "--accent": "174 45% 92%",
        "--accent-foreground": "174 72% 18%",

        "--border": "214 20% 90%",
        "--input": "214 20% 90%",
        "--ring": "174 72% 28%",

        "--destructive": "8 78% 52%",
        "--destructive-foreground": "0 0% 100%",

        "--radius": "0.9rem",

        "--risk-high": "8 78% 52%",
        "--risk-high-bg": "8 80% 96%",
        "--risk-warn": "38 92% 50%",
        "--risk-warn-bg": "44 100% 95%",
        "--risk-safe": "152 55% 36%",
        "--risk-safe-bg": "152 45% 95%",

        "--vault": "200 85% 45%",
        "--vault-bg": "200 85% 96%"
      },
      "optional_dark_mode": {
        "enabled": true,
        "intent": "Dark mode untuk kerja malam; tetap readable untuk teks panjang.",
        "css_variables": {
          "--background": "222 47% 7%",
          "--foreground": "210 40% 98%",
          "--card": "222 47% 9%",
          "--card-foreground": "210 40% 98%",
          "--primary": "174 70% 45%",
          "--primary-foreground": "222 47% 7%",
          "--border": "217 20% 18%",
          "--muted": "217 20% 14%",
          "--muted-foreground": "215 20% 70%",
          "--ring": "174 70% 45%",
          "--risk-high-bg": "8 40% 16%",
          "--risk-warn-bg": "44 45% 16%",
          "--risk-safe-bg": "152 35% 16%",
          "--vault-bg": "200 45% 16%"
        }
      }
    },
    "gradients": {
      "restriction": "Ikuti GRADIENT RESTRICTION RULE (maks 20% viewport, hanya dekoratif).",
      "allowed_background_gradients": [
        {
          "name": "hero-mist",
          "css": "radial-gradient(900px circle at 15% 10%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(700px circle at 85% 0%, rgba(56,189,248,0.14), transparent 50%)",
          "usage": "Hero background overlay saja (bukan card)."
        }
      ]
    }
  },

  "layout_grid": {
    "app_shell": {
      "structure": "Single-page workspace dengan top bar + 3-panel resizable",
      "desktop_grid": "[Left: Document Preview] [Center: Chat/Actions] [Right: Risk/Vault]",
      "mobile": "Stacked tabs: Dokumen | Chat | Risiko | Vault",
      "max_width": "Gunakan container lebar (max-w-[1400px]) tapi panel tetap scrollable",
      "spacing": "Gunakan gap-4 md:gap-6 dan padding p-4 md:p-6"
    },
    "resizable": {
      "component": "src/components/ui/resizable.jsx",
      "default_sizes": {
        "left": "35%",
        "center": "40%",
        "right": "25%"
      },
      "min_sizes": {
        "left": "280px",
        "center": "320px",
        "right": "280px"
      }
    }
  },

  "components": {
    "component_path": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "progress": "/app/frontend/src/components/ui/progress.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "separator": "/app/frontend/src/components/ui/separator.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "switch": "/app/frontend/src/components/ui/switch.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx",
      "skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
      "alert": "/app/frontend/src/components/ui/alert.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "hover_card": "/app/frontend/src/components/ui/hover-card.jsx",
      "collapsible": "/app/frontend/src/components/ui/collapsible.jsx"
    },

    "top_bar": {
      "contents": [
        "Left: logo wordmark ‘PasalBerapa?’ + mini tagline",
        "Center: Stateless indicator pill (\"Data kamu nggak disimpen. Refresh = hilang.\")",
        "Right: Connection status chip + tombol Settings"
      ],
      "shadcn": ["badge", "button", "tooltip", "dialog"],
      "classes": {
        "bar": "sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "inner": "mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6",
        "brand": "font-[var(--font-display)] text-base md:text-lg font-semibold tracking-tight",
        "stateless_pill": "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground",
        "status_chip": "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
      },
      "data_testids": {
        "settings_button": "settings-open-button",
        "connection_status": "connection-status-chip",
        "stateless_indicator": "stateless-indicator"
      }
    },

    "hero_upload": {
      "layout": "Hero split: kiri copy + trust bullets, kanan upload dropzone card",
      "dropzone": {
        "surface": "Card putih dengan border dashed + hover glow teal",
        "states": ["idle", "drag-over", "uploading", "extracting", "ocr-running", "done", "error"],
        "classes": {
          "wrapper": "rounded-[var(--radius)] border border-border bg-card shadow-sm",
          "drop": "group relative flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-2px)] border-2 border-dashed border-border bg-[rgba(255,255,255,0.6)] p-6 text-center",
          "drop_hover": "hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]",
          "icon": "h-10 w-10 text-[hsl(var(--primary))]",
          "hint": "text-xs text-muted-foreground"
        },
        "microcopy": {
          "title": "Tarik PDF ke sini",
          "subtitle": "Atau klik buat pilih file. Kita masking data sensitif dulu sebelum analisis.",
          "privacy_note": "Nama, email, NIK, alamat, nomor HP bakal diganti jadi tag kayak <PERSON_1>."
        },
        "data_testids": {
          "dropzone": "pdf-dropzone",
          "file_picker": "pdf-file-picker-button",
          "progress": "extraction-progress"
        }
      },
      "shadcn": ["card", "button", "progress", "alert"],
      "motion": "Dropzone: border color transition + subtle scale on drag-over (scale-[1.01])"
    },

    "workspace_panels": {
      "document_preview": {
        "title": "Teks Dokumen",
        "features": [
          "Search within extracted text (Command component)",
          "Highlight masked tags with mono chip",
          "Sticky mini-toolbar: Copy masked text, Download redacted (future)"
        ],
        "shadcn": ["card", "scroll-area", "command", "badge", "tooltip"],
        "classes": {
          "panel": "h-[calc(100vh-72px)] rounded-[var(--radius)] border bg-card",
          "header": "flex items-center justify-between border-b px-4 py-3",
          "body": "p-4",
          "text": "prose prose-slate max-w-none text-sm leading-7"
        },
        "data_testids": {
          "doc_panel": "document-preview-panel",
          "doc_search": "document-search-input",
          "copy_masked": "copy-masked-text-button"
        }
      },

      "analysis_chat": {
        "title": "Analisis (Santai tapi Nendang)",
        "chat_feed": {
          "bubble_styles": {
            "user": "bg-secondary text-secondary-foreground",
            "assistant": "bg-[hsl(var(--accent))] text-foreground border border-border"
          },
          "message_meta": "timestamp + label (Kamu / PasalBerapa?)",
          "streaming": "Gunakan skeleton lines + typing indicator (3 dots)"
        },
        "composer": {
          "shadcn": ["textarea", "button", "tooltip"],
          "classes": {
            "wrap": "border-t p-3",
            "textarea": "min-h-[44px] resize-none",
            "send": "rounded-xl"
          },
          "data_testids": {
            "chat_input": "chat-composer-input",
            "chat_send": "chat-send-button"
          }
        },
        "quick_actions": {
          "buttons": [
            {
              "label": "Bedah Risiko (Red Flags)",
              "variant": "default",
              "icon": "lucide:ShieldAlert",
              "data_testid": "quick-action-risk-button"
            },
            {
              "label": "Ringkas Isi",
              "variant": "secondary",
              "icon": "lucide:FileText",
              "data_testid": "quick-action-summary-button"
            },
            {
              "label": "Jelaskan Pasal Terpenting",
              "variant": "outline",
              "icon": "lucide:Sparkles",
              "data_testid": "quick-action-key-articles-button"
            }
          ],
          "layout": "3 tombol dalam grid gap-2 (mobile: 1 kolom, md: 3 kolom)",
          "micro_interaction": "Hover: translate-y-[-1px] + shadow-sm; Active: scale-95"
        },
        "shadcn": ["card", "button", "scroll-area", "separator", "skeleton"]
      },

      "privacy_vault": {
        "title": "Privacy Vault",
        "tone": "Bahasa santai: ‘Ini daftar yang kita samarin. Kamu bisa cek, tapi default-nya disembunyiin.’",
        "structure": [
          "Header: lock icon + toggle ‘Tampilkan data asli’ (Switch)",
          "Table: Tag | Jenis | Nilai Asli (blurred) | Aksi (copy tag)",
          "Footer note: ‘Mapping ini cuma di browser kamu.’"
        ],
        "shadcn": ["card", "table", "switch", "tooltip", "badge", "collapsible"],
        "classes": {
          "tag_chip": "font-mono text-xs rounded-md bg-[hsl(var(--vault-bg))] px-2 py-1 text-[hsl(var(--vault))]",
          "blurred": "select-none blur-sm hover:blur-none transition-[filter] duration-200",
          "vault_note": "text-xs text-muted-foreground"
        },
        "data_testids": {
          "vault_panel": "privacy-vault-panel",
          "vault_toggle": "privacy-vault-reveal-toggle",
          "vault_table": "privacy-vault-table"
        },
        "privacy_guardrail": "Saat toggle ON, tampilkan AlertDialog konfirmasi: ‘Yakin mau nampilin data asli? Pastikan layar aman.’"
      },

      "risk_dashboard": {
        "title": "Dashboard Risiko",
        "summary_row": [
          "Risk score (0–100) + label",
          "Counts: High / Warning / Aman",
          "Confidence indicator (opsional)"
        ],
        "risk_cards": {
          "card_types": [
            "High (red)",
            "Warning (amber)",
            "Safe (green)"
          ],
          "expandable": "Gunakan Accordion/Collapsible untuk detail: kutipan pasal + kenapa berisiko + saran negosiasi",
          "highlighting": "Saat user klik kartu, scroll & highlight paragraf terkait di panel dokumen (outline ring teal)"
        },
        "color_classes": {
          "high": "border-[hsl(var(--risk-high))] bg-[hsl(var(--risk-high-bg))]",
          "warn": "border-[hsl(var(--risk-warn))] bg-[hsl(var(--risk-warn-bg))]",
          "safe": "border-[hsl(var(--risk-safe))] bg-[hsl(var(--risk-safe-bg))]"
        },
        "shadcn": ["card", "badge", "accordion", "progress", "tooltip"],
        "data_testids": {
          "risk_dashboard": "risk-dashboard-panel",
          "risk_score": "risk-score-value",
          "risk_card": "risk-item-card"
        }
      }
    },

    "settings_connection": {
      "entry": "Top bar Settings button",
      "container": "Desktop: Dialog. Mobile: Drawer.",
      "fields": [
        "Gateway Base URL",
        "Vector DB endpoint",
        "LLM endpoint",
        "Timeout (ms)",
        "Test Connection button"
      ],
      "status_states": [
        "Not configured",
        "Testing…",
        "Connected",
        "Failed (show error)"
      ],
      "shadcn": ["dialog", "drawer", "input", "label", "button", "alert"],
      "data_testids": {
        "settings_modal": "settings-connection-modal",
        "gateway_input": "settings-gateway-url-input",
        "test_connection": "settings-test-connection-button"
      }
    }
  },

  "motion_microinteractions": {
    "library": {
      "recommended": "framer-motion",
      "install": "npm i framer-motion",
      "usage": [
        "Panel entrance (fade+slide 8px)",
        "Risk card expand/collapse",
        "Dropzone drag-over scale",
        "Toast entrance (sonner already)"
      ],
      "reduced_motion": "Respect prefers-reduced-motion: disable parallax/scale"
    },
    "principles": [
      "Durations: 160–220ms for hover, 240–320ms for panel transitions",
      "Easing: cubic-bezier(0.2, 0.8, 0.2, 1)",
      "No universal transition: avoid transition-all"
    ]
  },

  "iconography": {
    "library": "lucide-react",
    "install": "npm i lucide-react",
    "usage": [
      "Privacy: Lock, ShieldCheck",
      "Risk: ShieldAlert, TriangleAlert",
      "Upload: UploadCloud",
      "Settings: SlidersHorizontal",
      "Stateless: TimerReset"
    ],
    "rules": [
      "Icon size default: h-4 w-4 in buttons, h-5 w-5 in headers",
      "Use consistent stroke width (default lucide)"
    ]
  },

  "empty_loading_states": {
    "global": {
      "empty_canvas": "Gunakan Card dengan ilustrasi sederhana (icon besar) + 1 kalimat + 1 CTA.",
      "copy_examples": {
        "no_doc": "Belum ada dokumen. Upload dulu, nanti gue bantu bedah.",
        "not_connected": "Backend belum nyambung. Atur endpoint dulu di Settings.",
        "ocr": "Lagi baca scan… ini bisa agak lama tergantung kualitas PDF."
      }
    },
    "skeletons": {
      "use": "src/components/ui/skeleton.jsx",
      "patterns": [
        "Chat: 3–6 baris skeleton bubble",
        "Risk cards: 3 cards skeleton",
        "Doc preview: paragraph skeleton blocks"
      ]
    },
    "toasts": {
      "use": "sonner",
      "events": [
        "Upload success",
        "Masking complete",
        "Connection test result",
        "Copy tag"
      ]
    }
  },

  "accessibility": {
    "rules": [
      "Kontras: risk backgrounds harus tetap readable (gunakan text-foreground + border kuat)",
      "Focus ring: gunakan ring-[hsl(var(--ring))] ring-offset-2",
      "Keyboard: semua panel scrollable harus bisa diakses (ScrollArea)",
      "Long text: jangan pakai font terlalu kecil; minimal text-sm dengan leading-7",
      "Tables: header jelas + row hover state"
    ],
    "data_testid_policy": "Semua elemen interaktif & info penting wajib punya data-testid (kebab-case)."
  },

  "image_urls": {
    "hero": [
      {
        "url": "https://images.pexels.com/photos/7841423/pexels-photo-7841423.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "usage": "Hero side image (optional) di landing; blur + overlay supaya nggak ganggu teks",
        "alt": "Dokumen kontrak dan pena"
      }
    ],
    "background_texture": [
      {
        "url": "https://images.pexels.com/photos/3255761/pexels-photo-3255761.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "usage": "Subtle paper/marble texture overlay (opacity 0.06–0.1) untuk canvas",
        "alt": "Tekstur halus"
      }
    ]
  },

  "implementation_notes_js": {
    "react_files": "Project pakai .js (bukan .tsx). Hindari type annotations.",
    "state_management": [
      "PII mapping disimpan di React state (Context) dan tidak dipersist.",
      "Tampilkan ‘Stateless’ indicator selalu terlihat."
    ],
    "pdf_ocr": [
      "pdf.js untuk extraction progress",
      "tesseract.js untuk OCR; tampilkan progress bar + ETA perkiraan"
    ]
  },

  "instructions_to_main_agent": [
    "Ganti default CRA App.css yang center/dark; jangan pakai .App-header center.",
    "Update index.css tokens sesuai color_system.tokens_css (HSL).",
    "Tambahkan import Google Fonts (Space Grotesk, Figtree, IBM Plex Mono) di index.html atau CSS.",
    "Bangun App shell: TopBar + Resizable panels (desktop) + Tabs (mobile).",
    "Pastikan semua tombol/inputs/links/status chips punya data-testid.",
    "Implement empty states untuk ‘backend belum nyambung’ dan ‘belum upload dokumen’.",
    "Risk dashboard: gunakan Accordion/Collapsible untuk kartu risiko; klik kartu highlight paragraf terkait di dokumen.",
    "Privacy Vault: default hidden; toggle reveal pakai AlertDialog konfirmasi; nilai asli diblur.",
    "Gunakan sonner untuk toast; jangan pakai toast HTML custom.",
    "Ikuti GRADIENT RESTRICTION RULE: gradient hanya dekoratif di hero background, <20% viewport."
  ],

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
