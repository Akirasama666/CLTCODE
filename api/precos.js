/* ============================================================
   /api/precos?q=termo
   ------------------------------------------------------------
   Sem chave de API configurada  -> responde com o catálogo de
   preços de referência abaixo (fonte: "catalogo").
   Com SERPAPI_KEY na Vercel     -> busca preço real no Google
   Shopping Brasil (fonte: "api").
   Para ligar a busca real, basta criar a variável de ambiente
   SERPAPI_KEY no painel da Vercel. Nada mais muda no código.
   ============================================================ */

const CATALOGO = [
  { nome: 'Cesta básica (mensal)',            preco: 820,   tags: 'cesta basica alimento mercado compra mes' },
  { nome: 'Compra de mercado (semanal)',      preco: 280,   tags: 'mercado supermercado compras feira semana' },
  { nome: 'Botijão de gás 13 kg',             preco: 115,   tags: 'gas botijao cozinha glp' },
  { nome: 'Gasolina — 1 litro',               preco: 6.2,   tags: 'gasolina combustivel posto litro' },
  { nome: 'Gasolina — tanque de 40 L',        preco: 248,   tags: 'gasolina tanque combustivel carro' },
  { nome: 'Etanol — 1 litro',                 preco: 4.3,   tags: 'etanol alcool combustivel' },
  { nome: 'Passagem de ônibus urbano',        preco: 5.5,   tags: 'onibus passagem transporte publico busao' },
  { nome: 'Vale-transporte mensal',           preco: 242,   tags: 'vale transporte mensal onibus' },
  { nome: 'Almoço no self-service',           preco: 32,    tags: 'almoco comida restaurante self service marmita' },
  { nome: 'Marmita congelada',                preco: 18,    tags: 'marmita comida congelada' },
  { nome: 'Café da manhã na padaria',         preco: 15,    tags: 'cafe padaria pao manha' },
  { nome: 'Conta de energia (residencial)',   preco: 145,   tags: 'energia luz eletrica conta' },
  { nome: 'Conta de água',                    preco: 78,    tags: 'agua saneamento conta' },
  { nome: 'Internet fibra 300 Mb',            preco: 99.9,  tags: 'internet fibra wifi banda larga' },
  { nome: 'Plano de celular pré-pago',        preco: 35,    tags: 'celular chip plano telefone pre pago' },
  { nome: 'Aluguel de 1 quarto (interior)',   preco: 750,   tags: 'aluguel casa quarto moradia' },
  { nome: 'Celular de entrada',               preco: 900,   tags: 'celular smartphone telefone entrada' },
  { nome: 'Celular intermediário',            preco: 1600,  tags: 'celular smartphone intermediario' },
  { nome: 'Celular top de linha',             preco: 5200,  tags: 'celular smartphone top iphone galaxy' },
  { nome: 'Notebook básico',                  preco: 2500,  tags: 'notebook laptop computador basico' },
  { nome: 'Notebook para trabalho',           preco: 4200,  tags: 'notebook laptop computador trabalho' },
  { nome: 'Smart TV 43"',                     preco: 1700,  tags: 'tv televisao smart 43' },
  { nome: 'Geladeira frost free',             preco: 3100,  tags: 'geladeira refrigerador frost free eletrodomestico' },
  { nome: 'Máquina de lavar 11 kg',           preco: 2200,  tags: 'maquina lavar roupa lavadora' },
  { nome: 'Fogão 4 bocas',                    preco: 950,   tags: 'fogao 4 bocas cozinha' },
  { nome: 'Micro-ondas',                      preco: 620,   tags: 'microondas micro ondas cozinha' },
  { nome: 'Ventilador de coluna',             preco: 180,   tags: 'ventilador coluna calor' },
  { nome: 'Ar-condicionado 9.000 BTUs',       preco: 2100,  tags: 'ar condicionado split btus' },
  { nome: 'Par de tênis esportivo',           preco: 320,   tags: 'tenis calcado sapato esportivo' },
  { nome: 'Calça jeans',                      preco: 150,   tags: 'calca jeans roupa' },
  { nome: 'Camiseta básica',                  preco: 55,    tags: 'camiseta camisa roupa' },
  { nome: 'Corte de cabelo',                  preco: 45,    tags: 'cabelo corte barbeiro salao' },
  { nome: 'Cinema (ingresso inteiro)',        preco: 36,    tags: 'cinema filme ingresso lazer' },
  { nome: 'Streaming de vídeo (mensal)',      preco: 45,    tags: 'streaming netflix assinatura video' },
  { nome: 'Academia (mensalidade)',           preco: 120,   tags: 'academia ginastica musculacao mensalidade' },
  { nome: 'Consulta médica particular',       preco: 280,   tags: 'medico consulta saude particular' },
  { nome: 'Plano de saúde individual',        preco: 480,   tags: 'plano saude convenio mensalidade' },
  { nome: 'Consulta odontológica',            preco: 180,   tags: 'dentista odontologia dente' },
  { nome: 'Bicicleta aro 29',                 preco: 1450,  tags: 'bicicleta bike aro 29' },
  { nome: 'Moto 160cc (entrada)',             preco: 3500,  tags: 'moto motocicleta entrada financiamento' },
  { nome: 'Curso técnico (mensalidade)',      preco: 320,   tags: 'curso tecnico escola mensalidade estudo' },
  { nome: 'Faculdade EAD (mensalidade)',      preco: 290,   tags: 'faculdade ead universidade mensalidade' },
  { nome: 'Botija de água mineral 20 L',      preco: 16,    tags: 'agua mineral galao botija' },
  { nome: 'Pizza grande delivery',            preco: 68,    tags: 'pizza delivery comida jantar' },
  { nome: 'Cerveja — caixa 12 latas',         preco: 48,    tags: 'cerveja caixa lata bebida' },
  { nome: 'Botina de trabalho',               preco: 165,   tags: 'botina bota trabalho calcado epi' },
  { nome: 'Kit de ferramentas',               preco: 240,   tags: 'ferramenta kit chave trabalho' },
  { nome: 'Colchão de casal',                 preco: 1100,  tags: 'colchao cama casal movel' },
  { nome: 'Sofá 3 lugares',                   preco: 1600,  tags: 'sofa movel sala 3 lugares' },
  { nome: 'Mesa com 4 cadeiras',              preco: 890,   tags: 'mesa cadeira jantar movel' }
];

function normalizar(s){
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buscarNoCatalogo(termo){
  const palavras = normalizar(termo).split(' ').filter(p => p.length > 2);
  if(!palavras.length) return [];
  return CATALOGO
    .map(item => {
      const alvo = normalizar(item.nome + ' ' + item.tags);
      let pontos = 0;
      palavras.forEach(p => {
        if(alvo.includes(p)) pontos += 2;
        else if(alvo.split(' ').some(t => t.startsWith(p.slice(0,4)))) pontos += 1;
      });
      return { item, pontos };
    })
    .filter(r => r.pontos > 0)
    .sort((a,b) => b.pontos - a.pontos)
    .slice(0, 6)
    .map(r => ({ nome: r.item.nome, preco: r.item.preco, fonte: 'preço de referência' }));
}

async function buscarNaApi(termo, chave){
  const url = 'https://serpapi.com/search.json?engine=google_shopping'
    + '&q=' + encodeURIComponent(termo)
    + '&gl=br&hl=pt-br&location=Brazil&api_key=' + encodeURIComponent(chave);
  const r = await fetch(url);
  if(!r.ok) throw new Error('busca indisponível');
  const j = await r.json();
  const lista = j.shopping_results || [];
  return lista.slice(0, 8).map(x => ({
    nome: x.title,
    preco: typeof x.extracted_price === 'number' ? x.extracted_price : 0,
    loja: x.source || '',
    url: x.product_link || x.link || null,
    fonte: 'preço ao vivo'
  })).filter(x => x.preco > 0);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');

  const termo = (req.query && req.query.q) || '';
  if(!termo || String(termo).trim().length < 2){
    return res.status(400).json({ erro: 'Informe o que você quer buscar.', resultados: [] });
  }

  const chave = process.env.SERPAPI_KEY;
  if(chave){
    try{
      const resultados = await buscarNaApi(termo, chave);
      if(resultados.length) return res.status(200).json({ fonte: 'api', termo, resultados });
    } catch(e){ /* cai para o catálogo abaixo */ }
  }

  return res.status(200).json({
    fonte: 'catalogo',
    termo,
    aviso: 'Preços médios de referência no Brasil. Confira na loja antes de comprar.',
    resultados: buscarNoCatalogo(termo)
  });
};
