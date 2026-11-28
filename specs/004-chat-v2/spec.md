# Spec 004 — Chat v2 (Seletor de LLM, Histórico do Dia e Cadastro Inteligente)

**Status:** aprovada · **Versão:** 0.3 · **Foco:** o quê e por quê (sem decisões de implementação)

> Aprovada em 27/11/2026. Implementação liberada.

## Objetivo

Evoluir o chatbot do Xilas Finance para permitir que o usuário escolha qual modelo de LLM pré-configurado responderá, salve suas conversas em histórico persistente (mostrando por padrão apenas a conversa do dia, com botão de "Nova conversa" e acesso ao histórico anterior) e cadastre despesas em linguagem natural com preenchimento inteligente de lojas, recorrências e perguntas diretas apenas sobre campos faltantes.

## Escopo

**Dentro:** seletor de modelo de LLM pré-configurado no servidor, persistência de conversas e mensagens no banco por usuário, exibição padrão apenas da conversa ativa do dia (`America/Fortaleza`), botão "Nova conversa", painel de histórico de conversas anteriores, melhoria do cadastro de despesas pelo chat (incluindo recorrências, reconhecimento de lojas cadastradas em Configurações e perguntas apenas sobre campos faltantes).
**Fora:** inserção de chaves de API pelo usuário na interface, cadastro de rendas pelo chat (coberto na `005-income` após a criação da tabela de rendas), compartilhamento de conversas entre usuários.

## Glossário

- **Modelo pré-configurado:** provedor + modelo definido via variáveis de ambiente no servidor, exposto à UI apenas por identificador e nome amigável (nunca chave ou URL interna).
- **Conversa do dia:** conversa mais recente criada no dia atual no fuso `America/Fortaleza`.

## US-1 — Escolher qual LLM responde no chat

Como usuário, quero escolher entre os modelos de LLM pré-configurados no servidor para decidir qual assistente responde minhas perguntas.

**Critérios de aceite**
- [ ] A interface do chat exibe um seletor com os modelos de LLM pré-configurados disponíveis no servidor.
- [ ] Ao enviar uma mensagem, o servidor usa o modelo selecionado; se omitido, usa o modelo padrão (`primary`).
- [ ] Se o usuário enviar um `modelId` inválido, o servidor rejeita com erro claro (400) sem expor detalhes internos.
- [ ] Se o modelo escolhido falhar por limite (`429`), erro `5xx` ou timeout, o fallback configurado continua funcionando e a UI indica quando houve fallback.
- [ ] Nenhuma chave de API ou segredo de LLM é enviado ao cliente.

## US-2 — Histórico de conversas com foco no dia atual

Como usuário, quero que minhas conversas fiquem salvas, vendo por padrão apenas a conversa de hoje, mas podendo iniciar uma nova conversa ou consultar dias anteriores quando precisar.

**Critérios de aceite**
- [ ] Cada mensagem enviada pelo usuário e resposta do assistente é salva no banco vinculada a uma conversa do usuário.
- [ ] Ao abrir a página do chat, o app carrega automaticamente apenas a conversa ativa do dia atual (`America/Fortaleza`); se não houver conversa hoje, inicia uma tela limpa pronta para a primeira mensagem.
- [ ] Existe um botão claro **"Nova conversa"** que inicia uma nova conversa vazia no dia atual (sem apagar as anteriores).
- [ ] Existe um painel/menu de **Histórico** (colapsável/drawer) onde o usuário pode listar e abrir conversas anteriores (do mesmo dia ou de dias passados).
- [ ] O usuário pode excluir uma conversa do histórico (com confirmação).
- [ ] Isolamento total por usuário via RLS em `chat_conversations` e `chat_messages`.
- [ ] Nenhum dado bancário sensível é gravado nas mensagens enviadas ao LLM.

## US-3 — Cadastro inteligente de despesas pelo chat

Como usuário, quero descrever uma despesa em linguagem natural (avulsa, recorrente ou em uma loja cadastrada) para que o bot extraia o máximo possível, pergunte apenas o que faltou e peça minha confirmação antes de salvar.

**Critérios de aceite**
- [ ] **Campos faltantes:** ao enviar algo incompleto como `"Adicionar 200 em conta de água"`, o bot identifica descrição (`Conta de água`) e valor (`R$ 200,00`), e pergunta **apenas** os campos obrigatórios que faltam (ex.: tipo de pagamento, vencimento/categoria).
- [ ] **Despesa recorrente:** ao enviar `"Criar conta recorrente, 100 para meu pai no pix todo dia 1º"`, o bot identifica `recurring = true`, valor `R$ 100,00`, `payment_type = pix`, vencimento no próximo dia 1º e propõe o cartão de confirmação (perguntando só se faltar categoria).
- [ ] **Reconhecimento de loja cadastrada:** ao enviar `"Comprei hoje na amazon uma cadeira gamer no cartão de crédito"`, o bot reconhece a data de hoje (`America/Fortaleza`), vincula a loja cadastrada `Amazon` (recebida no contexto do prompt), identifica `payment_type = credit`, pergunta apenas o que faltou (ex.: valor) e monta o rascunho para confirmação.
- [ ] O bot **nunca** grava no banco sem confirmação explícita do usuário no cartão de confirmação (Constituição §5).

## Requisitos não funcionais

- **Privacidade/segurança:** RLS obrigatória em `chat_conversations` e `chat_messages`; teste pgTAP de isolamento por usuário; chaves de LLM exclusivamente no servidor (Constituição §4); nunca enviar banco/agência/conta ao LLM.
- **Desempenho:** abertura do chat carrega apenas a conversa do dia.

## Premissas adotadas

1. Esta spec atualiza a premissa 4 da `001-core`: a *configuração* (chaves, URLs e catálogo) permanece no servidor, mas a *seleção* entre modelos pré-configurados fica disponível na interface.
2. O prompt de sistema do chat passa a incluir apenas os nomes/IDs das **lojas cadastradas** do usuário (além das categorias), nunca dados bancários sensíveis.

## Histórico

- 0.2 — Adicionada US-3 com cenários explícitos de cadastro inteligente de despesas (campos faltantes, recorrência e reconhecimento de lojas).
- 0.1 — Rascunho inicial.
