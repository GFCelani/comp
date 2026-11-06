import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { senhaConfigurada } from "@/lib/painel/senha";
import { sessaoAtual } from "@/lib/painel/guarda";
import { bancoConfigurado } from "@/lib/painel/db";
import { obterDados } from "@/lib/edicoes";
import { FormLogin } from "./FormLogin";
import { Editor } from "./Editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editar · Tradutor do Copom",
  robots: { index: false, follow: false },
};

export default async function Editar() {
  const temSenha = Boolean(senhaConfigurada());
  const sessao = temSenha ? await sessaoAtual() : null;

  let conteudo: React.ReactNode;
  if (!temSenha) {
    conteudo = (
      <div className="cartao p-5 border-dashed" role="status">
        <p className="font-semibold">edição desativada: ADMIN_PASSWORD não configurada</p>
        <p className="text-sm text-texto-2 mt-1">
          O site público continua funcionando com os dados do pipeline. Para liberar a edição, cadastre a variável
          ADMIN_PASSWORD no projeto da Vercel.
        </p>
      </div>
    );
  } else if (!sessao) {
    conteudo = <FormLogin />;
  } else if (!bancoConfigurado()) {
    conteudo = (
      <div className="cartao p-5 border-dashed" role="status">
        <p className="font-semibold">banco não configurado</p>
        <p className="text-sm text-texto-2 mt-1">
          Você entrou, mas as edições precisam do banco. Cadastre DATABASE_URL (Neon, pela aba Storage da Vercel).
        </p>
      </div>
    );
  } else {
    const { dados, fonteIndiceEscolhida } = await obterDados();
    const u = dados.resumo.ultima_ata;
    conteudo = (
      <Editor
        ata={u.numero}
        mudancas={dados.mudancas.map((m) => ({ paragrafo: m.paragrafo, trecho: m.trecho, explicacao: m.explicacao, efeito: m.efeito }))}
        impacto={dados.impacto.texto}
        paragrafos={(dados.atas.find((a) => a.numero === u.numero)?.paragrafos ?? []).map((p) => ({
          paragrafo: p.paragrafo,
          nota: p.nota,
          trecho: p.trecho,
        }))}
        fonteIndice={fonteIndiceEscolhida ?? dados.fonte_indice}
      />
    );
  }

  return (
    <>
      <Cabecalho atual="painel" />
      <main id="conteudo" className="mx-auto w-full max-w-[1180px] px-4 pb-8">
        <header className="pt-10 sm:pt-14">
          <span className="pilula">painel · edição pelo time</span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-semibold leading-[1.05]">
            Revisar os textos
            <br />e as notas
          </h1>
          <p className="mt-4 text-texto-2 max-w-[62ch]">
            Cada alteração fica guardada com o valor antigo, o novo e o motivo. O JSON do pipeline nunca muda: o site
            aplica a edição mais recente por cima e marca o item como “revisado pelo time”.
          </p>
          <hr className="regua-forte mt-6" />
        </header>
        <div className="mt-8">{conteudo}</div>
      </main>
      <Rodape />
    </>
  );
}
