# Constituição — Xilas Finance

Princípios que valem para toda spec, plano e tarefa. Mudou um princípio? Atualize aqui primeiro.

## Stack

- **Frontend:** React + TypeScript (strict), Tailwind, shadcn/ui
- **Backend/dados:** Supabase (Postgres, Auth por convite, Row Level Security)
- **Hospedagem:** Vercel (previews por PR, produção na `main`)
- **Versionamento:** GitHub, branches curtas, Conventional Commits
- **LLM:** modelos gratuitos de provedores intercambiáveis (DeepSeek, OpenRouter, Together AI e outros), acessados apenas pelo servidor

## Princípios

1. **Spec primeiro.** Nenhuma feature é implementada sem spec aprovada em `specs/`. Código diverge da spec? Corrija a spec ou o código, nunca deixe os dois desalinhados.
2. **Dinheiro nunca é float.** Valores monetários são armazenados como inteiros em centavos (ou `numeric` no Postgres) e formatados só na UI.
3. **Segurança por padrão.** RLS ativo em todas as tabelas; cada linha pertence a um `user_id`. Dados bancários (banco, agência, conta) são tratados como sensíveis: nunca em logs, nunca enviados ao LLM sem necessidade.
4. **Chaves só no servidor.** As chaves dos provedores de LLM e a `service_role` do Supabase ficam em variáveis de ambiente da Vercel, nunca no bundle do cliente.
4a. **Provedor de LLM é plugável.** O app fala com uma interface única de "provedor de LLM"; trocar de DeepSeek para OpenRouter, Together AI ou outro é configuração (provedor, modelo, chave), não mudança de código. Camadas gratuitas mudam de limite e de modelos disponíveis, então nenhuma regra de negócio depende de um modelo específico.
5. **LLM propõe, usuário confirma.** O chatbot nunca grava dados sem uma confirmação explícita do usuário. Saídas do LLM são validadas com schema (Zod) antes de qualquer escrita.
6. **Validação única.** Os mesmos schemas Zod validam formulários, API e ferramentas do chatbot.
7. **Componentes simples.** Preferir componentes shadcn existentes; lógica de dados em hooks/serviços, não em componentes de UI.
8. **Testável.** Cada critério de aceite da spec vira pelo menos um teste (unitário, de componente ou e2e).
9. **Pequeno e verificável.** Tarefas cabem em um PR pequeno e têm um critério de pronto objetivo.
10. **Acessível e responsivo.** Mobile-first; contraste e navegação por teclado nos componentes interativos.

## Governança do SDD

- Ordem de autoridade: constituição > spec > plano > tarefas > código.
- Só humanos aprovam specs (`Status: aprovada`) e alteram esta constituição; agents propõem.
- Toda mudança de código de comportamento aponta para uma tarefa (`T-NN`) e uma spec (`Spec:` / `Task:` no PR).
- Regras operacionais para agents estão em `AGENTS.md`; o verificador é `npm run check:specs`.

## Convenções

- Pastas: `src/features/<feature>/{components,hooks,api,schemas}`
- Nomes de tabela em `snake_case`, plural; migrações versionadas em `supabase/migrations`
- Idioma da UI: pt-BR; código e commits em inglês
- Moeda padrão: BRL; datas em `America/Fortaleza` na exibição, UTC no banco

## Definição de pronto

- Critérios de aceite da spec atendidos e testados
- Sem erros de TypeScript/lint; build da Vercel verde
- RLS verificada para qualquer tabela nova ou alterada
- Spec e plano atualizados se algo mudou
