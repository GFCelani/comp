"""
Compara a última ata com a anterior → saida/diff_ultimas.json (formato do CONTRATO.md).

Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/diff.py              # duas atas mais recentes do banco
    .venv/Scripts/python.exe pipeline/diff.py 280 281      # par específico

Mesma lógica de `comparar` em avancado/case2_copom/extrair_atas.py: para cada parágrafo
da ata nova procura o mais parecido na anterior (difflib); ≥ 0,95 = igual, ≥ 0,5 = alterado,
abaixo = novo; o que sobrou na anterior = removido.
"""
import difflib
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARQ_PARAGRAFOS = RAIZ / "banco" / "paragrafos.jsonl"
ARQ_SAIDA = RAIZ / "saida" / "diff_ultimas.json"
IGUAL, ALTERADO = 0.95, 0.5


def diff_palavras(a: str, b: str) -> str:
    """Mostra ~~removido~~ e **adicionado** palavra a palavra."""
    pa, pb = a.split(), b.split()
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, pa, pb).get_opcodes():
        if op == "equal":
            out.append(" ".join(pb[j1:j2]))
        if op in ("delete", "replace"):
            out.append("~~" + " ".join(pa[i1:i2]) + "~~")
        if op in ("insert", "replace"):
            out.append("**" + " ".join(pb[j1:j2]) + "**")
    return " ".join(out)


def carregar_paragrafos() -> dict[int, list[dict]]:
    por_ata: dict[int, list[dict]] = {}
    for linha in ARQ_PARAGRAFOS.read_text(encoding="utf-8").splitlines():
        if linha.strip():
            p = json.loads(linha)
            por_ata.setdefault(p["ata"], []).append(p)
    return por_ata


def comparar(anterior: list[dict], atual: list[dict]) -> dict:
    usados = set()
    novos, alterados, iguais = [], [], 0
    for par in atual:
        notas = [(difflib.SequenceMatcher(None, par["texto"], x["texto"]).ratio(), k)
                 for k, x in enumerate(anterior) if k not in usados]
        nota, k = max(notas) if notas else (0, None)
        if nota >= IGUAL:
            iguais += 1
            usados.add(k)
        elif nota >= ALTERADO:
            alterados.append({"paragrafo_atual": par["paragrafo"],
                              "paragrafo_anterior": anterior[k]["paragrafo"],
                              "similaridade": round(nota, 2),
                              "diff": diff_palavras(anterior[k]["texto"], par["texto"])})
            usados.add(k)
        else:
            novos.append({"paragrafo": par["paragrafo"], "texto": par["texto"]})
    removidos = [{"paragrafo": x["paragrafo"], "texto": x["texto"]}
                 for k, x in enumerate(anterior) if k not in usados]
    return {"novos": novos, "removidos": removidos, "alterados": alterados, "iguais": iguais}


def main() -> int:
    por_ata = carregar_paragrafos()
    if len(sys.argv) == 3:
        n_ant, n_atual = int(sys.argv[1]), int(sys.argv[2])
    else:
        n_ant, n_atual = sorted(por_ata)[-2:]
    resultado = {"ata_atual": n_atual, "ata_anterior": n_ant,
                 **comparar(por_ata[n_ant], por_ata[n_atual])}
    ARQ_SAIDA.parent.mkdir(exist_ok=True)
    ARQ_SAIDA.write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{n_ant} -> {n_atual}: iguais {resultado['iguais']}, alterados {len(resultado['alterados'])}, "
          f"novos {len(resultado['novos'])}, removidos {len(resultado['removidos'])} -> {ARQ_SAIDA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
