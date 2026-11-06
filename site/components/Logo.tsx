/**
 * Logo do CopomAI: um medidor de tom em meia-lua (frio = brando à esquerda,
 * quente = duro à direita) com o ponteiro em petróleo, mais o nome.
 * O símbolo é o mesmo de app/icon.svg (favicon).
 */
export function SimboloCopomAI({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect width="32" height="32" rx="8" fill="var(--acento)" />
      {/* arco do medidor: metade fria, metade quente */}
      <path d="M7 21a9 9 0 0 1 9-9" stroke="#8fb6ec" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 12a9 9 0 0 1 9 9" stroke="#f0a46a" strokeWidth="3" strokeLinecap="round" />
      {/* ponteiro levemente para o lado duro */}
      <path d="M16 21l4.6-6.2" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.4" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ className = "", tamanho = "md" }: { className?: string; tamanho?: "sm" | "md" | "lg" }) {
  const simbolo = tamanho === "lg" ? "h-9 w-9" : tamanho === "sm" ? "h-6 w-6" : "h-8 w-8";
  const texto = tamanho === "lg" ? "text-[1.6rem]" : tamanho === "sm" ? "text-[1.0625rem]" : "text-[1.4rem]";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SimboloCopomAI className={`${simbolo} shrink-0`} />
      <span className={`font-sans font-semibold tracking-[-0.035em] leading-none text-tinta ${texto}`}>
        Copom<span className="text-acento">AI</span>
      </span>
    </span>
  );
}
