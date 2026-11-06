import type { ConferenciaSelic, DadosSite } from "@/lib/dados";
import { dataHora } from "@/lib/formato";
import { Aguardando, BlocoAguardando, Cartao, Pares } from "./Partes";

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ConferenciaSelicCartao({ cs, resumida }: { cs: ConferenciaSelic | null | undefined; resumida?: boolean }) {
  if (!cs) {
    return (
      <Cartao titulo="Conferência da Selic">
        <BlocoAguardando texto="A conferência da Selic de cada reunião com o histórico oficial do Banco Central ainda não rodou." />
      </Cartao>
    );
  }
  const n = cs.divergencias.length;
  const colunas = Array.from(new Set(cs.divergencias.flatMap((d) => Object.keys(d))));
  return (
    <Cartao
      titulo="Conferência da Selic"
      descricao={
        <>
          Selic de cada reunião contra{" "}
          <a href={cs.fonte_url} target="_blank" rel="noopener noreferrer" className="link">
            o histórico de taxas do BC
          </a>
          .
        </>
      }
      acao={
        n === 0 ? (
          <span className="selo selo-ok">sem divergências</span>
        ) : (
          <span className="selo selo-erro">
            {n} {n === 1 ? "divergência" : "divergências"}
          </span>
        )
      }
    >
      <p className="num text-sm text-tinta-2">
        <span className="font-semibold text-tinta">{cs.n_comparadas}</span> reuniões comparadas · conferido em{" "}
        {dataHora(cs.verificado_em) ?? <span className="aguardando">aguardando</span>}
      </p>
      {n > 0 && !resumida && (
        <div className="relative mt-4 overflow-x-auto">
          <table className="tabela num">
            <thead>
              <tr>
                {colunas.map((c) => (
                  <th key={c} scope="col">
                    {c.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cs.divergencias.map((d, i) => (
                <tr key={i}>
                  {colunas.map((c) => (
                    <td key={c} className="break-words">
                      {valorLegivel(d[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}

type SelicOficial = {
  verificado_em?: string | null;
  fonte?: string | null;
  n_comparadas?: number | null;
  divergencias?: unknown[] | null;
  so_no_csv?: number[] | null;
  so_no_banco?: number[] | null;
};

type Citacoes = { secoes?: { paragrafos?: { citacoes?: unknown[] | null }[] | null }[] | null } | null;

const lista = (v: number[] | null | undefined) =>
  v === null || v === undefined ? <Aguardando /> : v.length === 0 ? "nenhuma" : v.map((n) => `${n}ª`).join(", ");

function SelicOficialCartao({ so }: { so: SelicOficial | null }) {
  if (!so) {
    return (
      <Cartao titulo="Selic contra o CSV oficial">
        <BlocoAguardando texto="A comparação com validacao/selic_oficial.csv ainda não rodou." />
      </Cartao>
    );
  }
  const div = so.divergencias?.length ?? null;
  return (
    <Cartao
      titulo="Selic contra o CSV oficial"
      descricao={so.fonte ?? undefined}
      acao={
        div === null ? null : div === 0 ? (
          <span className="selo selo-ok">sem divergências</span>
        ) : (
          <span className="selo selo-erro">
            {div} {div === 1 ? "divergência" : "divergências"}
          </span>
        )
      }
    >
      <Pares
        itens={[
          { rotulo: "reuniões comparadas", valor: so.n_comparadas ?? <Aguardando /> },
          { rotulo: "divergências", valor: div ?? <Aguardando /> },
          { rotulo: "só no CSV", valor: lista(so.so_no_csv) },
          { rotulo: "conferido em", valor: dataHora(so.verificado_em) ?? <Aguardando /> },
        ]}
      />
    </Cartao>
  );
}

function ChecagensCartao({ dados }: { dados: DadosSite }) {
  const bruto = dados as unknown as Record<string, unknown>;
  const pars = dados.atas.flatMap((a) => a.paragrafos ?? []);
  const comTrecho = pars.filter((p) => p.trecho !== null && p.trecho !== undefined).length;
  const rel = (bruto.relatorio ?? null) as Citacoes;
  const nCit = rel?.secoes
    ? rel.secoes.reduce((s, sec) => s + (sec.paragrafos ?? []).reduce((t, p) => t + (p.citacoes?.length ?? 0), 0), 0)
    : null;
  const status = (bruto.status ?? null) as Record<string, unknown> | null;
  const portao = bruto.portao ?? bruto.qualidade ?? status?.portao ?? status?.qualidade ?? null;
  const portaoTexto =
    portao === null || portao === undefined ? (
      <Aguardando />
    ) : typeof portao === "object" ? (
      <code className="break-all text-xs">{JSON.stringify(portao)}</code>
    ) : (
      String(portao)
    );
  return (
    <Cartao titulo="Checagens automáticas" descricao="Conferências que o pipeline faz a cada execução.">
      <Pares
        itens={[
          {
            rotulo: "parágrafos com trecho citado",
            valor: pars.length ? `${comTrecho.toLocaleString("pt-BR")} de ${pars.length.toLocaleString("pt-BR")}` : <Aguardando />,
          },
          { rotulo: "trechos inválidos", valor: dados.resumo.n_trechos_invalidos ?? <Aguardando /> },
          {
            rotulo: "citações do relatório",
            valor: nCit === null ? <Aguardando /> : `${nCit} conferidas com a ata`,
          },
          { rotulo: "atas processadas", valor: dados.resumo.n_atas ?? <Aguardando /> },
          { rotulo: "parágrafos processados", valor: dados.resumo.n_paragrafos?.toLocaleString("pt-BR") ?? <Aguardando /> },
          { rotulo: "último portão de qualidade", valor: portaoTexto },
        ]}
      />
      <p className="mt-4 text-[13px] leading-relaxed text-tinta-3">
        O relatório só é publicado se todas as citações conferem com o texto da ata.
      </p>
    </Cartao>
  );
}

export function SecaoValidacao({ dados }: { dados: DadosSite }) {
  const so = ((dados as unknown as Record<string, unknown>).validacao_selic_oficial ?? null) as SelicOficial | null;
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <ChecagensCartao dados={dados} />
      <div className="grid gap-6">
        <ConferenciaSelicCartao cs={dados.conferencia_selic} />
        <SelicOficialCartao so={so} />
      </div>
    </div>
  );
}
