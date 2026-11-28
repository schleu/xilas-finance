# Spec 011 — Layout da Navegação Principal e Homepage

**Status:** implementada · **Versão:** 0.1 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Melhorar a navegação global do aplicativo (desktop e mobile) e refinar os controles da página inicial, tornando o cabeçalho mais limpo e intuitivo.

## Escopo

**Dentro:**
- Título **"Xilas Finance"** no cabeçalho como link para a página inicial (`/`).
- Ícones em todas as opções do menu principal (Início, Despesas, Rendas, Chat, Configurações).
- Remoção do seletor de tema claro/escuro do menu principal (movido para Configurações na Spec 013).
- Substituição do e-mail no cabeçalho pelas iniciais do nome do usuário dentro de um círculo.
- Menu responsivo dedicado para dispositivos mobile.
- Homepage: botão **"Criar primeira despesa"** alterado para **"Registrar primeira despesa"**.
- Homepage: botão **"Mês atual"** posicionado à esquerda do controle de mês de referência.

**Fora:**
- Seleção de dark/light mode em Configurações (coberta na Spec 013).
- Edição de perfil/nome de exibição do usuário.

## US-1 — Cabeçalho limpo, avatar com iniciais e menu mobile

Como usuário, quero clicar no título para voltar à página inicial, identificar rapidamente as seções por ícones, ver minhas iniciais no cabeçalho e navegar confortavelmente pelo celular.

**Critérios de aceite**
- [ ] Clicar no título **"Xilas Finance"** navega para `/`.
- [ ] Todas as opções do menu principal (Início, Despesas, Rendas, Chat, Configurações) exibem ícone e rótulo.
- [ ] O controle de dark/light mode não é exibido no menu principal.
- [ ] No lugar do e-mail, é exibido um círculo com até duas iniciais maiúsculas do nome do usuário (usando `profiles.display_name` / metadados, com fallback para o prefixo do e-mail), com `title`/`aria-label` acessível.
- [ ] Em telas mobile, existe um botão de menu que abre/fecha um menu mobile contendo as opções de navegação e o botão "Sair", fechando automaticamente ao navegar ou pressionar `Escape`.

## US-2 — Ajustes de texto e posicionamento na Homepage

Como usuário, quero ver o botão "Mês atual" à esquerda do seletor de mês e o texto "Registrar primeira despesa" no estado vazio.

**Critérios de aceite**
- [ ] Quando o mês na Homepage não possui despesas, o botão de ação exibe **"Registrar primeira despesa"**.
- [ ] Quando o mês selecionado na Homepage é diferente do mês atual, o botão **"Mês atual"** aparece à esquerda do controle de mês de referência (antes da seta de mês anterior).

## Requisitos não funcionais

- **Acessibilidade e responsividade:** menu mobile acessível por teclado e leitor de tela (`aria-expanded`, `aria-controls`); avatar com contraste adequado nos modos claro e escuro.

## Histórico

- 0.1 — Rascunho inicial separado da proposta unificada.
