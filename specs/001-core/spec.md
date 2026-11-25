# Spec 001 — Núcleo do Xilas Finance

**Status:** rascunho · **Versão:** 0.2 · **Foco:** o quê e por quê (sem decisões de implementação)

> Para liberar a implementação das fases 1 a 6, troque o status para `aprovada` (decisão humana).

## Objetivo

Permitir que uma pessoa registre suas contas (gastos) e entenda para onde o dinheiro vai, mês a mês, manualmente ou conversando com um chatbot.

## Escopo

**Dentro:** login por convite, homepage com resumo, cadastro de contas com vencimento, recorrência com geração automática de lançamentos, categorias, chatbot (adicionar, listar, relatório), edição manual.
**Fora (por enquanto):** integração bancária automática, multi-moeda, compartilhamento de contas entre usuários, app mobile nativo, notificações de vencimento.

## Glossário

- **Conta (lançamento):** um gasto/compromisso com valor e vencimento (ex.: aluguel de dezembro).
- **Recorrente:** conta cujo valor não muda de um mês para o outro; gera um lançamento por mês.
- **Pendente:** lançamento ainda não pago. **Atrasado** é um pendente com vencimento anterior a hoje (derivado, não escolhido).
- **Categoria:** classificação da conta. Padrão: Fixa, Variável, Cartão de Crédito; o usuário pode criar outras.
- **Mês de referência:** o mês do **vencimento** do lançamento.

## US-0 — Acesso por convite

Como dono do app, quero convidar pessoas pontualmente para que cada uma use o sistema com seus próprios dados.

**Critérios de aceite**
- [ ] Não existe cadastro público: só entra quem foi convidado por e-mail.
- [ ] Cada usuário vê e altera **apenas** os próprios dados (contas, categorias, conversas).
- [ ] Ao entrar pela primeira vez, o usuário já tem as categorias padrão.
- [ ] Usuário sem sessão válida é redirecionado para o login.

## US-1 — Homepage

Como usuário, quero ver um resumo do mês para saber rapidamente quanto gastei.

**Critérios de aceite**
- [ ] Mostra o **total gasto** do mês selecionado (padrão: mês atual), contando **somente lançamentos pagos**.
- [ ] Mostra **à parte** o total **pendente** do mês e quantos estão **atrasados**.
- [ ] Permite navegar entre meses.
- [ ] Gráfico de **gasto por categoria** do mês (somente pagos).
- [ ] Gráfico de **evolução mensal** (últimos 6 meses, somente pagos).
- [ ] Lista de **próximos vencimentos** (pendentes ordenados por vencimento).
- [ ] Estado vazio claro quando não há contas, com atalho para criar a primeira.

## US-2 — Cadastro de conta

Como usuário, quero registrar uma conta com seus detalhes para acompanhá-la.

**Campos** (* obrigatório)

| Campo | Regra |
|---|---|
| Descrição* | texto, 1–120 caracteres |
| Empresa | texto opcional |
| Categoria* | uma das categorias do usuário |
| Valor* | maior que zero, em BRL |
| Vencimento* | data |
| Tipo de pagamento* | `pix`, `crédito` ou `débito em conta` |
| Banco, agência, conta | **obrigatórios apenas** se tipo = débito em conta |
| Status* | `pendente` ou `pago` (atrasado é calculado) |
| Data de pagamento | preenchida ao marcar como pago (padrão: hoje) |
| Recorrente* | sim/não |

**Critérios de aceite**
- [ ] Não salva sem os campos obrigatórios; mostra erro por campo.
- [ ] Ao escolher "débito em conta", exibe e exige banco, agência e conta; nos outros tipos, esses campos ficam ocultos e vazios.
- [ ] Ao salvar, a conta aparece na lista e entra nos totais conforme seu status e vencimento.
- [ ] Marcar como pago é uma ação rápida (um clique) a partir da lista e da homepage.
- [ ] Usuário pode editar e excluir uma conta (exclusão com confirmação).
- [ ] Dados de agência e conta aparecem mascarados na lista (ex.: `••••1234`) e completos só na edição.

## US-2b — Recorrência

Como usuário, quero marcar uma conta como recorrente para não precisar recadastrá-la todo mês.

**Critérios de aceite**
- [ ] Ao salvar uma conta recorrente, o sistema gera automaticamente os lançamentos dos meses seguintes, mantendo o mesmo dia de vencimento (em meses curtos, usa o último dia do mês).
- [ ] Lançamentos gerados nascem como **pendentes**.
- [ ] A geração é **idempotente**: nunca cria dois lançamentos para a mesma recorrência no mesmo mês.
- [ ] Sempre existem lançamentos gerados para o mês atual e para os próximos 2 meses.
- [ ] Ao editar um lançamento recorrente, o usuário escolhe: **só este** ou **este e os futuros pendentes**.
- [ ] Usuário pode **encerrar** a recorrência (os futuros pendentes são removidos; os pagos permanecem).

## US-3 — Categorias

Como usuário, quero gerenciar categorias para organizar meus gastos do meu jeito.

**Critérios de aceite**
- [ ] Existem categorias padrão: Fixa, Variável, Cartão de Crédito.
- [ ] Usuário pode criar, renomear e excluir categorias.
- [ ] Não é possível excluir categoria em uso sem reatribuir as contas a outra.
- [ ] Nomes de categoria são únicos por usuário (sem diferenciar maiúsculas).

## US-4 — Chatbot

Como usuário, quero conversar em linguagem natural para adicionar e consultar contas sem preencher formulários.

**Critérios de aceite**
- [ ] **Adicionar conta:** a partir de uma frase ("internet 120 no pix vence dia 10"), o bot extrai os campos, **mostra um resumo para confirmação** e só salva após o usuário confirmar.
- [ ] Se faltar campo obrigatório, o bot pergunta apenas o que falta.
- [ ] **Visualizar contas:** responde pedidos como "quais contas vencem esta semana?" com contas reais do usuário.
- [ ] **Relatório Gasto × Categoria:** resumo do período pedido (padrão: mês atual), consistente com o gráfico da homepage (somente pagos, pendentes citados à parte).
- [ ] O bot nunca inventa contas ou valores: só informa o que existe no banco.
- [ ] Dados bancários (banco, agência, conta) não são enviados ao LLM.
- [ ] O provedor e o modelo de LLM (ex.: DeepSeek, OpenRouter, Together AI) são **configuráveis** sem alterar o comportamento do chatbot.
- [ ] Se o provedor atingir o limite gratuito ou falhar, o sistema usa um **provedor de reserva** configurado; sem reserva, mostra mensagem amigável e o app segue utilizável manualmente.

## US-5 — Inserção e edição manual

Como usuário, quero criar e editar contas e categorias por telas comuns, sem depender do chatbot.

**Critérios de aceite**
- [ ] Lista de contas com filtro por mês, categoria e status (incluindo "atrasadas").
- [ ] Criar/editar conta e categoria usa as mesmas regras de validação do chatbot.
- [ ] Alterações feitas pelo chat ou manualmente aparecem imediatamente nas duas vias.

---

## Requisitos não funcionais

- **Privacidade:** isolamento total por usuário, garantido no banco (RLS), não só na interface.
- **Desempenho:** homepage carrega em até 2 s com até 2.000 contas.
- **Resiliência do chat:** limites da camada gratuita do LLM tratados sem quebrar o app.

## Premissas adotadas (me avise se alguma estiver errada)

1. Cada convidado tem **seus próprios dados isolados**; não há compartilhamento de contas entre usuários.
2. O mês de referência dos totais é o do **vencimento**.
3. "Atrasado" é **derivado** (pendente com vencimento passado), não um status gravado.
4. A escolha do modelo de LLM é **configuração do projeto**, não da interface.

## Próximos artefatos

`plan.md` (arquitetura, modelo de dados, contratos) → `tasks.md` (tarefas pequenas) → implementação.

## Histórico

- 0.2 — Respostas às perguntas abertas: login por convite, vencimento, recorrência com geração automática, pendentes à parte, categorias livres.
- 0.1 — Rascunho inicial.
