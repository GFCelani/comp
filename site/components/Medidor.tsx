/**
 * Medidor pequeno no estilo do símbolo da logo: meia-lua fria (brando) à esquerda,
 * quente (duro) à direita, ponteiro girando de −2 até o valor (CSS, uma vez).
 */
export function Medidor({ valor, className = "" }: { valor: number | null; className?: string }) {
  if (valor === null) return null;
  const v = Math.max(-2, Math.min(2, valor));
  const graus = (v / 2) * 90; // −90° (−2) a +90° (+2)
  return (
    <svg viewBox="0 0 64 38" className={className} role="img" aria-label={`Medidor do tom: ${valor.toFixed(2).replace(".", ",")} numa escala de −2 a +2`}>
      <path d="M8 32a24 24 0 0 1 24-24" stroke="var(--brando-forte)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M32 8a24 24 0 0 1 24 24" stroke="var(--duro-forte)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <line x1="32" y1="2.5" x2="32" y2="6" stroke="var(--papel)" strokeWidth="1.5" />
      <g className="medidor-ponteiro" style={{ ["--angulo" as string]: `${graus}deg`, transformOrigin: "32px 32px" }}>
        <line x1="32" y1="32" x2="32" y2="13" stroke="var(--tinta)" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <circle cx="32" cy="32" r="3.6" fill="var(--tinta)" />
    </svg>
  );
}
