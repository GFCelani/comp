import type { DadosSite } from "@/lib/dados";
import { dataHora } from "@/lib/formato";
import { Aguardando, Cartao, Pares } from "./Partes";
import { ConferenciaSelicCartao } from "./SecaoValidacao";

/** `status` do dados_site.json (não está no tipo DadosSite). Todos os campos podem faltar. */
type Status = {
  ultima_verificacao?: string | null;
  ultimo_commit_keepalive?: string | null;
  token_cadastrado_em?: string | null;
  token_expira_em?: string | null;
  fluxo?: {
    agenda?: string | null;
    ultima_ata_no_banco?: number | null;
    atas_novas?: unknown[] | null;
    pendencias?: unknown[] | null;
    token_no_ambiente?: boolean | null;
  } | null;
};

function texto(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return `${v}ª ata`;
  return JSON.stringify(v);
}

function quando(iso: string | null | undefined) {
  return dataHora(iso) ?? <Aguardando />;
}

export function SecaoAutomacao({ dados, verificacao }: { dados: DadosSite; verificacao: string }) {
  const st = ((dados as DadosSite & { status?: Status | null }).status ?? null) as Status | null;
  const fluxo = st?.fluxo ?? null;
  const pend = fluxo?.pendencias ?? null;
  const novas = fluxo?.atas_novas ?? null;
  const token = fluxo?.token_no_ambiente;

  return (
    <div className="grid gap-6">
      <div className="cartao flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <p className="num text-[15px] font-medium">{verificacao}</p>
        {pend && pend.length === 0 ? (
          <span className="selo selo-ok">nenhuma pendência</span>
        ) : pend && pend.length > 0 ? (
          <span className="selo selo-alerta">
            {pend.length} {pend.length === 1 ? "pendência" : "pendências"}
          </span>
        ) : (
          <span className="aguardando">pendências: aguardando</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Fluxo automático" descricao="Verifica se saiu ata nova, processa e publica o site sozinho.">
          <Pares
            itens={[
              { rotulo: "agenda", valor: fluxo?.agenda ?? <Aguardando /> },
              { rotulo: "última verificação (JSON)", valor: quando(st?.ultima_verificacao ?? dados.ultima_verificacao) },
              { rotulo: "último commit de manutenção", valor: quando(st?.ultimo_commit_keepalive) },
              {
                rotulo: "última ata no banco",
                valor: typeof fluxo?.ultima_ata_no_banco === "number" ? `${fluxo.ultima_ata_no_banco}ª` : <Aguardando />,
              },
              {
                rotulo: "atas novas",
                valor: !novas ? <Aguardando /> : novas.length === 0 ? "nenhuma" : novas.map(texto).join(", "),
              },
            ]}
          />
        </Cartao>

        <Cartao titulo="Token do Claude" descricao="Segredo usado pelo fluxo no GitHub Actions. O valor nunca aparece aqui.">
          <Pares
            itens={[
              {
                rotulo: "no ambiente do fluxo",
                valor:
                  token === true ? (
                    <span className="selo selo-ok">presente</span>
                  ) : token === false ? (
                    <span className="selo selo-alerta">ausente</span>
                  ) : (
                    <Aguardando />
                  ),
              },
              { rotulo: "cadastrado em", valor: quando(st?.token_cadastrado_em) },
              { rotulo: "validade", valor: quando(st?.token_expira_em) },
            ]}
          />
        </Cartao>
      </div>

      {(!pend || pend.length > 0) && (
        <Cartao titulo="Pendências">
          {!pend ? (
            <Aguardando />
          ) : (
            <ul className="grid gap-2 text-sm">
              {pend.map((p, i) => (
                <li key={i} className="flex items-start gap-2 break-words">
                  <span className="selo selo-alerta flex-none">pendente</span>
                  <span className="min-w-0">{texto(p)}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      )}

      <ConferenciaSelicCartao cs={dados.conferencia_selic} resumida />
    </div>
  );
}
