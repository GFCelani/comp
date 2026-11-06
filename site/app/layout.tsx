import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { dados } from "@/lib/dados";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tradutor do Copom",
  description:
    "O tom das atas do Copom numa régua de −2 a +2, o que mudou entre as atas e o que isso pode significar para a Selic. Sempre com o parágrafo e o trecho exato.",
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-ciano focus:px-3 focus:py-2 focus:text-[#06111f]"
        >
          ir para o conteúdo
        </a>
        {dados.exemplo && (
          <div
            role="status"
            className="bg-duro text-[#1a1200] text-center text-sm font-semibold px-4 py-2"
          >
            EXEMPLO — dados ilustrativos. Índices, trechos e textos abaixo não vêm das atas reais.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
