/** Seções do painel: id (vai no hash da URL), nome na navegação e título do cabeçalho. */

export const SECOES = [
  { id: "visao-geral", nome: "Visão geral", titulo: "Visão geral" },
  { id: "modelos", nome: "Modelos", titulo: "Modelos de previsão" },
  { id: "validacao", nome: "Validação", titulo: "Validação" },
  { id: "dados", nome: "Dados", titulo: "Dados do pipeline" },
  { id: "textos", nome: "Textos", titulo: "Textos publicados" },
  { id: "historico", nome: "Histórico", titulo: "Histórico de edições" },
  { id: "automacao", nome: "Automação", titulo: "Automação" },
] as const;

export type IdSecao = (typeof SECOES)[number]["id"];

export function ehSecao(v: string): v is IdSecao {
  return SECOES.some((s) => s.id === v);
}
