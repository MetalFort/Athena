# Atena: publicar no GitHub Pages e instalar no celular

Tempo total: uns 15 minutos. Não precisa instalar nada no PC, só usar o navegador.
No fim, o app fica em **https://metalfort.github.io/Athena/** e instalado no celular como um app de verdade.

> **Seus dados não vão para o GitHub.** No GitHub fica só o código do app. Tarefas, notas, gastos etc. ficam no celular (e no Firebase, se a sincronização estiver ligada). A configuração do Firebase também não fica no código: ela é colada dentro do app.

---

## Parte 1: preparar os arquivos
1. Baixe o arquivo **atena-final.zip** e extraia (botão direito → "Extrair tudo").
2. Vai aparecer uma pasta `atena` com estes arquivos:
   `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, a pasta `icons`, e os guias `.md`.

## Parte 2: criar o repositório no GitHub
1. Entre em **https://github.com** com a conta **MetalFort**.
2. Clique no **+** (canto de cima) → **New repository**.
3. **Repository name:** `atena` (tudo minúsculo).
4. Deixe como **Public** (o GitHub Pages gratuito exige repositório público).
5. **Não** marque "Add a README". Clique em **Create repository**.

## Parte 3: enviar os arquivos
1. Na página do repositório novo, clique no link **"uploading an existing file"**.
2. Abra a pasta `atena` que você extraiu, **selecione tudo que está DENTRO dela** (Ctrl + A) e arraste para a página do GitHub.
   - Importante: arraste o **conteúdo** da pasta, não a pasta `atena` em si. O `index.html` precisa ficar na "raiz" do repositório.
   - A pasta `icons` pode ser arrastada junto (no Chrome/Edge funciona).
3. Espere todos os arquivos aparecerem na lista. Embaixo, em "Commit changes", escreva `Primeira versão do Atena` e clique em **Commit changes**.
4. Confira: na página do repositório devem aparecer `index.html`, `app.js`, `icons/` etc. lado a lado.

## Parte 4: ligar o GitHub Pages
1. No repositório, clique em **Settings** (engrenagem, no menu de cima).
2. No menu da esquerda, clique em **Pages**.
3. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha **main** e a pasta **/ (root)** → **Save**.
5. Espere 1 ou 2 minutos e recarregue a página. Vai aparecer: *"Your site is live at https://metalfort.github.io/Athena/"*.
6. Abra esse endereço no PC para conferir.

## Parte 5: autorizar o endereço no Firebase (só se usa a sincronização)
1. Abra **https://console.firebase.google.com** → projeto **atena**.
2. **Authentication → Configurações → Domínios autorizados → Adicionar domínio**.
3. Digite `metalfort.github.io` e salve.
   Sem isso, o "Entrar com Google" mostra o erro de domínio não autorizado.

## Parte 6: instalar no celular (Android)
1. No celular, abra o **Chrome** e acesse **https://metalfort.github.io/Athena/**.
2. Toque nos **três pontinhos ⋮** (canto de cima) → **Instalar app** (ou "Adicionar à tela inicial" → Instalar).
3. O ícone do **Atena** aparece na tela inicial e na lista de apps. Abra por ele: o app abre em tela cheia, sem a barra do navegador.
4. Dentro do app:
   - **Mais → Lembretes → Permitir notificações** (aceite o aviso do Android).
   - **Mais → Configurações → Sincronização na nuvem**: cole o `firebaseConfig` e entre com o Google (veja `FIREBASE.md`).
   - **Mais → Configurações → Bloqueio do app**: crie o PIN e, se quiser, ligue a digital.
5. Teste o modo offline: ligue o modo avião e abra o app. Ele deve abrir normalmente.

> **iPhone:** abra no **Safari** → botão **Compartilhar** → **Adicionar à Tela de Início**. Notificações no iPhone só funcionam com o app instalado assim (iOS 16.4 ou mais novo).

## Parte 7: notificações no relógio Haylou
1. No celular, abra o app **Haylou Fun** → **Notificações** (ou "Lembretes de mensagens").
2. Ative as notificações do **Chrome** e, se aparecer na lista, também do **Atena**.
3. Nas **Configurações do Android → Apps → Haylou Fun**: deixe a bateria como **Sem restrições** e confirme que o "Acesso a notificações" está ligado.
4. Faça o mesmo com o **Chrome** (bateria sem restrições), para os lembretes não atrasarem.
5. Teste em **Mais → Lembretes → Testar agora**: a notificação deve aparecer no celular e vibrar no relógio.

> Lembrete: os avisos funcionam com o app aberto ou minimizado. Com o app totalmente fechado, seria preciso o "push" com servidor (plano Blaze do Firebase), que ficou como opcional.

---

## Como atualizar o app depois
1. Mude os arquivos no PC.
2. Abra o `sw.js` e aumente a versão: `atena-v23` → `atena-v24` (sempre um número maior).
3. No GitHub, abra o repositório → **Add file → Upload files** → arraste só os arquivos que mudaram (incluindo o `sw.js`) → **Commit changes**.
4. Em 1 ou 2 minutos o site atualiza. No celular, feche e abra o app (às vezes duas vezes) para pegar a versão nova. Seus dados continuam lá.

## Se algo der errado
| Problema | Solução |
|---|---|
| Página 404 no endereço | Confira se o `index.html` está na raiz do repositório (não dentro de uma pasta `atena/`) e se o Pages está em main / (root). Espere 2 minutos. |
| Não aparece "Instalar app" | Use o Chrome, abra pelo endereço `https://` e recarregue a página uma vez. |
| App não atualiza | Aumentou a versão no `sw.js`? Feche o app por completo e abra de novo. |
| Erro ao entrar com Google | Faltou a Parte 5 (domínio autorizado no Firebase). |
| Notificação não chega no relógio | Revise a Parte 7, principalmente a bateria "Sem restrições". |
