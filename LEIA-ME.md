# Atena: App de Desempenho Pessoal

App feito em HTML, CSS e JavaScript puros (sem frameworks e sem instalação), que funciona offline e pode ser instalado no celular.

## Guias
- **PUBLICAR.md**: publicar no GitHub Pages, instalar no celular e ligar o relógio Haylou.
- **FIREBASE.md**: ligar a sincronização na nuvem (login com Google).

## O que o app tem
| Onde | Função |
|---|---|
| Início | Saudação, resumo do dia, nível/XP, humor, matéria do dia, hábitos, metas da semana, frase do dia, fechamento do dia (à noite) |
| Tarefas | Projetos por dia da semana com tarefas que se repetem |
| Foco | Relógio + Pomodoro |
| Evolução | Desempenho diário com gráfico, diário de humor e histórico |
| Mais | Relatório mensal, Projetos dev, Treinos, Hábitos, Conquistas, Anotações, Filosofia do cérebro, Mindset, Leitura, Finanças, Estudos (plano + provas + quiz), Lembretes, Configurações |
| Topo | Microfone (comandos de voz) e modo claro/escuro |
| Abertura | Mega Brain: cérebro de partículas que fala a saudação |
| Configurações | Personalização, tema, sincronização Firebase, Mega Brain, backup, bloqueio com PIN/digital |

## Arquivos
| Arquivo | Para que serve |
|---|---|
| `index.html` | O esqueleto: todas as telas e cartões |
| `style.css` | O visual: vidro, cores, animações (cada etapa tem uma seção "ETAPA N") |
| `app.js` | O comportamento. Cada função é um "módulo" com `init()`, listados no fim do arquivo |
| `manifest.json` | Nome, cores e ícones para instalar no celular |
| `sw.js` | Service worker: guarda o app para abrir offline. **Aumente a versão a cada mudança** |
| `icons/` | Ícones originais do app |

## Testar no computador
1. Abra a pasta `atena`, clique na barra de endereço da pasta, digite `cmd` e aperte Enter.
2. Digite `python -m http.server 8000` e aperte Enter.
3. No Chrome, abra `http://localhost:8000`. Para ver como celular: `F12` e depois `Ctrl + Shift + M`.
4. Para parar: `Ctrl + C` no terminal.

(Ou, no VS Code, use a extensão "Live Server".)

## Seus dados
Ficam no próprio aparelho (localStorage). Faça backup em **Configurações → Exportar backup** ou ligue a sincronização com o Firebase.
