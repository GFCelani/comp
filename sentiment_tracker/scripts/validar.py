"""
Verificações automáticas dos rótulos (não depende de IA).

    .venv/bin/python scripts/validar.py --trechos 281 282    # confere formato e trechos de atas específicas
    .venv/bin/python scripts/validar.py --trechos            # todas as atas rotuladas

Um trecho é válido se, após normalizar espaços (e hifenização de quebra de linha), for substring
exata do parágrafo citado (ou do parágrafo removido da ata anterior, para mudanças "removido").
"""
import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOTES = RAIZ / "dados" / "lotes"
ROTULOS = RAIZ / "dados" / "rotulos"
DIMENSOES = {"inflacao_corrente", "expectativas", "balanco_riscos", "atividade_trabalho", "fiscal_credito",
             "externo", "orientacao_futura", "decisao_votacao", "outro"}


def norm(s: str) -> str:
    s = s.replace("­", "").replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", s).strip()


def contem(texto: str, trecho: str) -> bool:
    if not trecho:
        return False
    t, q = norm(texto), norm(trecho)
    return q in t or q.rstrip(".;:,") in t


def checar(n: int) -> list[str]:
    erros = []
    lote = json.loads((LOTES / f"ata_{n}.json").read_text(encoding="utf-8"))
    arq = ROTULOS / f"ata_{n}.json"
    if not arq.exists():
        return [f"ata {n}: sem arquivo de rótulos"]
    r = json.loads(arq.read_text(encoding="utf-8"))
    textos = {p["paragrafo"]: p["texto"] for p in lote["paragrafos"]}
    removidos = " ".join(p["texto"] for p in lote["removidos"])
    anteriores = {}
    if lote.get("anterior") and (LOTES / f"ata_{lote['anterior']}.json").exists():
        ant = json.loads((LOTES / f"ata_{lote['anterior']}.json").read_text(encoding="utf-8"))
        anteriores = {p["paragrafo"]: p["texto"] for p in ant["paragrafos"]}
    vistos = set()
    for p in r.get("paragrafos", []):
        k = p.get("paragrafo")
        vistos.add(k)
        if k not in textos:
            erros.append(f"ata {n} §{k}: parágrafo inexistente"); continue
        if p.get("dimensao") not in DIMENSOES:
            erros.append(f"ata {n} §{k}: dimensão inválida {p.get('dimensao')!r}")
        if p.get("tom") not in (-2, -1, 0, 1, 2):
            erros.append(f"ata {n} §{k}: tom inválido {p.get('tom')!r}")
        if p.get("sinal") not in (0, 1, 2):
            erros.append(f"ata {n} §{k}: sinal inválido {p.get('sinal')!r}")
        if not contem(textos[k], p.get("trecho", "")):
            erros.append(f"ata {n} §{k}: trecho não literal: {p.get('trecho', '')[:80]!r}")
        if len((p.get("trecho") or "").split()) > 30:
            erros.append(f"ata {n} §{k}: trecho com mais de 25 palavras")
    faltam = set(textos) - vistos
    if faltam:
        erros.append(f"ata {n}: parágrafos sem rótulo: {sorted(faltam)}")
    for i, m in enumerate(r.get("mudancas", [])):
        if m.get("direcao") not in (-2, -1, 0, 1, 2):
            erros.append(f"ata {n} mudança {i}: direção inválida {m.get('direcao')!r}")
        if m.get("tipo") == "removido":
            fonte = removidos + " " + anteriores.get(m.get("paragrafo_anterior"), "")
        else:
            fonte = textos.get(m.get("paragrafo"), "")
        if not contem(fonte, m.get("trecho", "")):
            erros.append(f"ata {n} mudança {i} ({m.get('tipo')} §{m.get('paragrafo')}): trecho não literal: "
                         f"{m.get('trecho', '')[:80]!r}")
    res = r.get("resumo", {})
    for c in ("tom_nivel", "surpresa"):
        if not isinstance(res.get(c), (int, float)) or not -2 <= res[c] <= 2:
            erros.append(f"ata {n}: resumo.{c} inválido")
    return erros


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--trechos", nargs="*", type=int)
    a = ap.parse_args()
    nums = a.trechos or sorted(int(p.stem.split("_")[1]) for p in ROTULOS.glob("ata_*.json"))
    total = []
    for n in nums:
        e = checar(n)
        total += e
        print(f"ata {n}: {'OK' if not e else f'{len(e)} problema(s)'}")
    for e in total:
        print("  -", e)
    sys.exit(1 if total else 0)
