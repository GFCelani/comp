"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Manchete que entra por linha: separa as palavras, descobre em que linha cada uma
 * caiu (offsetTop) e anima linha a linha, de baixo para cima, com fade.
 * Sem JS ou com movimento reduzido, o texto aparece normal (o CSS cuida disso).
 */
export function ManchetePorLinha({ texto, className, id }: { texto: string; className?: string; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [pronta, setPronta] = useState(false);
  const palavras = texto.split(/\s+/).filter(Boolean);

  useIsoLayout(() => {
    const h = ref.current;
    if (!h) return;
    const spans = Array.from(h.querySelectorAll<HTMLSpanElement>("[data-palavra]"));
    let linha = -1;
    let topo = -Infinity;
    for (const s of spans) {
      if (s.offsetTop > topo + 4) {
        linha += 1;
        topo = s.offsetTop;
      }
      s.style.setProperty("--linha", String(linha));
      s.style.setProperty("--i", String(spans.indexOf(s)));
    }
    setPronta(true);
  }, [texto]);

  return (
    <h1 ref={ref} id={id} className={`${className ?? ""} manchete-anim ${pronta ? "pronta" : ""}`}>
      {palavras.map((p, i) => (
        <span key={i} data-palavra className="palavra">
          {p}
          {i < palavras.length - 1 ? " " : ""}
        </span>
      ))}
    </h1>
  );
}

/** Número que conta de 0 até o valor (proporção 0–1 vira %), uma vez, em ~0,8 s. */
export function ContaAte({ valor, atraso = 300, duracao = 800, inteiro = false }: { valor: number; atraso?: number; duracao?: number; inteiro?: boolean }) {
  const alvo = inteiro ? Math.round(valor) : Math.round(valor * 100);
  const [n, setN] = useState(alvo);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let inicio = 0;
    const passo = (t: number) => {
      if (!inicio) inicio = t;
      const x = Math.min(1, Math.max(0, (t - inicio - atraso) / duracao));
      const suave = 1 - Math.pow(1 - x, 3);
      setN(Math.round(alvo * suave));
      if (x < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, atraso, duracao]);

  return (
    <span className="num" aria-label={inteiro ? String(alvo) : `${alvo}%`}>
      {n}
      {inteiro ? "" : "%"}
    </span>
  );
}
