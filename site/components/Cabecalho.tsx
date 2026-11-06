import Link from "next/link";
import { dados } from "@/lib/dados";
import { data } from "@/lib/formato";

const editorias = [
  { href: "/#relatorio", rotulo: "relatório" },
  { href: "/#tom", rotulo: "dados" },
  { href: "/#evidencia", rotulo: "evidência" },
  { href: "/#ferramentas", rotulo: "ferramentas" },
];

/** Cabeçalho do jornal. `atual` fica por compatibilidade; o painel tem o próprio cabeçalho. */
export function Cabecalho({ atual = "site" }: { atual?: "site" | "painel" }) {
  const u = dados.resumo.ultima_ata;
  return (
    <header className="sticky top-0 z-40 bg-papel/90 backdrop-blur-md border-b border-linha">
      <div className="envelope h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-baseline gap-3 min-w-0" aria-label="Tradutor do Copom, início">
          <span className="titulo-serifa text-[1.3125rem] font-semibold tracking-[-0.02em] whitespace-nowrap">Tradutor do Copom</span>
          <span className="hidden md:inline text-xs text-tinta-3 num whitespace-nowrap">
            ata {u.numero}, {data(u.data_reuniao)}
          </span>
        </Link>
        <nav aria-label="Seções" className="flex items-center gap-7 text-sm text-tinta-2">
          {atual === "site" ? (
            <div className="hidden lg:flex items-center gap-7">
              {editorias.map((e) => (
                <a key={e.href} href={e.href} className="hover:text-tinta transition-colors">
                  {e.rotulo}
                </a>
              ))}
            </div>
          ) : null}
          <a href="/#relatorio" className="lg:hidden botao text-[0.8125rem] min-h-0 py-1.5">
            relatório
          </a>
        </nav>
      </div>
    </header>
  );
}
