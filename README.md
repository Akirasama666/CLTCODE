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
- **Documentos**: lê o PDF do extrato do Serasa e do Registrato do Banco Central,
  lista o que encontrou e integra as dívidas com um clique. A leitura acontece no
  próprio navegador — o arquivo não é enviado a lugar nenhum, só o resumo é salvo.
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

## Contas, planos e administração

### Como funciona hoje

O CLT Code já é multiusuário. Cada pessoa cria a própria conta e só enxerga os
próprios dados — quem garante isso é a RLS do Postgres, não o código do site.
Você é apenas mais um usuário, com uma diferença: seu perfil tem `admin = true`.

### O painel do dono

Quem tem `admin = true` vê o menu **Administração**, com:

- quantas pessoas se cadastraram, quantas abriram o app nos últimos 30 dias,
  quantas estão no Pro e a receita recorrente das assinaturas ativas;
- a lista de pessoas, onde dá para trocar o plano (Free/Pro) e a data de validade;
- o registro de pagamentos: escolhe a pessoa, o valor, o método e o período —
  o plano dela vira Pro automaticamente até a data final.

### Como virar administrador

Uma vez, no SQL Editor do Supabase:

```sql
update public.perfis set admin = true where email = 'seu@email.com';
```

### Sobre cobrança automática

O registro de pagamento acima é **manual** — feito para quem recebe por Pix.
Para cobrança automática (cartão recorrente), o caminho é um gateway
(Mercado Pago, Asaas ou Stripe) com **webhook**: o gateway avisa o servidor que
o pagamento entrou e o servidor muda o plano. A mudança de plano nunca pode
partir do navegador do cliente, senão qualquer pessoa libera o Pro sozinha —
é por isso que as políticas de `perfis` só deixam o dono alterar planos.


## Planos e limites

Três planos: **Free**, **Pro** (R$ 12,90/mês) e **Vitalício** (R$ 49,90, pagamento único).

Os limites ficam em um único lugar no `app.js` — a constante `LIMITES`:

```js
const LIMITES = {
  free: { dividas: 2, recibosMes: 3, mesesGrafico: 3,  documentos: false, buscaPreco: false, exportar: false },
  pago: { dividas: Infinity, recibosMes: Infinity, mesesGrafico: 12, documentos: true, buscaPreco: true, exportar: true }
};
```

Mudou o número ali, mudou no app inteiro. Os preços ficam em `PRECOS`.

Quem está com plano ativo **não vê a tela de preços** — ela só reaparece quando a
assinatura vence, ou nos 5 dias antes do vencimento, como aviso de renovação.
O Vitalício nunca vê preço.

### Contato para pagamento

Preencha a constante `CONTATO` no topo do `app.js` para os botões "Quero o Pro" e
"Quero o Vitalício" abrirem seus dados:

```js
const CONTATO = { pix: 'sua-chave-pix', whatsapp: '5561999999999', email: 'voce@email.com' };
```

Enquanto estiver vazio, o app avisa que o contato ainda não foi configurado.

### Aviso honesto sobre os limites

O bloqueio hoje é **na tela**. Alguém com conhecimento técnico consegue burlar pelo
navegador. Para um app pessoal e os primeiros assinantes isso basta; quando houver
dinheiro de verdade em jogo, os limites precisam subir para o banco (regras de RLS
e funções que contem recibos e dívidas por usuário).
