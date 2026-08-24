import "@/index.css";
import Providers from "./providers";

export const metadata = {
  title: "PasalBerapa? — Bedah Kontrak Tanpa Ribet",
  description: "AI Legal Risk Platform untuk Bisnis, UMKM, & Personal. Bedah klausul berisiko dan red flags kontrak secara instan tanpa login.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
