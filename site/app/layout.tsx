import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { dados } from "@/lib/dados";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CopomAI",
  description:
    "CopomAI lê as atas do Copom. O tom das atas do Copom numa régua de −2 a +2, o que mudou entre as atas e o que isso pode significar para a Selic. Sempre com o parágrafo e o trecho exato.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-tinta focus:px-4 focus:py-2 focus:text-papel"
        >
          ir para o conteúdo
        </a>
        {dados.exemplo && (
          <div role="status" className="bg-alerta-suave text-alerta text-center text-sm font-medium px-4 py-2">
            Exemplo: dados ilustrativos. Índices, trechos e textos abaixo não vêm das atas reais.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
