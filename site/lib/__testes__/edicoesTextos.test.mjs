// Rode em site/: node lib/__testes__/edicoesTextos.test.mjs  (Node 24 remove os tipos do .ts sozinho)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aplicarEdicoesTextos, validarParagrafo, validarManchete, lerChaveParagrafo, ataDosTextos, limiteParagrafo } from "../edicoesTextos.ts";

const base = JSON.parse(readFileSync(new URL("../../data/dados_site.json", import.meta.url), "utf8"));
const copia = () => structuredClone(base);
const ata = ataDosTextos(base);
const p0 = base.relatorio.secoes.find((s) => s.id === "mudou").paragrafos[0];
const ids = p0.citacoes.map((c) => c.id);

test("ata dos textos vem do relatório/previsão", () => {
  assert.equal(ata, base.previsao.base_ata);
});

test("lerChaveParagrafo", () => {
  assert.deepEqual(lerChaveParagrafo("281.mudou.0"), { ata: 281, secao: "mudou", i: 0 });
  assert.equal(lerChaveParagrafo("281.mudou"), null);
  assert.equal(lerChaveParagrafo("x.mudou.0"), null);
});

test("validarParagrafo: aceita marcadores do original", () => {
  assert.deepEqual(validarParagrafo(`Texto novo [[${ids[0]}]].`, ids), { ok: true });
});

test("validarParagrafo: recusa sem marcador", () => {
  const v = validarParagrafo("Texto sem citação.", ids);
  assert.equal(v.ok, false);
  assert.match(v.motivo, /pelo menos um marcador/);
});

test("validarParagrafo: recusa citação inventada", () => {
  const v = validarParagrafo(`Texto [[${ids[0]}]] e [[c99]].`, ids);
  assert.equal(v.ok, false);
  assert.match(v.motivo, /\[\[c99\]\]/);
});

test("limiteParagrafo: 1,5 vez o original, entre 300 e 1500", () => {
  assert.equal(limiteParagrafo(100), 300);
  assert.equal(limiteParagrafo(400), 600);
  assert.equal(limiteParagrafo(2000), 1500);
});

test("validarParagrafo: limite relativo ao original", () => {
  const m = ` [[${ids[0]}]].`;
  const tam = p0.texto.length;
  const lim = limiteParagrafo(tam);
  assert.ok(lim > 300, "parágrafo original real ultrapassa o antigo limite de 300/1,5");
  assert.equal(validarParagrafo("a".repeat(lim - m.length) + m, ids, tam).ok, true);
  const v = validarParagrafo("a".repeat(lim + 1 - m.length) + m, ids, tam);
  assert.equal(v.ok, false);
  assert.match(v.motivo, /longo demais/);
});

test("validarParagrafo: recusa vazio", () => {
  assert.equal(validarParagrafo("   ", ids).ok, false);
});

test("validarManchete: vazio e limite de 300", () => {
  assert.equal(validarManchete("").ok, false);
  assert.equal(validarManchete("a".repeat(301)).ok, false);
  assert.equal(validarManchete("a".repeat(300)).ok, true);
});

test("aplica manchete, linha fina e parágrafo da ata atual", () => {
  const d = copia();
  const novo = `Parágrafo revisado [[${ids[0]}]].`;
  const r = aplicarEdicoesTextos(d, [
    { campo: "manchete.texto", chave: String(ata), valor_novo: "Manchete revisada" },
    { campo: "manchete.linha_fina", chave: String(ata), valor_novo: "Linha fina revisada" },
    { campo: "relatorio.paragrafo", chave: `${ata}.mudou.0`, valor_novo: novo },
  ]);
  assert.equal(d.manchete.texto, "Manchete revisada");
  assert.equal(d.manchete.linha_fina, "Linha fina revisada");
  assert.equal(d.relatorio.secoes.find((s) => s.id === "mudou").paragrafos[0].texto, novo);
  assert.equal(r.manchete, true);
  assert.equal(r.linhaFina, true);
  assert.deepEqual([...r.relatorioParagrafos], [`${ata}.mudou.0`]);
  assert.deepEqual(d.relatorio.secoes[0].paragrafos[0].citacoes, p0.citacoes, "citações não mudam");
  assert.equal(base.manchete.texto !== "Manchete revisada", true, "base intacta");
});

test("ignora chave de outra ata (relatório regenerado)", () => {
  const d = copia();
  const r = aplicarEdicoesTextos(d, [
    { campo: "manchete.texto", chave: String(ata - 1), valor_novo: "Velha" },
    { campo: "relatorio.paragrafo", chave: `${ata - 1}.mudou.0`, valor_novo: `Velho [[${ids[0]}]]` },
  ]);
  assert.equal(d.manchete.texto, base.manchete.texto);
  assert.equal(d.relatorio.secoes[0].paragrafos[0].texto, p0.texto);
  assert.equal(r.manchete, false);
  assert.equal(r.relatorioParagrafos.size, 0);
});

test("ignora parágrafo inexistente, seção fora da lista e marcador inválido", () => {
  const d = copia();
  const r = aplicarEdicoesTextos(d, [
    { campo: "relatorio.paragrafo", chave: `${ata}.mudou.99`, valor_novo: `X [[${ids[0]}]]` },
    { campo: "relatorio.paragrafo", chave: `${ata}.outra.0`, valor_novo: `X [[${ids[0]}]]` },
    { campo: "relatorio.paragrafo", chave: `${ata}.mudou.0`, valor_novo: "Sem marcador" },
  ]);
  assert.equal(r.relatorioParagrafos.size, 0);
  assert.equal(d.relatorio.secoes[0].paragrafos[0].texto, p0.texto);
});

test("vale a última edição da lista para o mesmo campo+chave", () => {
  const d = copia();
  aplicarEdicoesTextos(d, [
    { campo: "manchete.texto", chave: String(ata), valor_novo: "Primeira" },
    { campo: "manchete.texto", chave: String(ata), valor_novo: "Segunda" },
  ]);
  assert.equal(d.manchete.texto, "Segunda");
});
