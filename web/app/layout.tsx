import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Noto_Sans_Thai } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { CatalogProvider } from "@/lib/data/catalog-provider";
import { readCatalog, readShelf } from "@/lib/data/store";
import { AI_ENABLED } from "@/lib/feature-flags";
import "@/styles/tokens.css";
import "@/styles/bundle.css";
import "@/styles/app.css";
import { AppShell } from "./shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", adjustFontFallback: false });
const thai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-noto-thai", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-ibm-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "ShelfPilot AI",
  description: "ผู้ช่วยค้นหาหนังสือเล่มและจัดการหนังสือสะสม",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const [catalog, shelf] = await Promise.all([readCatalog(), readShelf()]);
  return (
    <html lang="th" className={`${inter.variable} ${thai.variable} ${mono.variable}`}>
      <body>
        <CatalogProvider catalog={catalog} shelf={shelf}>
          <AppShell aiEnabled={AI_ENABLED}>{children}</AppShell>
        </CatalogProvider>
      </body>
    </html>
  );
}
