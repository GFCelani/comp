"use client";

import { useEffect, useRef } from "react";

/**
 * Fundo vivo do hero: o índice de tom e a Selic ao longo das reuniões, em linhas
 * finas e de baixa opacidade, desenhando-se uma vez; parallax leve ao rolar.
 * Decorativo (aria-hidden); respeita prefers-reduced-motion.
 */
export function FundoHero({ tom, selic }: { tom: (number | null)[]; selic: number[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const mover = () => {
      raf = 0;
      const y = Math.min(window.scrollY, 900);
      if (ref.current) ref.current.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(mover);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const W = 1200;
  const H = 400;
  const n = tom.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const yTom = (v: number) => H * 0.55 - (v / 2) * H * 0.42;
  let dTom = "";
  let novo = true;
  tom.forEach((v, i) => {
    if (v === null) {
      novo = true;
      return;
    }
    dTom += `${novo ? "M" : "L"}${x(i).toFixed(1)} ${yTom(v).toFixed(1)} `;
    novo = false;
  });
  const sMax = Math.max(...selic, 1);
  const ySel = (v: number) => H * 0.95 - (v / sMax) * H * 0.4;
  let dSel = "";
  selic.forEach((v, i) => {
    dSel += i === 0 ? `M${x(i).toFixed(1)} ${ySel(v).toFixed(1)} ` : `H${x(i).toFixed(1)} V${ySel(v).toFixed(1)} `;
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={ref} className="absolute inset-x-0 top-[18%] bottom-0 will-change-transform">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
          <path className="fundo-linha" d={dSel} pathLength={1} stroke="var(--tinta-3)" strokeOpacity="0.16" strokeWidth="1.2" fill="none" vectorEffect="non-scaling-stroke" />
          <path className="fundo-linha fundo-linha-2" d={dTom} pathLength={1} stroke="var(--acento)" strokeOpacity="0.2" strokeWidth="1.6" fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {/* véu para o texto ficar sempre legível sobre as linhas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgb(255_255_255/0.85),rgb(255_255_255/0.35)_70%)]" />
    </div>
  );
}
