# CLT Code

Seu dinheiro em horas. Calculadora de ganhos e controle financeiro pessoal para
quem trabalha de carteira assinada, por hora, por dia ou por escala.

## O que o app faz

- **Valor da sua hora, do seu dia e do seu minuto**, a partir do salário mensal
  e da escala de trabalho (5x2, 6x1, 12x36, 24x48, meio período ou personalizada).
  O valor da hora usa o divisor da CLT (44h semanais → 220h/mês).
- **Contas do mês** fixas e variáveis, com vencimento, status de pagamento e o
  custo de cada uma traduzido em horas de trabalho.
- **Dívidas**: cada dívida tem uma caixinha que decide se a parcela entra no
  total de saídas do mês. Barra de progresso, abatimento por parcela ou por
  valor livre, e ordem sugerida de quitação (bola de neve).
- **Entradas e saídas** com histórico permanente.
- **Gráficos** dos últimos seis meses: entrou × saiu, evolução do saldo e
  divisão das saídas por categoria.
- **Preços**: simulador "vale quantas horas?" e busca (`/api/precos`).
- **Recibos em PDF** com valor por extenso.
- **Funciona offline** e pode ser instalado como aplicativo (PWA).

## Estrutura

```
index.html          página única do app
app.css             sistema visual (tokens, tema claro/escuro)
app.js              toda a lógica
sw.js               service worker (modo offline)
manifest.json       instalação como app
icon.svg            ícone
api/precos.js       função serverless de busca de preço
```

## Publicar

Projeto estático + uma função serverless. Na Vercel:

- **Framework Preset:** Other
- **Build Command:** vazio
- **Output Directory:** vazio
- **Install Command:** vazio

Depois do primeiro deploy, em **Settings → Deployment Protection**, deixe
*Vercel Authentication* como **Disabled** para o site ficar público.

## Variáveis de ambiente

| Nome | Obrigatória | Para que serve |
|---|---|---|
| `SERPAPI_KEY` | não | Liga a busca de preço real no Google Shopping. Sem ela, `/api/precos` responde com o catálogo de preços de referência embutido. |

## Banco de dados

Supabase (`mbcmnzdgsvqezelujuwq`). Tabelas: `perfis`, `contas`, `lancamentos`,
`dividas`, `recibos`, `itens_preco`, `precos_cache`.

Todas com **RLS** ligada: cada usuário só lê e escreve as próprias linhas. A URL
e a chave publicável ficam no topo de `app.js` — são públicas por natureza, quem
protege os dados são as políticas de RLS, não a chave.

Sem login, o app funciona em modo local (`localStorage`). Ao criar conta, os
dados que já estavam no aparelho sobem para a nuvem.
