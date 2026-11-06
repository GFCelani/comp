# Competição de Claude Code

Pasta de trabalho para um desafio ainda não definido. Repositório privado: GFCelani/comp.

## Como trabalhar

1. Planeje antes de codar: leia o desafio, liste os requisitos e escreva um plano curto em passos.
2. Trabalhe em passos pequenos, uma mudança verificável por vez.
3. Mexa só no que está no escopo da tarefa.
4. Teste cada passo antes de seguir: rode o código, os testes ou abra a página no Playwright.
5. Antes de dizer que terminou, verifique o próprio trabalho: abra a página, tire captura e rode os testes.
6. Commits pequenos e frequentes, com mensagem clara no imperativo (ex.: "Adiciona validação do formulário"). Push no fim de cada etapa.
7. Para desfazer, use git revert pontual, nunca reset.
8. O tempo é curto: use subagentes em paralelo sempre que as tarefas forem independentes, inclusive pesquisa e leitura ampla de código.
9. Se travar duas vezes no mesmo erro, pare, investigue a causa e mude a abordagem.
10. Se a memória do computador ficar acima de 90% por muito tempo, reduza o paralelismo e feche os navegadores do Playwright abertos.

## Ferramentas

- Node 24, npm, pnpm, Python 3.13, pip e uv já instalados. Prefira pnpm para Node e uv para Python.
- Instale bibliotecas só quando o desafio pedir, sempre no projeto, nunca global.
- Playwright MCP para abrir páginas e tirar capturas. Salve capturas em .playwright-mcp/.

## Regras

- Nenhuma chave de API ou senha no código, no repositório ou no chat. O usuário cadastra os segredos: informe o nome da variável, que fica em .env (fora do git).
- Nada de métrica, depoimento ou texto inventado.
- Mantenha um .env.example com os nomes das variáveis, sem valores.
- Skills de terceiros só como pasta com SKILL.md. Nada de plugins, hooks ou .mcp.json de terceiros.
- Não altere configurações globais nem outros projetos.

## Relatórios

- Em português, curtos e objetivos: o que foi feito, como foi testado, o que falta.
- Diga claramente quando algo falhou ou não foi testado.
