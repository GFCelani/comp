"""
Rotula o tom de cada parágrafo das atas → banco/rotulos.jsonl.

Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/rotular.py            # só atas ainda sem rótulos
    .venv/Scripts/python.exe pipeline/rotular.py --push 10  # commit + push a cada 10 atas
    .venv/Scripts/python.exe pipeline/rotular.py --modelo   # exige o modelo do parceiro, sem Claude

Sem --modelo, usa o modelo do parceiro se existir (banco/modelo.pkl ou prever() em modelo/*.py);
senão o Claude; se nenhum estiver disponível (nuvem sem CLAUDE_CODE_OAUTH_TOKEN), não rotula
e sai com código 3 (SEM_ROTULADOR).

Uma chamada `claude -p --model sonnet` por ata (nunca por parágrafo), até 3 em paralelo
(2 se a RAM passar de 90%). Régua de avancado/case2_copom/classificar_tom.py.
Cada trecho é conferido por código (cópia literal, até 25 palavras); os inválidos voltam
numa segunda chamada só com eles; se falharem de novo, ficam com trecho_valido=false.
Ordem: atas 276–281 primeiro, depois o resto da mais recente para a mais antiga.
"""
import argparse
import json
import subprocess
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import claude_cli  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
ARQ_PARAGRAFOS = RAIZ / "banco" / "paragrafos.jsonl"
ARQ_ROTULOS = RAIZ / "banco" / "rotulos.jsonl"
PRIMEIRAS = [281, 280, 279, 278, 277, 276]
LOCK = threading.Lock()
SEM_ROTULADOR = 3   # código de saída: há atas sem nota e nada para rotulá-las (rodar.py lê)

REGUA = """ +2 = muito duro (hawkish): sinaliza alta de juros ou juros altos por mais tempo com ênfase
 +1 = duro
  0 = neutro ou descritivo (fatos, dados, sem sinalização)
 -1 = brando (dovish)
 -2 = muito brando: sinaliza corte de juros com ênfase"""

PROMPT = """Você é um economista que analisa comunicação de bancos centrais.
Abaixo estão todos os parágrafos numerados da ata da {ata}ª reunião do Copom.
Classifique CADA parágrafo quanto ao TOM de política monetária, com esta régua:

{regua}

Para cada parágrafo, copie também um "trecho" de no máximo 25 palavras que justifique a nota.
O trecho deve ser cópia LITERAL e contínua do parágrafo (mesmas palavras, acentos e pontuação),
sem reticências, sem cortar palavras no meio e sem juntar partes separadas.

Responda APENAS com um JSON, sem texto antes ou depois, uma entrada por parágrafo:
[{{"paragrafo": <n>, "nota": <inteiro de -2 a 2>, "trecho": "<até 25 palavras copiadas>"}}]

Parágrafos:
{paragrafos}"""

PROMPT_CORRIGIR = """Os trechos abaixo não são cópias literais dos parágrafos da ata (ou passam de 25 palavras).
Para cada parágrafo, copie um trecho de NO MÁXIMO 25 palavras que seja cópia LITERAL e contínua
do texto (mesmas palavras, acentos e pontuação; sem reticências; sem juntar partes separadas),
que justifique a nota indicada.

Responda APENAS com um JSON: [{{"paragrafo": <n>, "trecho": "<cópia literal>"}}]

{itens}"""


def carregar_paragrafos() -> dict[int, list[dict]]:
    por_ata = defaultdict(list)
    with ARQ_PARAGRAFOS.open(encoding="utf-8") as f:
        for linha in f:
            if linha.strip():
                p = json.loads(linha)
                por_ata[p["ata"]].append(p)
    return por_ata


def atas_rotuladas() -> set[int]:
    if not ARQ_ROTULOS.exists():
        return set()
    with ARQ_ROTULOS.open(encoding="utf-8") as f:
        return {json.loads(l)["ata"] for l in f if l.strip()}


def ordem(atas: list[int]) -> list[int]:
    primeiro = [a for a in PRIMEIRAS if a in atas]
    return primeiro + sorted((a for a in atas if a not in primeiro), reverse=True)


def rotular_claude(ata: int, pars: list[dict]) -> list[dict]:
    texto_por_n = {p["paragrafo"]: p["texto"] for p in pars}
    bloco = "\n\n".join(f"[{p['paragrafo']}] {p['texto']}" for p in pars)
    resp = claude_cli.extrair_json(claude_cli.chamar(PROMPT.format(ata=ata, regua=REGUA, paragrafos=bloco)))
    rotulos = {}
    for r in resp:
        n = int(r["paragrafo"])
        if n in texto_por_n:
            nota = max(-2, min(2, int(r["nota"])))
            rotulos[n] = {"nota": nota, "trecho": claude_cli.normalizar(str(r.get("trecho", "")))}
    faltando = [n for n in texto_por_n if n not in rotulos]
    if faltando:
        raise RuntimeError(f"ata {ata}: resposta sem os parágrafos {faltando}")

    invalidos = [n for n in rotulos if not claude_cli.trecho_ok(rotulos[n]["trecho"], texto_por_n[n])]
    if invalidos:
        itens = "\n\n".join(f"Parágrafo {n} (nota {rotulos[n]['nota']}):\n\"\"\"{texto_por_n[n]}\"\"\""
                            for n in invalidos)
        try:
            corr = claude_cli.extrair_json(claude_cli.chamar(PROMPT_CORRIGIR.format(itens=itens)))
            for c in corr:
                n = int(c["paragrafo"])
                if n in invalidos:
                    novo = claude_cli.normalizar(str(c.get("trecho", "")))
                    if claude_cli.trecho_ok(novo, texto_por_n[n]):
                        rotulos[n]["trecho"] = novo
        except Exception as e:
            print(f"  ata {ata}: correção falhou ({e})", flush=True)

    agora = datetime.now().isoformat(timespec="seconds")
    return [{"ata": ata, "paragrafo": n, "nota": rotulos[n]["nota"], "trecho": rotulos[n]["trecho"],
             "trecho_valido": claude_cli.trecho_ok(rotulos[n]["trecho"], texto_por_n[n]),
             "modelo": f"claude-{claude_cli.MODELO}", "rotulado_em": agora}
            for n in sorted(rotulos)]


def carregar_modelo_parceiro():
    """Função prever(textos) -> notas do parceiro. Só lê modelo/ e banco/modelo.pkl; não inventa interface."""
    pkl = RAIZ / "banco" / "modelo.pkl"
    pasta = RAIZ / "modelo"
    if pasta.is_dir():
        import importlib.util
        for py in sorted(pasta.glob("*.py")):
            spec = importlib.util.spec_from_file_location(f"modelo_{py.stem}", py)
            mod = importlib.util.module_from_spec(spec)
            try:
                spec.loader.exec_module(mod)
            except Exception:
                continue
            for nome in ("prever", "prever_notas", "predict"):
                if callable(getattr(mod, nome, None)):
                    return getattr(mod, nome), f"modelo/{py.name}:{nome}"
    if pkl.exists():
        import pickle
        with pkl.open("rb") as f:
            obj = pickle.load(f)
        if callable(getattr(obj, "predict", None)):
            return obj.predict, "banco/modelo.pkl"
    raise RuntimeError("modelo do parceiro não encontrado (nem função prever em modelo/*.py nem banco/modelo.pkl)")


def rotular_modelo(prever, nome: str, ata: int, pars: list[dict]) -> list[dict]:
    notas = list(prever([p["texto"] for p in pars]))
    agora = datetime.now().isoformat(timespec="seconds")
    saida = []
    for p, nota in zip(pars, notas):
        trecho = " ".join(p["texto"].split()[:25])           # início literal do parágrafo
        saida.append({"ata": ata, "paragrafo": p["paragrafo"], "nota": max(-2, min(2, int(round(float(nota))))),
                      "trecho": trecho, "trecho_valido": claude_cli.trecho_ok(trecho, p["texto"]),
                      "modelo": nome, "rotulado_em": agora})
    return saida


def gravar(linhas: list[dict]) -> None:
    """Append de uma ata inteira de uma vez, sob lock (as threads não intercalam linhas)."""
    bloco = "".join(json.dumps(l, ensure_ascii=False) + "\n" for l in linhas)
    with LOCK:
        with ARQ_ROTULOS.open("a", encoding="utf-8", newline="\n") as f:
            f.write(bloco)
            f.flush()


def resumo_rotulos() -> tuple[int, int, int]:
    with ARQ_ROTULOS.open(encoding="utf-8") as f:
        linhas = [json.loads(l) for l in f if l.strip()]
    return len({l["ata"] for l in linhas}), len(linhas), sum(not l["trecho_valido"] for l in linhas)


def git_push() -> None:
    atas, pars, inv = resumo_rotulos()
    msg = (f"Atualiza rótulos de tom: {atas} atas, {pars} parágrafos\n\n"
           "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>")
    caminho = "banco/rotulos.jsonl"
    def git(*args):
        for t in range(3):
            r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8")
            if r.returncode == 0:
                return r
            if "index.lock" in r.stderr or "rebase" in r.stderr:
                time.sleep(5)
                continue
            raise RuntimeError(f"git {' '.join(args)}: {r.stderr[:300]}")
        raise RuntimeError(f"git {' '.join(args)} falhou 3x: {r.stderr[:300]}")
    with LOCK:
        git("add", caminho)
        git("commit", "-m", msg, "--", caminho)
        git("pull", "--rebase", "--autostash")
        git("push")
    print(f"PUSH rotulos.jsonl no GitHub: {atas} atas, {pars} parágrafos rotulados, {inv} trechos inválidos",
          flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", action="store_true", help="usa o modelo do parceiro em vez do Claude")
    ap.add_argument("--push", type=int, default=0, help="commit + push a cada N atas (0 = não faz push)")
    ap.add_argument("--atas", type=int, nargs="*", help="só estas atas")
    ap.add_argument("--max", type=int, default=0, help="no máximo N atas nesta execução")
    args = ap.parse_args()

    por_ata = carregar_paragrafos()
    feitas = atas_rotuladas()
    pendentes = ordem([a for a in por_ata if a not in feitas and (not args.atas or a in args.atas)])
    if args.max:
        pendentes = pendentes[:args.max]
    if not pendentes:
        print(f"Nenhuma ata nova para rotular ({len(feitas)} já rotuladas).")
        return 0
    print(f"Rotulando {len(pendentes)} atas: {pendentes}", flush=True)

    # Prioridade: modelo do parceiro (sem Claude) > Claude (local logado ou CLAUDE_CODE_OAUTH_TOKEN) > nenhum
    modelo = None
    try:
        modelo = carregar_modelo_parceiro()
    except Exception as e:
        if args.modelo:
            raise
        print(f"  modelo do parceiro indisponível ({e})", flush=True)
    if modelo is None and not claude_cli.disponivel():
        print(f"SEM ROTULADOR: nem modelo do parceiro nem Claude (CLAUDE_CODE_OAUTH_TOKEN); "
              f"atas {pendentes} entram sem nota (índice null, fora das métricas).", flush=True)
        return SEM_ROTULADOR

    if modelo is not None:
        prever, nome = modelo
        for ata in pendentes:
            gravar(rotular_modelo(prever, nome, ata, por_ata[ata]))
            print(f"  ata {ata}: rotulada por {nome}", flush=True)
        return 0

    inicio = time.time()
    concluidas, falhas, ultimo_push = 0, [], 0
    fila = list(pendentes)
    while fila:
        ram = claude_cli.ram_percentual()
        paralelo = 2 if ram > 90 else 3
        lote, fila = fila[:paralelo], fila[paralelo:]
        print(f"Lote {lote} (RAM {ram:.0f}%, {paralelo} em paralelo)", flush=True)
        with ThreadPoolExecutor(max_workers=paralelo) as ex:
            futuros = {ex.submit(rotular_claude, a, por_ata[a]): a for a in lote}
            for fut in as_completed(futuros):
                ata = futuros[fut]
                try:
                    linhas = fut.result()
                except Exception as e:
                    falhas.append(ata)
                    print(f"  ata {ata}: FALHOU ({e})", flush=True)
                    continue
                gravar(linhas)
                concluidas += 1
                inv = sum(not l["trecho_valido"] for l in linhas)
                dist = {k: sum(l["nota"] == k for l in linhas) for k in (-2, -1, 0, 1, 2)}
                print(f"  ata {ata}: {len(linhas)} parágrafos, {inv} trechos inválidos, notas {dist} "
                      f"({time.time() - inicio:.0f}s)", flush=True)
        if args.push and concluidas > ultimo_push and (concluidas - ultimo_push >= args.push or not fila):
            try:
                git_push()
                ultimo_push = concluidas
            except Exception as e:
                print(f"  push falhou: {e}", flush=True)

    print(f"Fim: {concluidas} atas rotuladas, falhas {falhas or '-'}, {claude_cli.CHAMADAS} chamadas ao Claude, "
          f"{time.time() - inicio:.0f}s", flush=True)
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
