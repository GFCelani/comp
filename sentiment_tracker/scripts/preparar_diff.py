"""
Texto compacto só com o que MUDOU em cada ata (para a 2ª leitura independente, barata em tokens).

    .venv/bin/python scripts/preparar_diff.py

Lê dados/lotes/ e dados/holdout/lotes/; grava dados/segunda_leitura/entrada/ata_<n>.txt com:
parágrafos alterados (diff ~~saiu~~ **entrou**), novos e removidos. Parágrafos iguais ficam de fora.
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
SAIDA = RAIZ / "dados" / "segunda_leitura" / "entrada"

if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    for pasta in (RAIZ / "dados" / "lotes", RAIZ / "dados" / "holdout" / "lotes"):
        for f in pasta.glob("ata_*.json"):
            l = json.loads(f.read_text(encoding="utf-8"))
            if not l.get("anterior"):
                continue
            out = [f"ATA {l['ata']} (anterior: {l['anterior']}) — só o que mudou\n"]
            for p in l["paragrafos"]:
                if p["status"] == "alterado":
                    out.append(f"[ALTERADO §{p['paragrafo']} | {p['secao'][:40]}] {p['diff']}")
                elif p["status"] == "novo":
                    out.append(f"[NOVO §{p['paragrafo']} | {p['secao'][:40]}] {p['texto']}")
            for p in l["removidos"]:
                out.append(f"[REMOVIDO da anterior §{p['paragrafo']}] {p['texto']}")
            (SAIDA / f"ata_{l['ata']}.txt").write_text("\n\n".join(out), encoding="utf-8")
    fs = sorted(SAIDA.glob("*.txt"))
    print(len(fs), "arquivos;", sum(len(f.read_text().split()) for f in fs), "palavras no total")
