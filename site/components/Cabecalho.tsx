"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

/*
 * Cabeçalho portado do Header do cartoes-nfc (mesma estrutura, medidas, histerese,
 * cápsula de vidro, curva e duração), com o conteúdo do CopomAI.
 * Estático: fica no topo da página, sem fundo nem borda, e rola junto com o conteúdo.
 * A cápsula de vidro só aparece com o menu do celular aberto.
 */

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const FOCO =
  "outline-none focus-visible:ring-2 focus-visible:ring-acento focus-visible:ring-offset-2 focus-visible:ring-offset-papel";

const VIDRO = "border border-[rgba(16,19,23,0.1)] backdrop-blur-[20px] backdrop-saturate-[130%]";

const ITENS = [
  { href: "#relatorio", nome: "Relatório", num: "01" },
  { href: "#previsao", nome: "Previsão", num: "02" },
  { href: "#tom", nome: "Dados", num: "03" },
  { href: "#ferramentas", nome: "Ferramentas", num: "04" },
];

const ITEM =
  "relative flex cursor-pointer items-center gap-[5.6px] rounded-[4px] px-[8px] py-[7.5px] text-[14px] leading-[1.65] text-tinta xl:px-[11px] xl:text-[15px] " +
  "transition-colors duration-200 hover:text-acento " +
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 " +
  "after:bg-acento after:transition-[scale] after:duration-300 after:ease-out hover:after:scale-x-100 " +
  FOCO;

function Num({ children }: { children: string }) {
  return <span className="font-mono text-[9.4px] leading-none tracking-[0.16em] text-acento">{children}</span>;
}

/** `atual` fica por compatibilidade; o painel tem o próprio cabeçalho. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Cabecalho(_props: { atual?: "site" | "painel" } = {}) {
  const [pronto, setPronto] = useState(false);
  const [menu, setMenu] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  useEffect(() => {
    /* a transição do menu só liga depois da primeira pintura */
    const t = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      botaoMenu.current?.focus();
    };
    const largo = window.matchMedia("(min-width: 1024px)");
    const fechar = () => {
      if (largo.matches) setMenu(false);
    };
    document.addEventListener("keydown", tecla);
    largo.addEventListener("change", fechar);
    return () => {
      html.style.overflow = antes;
      document.removeEventListener("keydown", tecla);
      largo.removeEventListener("change", fechar);
    };
  }, [menu]);

  const trans = pronto ? "duration-[420ms] ease-[cubic-bezier(0.22,0.7,0.28,1)]" : "";
  /* a cápsula fica uns 29px mais larga que a fileira, sem chegar a menos de 12px da borda */
  const sobra = "calc(-1 * max(0px, min(29px, (100vw - 100%) / 2 - 12px)))";

  return (
    <>
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-40 px-3 pt-4 lg:px-6 lg:pt-[22px]",
        )}
      >
        <div className="relative mx-auto flex h-16 max-w-[1162px] items-center justify-between px-5 lg:grid lg:h-[70px] lg:grid-cols-[1fr_auto_1fr] lg:gap-x-[19px] lg:px-[26px]">
          <span
            aria-hidden
            style={{ left: sobra, right: sobra }}
            className={cn(
              VIDRO,
              "pointer-events-none absolute inset-y-1 rounded-[12px] bg-[rgba(255,255,255,0.74)] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_18px_44px_-28px_rgba(16,19,23,0.35)] lg:inset-y-[7px]",
              pronto && cn("transition-[opacity,visibility]", trans),
              menu ? "visible opacity-100" : "invisible opacity-0",
            )}
          />

          <Link href="/" className={cn("relative flex min-h-11 items-center rounded-[4px] lg:justify-self-start", FOCO)}>
            <Logo tamanho="md" className="lg:hidden" />
            <Logo tamanho="lg" className="max-lg:hidden" />
            <span className="sr-only">, início</span>
          </Link>

          <nav aria-label="Principal" className="max-lg:hidden lg:justify-self-center">
            <ul className="flex items-center gap-[2px] xl:gap-[3.75px]">
              {ITENS.map((it) => (
                <li key={it.href}>
                  <a href={it.href} className={ITEM}>
                    <Num>{it.num}</Num>
                    {it.nome}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <a
            href="#relatorio"
            className={cn(
              "relative flex h-[42px] items-center rounded-[10px] border border-acento bg-acento px-[15px] text-[13.125px] leading-none font-medium whitespace-nowrap text-papel transition-colors duration-200 hover:bg-acento-2 hover:border-acento-2 max-lg:hidden lg:justify-self-end",
              FOCO,
            )}
          >
            Ler o relatório
          </a>

          <button
            ref={botaoMenu}
            type="button"
            aria-expanded={menu}
            aria-controls={idMenu}
            aria-label={menu ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenu((v) => !v)}
            className={cn(
              "relative -mr-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] text-tinta transition-colors duration-200 lg:hidden",
              menu && "bg-[rgba(16,19,23,0.06)]",
              FOCO,
            )}
          >
            <span aria-hidden className="relative block h-4 w-6">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "absolute left-0 block h-px w-6 bg-current transition-[translate,rotate,opacity] duration-300 ease-out",
                    i === 0 && "top-0",
                    i === 1 && "top-2",
                    i === 2 && "top-4",
                    menu && i === 0 && "translate-y-2 rotate-45",
                    menu && i === 1 && "opacity-0",
                    menu && i === 2 && "-translate-y-2 -rotate-45",
                  )}
                />
              ))}
            </span>
          </button>
        </div>
      </header>

      <div
        aria-hidden
        onClick={() => setMenu(false)}
        className={cn(
          "fixed inset-0 z-30 bg-[rgba(16,19,23,0.32)] lg:hidden",
          pronto && "transition-[opacity,visibility] duration-300",
          menu ? "visible opacity-100" : "invisible opacity-0",
        )}
      />
      <div
        id={idMenu}
        inert={!menu}
        className={cn(
          VIDRO,
          "fixed inset-x-3 top-[84px] z-40 max-h-[calc(100dvh-96px)] overflow-y-auto overscroll-contain rounded-[12px] bg-[rgba(255,255,255,0.96)] px-6 pt-2 pb-6 lg:hidden",
          pronto && "transition-[opacity,translate,visibility] duration-300 ease-out",
          menu ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        )}
      >
        <nav aria-label="Menu">
          <ul className="flex flex-col">
            {ITENS.map((it) => (
              <li key={it.href} className="border-b border-[rgba(16,19,23,0.1)]">
                <a
                  href={it.href}
                  onClick={() => setMenu(false)}
                  className={cn("flex min-h-14 items-center gap-3 rounded-[4px] text-[17px] text-tinta hover:text-acento", FOCO)}
                >
                  <span className="font-mono text-[10px] tracking-[0.16em] text-acento">{it.num}</span>
                  {it.nome}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#relatorio"
            onClick={() => setMenu(false)}
            className={cn(
              "mt-6 flex h-12 items-center justify-center rounded-[10px] bg-acento text-[15px] font-medium text-papel hover:bg-acento-2",
              FOCO,
            )}
          >
            Ler o relatório
          </a>
        </nav>
      </div>
    </>
  );
}
