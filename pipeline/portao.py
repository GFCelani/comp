"""
Portão de qualidade antes de publicar ata nova.

    .venv/Scripts/python.exe pipeline/portao.py 281 [282 ...]

Para cada ata: nº de parágrafos dentro de [mín − 3, máx + 3] das atas anteriores; numeração
sequencial 1..n; trechos inválidos ≤ 10% dos rótulos da ata. Imprime o motivo e, se GITHUB_OUTPUT
existir, grava `aprovado=true|false` e `motivo=<texto>`. Sai com 1 se reprovar.
(O build do site é conferido no workflow.)
"""
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def _jsonl(p: Path) -> list[dict]:
    with p.open(encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def checar(atas: list[int]) -> list[str]:
    pars = defaultdict(list)
    for p in _jsonl(RAIZ / "banco" / "paragrafos.jsonl"):
        pars[p["ata"]].append(p["paragrafo"])
    rot = {}
    for r in _jsonl(RAIZ / "banco" / "rotulos.jsonl"):
        rot[(r["ata"], r["paragrafo"])] = r
    problemas = []
    for ata in atas:
        nums = sorted(pars.get(ata, []))
        antes = [len(v) for k, v in pars.items() if k < ata]
        if not nums:
            problemas.append(f"ata {ata}: nenhum parágrafo extraído")
            continue
        if antes and not (min(antes) - 3 <= len(nums) <= max(antes) + 3):
            problemas.append(f"ata {ata}: {len(nums)} parágrafos, fora de [{min(antes) - 3}, {max(antes) + 3}]")
        if nums != list(range(1, len(nums) + 1)):
            problemas.append(f"ata {ata}: numeração não é 1..{len(nums)} ({nums[:5]}...)")
        rs = [rot[(ata, n)] for n in nums if (ata, n) in rot]
        if len(rs) < len(nums):
            problemas.append(f"ata {ata}: {len(nums) - len(rs)} parágrafos sem nota")
        inval = sum(not r.get("trecho_valido") for r in rs)
        if rs and inval / len(rs) > 0.10:
            problemas.append(f"ata {ata}: {inval}/{len(rs)} trechos inválidos (> 10%)")
    return problemas


def main() -> int:
    atas = [int(a) for a in sys.argv[1:] if a.strip()]
    problemas = checar(atas) if atas else []
    motivo = "; ".join(problemas)
    print(f"Portão de qualidade (atas {atas or '-'}): " + ("APROVADO" if not problemas else f"REPROVADO: {motivo}"))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"aprovado={'false' if problemas else 'true'}\n")
            f.write(f"motivo={motivo}\n")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
