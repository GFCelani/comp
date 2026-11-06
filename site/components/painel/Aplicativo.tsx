"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icone } from "./Icones";
import { SECOES, ehSecao, type IdSecao } from "./secoes";

const SecaoAtiva = createContext<IdSecao>("visao-geral");

/** Seção visível agora (para quem só busca dados ao abrir, como o histórico). */
export function useSecaoAtiva(): IdSecao {
  return useContext(SecaoAtiva);
}

const NOME = "CopomAI";

function useSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const sair = useCallback(async () => {
    setSaindo(true);
    try {
      await fetch("/api/painel/sair", { method: "POST" });
    } finally {
      router.refresh();
      setSaindo(false);
    }
  }, [router]);
  return { sair, saindo };
}

export function Aplicativo({
  secaoInicial,
  contexto,
  secoes,
}: {
  secaoInicial: IdSecao;
  contexto: string;
  secoes: Partial<Record<IdSecao, React.ReactNode>>;
}) {
  const [ativa, setAtiva] = useState<IdSecao>(secaoInicial);
  const { sair, saindo } = useSair();
  const navCelular = useRef<HTMLElement>(null);

  // No celular, mantém a aba ativa visível no menu rolável.
  useEffect(() => {
    const nav = navCelular.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && el) nav.scrollTo({ left: Math.max(0, el.offsetLeft - 12) });
  }, [ativa]);

  // Abre na seção do hash (#modelos…) e acompanha voltar/avançar do navegador.
  useEffect(() => {
    const ler = () => {
      const h = window.location.hash.slice(1);
      if (ehSecao(h)) setAtiva(h);
    };
    ler();
    window.addEventListener("popstate", ler);
    window.addEventListener("hashchange", ler);
    return () => {
      window.removeEventListener("popstate", ler);
      window.removeEventListener("hashchange", ler);
    };
  }, []);

  function ir(id: IdSecao, e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (id !== ativa) window.history.pushState(null, "", `#${id}`);
    setAtiva(id);
    window.scrollTo({ top: 0 });
    document.getElementById("conteudo")?.focus({ preventScroll: true });
  }

  const atual = SECOES.find((s) => s.id === ativa) ?? SECOES[0];

  return (
    <SecaoAtiva.Provider value={ativa}>
      <div className="flex-1 bg-papel-2">
        {/* barra lateral (≥1024px) */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col border-r border-linha bg-papel lg:flex">
          <div className="px-5 pt-6 pb-5">
            <p className="text-[15px] font-semibold leading-tight">{NOME}</p>
            <p className="mt-0.5 text-[13px] text-tinta-3">painel</p>
          </div>
          <nav aria-label="Seções do painel" className="flex-1 overflow-y-auto px-3">
            <ul className="grid gap-0.5">
              {SECOES.map((s) => {
                const eh = s.id === ativa;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={(e) => ir(s.id, e)}
                      aria-current={eh ? "page" : undefined}
                      className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        eh
                          ? "bg-acento-suave font-medium text-acento"
                          : "text-tinta-2 hover:bg-papel-2 hover:text-tinta"
                      }`}
                    >
                      {eh && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-acento" />}
                      <Icone nome={s.id} />
                      {s.nome}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="grid gap-0.5 border-t border-linha px-3 py-4">
            <Link href="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-tinta-2 hover:bg-papel-2 hover:text-tinta">
              <Icone nome="site" />
              ver o site
            </Link>
            <button
              type="button"
              onClick={sair}
              disabled={saindo}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-tinta-2 hover:bg-papel-2 hover:text-tinta disabled:opacity-60"
            >
              <Icone nome="sair" />
              {saindo ? "saindo…" : "sair"}
            </button>
          </div>
        </aside>

        {/* barra superior (<1024px) */}
        <header className="sticky top-0 z-20 border-b border-linha bg-papel lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
            <p className="min-w-0 truncate text-sm font-semibold">
              {NOME} <span className="font-normal text-tinta-3">· painel</span>
            </p>
            <div className="flex flex-none items-center gap-1">
              <Link href="/" className="rounded-md px-2 py-1.5 text-[13px] text-tinta-2 hover:bg-papel-2">
                ver o site
              </Link>
              <button
                type="button"
                onClick={sair}
                disabled={saindo}
                className="rounded-md px-2 py-1.5 text-[13px] text-tinta-2 hover:bg-papel-2 disabled:opacity-60"
              >
                {saindo ? "saindo…" : "sair"}
              </button>
            </div>
          </div>
          <nav ref={navCelular} aria-label="Seções do painel" className="relative overflow-x-auto [scrollbar-width:none]">
            <ul className="flex w-max gap-1 px-3 pb-2.5">
              {SECOES.map((s) => {
                const eh = s.id === ativa;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={(e) => ir(s.id, e)}
                      aria-current={eh ? "page" : undefined}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] ${
                        eh ? "bg-acento-suave font-medium text-acento" : "text-tinta-2 hover:bg-papel-2"
                      }`}
                    >
                      {s.nome}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </header>

        <main id="conteudo" tabIndex={-1} className="outline-none lg:pl-[240px]">
          <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 xl:px-10">
            <header className="mb-6 lg:mb-8">
              <h1 className="font-serif text-[28px] font-medium leading-tight tracking-[-0.01em] sm:text-[32px]">
                {atual.titulo}
              </h1>
              <p className="rotulo num mt-1.5">{contexto}</p>
            </header>
            {SECOES.map((s) => (
              <div key={s.id} id={`secao-${s.id}`} hidden={s.id !== ativa}>
                {secoes[s.id]}
              </div>
            ))}
          </div>
        </main>
      </div>
    </SecaoAtiva.Provider>
  );
}
