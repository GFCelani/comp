/** Ícones de 16px em traço fino, desenhados aqui (sem biblioteca). */

const caminhos: Record<string, React.ReactNode> = {
  "visao-geral": (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </>
  ),
  modelos: (
    <>
      <path d="M2.5 13.5h11" />
      <path d="M4.5 11V7.5M8 11V4.5M11.5 11V8.5" />
    </>
  ),
  validacao: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.75 8.1l1.6 1.6 2.9-3.2" />
    </>
  ),
  dados: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="1.75" />
      <path d="M3 4v8c0 .97 2.24 1.75 5 1.75s5-.78 5-1.75V4" />
      <path d="M3 8c0 .97 2.24 1.75 5 1.75S13 8.97 13 8" />
    </>
  ),
  textos: (
    <>
      <path d="M10.5 3l2.5 2.5L6 12.5H3.5V10L10.5 3z" />
      <path d="M9 4.5L11.5 7" />
    </>
  ),
  historico: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.25l2 1.25" />
    </>
  ),
  automacao: (
    <>
      <path d="M13 6.5A5.25 5.25 0 0 0 3.6 5" />
      <path d="M3 9.5A5.25 5.25 0 0 0 12.4 11" />
      <path d="M3.25 2.75V5.25H5.75M12.75 13.25V10.75H10.25" />
    </>
  ),
  site: (
    <>
      <path d="M6 3.5H3.5v9h9V10" />
      <path d="M9 3h4v4M13 3L7.5 8.5" />
    </>
  ),
  sair: (
    <>
      <path d="M6.5 13H3.5V3h3" />
      <path d="M10 5l3 3-3 3M13 8H6.5" />
    </>
  ),
};

export function Icone({ nome, className = "" }: { nome: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      {caminhos[nome]}
    </svg>
  );
}
