import type { Metadata } from "next";
import { PainelPagina } from "@/components/painel/PainelPagina";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel · Tradutor do Copom",
  robots: { index: false, follow: false },
};

export default function Painel() {
  return <PainelPagina secaoInicial="visao-geral" />;
}
