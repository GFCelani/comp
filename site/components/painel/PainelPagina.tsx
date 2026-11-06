import "server-only";
import { senhaConfigurada } from "@/lib/painel/senha";
import { sessaoAtual } from "@/lib/painel/guarda";
import { bancoConfigurado } from "@/lib/painel/db";
import { obterDados } from "@/lib/edicoes";
import { camposNovos } from "@/lib/previsao";
import { fraseUltimaVerificacao } from "@/lib/verificacao";
import { dataHora } from "@/lib/formato";
import { Aplicativo } from "./Aplicativo";
import { FormEntrada } from "./FormEntrada";
import type { IdSecao } from "./secoes";
import { SecaoVisaoGeral } from "./SecaoVisaoGeral";
import { SecaoModelos } from "./SecaoModelos";
import { SecaoValidacao } from "./SecaoValidacao";
import { SecaoDados } from "./SecaoDados";
import { SecaoTextos } from "./SecaoTextos";
import { SecaoHistorico } from "./SecaoHistorico";
import { SecaoAutomacao } from "./SecaoAutomacao";

function TelaCentral({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="flex flex-1 items-center justify-center bg-papel-2 px-4 py-16">
      <div className="cartao w-full max-w-[380px] p-6 sm:p-8">
        <p className="text-[15px] font-semibold">
          CopomAI <span className="font-normal text-tinta-3">· painel</span>
        </p>
        {children}
      </div>
    </main>
  );
}

/**
 * Porta do painel. Sem ADMIN_PASSWORD: só o aviso. Sem sessão: só o formulário de entrada
 * (nenhum dado vai para o HTML). Com sessão: o aplicativo inteiro.
 */
export async function PainelPagina({ secaoInicial }: { secaoInicial: IdSecao }) {
  if (!senhaConfigurada()) {
    return (
      <TelaCentral>
        <p className="mt-4 text-sm leading-relaxed text-tinta-2" role="status">
          Painel desativado: falta cadastrar ADMIN_PASSWORD na Vercel.
        </p>
      </TelaCentral>
    );
  }

  const sessao = await sessaoAtual();
  if (!sessao) {
    return (
      <TelaCentral>
        <p className="mt-1 mb-6 text-[13px] text-tinta-3">Acesso restrito ao time.</p>
        <FormEntrada />
      </TelaCentral>
    );
  }

  const [{ dados, fonteIndiceEscolhida }, verificacao] = await Promise.all([obterDados(), fraseUltimaVerificacao()]);
  const { campos } = camposNovos(dados);
  const u = dados.resumo.ultima_ata;
  const atualizado = dataHora(dados.gerado_em);
  const contexto = `dados de ${atualizado ?? "data aguardando"} · última ata: ${u.numero}ª`;

  return (
    <Aplicativo
      secaoInicial={secaoInicial}
      contexto={contexto}
      secoes={{
        "visao-geral": <SecaoVisaoGeral dados={dados} previsao={campos.previsao ?? null} />,
        modelos: <SecaoModelos dados={dados} previsao={campos.previsao ?? null} />,
        validacao: <SecaoValidacao dados={dados} />,
        dados: <SecaoDados dados={dados} />,
        textos: (
          <SecaoTextos
            bancoOk={bancoConfigurado()}
            ata={u.numero}
            mudancas={dados.mudancas.map((m) => ({
              paragrafo: m.paragrafo,
              trecho: m.trecho,
              explicacao: m.explicacao,
              efeito: m.efeito,
            }))}
            impacto={dados.impacto.texto}
            paragrafos={(dados.atas.find((a) => a.numero === u.numero)?.paragrafos ?? []).map((p) => ({
              paragrafo: p.paragrafo,
              nota: p.nota,
              trecho: p.trecho,
            }))}
            fonteIndice={fonteIndiceEscolhida ?? dados.fonte_indice}
            manchete={campos.manchete ?? null}
            relatorio={
              campos.relatorio
                ? {
                    origem: campos.relatorio.origem ?? null,
                    secoes: campos.relatorio.secoes.map((s) => ({
                      id: s.id,
                      titulo: s.titulo,
                      paragrafos: s.paragrafos.map((p) => ({
                        texto: p.texto,
                        citacoes: p.citacoes.map((c) => ({ id: c.id, ata: c.ata, paragrafo: c.paragrafo })),
                      })),
                    })),
                  }
                : null
            }
          />
        ),
        historico: <SecaoHistorico />,
        automacao: <SecaoAutomacao dados={dados} verificacao={verificacao} />,
      }}
    />
  );
}
