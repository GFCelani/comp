import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/painel/guarda";
import { bancoConfigurado, gravarConfig, listarEdicoes, registrarEdicao } from "@/lib/painel/db";
import { obterDados, trechoValido } from "@/lib/edicoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_TEXTO = 2000;

function erro(mensagem: string, status = 400) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function GET() {
  const auth = await exigirSessao();
  if (!auth.ok) return auth.resposta;
  if (!bancoConfigurado()) return erro("Banco não configurado: falta DATABASE_URL.", 503);
  try {
    return NextResponse.json({ edicoes: await listarEdicoes(200) });
  } catch (e) {
    console.error("[painel] listar edições:", e);
    return erro("O banco não respondeu. Tente de novo.", 503);
  }
}

type Pedido = {
  campo?: unknown;
  indice?: unknown;
  ata?: unknown;
  paragrafo?: unknown;
  valor?: unknown;
  motivo?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await exigirSessao();
  if (!auth.ok) return auth.resposta;
  if (!bancoConfigurado()) return erro("Banco não configurado: falta DATABASE_URL.", 503);

  let p: Pedido;
  try {
    p = (await request.json()) as Pedido;
  } catch {
    return erro("Pedido inválido.");
  }

  const motivo = typeof p.motivo === "string" ? p.motivo.trim().slice(0, 500) : "";
  const valor = typeof p.valor === "string" ? p.valor.trim() : "";
  if (valor.length > LIMITE_TEXTO) return erro(`Texto longo demais (máximo ${LIMITE_TEXTO} caracteres).`);

  const { dados } = await obterDados();
  const ata = dados.resumo.ultima_ata.numero;

  try {
    if (p.campo === "mudanca.trecho" || p.campo === "mudanca.explicacao") {
      const i = Number(p.indice);
      const m = Number.isInteger(i) ? dados.mudancas[i] : undefined;
      if (!m) return erro("Mudança não encontrada.");
      if (!valor) return erro("O texto não pode ficar vazio.");
      if (p.campo === "mudanca.trecho") {
        const v = trechoValido(ata, m.paragrafo, valor);
        if (!v.ok) return erro(v.motivo, 422);
      }
      const antigo = p.campo === "mudanca.trecho" ? m.trecho : m.explicacao;
      if (antigo === valor) return erro("Nada mudou.");
      await registrarEdicao({ campo: p.campo, chave: `${ata}.${i}`, valor_antigo: antigo, valor_novo: valor, motivo: motivo || null });
    } else if (p.campo === "impacto.texto") {
      if (!valor) return erro("O texto não pode ficar vazio.");
      if (valor === dados.impacto.texto) return erro("Nada mudou.");
      await registrarEdicao({
        campo: "impacto.texto",
        chave: String(ata),
        valor_antigo: dados.impacto.texto,
        valor_novo: valor,
        motivo: motivo || null,
      });
    } else if (p.campo === "nota") {
      const a = Number(p.ata);
      const par = Number(p.paragrafo);
      const nota = Number(valor);
      if (!Number.isInteger(nota) || nota < -2 || nota > 2) return erro("A nota tem de ser um inteiro de −2 a +2.");
      if (!motivo) return erro("Explique o motivo da mudança de nota.");
      const item = dados.atas.find((x) => x.numero === a)?.paragrafos.find((x) => x.paragrafo === par);
      if (!item) return erro("Parágrafo não encontrado entre os que têm nota nesta ata.");
      if (item.nota === nota) return erro("Nada mudou.");
      await registrarEdicao({ campo: "nota", chave: `${a}.${par}`, valor_antigo: String(item.nota), valor_novo: String(nota), motivo });
    } else if (p.campo === "config.fonte_indice") {
      if (valor !== "simples" && valor !== "modelo") return erro("Fonte do índice deve ser “simples” ou “modelo”.");
      await gravarConfig("fonte_indice", valor);
      await registrarEdicao({ campo: "config.fonte_indice", chave: "fonte_indice", valor_antigo: null, valor_novo: valor, motivo: motivo || null });
    } else {
      return erro("Campo não editável.");
    }
  } catch (e) {
    console.error("[painel] salvar edição:", e);
    return erro("O banco não respondeu. A edição não foi salva.", 503);
  }

  revalidatePath("/");
  revalidatePath("/painel");
  return NextResponse.json({ ok: true });
}
