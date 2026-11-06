import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { dados } from "@/lib/dados";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tradutor do Copom",
  description:
    "O tom das atas do Copom numa régua de −2 a +2, o que mudou entre as atas e o que isso pode significar para a Selic. Sempre com o parágrafo e o trecho exato.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e13",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-acento focus:px-3 focus:py-2 focus:text-[#1a1000]"
        >
          ir para o conteúdo
        </a>
        {dados.exemplo && (
          <div role="status" className="bg-acento text-[#1a1000] text-center text-sm font-semibold px-4 py-2">
            EXEMPLO — dados ilustrativos. Índices, trechos e textos abaixo não vêm das atas reais.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
