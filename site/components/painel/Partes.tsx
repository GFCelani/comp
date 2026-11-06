/** Peças de apresentação do painel (sem estado: servem ao servidor e ao cliente). */

export function Cartao({
  titulo,
  descricao,
  acao,
  children,
  className = "",
}: {
  titulo?: React.ReactNode;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`cartao min-w-0 p-5 sm:p-6 ${className}`}>
      {(titulo || acao) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {titulo && <h3 className="text-[15px] font-semibold leading-snug">{titulo}</h3>}
            {descricao && <p className="mt-1 text-[13px] leading-relaxed text-tinta-3">{descricao}</p>}
          </div>
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  rotulo,
  valor,
  contexto,
  children,
}: {
  rotulo: string;
  valor?: React.ReactNode;
  contexto?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="cartao h-full min-w-0 p-5">
      <p className="rotulo">{rotulo}</p>
      {valor !== undefined && (
        <p className="num mt-2 text-[28px] font-semibold leading-none tracking-tight sm:text-[30px]">{valor}</p>
      )}
      {children}
      {contexto && <p className="mt-2.5 text-[13px] leading-snug text-tinta-3">{contexto}</p>}
    </div>
  );
}

export function Aguardando({ children = "aguardando" }: { children?: React.ReactNode }) {
  return <span className="aguardando">{children}</span>;
}

/** Bloco "aguardando" de um item inteiro, com a explicação do porquê. */
export function BlocoAguardando({ titulo, texto }: { titulo?: string; texto: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-dashed border-linha-2 bg-papel-2 p-5">
      {titulo && <p className="text-sm font-semibold">{titulo}</p>}
      <p className={titulo ? "mt-1" : ""}>
        <Aguardando />
      </p>
      <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-tinta-2">{texto}</p>
    </div>
  );
}

/** Lista de pares rótulo → valor, compacta. */
export function Pares({ itens }: { itens: { rotulo: string; valor: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-linha">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-[13px] text-tinta-3">{i.rotulo}</dt>
          <dd className="num ml-auto min-w-0 text-right text-sm text-tinta">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
