import type { Metadata } from "next";
import { PainelPagina } from "@/components/painel/PainelPagina";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Textos · Painel · CopomAI",
  robots: { index: false, follow: false },
};

/** Mesmo aplicativo do /painel, abrindo na seção Textos. */
export default function Editar() {
  return <PainelPagina secaoInicial="textos" />;
}
