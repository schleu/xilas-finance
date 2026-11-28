# Spec 007 — Supermercado, Subitens e Importação de NF-e / NFC-e (CE e BA)

**Status:** aprovada · **Versão:** 0.3 · **Foco:** o quê e por quê (sem decisões de implementação)

> Aprovada em 27/11/2026. Implementação liberada.

## Objetivo

Permitir que o usuário registre despesas de supermercado com detalhes específicos (mercado selecionado das Lojas/Supermercados cadastrados em Configurações ou nome fantasia avulso, forma de pagamento própria de supermercado, link da NF-e/NFC-e e subitens com categoria, quantidade e preço unitário), podendo escanear o QR Code da nota fiscal para importar automaticamente os dados e subitens (suporte prioritário para CE e BA).

## Escopo

**Dentro:** categoria "Supermercado", campos específicos de supermercado em despesas dessa categoria (forma de pagamento específica, nome fantasia/supermercado cadastrado em Configurações, link da NF-e/NFC-e opcional), cadastro manual e visualização de subitens (descrição, categoria do subitem, valor total, quantidade + unidade, valor por unidade/quantidade), leitura de QR Code via câmera do navegador, importação de dados e subitens a partir de link da NFC-e (CE e BA) com revisão antes de salvar.
**Fora:** integração direta com certificado digital A1/A3 da Receita Federal, controle de estoque/despensa, comparação de preços entre usuários, quebra automática de CAPTCHA.

## Glossário

- **Despesa de supermercado:** lançamento normal em `bills` cuja categoria é `Supermercado`, aparecendo normalmente nos totais e gráficos da homepage.
- **Forma de pagamento de supermercado:** meio de pagamento específico para compras de supermercado: `crédito`, `débito`, `vale-alimentação`, `vale-refeição`, `pix` ou `dinheiro`.
- **Subitem:** item individual de uma compra de supermercado (ex.: "Sabão em pó 1kg", categoria `Limpeza`, quantidade `1 kg`, valor unitário `R$ 15,90/kg`, total `R$ 15,90`).
- **NFC-e / NF-e:** Nota Fiscal de Consumidor Eletrônica acessível via link contido no QR Code impresso no cupom fiscal (SEFAZ-CE e SEFAZ-BA).

## US-1 — Cadastro de despesa de supermercado

Como usuário, quero registrar uma compra de supermercado com o mercado (cadastrado em Configurações ou avulso), forma de pagamento adequada e link opcional da nota fiscal para acompanhar meus gastos de mercado com precisão.

**Critérios de aceite**
- [ ] Existe a categoria **Supermercado** (criada como padrão para novos usuários e via backfill para existentes).
- [ ] Quando a despesa pertence à categoria Supermercado, o formulário exibe os campos específicos:
  - **Supermercado / Nome fantasia:** seleção rápida entre os Supermercados cadastrados em Configurações (`Assaí`, `Pão de Açúcar`, `Atacadão`, `Cometa`, `São Luiz`, `Nidobox` e outros criados pelo usuário) ou texto livre
  - **Forma de pagamento de supermercado:** `crédito`, `débito`, `vale-alimentação`, `vale-refeição`, `pix` ou `dinheiro` (exclusivo da categoria Supermercado)
  - **Link da NF-e / NFC-e** (URL opcional)
- [ ] A compra de supermercado entra normalmente nos totais mensais, saldo, gráficos por categoria e evolução mensal da homepage.

## US-2 — Subitens da compra de supermercado

Como usuário, quero detalhar os itens de uma compra de supermercado (com categoria do item, quantidade, unidade e valor por unidade) para entender onde gasto mais dentro do mercado.

**Critérios de aceite**
- [ ] Em uma despesa de supermercado, o usuário pode adicionar, editar e remover **subitens** (opcional; uma despesa pode ser salva sem subitens).
- [ ] Cada subitem possui:
  - **Descrição*** (obrigatório, 1–160 caracteres)
  - **Categoria do subitem*** (`Alimento`, `Limpeza`, `Higiene`, `Bebidas`, `Hortifruti`, `Padaria/Açougue`, `Outros`)
  - **Quantidade*** (numérico > 0) e **Unidade*** (`un`, `kg`, `g`, `l`, `ml`, `pct`)
  - **Valor por unidade/quantidade*** (em BRL / centavos inteiros)
  - **Valor total do item*** (em BRL / centavos inteiros, > 0; calculado automaticamente a partir de quantidade × valor unitário quando preenchidos, permitindo ajuste manual)
- [ ] A interface exibe a soma dos subitens e sinaliza caso divirja do valor total da despesa (com botão para atualizar o total pela soma dos subitens).
- [ ] Todos os valores monetários de subitens são armazenados em **centavos inteiros** (nunca `float`).
- [ ] Subitens são isolados por usuário via RLS.

## US-3 — Leitura de QR Code (link da NFC-e)

Como usuário, quero apontar a câmera do celular ou computador para o QR Code do cupom fiscal para preencher automaticamente o link da NF-e/NFC-e.

**Critérios de aceite**
- [ ] No formulário de despesa de supermercado, existe um botão **"Ler QR Code"** que abre o leitor de câmera em modal.
- [ ] Ao detectar QR Code contendo URL válida de NF-e/NFC-e, o leitor fecha automaticamente, preenche o campo de link e oferece/dispara a importação dos itens.
- [ ] Se o dispositivo não tiver câmera ou a permissão for negada, exibe mensagem amigável em pt-BR permitindo colar o link manualmente.
- [ ] A câmera é encerrada imediatamente ao fechar o modal ou concluir a leitura.

## US-4 — Importação de subitens a partir do link da NF-e / NFC-e (CE e BA)

Como usuário, quero importar automaticamente o nome do mercado, o valor total e os subitens a partir do link da NF-e/NFC-e (CE e BA) para economizar tempo no cadastro.

**Critérios de aceite**
- [ ] Ao informar um link de NFC-e da **SEFAZ-CE** ou **SEFAZ-BA** e acionar **"Importar da NF-e"**, o servidor busca e interpreta a página pública da nota fiscal.
- [ ] A importação retorna para revisão na tela (sem salvar automaticamente): nome fantasia do mercado (associando automaticamente a um Supermercado cadastrado quando houver correspondência), data da compra, valor total em centavos e lista de subitens com sugestão de categoria.
- [ ] O usuário pode revisar, ajustar ou remover itens antes de salvar a despesa.
- [ ] O endpoint valida estritamente a URL contra uma allowlist de domínios oficiais da SEFAZ (`*.sefaz.ce.gov.br`, `*.sefaz.ba.gov.br`) para evitar SSRF.
- [ ] Se a SEFAZ estiver indisponível, exigir CAPTCHA ou retornar formato não reconhecido, o app exibe mensagem clara e mantém o link salvo para cadastro manual.

## Requisitos não funcionais

- **Segurança:** RLS obrigatória em `bill_items`; allowlist anti-SSRF no endpoint; JWT obrigatório; nunca tentar burlar CAPTCHA.
- **Precisão monetária:** valores em centavos inteiros (`integer`); quantidades em `numeric(10,3)`.

## Premissas adotadas

1. Reutiliza a tabela `bills` e integra-se com os Supermercados cadastrados em `public.stores` (`003-settings-and-expenses-rename`).
2. `supermarket_payment_method` separa cartão de débito/vales de supermercado do `debit` (débito em conta bancária).
3. Categorização inicial dos subitens importados usa heurística determinística por palavras-chave, sempre editável pelo usuário.

## Histórico

- 0.2 — Renumerada para `007-supermarket-nfe` e integrada com os Supermercados cadastrados em Configurações (`003`).
- 0.1 — Rascunho inicial (antiga `005-supermarket-nfe`).
