# Atena: como ligar a sincronização na nuvem (Firebase)

Com a sincronização ligada, seus dados ficam salvos na nuvem e aparecem iguais no celular e no PC.
O plano gratuito do Firebase (Spark) é mais do que suficiente para uso pessoal e **não pede cartão**.

## 1. Criar o projeto
1. Acesse **https://console.firebase.google.com** e entre com sua conta Google.
2. Clique em **Adicionar projeto** (ou "Criar um projeto").
3. Nome: `atena`. Clique em Continuar.
4. O Google Analytics pode ser **desativado**. Clique em **Criar projeto** e espere terminar.

## 2. Ligar o login com Google
1. No menu da esquerda: **Criação → Authentication** → **Vamos começar**.
2. Na aba **Método de login**, clique em **Google** → ative a chave → escolha seu e-mail de suporte → **Salvar**.
3. Ainda em Authentication, abra a aba **Configurações → Domínios autorizados**.
   - `localhost` já vem na lista (serve para testar no PC).
   - Na etapa final (GitHub Pages) vamos adicionar aqui o endereço do site, por exemplo `metalfort.github.io`.

## 3. Criar o banco de dados (Firestore)
1. No menu: **Criação → Firestore Database** → **Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**.
3. Escolha **Iniciar no modo de produção** → Criar.
4. Abra a aba **Regras**, apague o que estiver lá e cole exatamente isto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cada pessoa só lê e grava o PRÓPRIO documento
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

5. Clique em **Publicar**.

## 4. Pegar a configuração do app
1. Clique na **engrenagem** (ao lado de "Visão geral do projeto") → **Configurações do projeto**.
2. Desça até **Seus apps** e clique no ícone **`</>`** (Web).
3. Apelido: `atena`. **Não** marque o Firebase Hosting. Clique em **Registrar app**.
4. Vai aparecer um código com `const firebaseConfig = { ... }`. Copie esse bloco inteiro.

## 5. Ligar no Atena
1. No app: **Mais → Configurações → Sincronização na nuvem**.
2. Cole o bloco no campo e toque em **Salvar configuração**.
3. Toque em **Entrar com Google** e escolha sua conta.
4. Pronto! O status mostra "Conectado como ...". Faça o mesmo no outro aparelho.
   - Na primeira vez em um aparelho novo, o app pergunta se deve usar os dados da nuvem. Toque em **OK** para trazer seus dados.

## Perguntas comuns
- **A "apiKey" é segredo?** Não. Ela só identifica o projeto. Quem protege seus dados são as **regras** do passo 3: só você, logado, acessa o seu documento.
- **E sem internet?** O app continua funcionando normalmente. As mudanças sobem sozinhas quando a conexão voltar.
- **Erro "domínio não autorizado"?** Adicione o endereço que aparece na mensagem em Authentication → Configurações → Domínios autorizados.
- **Erro de permissão?** Confira se as regras do passo 3 foram **publicadas**.
- **Lembretes com o app fechado:** para isso o Firebase precisa de um "servidor" (Cloud Functions), que só existe no plano Blaze (pede cartão, mas tem cota gratuita). Por isso ficou como etapa opcional.
