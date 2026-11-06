import Link from "next/link";
import { dados } from "@/lib/dados";
import { dataCurta } from "@/lib/formato";

const editorias = [
  { href: "/#relatorio", rotulo: "relatório" },
  { href: "/#tom", rotulo: "tom" },
  { href: "/#evidencia", rotulo: "evidência" },
  { href: "/#perguntar", rotulo: "perguntar" },
  { href: "/#atas", rotulo: "atas" },
];

export function Cabecalho({ atual }: { atual: "site" | "painel" }) {
  const u = dados.resumo.ultima_ata;
  return (
    <div className="sticky top-0 z-40 bg-fundo/90 backdrop-blur border-b border-borda">
      <div className="mx-auto max-w-[1180px] px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline gap-2 min-w-0">
          <span className="font-semibold tracking-tight">Tradutor do Copom</span>
          <span className="hidden sm:inline etiqueta etiqueta-sem-ponto">
            edição {u.numero} · {dataCurta(u.data_reuniao)}
          </span>
        </Link>
        <nav aria-label="Seções" className="flex items-center gap-4 text-sm text-texto-2 min-w-0">
          <div className="hidden lg:flex items-center gap-4">
            {editorias.map((e) => (
              <a key={e.href} href={e.href} className="hover:text-texto">
                {e.rotulo}
              </a>
            ))}
          </div>
          <Link
            href={atual === "painel" ? "/" : "/painel"}
            className="botao text-xs"
          >
            {atual === "painel" ? "voltar ao jornal" : "painel de verificação"}
          </Link>
        </nav>
      </div>
    </div>
  );
}
