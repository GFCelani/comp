"""
Pontua uma ata NOVA de ponta a ponta (ex.: a 282).

    .venv/bin/python scripts/avaliar_ata.py 282            # usa o Claude (claude -p), cai na reserva se não houver
    .venv/bin/python scripts/avaliar_ata.py 282 --reserva  # força o modelo reserva (sem IA)

Pré-requisito: a ata já extraída em ../banco/paragrafos.jsonl (o pipeline do time faz isso com
`pipeline/atualizar_banco.py` + `pipeline/extrair.py`).

Passos:
  1. scripts/preparar.py N            → dados/lotes/ata_N.json (parágrafos + diff com a anterior)
  2. Claude aplica a Skill tom-copom  → dados/rotulos/ata_N.json  (via `claude -p`, sem chave de API;
     usa pipeline/claude_cli.py do time). Valida trechos; se houver erro, pede 1 correção.
     Sem Claude: modelo reserva rotula os parágrafos (sem mudanças nem resumo do Claude).
  3. scripts/lexico.py e scripts/indice.py → resultados/indice.json e indice_modelo.json
"""
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ROTULOS_DIR = __import__("os").environ.get("TOM_ROTULOS", "rotulos")
PY = sys.executable
sys.path.insert(0, str(RAIZ.parent / "pipeline"))
sys.path.insert(0, str(RAIZ / "scripts"))


def rodar(*args):
    subprocess.run([PY, *args], cwd=RAIZ, check=True)


def prompt_claude(n: int, erros: list[str] | None = None) -> str:
    skill = (RAIZ / "skill" / "tom-copom" / "SKILL.md").read_text(encoding="utf-8")
    padroes = (RAIZ / "skill" / "tom-copom" / "regras.md").read_text(encoding="utf-8")
    lote = (RAIZ / "dados" / "lotes" / f"ata_{n}.json").read_text(encoding="utf-8")
    p = (f"{skill}\n\n# regras.md\n{padroes}\n\n# Lote da ata {n}\n```json\n{lote}\n```\n\n"
         "Responda SOMENTE com o JSON de saída da Skill (sem cercas de código, sem texto antes ou depois). "
         'Use "rotulador": "claude-sonnet-cli".')
    if erros:
        p += "\n\nSua resposta anterior teve estes problemas; corrija e devolva o JSON completo:\n- " + "\n- ".join(erros)
    return p


def extrair_json(txt: str) -> dict:
    txt = txt.strip()
    if txt.startswith("```"):
        txt = txt.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(txt[txt.find("{"): txt.rfind("}") + 1])


def com_claude(n: int) -> bool:
    try:
        import claude_cli
    except ImportError:
        return False
    if not claude_cli.disponivel():
        return False
    from validar import checar
    destino = RAIZ / "dados" / ROTULOS_DIR / f"ata_{n}.json"
    erros = None
    for _ in range(2):
        r = extrair_json(claude_cli.chamar(prompt_claude(n, erros)))
        r["ata"] = n
        destino.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        erros = checar(n)
        if not erros:
            return True
    print("AVISO: rótulos com problemas após correção:", *erros, sep="\n  ")
    return True


def com_reserva(n: int):
    from modelo_reserva import prever
    lote = json.loads((RAIZ / "dados" / "lotes" / f"ata_{n}.json").read_text(encoding="utf-8"))
    notas = prever([f"{p['secao']} || {p['texto']}" for p in lote["paragrafos"]])
    pars = [{"paragrafo": p["paragrafo"], "dimensao": "outro", "tom": int(t), "sinal": 1 if t else 0,
             "trecho": " ".join(p["texto"].split()[:25]), "padroes": [], "confianca": 0.4}
            for p, t in zip(lote["paragrafos"], notas)]
    media = sum(notas) / max(len(notas), 1)
    r = {"ata": n, "rotulador": "modelo_reserva", "skill_versao": "reserva", "paragrafos": pars, "mudancas": [],
         "resumo": {"tom_nivel": round(media, 2), "surpresa": 0.0,
                    "explicacao": "Nota provisória do modelo reserva (sem IA); reavaliar com o Claude."}}
    (RAIZ / "dados" / ROTULOS_DIR / f"ata_{n}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    n = int(sys.argv[1])
    rodar("scripts/preparar.py", str(n))
    if "--reserva" in sys.argv or not com_claude(n):
        print("Sem Claude disponível: usando o modelo reserva (nota provisória).")
        com_reserva(n)
    rodar("scripts/lexico.py")
    rodar("scripts/indice.py")
    idx = json.loads((RAIZ / "resultados" / "indice.json").read_text(encoding="utf-8"))
    item = next((a for a in idx["atas"] if a["ata"] == n), None)
    print(json.dumps(item, ensure_ascii=False, indent=1)[:3000])
