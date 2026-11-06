"""
Prepara um "lote" por ata para a rotulagem: parágrafos (do banco do pipeline) + diff com a ata anterior.

    .venv/bin/python scripts/preparar.py            # todas as atas de banco/paragrafos.jsonl
    .venv/bin/python scripts/preparar.py 282        # só uma

Entrada: ../banco/paragrafos.jsonl  (contrato do time: ata, paragrafo, secao, texto)
Saída:   dados/lotes/ata_<n>.json  {"ata", "anterior", "paragrafos": [...], "mudancas": [...]}

Cada parágrafo da ata atual recebe "status" ∈ igual | alterado | novo, com o parágrafo mais parecido
da ata anterior e o diff palavra a palavra (~~saiu~~ **entrou**). Parágrafos da anterior sem par
entram em "removidos". O casamento é por similaridade (difflib), não pela numeração.
"""
import difflib
import json
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
BANCO = RAIZ.parent / "banco" / "paragrafos.jsonl"
LOTES = RAIZ / "dados" / "lotes"
IGUAL, PARECIDO = 0.97, 0.45


def carregar() -> dict[int, list[dict]]:
    atas = defaultdict(list)
    for l in BANCO.read_text(encoding="utf-8").splitlines():
        if l.strip():
            p = json.loads(l)
            atas[p["ata"]].append(p)
    return {k: sorted(v, key=lambda p: p["paragrafo"]) for k, v in sorted(atas.items())}


def diff_palavras(a: str, b: str) -> str:
    pa, pb = a.split(), b.split()
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, pa, pb, autojunk=False).get_opcodes():
        if op == "equal":
            out.append(" ".join(pb[j1:j2]))
        if op in ("delete", "replace"):
            out.append("~~" + " ".join(pa[i1:i2]) + "~~")
        if op in ("insert", "replace"):
            out.append("**" + " ".join(pb[j1:j2]) + "**")
    return " ".join(out)


def lote(atual: list[dict], anterior: list[dict] | None) -> dict:
    pars, usados = [], set()
    for p in atual:
        item = {"paragrafo": p["paragrafo"], "secao": p["secao"], "texto": p["texto"]}
        if anterior:
            notas = [(difflib.SequenceMatcher(None, p["texto"], q["texto"], autojunk=False).quick_ratio(), k)
                     for k, q in enumerate(anterior)]
            cand = sorted(notas, reverse=True)[:3]               # refina os 3 melhores com ratio exato
            sim, k = max((difflib.SequenceMatcher(None, p["texto"], anterior[k]["texto"], autojunk=False).ratio(), k)
                         for _, k in cand)
            if sim >= IGUAL:
                item["status"] = "igual"; usados.add(k)
            elif sim >= PARECIDO:
                item.update(status="alterado", paragrafo_anterior=anterior[k]["paragrafo"],
                            similaridade=round(sim, 2), diff=diff_palavras(anterior[k]["texto"], p["texto"]))
                usados.add(k)
            else:
                item["status"] = "novo"
        else:
            item["status"] = "sem_anterior"
        pars.append(item)
    removidos = [{"paragrafo": q["paragrafo"], "secao": q["secao"], "texto": q["texto"]}
                 for k, q in enumerate(anterior or []) if k not in usados]
    return {"paragrafos": pars, "removidos": removidos}


if __name__ == "__main__":
    atas = carregar()
    nums = list(atas)
    alvo = [int(a) for a in sys.argv[1:]] or nums
    LOTES.mkdir(parents=True, exist_ok=True)
    for n in alvo:
        i = nums.index(n)
        ant = nums[i - 1] if i > 0 else None
        l = {"ata": n, "anterior": ant, **lote(atas[n], atas[ant] if ant else None)}
        (LOTES / f"ata_{n}.json").write_text(json.dumps(l, ensure_ascii=False, indent=1), encoding="utf-8")
        c = defaultdict(int)
        for p in l["paragrafos"]:
            c[p["status"]] += 1
        print(f"ata {n} (anterior {ant}): {dict(c)} removidos={len(l['removidos'])}")
