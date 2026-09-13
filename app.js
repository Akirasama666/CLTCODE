/* ============================================================
   CLT Code — aplicação
   ============================================================ */
"use strict";

const SUPABASE_URL = "https://mbcmnzdgsvqezelujuwq.supabase.co";
const SUPABASE_KEY = "sb_publishable_JC1r-HWGKnLCPsvY8EmxcA_8kfPGTdt";
const SAL_MIN_2026 = 1621;

/* Se a biblioteca do Supabase não carregar (sem internet, bloqueio de rede),
   o app continua funcionando em modo local com este substituto. */
function clienteFalso(){
  const erro = { error: { message: 'sem conexão com a nuvem' }, data: null };
  const tabela = () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => erro, then: undefined }), }),
    update: () => ({ eq: async () => erro }),
    upsert: async () => erro,
    delete: () => ({ eq: async () => erro })
  });
  return {
    offline: true,
    from: tabela,
    auth: {
      getSession: async () => ({ data:{ session:null } }),
      signUp: async () => { throw new Error('sem conexão'); },
      signInWithPassword: async () => { throw new Error('sem conexão'); },
      signOut: async () => {},
      resetPasswordForEmail: async () => ({ error:{ message:'sem conexão' } }),
      onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } })
    }
  };
}
let sb;
try {
  sb = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : clienteFalso();
} catch(e){ sb = clienteFalso(); }
const SEM_NUVEM = !!sb.offline;

/* ---------------- utilidades ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const BRL = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
const money = v => BRL.format(+v || 0);
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }));
const todayISO = () => new Date().toLocaleDateString('sv-SE');
const monthOf  = iso => String(iso).slice(0,7);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmtH(h){ if(!isFinite(h)||h<=0) return '0h';
  const H=Math.floor(h), M=Math.round((h-H)*60);
  return M===60 ? (H+1)+'h' : H+'h'+(M?String(M).padStart(2,'0'):''); }
function monthLabel(m){ const [y,mo]=m.split('-'); return MESES[+mo-1]+' '+y; }
function shortMonth(m){ const [y,mo]=m.split('-'); return MESES[+mo-1].slice(0,3)+'/'+y.slice(2); }
function addMonth(m,d){ const [y,mo]=m.split('-').map(Number); return new Date(y,mo-1+d,1).toLocaleDateString('sv-SE').slice(0,7); }
function toast(msg, kind){ const t=document.createElement('div'); t.className='toast'+(kind?' '+kind:'');
  t.textContent=msg; $('#toasts').appendChild(t); setTimeout(()=>t.remove(), 3200); }

const CATS_CONTA = ['Moradia','Alimentação','Transporte','Contas de casa','Saúde','Educação','Lazer','Dívidas','Outros'];
const CATS_LANC  = ['Salário','Extra / freela','Alimentação','Transporte','Moradia','Lazer','Saúde','Compras','Dívidas','Outros'];

/* ---------------- estado local ---------------- */
const LS='cltcode.v2', LS_OUT='cltcode.outbox';
function vazio(){
  return { v:2, demo:false, updatedAt:Date.now(),
    perfil:{ nome:'', cidade:'', documento:'', salario:SAL_MIN_2026, jornada:44, dias_uteis:22,
      escala:'5x2', horas_dia:8.8, dias_trabalhados:22, saldo_inicial:0, plano:'free', plano_expira:null },
    contas:[], lancamentos:[], recibos:[], itens:[], dividas:[], documentos:[], meta:{ nome:'', valor:0, mensal:0 } };
}
function exemplo(){
  const s = vazio(), m = todayISO().slice(0,7), d = n => m+'-'+String(n).padStart(2,'0');
  s.demo = true; s.perfil.saldo_inicial = 400;
  s.contas = [
    { id:uid(), mes:m, nome:'Aluguel',          valor:750,   tipo:'fixa',     categoria:'Moradia',        dia:5,  pago:true  },
    { id:uid(), mes:m, nome:'Energia elétrica', valor:138.4, tipo:'variavel', categoria:'Contas de casa', dia:12, pago:false },
    { id:uid(), mes:m, nome:'Internet',         valor:99.9,  tipo:'fixa',     categoria:'Contas de casa', dia:15, pago:false },
    { id:uid(), mes:m, nome:'Mercado',          valor:520,   tipo:'variavel', categoria:'Alimentação',    dia:20, pago:false },
    { id:uid(), mes:m, nome:'Transporte',       valor:180,   tipo:'fixa',     categoria:'Transporte',     dia:5,  pago:true  }
  ];
  s.lancamentos = [
    { id:uid(), data:d(5),  descricao:'Salário',               valor:SAL_MIN_2026, tipo:'entrada', categoria:'Salário' },
    { id:uid(), data:d(8),  descricao:'Freela de montagem',    valor:150, tipo:'entrada', categoria:'Extra / freela' },
    { id:uid(), data:d(9),  descricao:'Almoço fora',           valor:32,  tipo:'saida',   categoria:'Alimentação' },
    { id:uid(), data:d(14), descricao:'Bico de fim de semana', valor:50,  tipo:'entrada', categoria:'Extra / freela' },
    { id:uid(), data:d(15), descricao:'Bico de fim de semana', valor:50,  tipo:'entrada', categoria:'Extra / freela' }
  ];
  s.itens = [
    { id:uid(), nome:'Cesta básica',              preco:820,  fonte:'referência' },
    { id:uid(), nome:'Botijão de gás 13kg',       preco:115,  fonte:'referência' },
    { id:uid(), nome:'Gasolina — 1 tanque (40 L)',preco:250,  fonte:'referência' },
    { id:uid(), nome:'Celular intermediário',     preco:1500, fonte:'referência' }
  ];
  s.dividas = [
    { id:uid(), nome:'Cartão de crédito', credor:'Banco', total:1800, pago:600, parcela:300, dia:10, juros:0, contar:true,  quitada:false },
    { id:uid(), nome:'Loja de móveis',    credor:'Carnê', total:900,  pago:150, parcela:150, dia:20, juros:0, contar:false, quitada:false }
  ];
  s.meta = { nome:'Notebook novo', valor:2500, mensal:300 };
  return s;
}
function carregar(){
  try { const r = localStorage.getItem(LS); if(r){ const s = JSON.parse(r); if(s && s.perfil){
    s.dividas = s.dividas || []; s.documentos = s.documentos || [];
    if(!s.perfil.escala){ s.perfil.escala='5x2'; s.perfil.horas_dia=8.8; s.perfil.dias_trabalhados = s.perfil.dias_uteis || 22; }
    return s; } } } catch(e){}
  return exemplo();
}
let S = carregar();
let mesSel = todayISO().slice(0,7);
let sessao = null;          // sessão do Supabase, ou null (modo local)

function salvarLocal(){
  S.updatedAt = Date.now();
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch(e){}
}
function commit(render){ salvarLocal(); if(render !== false) desenharTudo(); }

/* ---------------- fila offline + sincronização ---------------- */
function fila(){ try { return JSON.parse(localStorage.getItem(LS_OUT) || '[]'); } catch(e){ return []; } }
function setFila(f){ try { localStorage.setItem(LS_OUT, JSON.stringify(f.slice(-400))); } catch(e){} }
function enfileirar(op){ const f = fila(); f.push(op); setFila(f); marcarSync(); }

const TABELAS = { contas:'contas', lancamentos:'lancamentos', recibos:'recibos', itens:'itens_preco', dividas:'dividas', documentos:'documentos' };

async function enviar(op){
  if(!sessao) return false;
  try{
    if(op.tipo === 'perfil'){
      const { error } = await sb.from('perfis').update(op.dados).eq('id', sessao.user.id);
      if(error) throw error;
    } else if(op.tipo === 'upsert'){
      const { error } = await sb.from(TABELAS[op.col]).upsert({ ...op.dados, user_id: sessao.user.id });
      if(error) throw error;
    } else if(op.tipo === 'delete'){
      const { error } = await sb.from(TABELAS[op.col]).delete().eq('id', op.id);
      if(error) throw error;
    }
    return true;
  } catch(e){ return false; }
}
async function sincronizar(op){
  if(!sessao) return;
  const ok = await enviar(op);
  if(!ok) enfileirar(op); else marcarSync();
}
async function esvaziarFila(){
  if(!sessao || !navigator.onLine) return;
  let f = fila();
  while(f.length){
    const ok = await enviar(f[0]);
    if(!ok) break;
    f.shift(); setFila(f);
  }
  marcarSync();
}
function marcarSync(){
  const b = $('#syncBadge'); if(!b) return;
  const pend = fila().length;
  b.className = 'sync' + (sessao ? (pend ? ' off' : ' on') : '');
  b.lastElementChild.textContent = !sessao ? 'Só neste aparelho'
    : pend ? (pend + ' alteração(ões) na fila') : 'Salvo na nuvem';
}

async function puxarDaNuvem(){
  if(!sessao) return;
  const uidv = sessao.user.id;
  const [p, c, l, r, i, dv, dc] = await Promise.all([
    sb.from('perfis').select('*').eq('id', uidv).maybeSingle(),
    sb.from('contas').select('*').eq('user_id', uidv),
    sb.from('lancamentos').select('*').eq('user_id', uidv),
    sb.from('recibos').select('*').eq('user_id', uidv),
    sb.from('itens_preco').select('*').eq('user_id', uidv),
    sb.from('dividas').select('*').eq('user_id', uidv),
    sb.from('documentos').select('*').eq('user_id', uidv).order('criado_em', { ascending:false })
  ]);
  const temNuvem = (c.data||[]).length || (l.data||[]).length || (r.data||[]).length;

  if(!temNuvem && (S.contas.length || S.lancamentos.length) && !S.demo){
    // primeiro login com dados locais: sobe o que já existe neste aparelho
    await subirTudo();
    toast('Seus dados locais foram enviados para a nuvem', 'good');
    return;
  }
  if(p.data){
    S.perfil = {
      nome:p.data.nome||'', cidade:p.data.cidade||'', documento:p.data.documento||'',
      salario:+p.data.salario, jornada:+p.data.jornada, dias_uteis:+p.data.dias_uteis,
      email:p.data.email||'', admin:!!p.data.admin,
      escala:p.data.escala||'5x2', horas_dia:+p.data.horas_dia||8.8,
      dias_trabalhados:+p.data.dias_trabalhados||22,
      saldo_inicial:+p.data.saldo_inicial, plano:p.data.plano||'free',
      plano_expira:p.data.plano_expira ? String(p.data.plano_expira).slice(0,10) : null
    };
  }
  if(temNuvem){
    S.demo = false;
    S.contas      = (c.data||[]).map(x=>({ id:x.id, mes:x.mes, nome:x.nome, valor:+x.valor, tipo:x.tipo, categoria:x.categoria, dia:x.dia, pago:x.pago }));
    S.lancamentos = (l.data||[]).map(x=>({ id:x.id, data:x.data, descricao:x.descricao, valor:+x.valor, tipo:x.tipo, categoria:x.categoria }));
    S.recibos     = (r.data||[]).map(x=>({ id:x.id, numero:x.numero, pagador:x.pagador, valor:+x.valor, data:x.data, referente:x.referente, cidade:x.cidade, emissor:x.emissor, documento:x.documento }));
    S.itens       = (i.data||[]).map(x=>({ id:x.id, nome:x.nome, preco:+x.preco, fonte:x.fonte, url:x.url }));
    S.dividas     = (dv.data||[]).map(x=>({ id:x.id, nome:x.nome, credor:x.credor, total:+x.total, pago:+x.pago,
      parcela:+x.parcela, dia:x.dia, juros:+x.juros, contar:x.contar, quitada:x.quitada }));
    S.documentos   = (dc.data||[]).map(x=>({ id:x.id, tipo:x.tipo, arquivo:x.arquivo, paginas:x.paginas,
      total:+x.total, itens:x.itens||[], integrado:x.integrado, criado_em:x.criado_em }));
  } else if(S.demo){
    // conta nova e sem nada na nuvem: começa limpo
    S = vazio(); S.perfil.nome = sessao.user.user_metadata?.nome || '';
  }
  salvarLocal();
}
async function subirTudo(){
  if(!sessao) return;
  const u = sessao.user.id;
  await sb.from('perfis').update(S.perfil).eq('id', u);
  const send = async (col, rows) => { if(rows.length) await sb.from(TABELAS[col]).upsert(rows.map(x=>({ ...x, user_id:u }))); };
  await send('contas', S.contas);
  await send('lancamentos', S.lancamentos);
  await send('recibos', S.recibos);
  await send('itens', S.itens);
  await send('dividas', S.dividas);
  await send('documentos', S.documentos);
}

/* ============================================================
   PLANOS E LIMITES
   Mude os números aqui para ajustar o que o Free oferece.
   ============================================================ */
const PRECOS = { pro: 12.90, vitalicio: 49.90 };
/* Preencha para o botão "Quero o Pro" abrir seu contato. */
const CONTATO = { pix: 'noxstudeo@gmail.com', whatsapp: '61993118272', email: 'noxstudeo@gmail.com' };

const LIMITES = {
  free: { dividas: 2, recibosMes: 3, mesesGrafico: 3,  documentos: false, buscaPreco: false, exportar: false },
  pago: { dividas: Infinity, recibosMes: Infinity, mesesGrafico: 12, documentos: true, buscaPreco: true, exportar: true }
};
function planoInfo(){
  const p = S.perfil.plano || 'free';
  const exp = S.perfil.plano_expira || null;
  if(p === 'vitalicio') return { plano:'vitalicio', nome:'Vitalício', ativo:true, expira:null, vencido:false };
  if(p === 'pro'){
    const ativo = !exp || exp >= todayISO();
    return { plano:'pro', nome:'Pro', ativo, expira:exp, vencido:!ativo };
  }
  return { plano:'free', nome:'Free', ativo:false, expira:null, vencido:false };
}
const ehPago = () => planoInfo().ativo;
const limite = () => ehPago() ? LIMITES.pago : LIMITES.free;
const recibosDoMes = () => S.recibos.filter(r => monthOf(r.data) === todayISO().slice(0,7)).length;

/* ---------------- cálculos ---------------- */
/* Escalas de trabalho brasileiras.
   diasMes = dias efetivamente trabalhados no mês · horasDia = duração do turno
   jornada = horas semanais, que define o divisor da CLT (44h -> 220h). */
const ESCALAS = {
  '5x2':    { nome:'5x2 — segunda a sexta (comercial)', diasMes:22, horasDia:8.8,  jornada:44 },
  '5x2_40': { nome:'5x2 — 40 horas semanais',           diasMes:22, horasDia:8,    jornada:40 },
  '6x1':    { nome:'6x1 — seis dias, uma folga',        diasMes:26, horasDia:7.33, jornada:44 },
  '5x1':    { nome:'5x1 — cinco dias, uma folga',       diasMes:25, horasDia:8,    jornada:44 },
  '6x2':    { nome:'6x2 — seis dias, duas folgas',      diasMes:22, horasDia:8,    jornada:44 },
  '4x2':    { nome:'4x2 — quatro dias, duas folgas',    diasMes:20, horasDia:11,   jornada:44 },
  '12x36':  { nome:'12x36 — plantão de 12 horas',       diasMes:15, horasDia:12,   jornada:36 },
  '24x48':  { nome:'24x48 — plantão de 24 horas',       diasMes:10, horasDia:24,   jornada:40 },
  'meio':   { nome:'Meio período — 6 horas por dia',    diasMes:22, horasDia:6,    jornada:30 },
  'livre':  { nome:'Personalizada — eu defino',         diasMes:22, horasDia:8,    jornada:44 }
};
function calc(){
  const p = S.perfil;
  const horasMes = Math.max(1, (+p.jornada||44) * 5);
  const hora = (+p.salario||0) / horasMes;
  const diasMes = Math.max(1, +p.dias_trabalhados || +p.dias_uteis || 22);
  const horasDia = Math.max(0.5, +p.horas_dia || (horasMes/diasMes));
  return { horasMes, hora, horasDia, diasMes, dia:(+p.salario||0)/diasMes, minuto:hora/60 };
}
const emHoras = v => v / Math.max(0.0001, calc().hora);
const contasDo = m => S.contas.filter(x => x.mes === m);
const lancDo   = m => S.lancamentos.filter(x => monthOf(x.data) === m);
function totaisMes(m){
  const L = lancDo(m), C = contasDo(m);
  const entradas    = L.filter(x=>x.tipo==='entrada').reduce((a,b)=>a+ +b.valor, 0);
  const saidasL     = L.filter(x=>x.tipo==='saida').reduce((a,b)=>a+ +b.valor, 0);
  const contasPagas = C.filter(x=>x.pago).reduce((a,b)=>a+ +b.valor, 0);
  const aPagar      = C.filter(x=>!x.pago).reduce((a,b)=>a+ +b.valor, 0);
  const parcelas = S.dividas.filter(d => d.contar && !d.quitada)
    .reduce((a,b) => a + Math.min(+b.parcela||0, Math.max(0, (+b.total||0)-(+b.pago||0))), 0);
  const saidas = saidasL + contasPagas;
  return { entradas, saidas, saidasL, contasPagas, parcelas, contasAbertas: aPagar,
           aPagar: aPagar + parcelas, resultado: entradas - saidas };
}
function saldoAte(m){
  let s = +S.perfil.saldo_inicial || 0;
  const meses = new Set([...S.lancamentos.map(x=>monthOf(x.data)), ...S.contas.map(x=>x.mes)]);
  [...meses].filter(x=>x<=m).sort().forEach(mm => { s += totaisMes(mm).resultado; });
  return s;
}
const ultimosMeses = n => { const a=[]; for(let i=n-1;i>=0;i--) a.push(addMonth(mesSel,-i)); return a; };

/* ============================================================
   DESENHO
   ============================================================ */
function desenharTudo(){
  $('#mLbl').textContent = monthLabel(mesSel);
  $('#demoNote').hidden  = !S.demo;
  $('#guestNote').hidden = !!sessao;
  painel(); contas(); renderDividas(); renderDocs(); lancamentos(); graficos(); precos(); recibo(); perfilView(); aplicarPlano();
  marcarSync();
}

/* ---------- painel ---------- */
function painel(){
  const c = calc(), t = totaisMes(mesSel);
  $('#fSal').value = S.perfil.salario;
  $('#fJor').value = S.perfil.jornada;
  $('#fDias').value = S.perfil.dias_trabalhados;
  $('#fEscala').value = S.perfil.escala || '5x2';
  $('#fHorasDia').value = S.perfil.horas_dia;
  const e0 = ESCALAS[S.perfil.escala] || ESCALAS['5x2'];
  $('#escalaHint').innerHTML = 'Na escala <b>' + e0.nome.split(' — ')[0] + '</b> você trabalha <b>' +
    S.perfil.dias_trabalhados + '</b> dias por mês, <b>' + fmtH(+S.perfil.horas_dia) + '</b> por dia. ' +
    'O valor da hora usa o divisor da CLT (<b>' + c.horasMes + 'h</b> para ' + S.perfil.jornada +
    'h semanais), que já embute o descanso semanal remunerado.';
  $('#fSaldo').value = S.perfil.saldo_inicial;

  $('#tHora').textContent = money(c.hora);
  $('#tHoraSub').textContent = c.horasMes + ' h no mês';
  $('#tDia').textContent = money(c.dia);
  $('#tDiaSub').textContent = fmtH(c.horasDia) + ' por dia · ' + c.diasMes + ' dias no mês';
  $('#tMin').textContent = money(c.minuto);
  $('#tHoras').textContent = c.horasMes + ' h';
  $('#tHorasSub').textContent = S.perfil.jornada + 'h por semana × 5';

  $('#mesResumo').textContent = 'Resultado de ' + monthLabel(mesSel) + ': ' + money(t.resultado);
  $('#tIn').textContent = money(t.entradas);
  $('#tInSub').innerHTML = '<span class="hours">' + fmtH(emHoras(t.entradas)) + ' de trabalho</span>';
  $('#tOut').textContent = money(t.saidas);
  $('#tOutSub').innerHTML = '<span class="hours">' + fmtH(emHoras(t.saidas)) + ' de trabalho</span>';
  $('#tDue').textContent = money(t.aPagar);
  $('#tDueSub').textContent = contasDo(mesSel).filter(x=>!x.pago).length + ' conta(s)' +
    (t.parcelas ? ' + ' + money(t.parcelas) + ' de dívidas' : '');
  const bal = saldoAte(mesSel);
  $('#tBal').textContent = money(bal);
  $('#tBalSub').textContent = 'Previsto após pagar tudo: ' + money(bal - t.aPagar);

  const ent = lancDo(mesSel).filter(x=>x.tipo==='entrada').sort((a,b)=>a.data.localeCompare(b.data));
  $('#chips').innerHTML = ent.length
    ? ent.map(x => '<span class="chip"><span>'+x.data.slice(8)+'</span><b>+'+NUM.format(x.valor)+'</b></span>').join('')
    : '<span class="hint">Nenhuma entrada registrada neste mês ainda.</span>';
  spark();

  $('#gNome').value = S.meta.nome || '';
  $('#gVal').value  = S.meta.valor || '';
  $('#gMes').value  = S.meta.mensal || '';
  meta();
}

function spark(){
  const [y,mo] = mesSel.split('-').map(Number);
  const nd = new Date(y, mo, 0).getDate();
  const byDay = new Array(nd).fill(0);
  lancDo(mesSel).filter(x=>x.tipo==='entrada').forEach(x => { byDay[+x.data.slice(8)-1] += +x.valor; });
  const max = Math.max(1, ...byDay);
  const W = Math.max(300, nd*11), H = 52, bw = 7, PADR = 12;
  let out = '';
  for(let i=0;i<nd;i++){
    const h = byDay[i] ? Math.max(3, (byDay[i]/max)*40) : 2;
    const x = i*(W-bw-PADR)/(nd-1);
    out += '<rect x="'+x.toFixed(1)+'" y="'+(H-14-h).toFixed(1)+'" width="'+bw+'" height="'+h.toFixed(1)+
           '" rx="3" fill="'+(byDay[i]?'var(--s3)':'var(--line-strong)')+'"><title>dia '+(i+1)+': '+money(byDay[i])+'</title></rect>';
  }
  [1, Math.ceil(nd/2), nd].forEach(d => {
    const x = (d-1)*(W-bw-PADR)/(nd-1) + bw/2;
    out += '<text x="'+x.toFixed(1)+'" y="'+(H-2)+'" text-anchor="'+(d===1?'start':d===nd?'end':'middle')+'">'+d+'</text>';
  });
  $('#sparkWrap').innerHTML =
    '<div class="flabel">Entradas por dia — pico '+money(max)+'</div>' +
    '<div class="chartwrap"><svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+
    '" role="img" aria-label="Entradas por dia do mês">'+out+'</svg></div>';
}

function meta(){
  const v = +S.meta.valor||0, m = +S.meta.mensal||0, c = calc();
  const el = $('#metaOut');
  if(!v){ el.innerHTML = '<span class="hint">Preencha o valor da meta para ver quanto tempo falta.</span>'; return; }
  const dias = v / Math.max(0.01, c.dia);
  const meses = m > 0 ? Math.ceil(v/m) : null;
  let txt = '<b>'+(S.meta.nome || 'Sua meta')+'</b> custa <b>'+money(v)+'</b> — ou <span class="hours">'+
    fmtH(emHoras(v))+' de trabalho</span>, o equivalente a <b>'+dias.toFixed(1).replace('.',',')+'</b> dias úteis.';
  if(meses){
    const alvo = addMonth(todayISO().slice(0,7), meses);
    txt += '<br>Guardando <b>'+money(m)+'</b> por mês, você chega lá em <b>'+meses+'</b> mês(es) — por volta de <b>'+monthLabel(alvo)+'</b>.';
  } else {
    txt += '<br><span class="hint">Informe quanto consegue guardar por mês para ver a data.</span>';
  }
  el.innerHTML = txt;
}

/* ---------- contas ---------- */
function contas(){
  const C = contasDo(mesSel).slice().sort((a,b)=>(a.dia||0)-(b.dia||0));
  const fix  = C.filter(x=>x.tipo==='fixa').reduce((a,b)=>a+ +b.valor,0);
  const vr   = C.filter(x=>x.tipo==='variavel').reduce((a,b)=>a+ +b.valor,0);
  const pago = C.filter(x=>x.pago).reduce((a,b)=>a+ +b.valor,0);
  const tot  = fix + vr;
  $('#contasSub').textContent = monthLabel(mesSel) + ' — ' + C.length + ' conta(s)';
  $('#cFix').textContent = money(fix); $('#cFixSub').innerHTML = '<span class="hours">'+fmtH(emHoras(fix))+'</span>';
  $('#cVar').textContent = money(vr);  $('#cVarSub').innerHTML = '<span class="hours">'+fmtH(emHoras(vr))+'</span>';
  $('#cTot').textContent = money(tot);
  $('#cTotSub').innerHTML = '<span class="hours">'+fmtH(emHoras(tot))+'</span> · '+
    (tot / Math.max(1, S.perfil.salario) * 100).toFixed(0) + '% do salário';
  $('#cPago').textContent = money(pago);
  $('#cPagoSub').textContent = tot ? Math.round(pago/tot*100) + '% do total' : '—';

  const el = $('#contasList');
  if(!C.length){
    el.innerHTML = '<div class="empty"><b>Nenhuma conta em '+monthLabel(mesSel)+'</b>Adicione acima ou copie as do mês anterior.</div>';
    return;
  }
  el.innerHTML = C.map(x =>
    '<div class="item"><span class="stripe '+(x.tipo==='fixa'?'fix':'var')+'"></span>'+
    '<div class="main"><div class="nm">'+esc(x.nome)+'</div><div class="meta">'+
      (x.tipo==='fixa'?'Fixa':'Variável')+' · '+esc(x.categoria||'Outros')+' · vence dia '+(x.dia||'—')+'</div></div>'+
    '<button class="pill '+(x.pago?'ok':'due')+'" data-pago="'+x.id+'">'+(x.pago?'Paga':'Pagar')+'</button>'+
    '<div class="amt num">'+money(x.valor)+'<small>'+fmtH(emHoras(x.valor))+'</small></div>'+
    '<button class="x" data-delc="'+x.id+'" aria-label="Excluir">&times;</button></div>').join('');

  $$('#contasList [data-pago]').forEach(b => b.onclick = () => {
    const c = S.contas.find(x=>x.id===b.dataset.pago); c.pago = !c.pago;
    commit(); sincronizar({ tipo:'upsert', col:'contas', dados:c });
  });
  $$('#contasList [data-delc]').forEach(b => b.onclick = () => {
    const id = b.dataset.delc;
    S.contas = S.contas.filter(x=>x.id!==id); commit();
    sincronizar({ tipo:'delete', col:'contas', id });
  });
}

/* ---------- lançamentos ---------- */
function lancamentos(){
  const L = lancDo(mesSel).slice().sort((a,b)=>b.data.localeCompare(a.data));
  const primeiro = S.lancamentos.length ? monthLabel(S.lancamentos.map(x=>monthOf(x.data)).sort()[0]) : '—';
  $('#histInfo').textContent = S.lancamentos.length + ' lançamentos guardados, de ' + primeiro + ' até hoje.';
  const el = $('#lancList');
  if(!L.length){
    el.innerHTML = '<div class="empty"><b>Nada lançado em '+monthLabel(mesSel)+'</b>Use o formulário acima para registrar o que entrou ou saiu.</div>';
    return;
  }
  el.innerHTML = L.map(x =>
    '<div class="item"><span class="stripe '+(x.tipo==='entrada'?'in':'out')+'"></span>'+
    '<div class="main"><div class="nm">'+esc(x.descricao||'(sem descrição)')+'</div>'+
    '<div class="meta">'+x.data.split('-').reverse().join('/')+' · '+esc(x.categoria||'Outros')+'</div></div>'+
    '<div class="amt num '+(x.tipo==='entrada'?'pos':'neg')+'">'+(x.tipo==='entrada'?'+':'−')+NUM.format(x.valor)+
    '<small>'+fmtH(emHoras(x.valor))+'</small></div>'+
    '<button class="x" data-dell="'+x.id+'" aria-label="Excluir">&times;</button></div>').join('');
  $$('#lancList [data-dell]').forEach(b => b.onclick = () => {
    const id = b.dataset.dell;
    S.lancamentos = S.lancamentos.filter(x=>x.id!==id); commit();
    sincronizar({ tipo:'delete', col:'lancamentos', id });
  });
}

/* ---------- gráficos ---------- */
function tipShow(e, html){ const t=$('#tip'); t.innerHTML=html; t.style.opacity='1';
  t.style.left = Math.min(window.innerWidth-200, e.clientX+12) + 'px';
  t.style.top  = Math.max(8, e.clientY-58) + 'px'; }
function tipHide(){ $('#tip').style.opacity='0'; }
function niceMax(v){ if(v<=0) return 100; const p=Math.pow(10,Math.floor(Math.log10(v))), n=v/p;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p; }
const kfmt = v => v>=1000 ? (v/1000).toFixed(v%1000?1:0).replace('.',',')+'k' : String(Math.round(v));
function barTop(x,y,w,h,r){ r = Math.min(r, w/2, h);
  return 'M'+x+','+(y+h)+' L'+x+','+(y+r)+' Q'+x+','+y+' '+(x+r)+','+y+
         ' L'+(x+w-r)+','+y+' Q'+(x+w)+','+y+' '+(x+w)+','+(y+r)+' L'+(x+w)+','+(y+h)+' Z'; }

function graficos(){
  const n = limite().mesesGrafico;
  $('#grafSub').textContent = 'Os últimos ' + n + ' meses de operação.';
  const meses = ultimosMeses(n);
  const dados = meses.map(m => ({ m, ...totaisMes(m) }));
  const W=680, ML=52, MR=16, MT=14, MB=34, iw=W-ML-MR;

  /* 1 — barras agrupadas */
  const H=260, ih=H-MT-MB;
  const max = niceMax(Math.max(1, ...dados.flatMap(d=>[d.entradas,d.saidas])));
  const band = iw/dados.length, bw = Math.min(26, (band-14)/2);
  let g='';
  for(let i=0;i<=4;i++){ const v=max*i/4, y=MT+ih-(v/max)*ih;
    g += '<line x1="'+ML+'" y1="'+y.toFixed(1)+'" x2="'+(W-MR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)"/>'+
         '<text x="'+(ML-8)+'" y="'+(y+3.5).toFixed(1)+'" text-anchor="end">'+kfmt(v)+'</text>'; }
  dados.forEach((d,i) => {
    const cx = ML + band*i + band/2, h1 = (d.entradas/max)*ih, h2 = (d.saidas/max)*ih;
    if(h1>0.5) g += '<path d="'+barTop(cx-bw-1, MT+ih-h1, bw, h1, 4)+'" fill="var(--s1)" data-tip="'+shortMonth(d.m)+'|Entradas|'+money(d.entradas)+'|'+fmtH(emHoras(d.entradas))+' de trabalho"/>';
    if(h2>0.5) g += '<path d="'+barTop(cx+1, MT+ih-h2, bw, h2, 4)+'" fill="var(--s2)" data-tip="'+shortMonth(d.m)+'|Saídas|'+money(d.saidas)+'|'+fmtH(emHoras(d.saidas))+' de trabalho"/>';
    g += '<text class="lbl" x="'+cx.toFixed(1)+'" y="'+(H-12)+'" text-anchor="middle"'+
         (d.m===mesSel?' style="fill:var(--ink);font-weight:700"':'')+'>'+shortMonth(d.m)+'</text>';
  });
  g += '<line x1="'+ML+'" y1="'+(MT+ih)+'" x2="'+(W-MR)+'" y2="'+(MT+ih)+'" stroke="var(--line-strong)"/>';
  $('#chart1').innerHTML = '<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Entradas e saídas dos últimos seis meses">'+g+'</svg>';
  $('#tbl1').innerHTML = '<table class="data"><thead><tr><th>Mês</th><th>Entrou</th><th>Saiu</th><th>Resultado</th></tr></thead><tbody>'+
    dados.map(d=>'<tr><td>'+shortMonth(d.m)+'</td><td class="num">'+money(d.entradas)+'</td><td class="num">'+
      money(d.saidas)+'</td><td class="num">'+money(d.resultado)+'</td></tr>').join('')+'</tbody></table>';

  /* 2 — saldo */
  const pts = meses.map(m => ({ m, v: saldoAte(m) }));
  const vals = pts.map(p=>p.v), lo = Math.min(0, ...vals), hi = niceMax(Math.max(1, ...vals));
  const H2=210, ih2=H2-MT-MB;
  const sx = i => ML + iw*(i/Math.max(1, pts.length-1));
  const sy = v => MT + ih2 - ((v-lo)/Math.max(1, hi-lo))*ih2;
  let g2='';
  for(let i=0;i<=4;i++){ const v=lo+(hi-lo)*i/4, y=sy(v);
    g2 += '<line x1="'+ML+'" y1="'+y.toFixed(1)+'" x2="'+(W-MR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)"/>'+
          '<text x="'+(ML-8)+'" y="'+(y+3.5).toFixed(1)+'" text-anchor="end">'+kfmt(v)+'</text>'; }
  const linha = pts.map((p,i)=>(i?'L':'M')+sx(i).toFixed(1)+','+sy(p.v).toFixed(1)).join(' ');
  g2 += '<path d="'+linha+' L'+sx(pts.length-1).toFixed(1)+','+(MT+ih2)+' L'+ML+','+(MT+ih2)+' Z" fill="var(--s3)" opacity=".12"/>';
  g2 += '<path d="'+linha+'" fill="none" stroke="var(--s3)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  pts.forEach((p,i) => {
    const last = i===pts.length-1;
    g2 += '<circle cx="'+sx(i).toFixed(1)+'" cy="'+sy(p.v).toFixed(1)+'" r="'+(last?5:3.5)+
          '" fill="var(--s3)" stroke="var(--surface)" stroke-width="2" data-tip="'+shortMonth(p.m)+'|Saldo|'+money(p.v)+'|'+fmtH(emHoras(Math.abs(p.v)))+' de trabalho"/>'+
          '<text class="lbl" x="'+sx(i).toFixed(1)+'" y="'+(H2-12)+'" text-anchor="middle">'+shortMonth(p.m)+'</text>';
  });
  const lp = pts[pts.length-1];
  g2 += '<text class="lbl" x="'+(sx(pts.length-1)-7).toFixed(1)+'" y="'+(sy(lp.v)-11).toFixed(1)+
        '" text-anchor="end" style="fill:var(--ink);font-weight:700">'+money(lp.v)+'</text>';
  $('#chart2').innerHTML = '<svg viewBox="0 0 '+W+' '+H2+'" width="'+W+'" height="'+H2+'" role="img" aria-label="Evolução do saldo">'+g2+'</svg>';

  /* 3 — categorias */
  const cats = {};
  lancDo(mesSel).filter(x=>x.tipo==='saida').forEach(x => { cats[x.categoria||'Outros'] = (cats[x.categoria||'Outros']||0) + +x.valor; });
  contasDo(mesSel).forEach(x => { cats[x.categoria||'Outros'] = (cats[x.categoria||'Outros']||0) + +x.valor; });
  const arr = Object.entries(cats).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,8);
  if(!arr.length){
    $('#chart3').innerHTML = '<div class="empty"><b>Sem saídas em '+monthLabel(mesSel)+'</b>Registre contas ou lançamentos para ver a divisão.</div>';
  } else {
    const rowH=32, LW=124, W3=680, H3=arr.length*rowH+16, mx=Math.max(...arr.map(a=>a.v)), bwMax=W3-LW-160;
    let g3='';
    arr.forEach((a,i) => {
      const y = i*rowH+8, w = Math.max(2, (a.v/mx)*bwMax);
      g3 += '<text class="lbl" x="'+(LW-10)+'" y="'+(y+15)+'" text-anchor="end">'+esc(a.k)+'</text>'+
            '<rect x="'+LW+'" y="'+y+'" width="'+w.toFixed(1)+'" height="18" rx="4" fill="var(--s1)" opacity="'+(1-i*0.085).toFixed(2)+
            '" data-tip="'+esc(a.k)+'|Saída|'+money(a.v)+'|'+fmtH(emHoras(a.v))+' de trabalho"/>'+
            '<text class="lbl" x="'+(LW+w+9).toFixed(1)+'" y="'+(y+13)+'" style="font-family:\'JetBrains Mono\',monospace">'+money(a.v)+'</text>'+
            '<text x="'+(LW+w+9).toFixed(1)+'" y="'+(y+25)+'" style="fill:var(--brass);font-weight:700">'+fmtH(emHoras(a.v))+'</text>';
    });
    $('#chart3').innerHTML = '<svg viewBox="0 0 '+W3+' '+H3+'" width="'+W3+'" height="'+H3+'" role="img" aria-label="Saídas por categoria">'+g3+'</svg>';
  }

  $$('[data-tip]').forEach(el => {
    const p = el.dataset.tip.split('|');
    const html = '<div style="opacity:.7;font-size:11px">'+p[0]+'</div><div>'+p[1]+' <b>'+p[2]+'</b></div>'+
                 '<div style="opacity:.75;font-size:11.5px">'+p[3]+'</div>';
    el.style.cursor='pointer';
    el.addEventListener('mousemove', e => tipShow(e, html));
    el.addEventListener('mouseleave', tipHide);
    el.addEventListener('touchstart', e => tipShow(e.touches[0], html), { passive:true });
    el.addEventListener('touchend', () => setTimeout(tipHide, 1800));
  });
}

/* ---------- preços ---------- */
function simular(){
  const v = +$('#fSim').value || 0, c = calc();
  $('#simOut').innerHTML = '<span class="hours">'+fmtH(emHoras(v))+'</span> de trabalho &nbsp;·&nbsp; '+
    (v/Math.max(0.01, c.dia)).toFixed(1).replace('.',',') + ' dias úteis';
}
function precos(){
  simular();
  const el = $('#itensList');
  if(!S.itens.length){
    el.innerHTML = '<div class="empty"><b>Nenhum item acompanhado</b>Busque um preço acima ou adicione um item manualmente.</div>';
    return;
  }
  el.innerHTML = S.itens.map(x =>
    '<div class="item"><span class="stripe"></span><div class="main"><div class="nm">'+esc(x.nome)+'</div>'+
    '<div class="meta">'+money(x.preco)+' · '+esc(x.fonte||'manual')+'</div></div>'+
    '<input class="num" data-item="'+x.id+'" type="number" step="0.01" style="max-width:120px" value="'+x.preco+'">'+
    '<div class="amt"><span class="hours">'+fmtH(emHoras(x.preco))+'</span>'+
    '<small>'+(x.preco/Math.max(0.01, calc().dia)).toFixed(1).replace('.',',')+' dias</small></div>'+
    '<button class="x" data-deli="'+x.id+'" aria-label="Excluir">&times;</button></div>').join('');

  $$('#itensList input[data-item]').forEach(inp => inp.onchange = () => {
    const it = S.itens.find(x=>x.id===inp.dataset.item);
    it.preco = +inp.value||0; it.fonte='manual'; commit();
    sincronizar({ tipo:'upsert', col:'itens', dados:it });
  });
  $$('#itensList [data-deli]').forEach(b => b.onclick = () => {
    const id = b.dataset.deli;
    S.itens = S.itens.filter(x=>x.id!==id); commit();
    sincronizar({ tipo:'delete', col:'itens', id });
  });
}
async function buscarPreco(termo){
  const out = $('#buscaOut');
  out.innerHTML = '<p class="hint">Procurando "'+esc(termo)+'"…</p>';
  try{
    const r = await fetch('/api/precos?q=' + encodeURIComponent(termo));
    const j = await r.json();
    $('#fonteSub').textContent = j.fonte === 'api'
      ? 'Busca ao vivo ligada.'
      : 'Sem chave de API configurada — mostrando preços de referência do catálogo.';
    if(!j.resultados || !j.resultados.length){
      out.innerHTML = '<div class="empty"><b>Nada encontrado para "'+esc(termo)+'"</b>Adicione o item manualmente abaixo com o preço que você viu.</div>';
      return;
    }
    out.innerHTML = j.resultados.map((x,i) =>
      '<div class="res"><div><div class="nm">'+esc(x.nome)+'</div>'+
      '<div class="src">'+esc(x.fonte||'referência')+(x.loja?' · '+esc(x.loja):'')+'</div></div>'+
      '<div class="pr"><b>'+money(x.preco)+'</b><small>'+fmtH(emHoras(x.preco))+' de trabalho</small></div>'+
      '<button class="btn ghost sm" data-add="'+i+'">Acompanhar</button></div>').join('');
    $$('#buscaOut [data-add]').forEach(b => b.onclick = () => {
      const x = j.resultados[+b.dataset.add];
      const it = { id:uid(), nome:x.nome, preco:+x.preco, fonte:x.fonte||'referência', url:x.url||null };
      S.itens.push(it); commit();
      sincronizar({ tipo:'upsert', col:'itens', dados:it });
      toast('Item adicionado à sua lista', 'good');
    });
  } catch(e){
    out.innerHTML = '<p class="err">Não consegui buscar agora. Verifique a conexão e tente de novo.</p>';
  }
}

/* ---------- recibos ---------- */
const UNI=['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const DEZ=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const CEN=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
function ext3(n){ if(!n) return ''; if(n===100) return 'cem';
  const c=Math.floor(n/100), r=n%100, p=[];
  if(c) p.push(CEN[c]);
  if(r){ if(r<20) p.push(UNI[r]); else { const d=Math.floor(r/10), u=r%10; p.push(DEZ[d]+(u?' e '+UNI[u]:'')); } }
  return p.join(' e '); }
function extenso(v){
  v = Math.round((+v||0)*100)/100;
  const i = Math.floor(v), cent = Math.round((v-i)*100);
  const mi=Math.floor(i/1e6), mil=Math.floor((i%1e6)/1000), un=i%1000, p=[];
  if(mi)  p.push(ext3(mi)+(mi===1?' milhão':' milhões'));
  if(mil) p.push(mil===1?'mil':ext3(mil)+' mil');
  if(un)  p.push(ext3(un));
  let out = i ? p.join(' e ')+' '+(i===1?'real':'reais') : '';
  if(cent) out = (out?out+' e ':'') + ext3(cent)+' '+(cent===1?'centavo':'centavos');
  if(!out) out = 'zero real';
  return out.charAt(0).toUpperCase()+out.slice(1);
}
function dadosRecibo(){
  return {
    numero: String(S.recibos.length+1).padStart(4,'0'),
    pagador: $('#rPag').value.trim() || '—',
    valor: +$('#rVal').value || 0,
    data: $('#rData').value || todayISO(),
    referente: $('#rRef').value.trim() || '—',
    cidade: $('#rCid').value.trim() || '—',
    emissor: $('#rEmi').value.trim() || '—',
    documento: $('#rDoc').value.trim()
  };
}
function recibo(){
  const r = dadosRecibo(), d = r.data.split('-');
  $('#rNum').textContent = 'Nº ' + r.numero;
  $('#rValBox').textContent = money(r.valor);
  $('#rBody').innerHTML = 'Recebi de <b>'+esc(r.pagador)+'</b> a importância de <b>'+money(r.valor)+
    '</b>, referente a <b>'+esc(r.referente)+'</b>, dando plena e geral quitação pelo valor recebido.';
  $('#rExt').textContent = '( ' + extenso(r.valor) + ' )';
  $('#rLocal').textContent = r.cidade + ', ' + d[2] + ' de ' + MESES[+d[1]-1] + ' de ' + d[0] + '.';
  $('#rSig').innerHTML = esc(r.emissor) + (r.documento ? '<br><span class="hint">'+esc(r.documento)+'</span>' : '');

  const el = $('#recList');
  if(!S.recibos.length){ el.innerHTML = '<div class="empty"><b>Nenhum recibo salvo</b>Preencha acima e clique em "Salvar no histórico".</div>'; return; }
  el.innerHTML = S.recibos.slice().reverse().map(x =>
    '<div class="item"><span class="stripe fix"></span><div class="main">'+
    '<div class="nm">Nº '+esc(x.numero)+' — '+esc(x.pagador)+'</div>'+
    '<div class="meta">'+String(x.data).split('-').reverse().join('/')+' · '+esc(x.referente)+'</div></div>'+
    '<div class="amt num">'+money(x.valor)+'</div>'+
    '<button class="x" data-delr="'+x.id+'" aria-label="Excluir">&times;</button></div>').join('');
  $$('#recList [data-delr]').forEach(b => b.onclick = () => {
    const id = b.dataset.delr;
    S.recibos = S.recibos.filter(x=>x.id!==id); commit();
    sincronizar({ tipo:'delete', col:'recibos', id });
  });
}
function gerarPDF(){
  const r = dadosRecibo();
  const JS = window.jspdf && window.jspdf.jsPDF;
  if(!JS){ toast('Gerador de PDF não carregou. Recarregue a página.', 'bad'); return null; }
  const doc = new JS({ unit:'mm', format:'a4' });
  const L=22, R=188;
  doc.setDrawColor(20,33,47);
  doc.setFont('times','normal'); doc.setFontSize(26); doc.text('RECIBO', L, 34);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120); doc.text('Nº '+r.numero, L, 40);
  doc.setTextColor(20,33,47);
  doc.setLineWidth(0.6); doc.rect(R-46, 24, 46, 13);
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(money(r.valor), R-23, 32.5, { align:'center' });
  doc.setLineWidth(0.8); doc.line(L, 45, R, 45);
  doc.setFont('helvetica','normal'); doc.setFontSize(11.5);
  const corpo = 'Recebi de '+r.pagador+' a importância de '+money(r.valor)+' ('+extenso(r.valor)+
    '), referente a '+r.referente+', dando plena e geral quitação pelo valor recebido.';
  doc.text(doc.splitTextToSize(corpo, R-L), L, 58, { lineHeightFactor:1.7 });
  const d = r.data.split('-');
  doc.text(r.cidade+', '+d[2]+' de '+MESES[+d[1]-1]+' de '+d[0]+'.', L, 100);
  doc.setLineWidth(0.4); doc.line(65, 128, 145, 128);
  doc.setFontSize(10.5); doc.text(r.emissor, 105, 133, { align:'center' });
  if(r.documento){ doc.setFontSize(9); doc.setTextColor(120); doc.text(r.documento, 105, 138, { align:'center' }); }
  doc.setFontSize(8); doc.setTextColor(150); doc.text('Emitido no CLT Code', L, 285);
  return doc;
}

/* ---------- minha conta ---------- */
function perfilView(){
  $('#pNome').value = S.perfil.nome || '';
  $('#pCid').value  = S.perfil.cidade || '';
  $('#pDoc').value  = S.perfil.documento || '';
  $('#contaSub').textContent = sessao
    ? 'Conectado como ' + sessao.user.email
    : 'Você está sem conta — os dados ficam só neste aparelho.';
  $('#whoBadge').textContent = sessao ? sessao.user.email : 'modo local';
  $('#btnSair').textContent = sessao ? 'Sair da conta' : 'Entrar / criar conta';
  const dono = !!(sessao && S.perfil.admin);
  $('#navAdmin').hidden = !dono;
  $('#sheetAdmin').hidden = !dono;
}

/* ============================================================
   NAVEGAÇÃO E EVENTOS
   ============================================================ */
function irPara(v){
  const sh = $('#sheetMais'); if(sh) sh.hidden = true;
  $$('.view').forEach(x => x.hidden = x.id !== 'v'+'-'+v);
  $$('.nv,.tb').forEach(b => b.setAttribute('aria-selected', b.dataset.view===v ? 'true':'false'));
  $('#main').scrollTo?.({ top:0 });
  window.scrollTo({ top:0 });
}
$$('.nv,.tb').forEach(b => b.onclick = () => irPara(b.dataset.view));

function alternarTema(){
  const cur = document.documentElement.getAttribute('data-theme');
  const escuro = cur ? cur==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const novo = escuro ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', novo);
  try { localStorage.setItem('cltcode.theme', novo); } catch(e){}
}
$('#btnTema').onclick = alternarTema;
$('#btnTemaM').onclick = alternarTema;
$('#btnContaM').onclick = () => irPara('conta');

$('#mPrev').onclick = () => { mesSel = addMonth(mesSel,-1); desenharTudo(); };
$('#mNext').onclick = () => { mesSel = addMonth(mesSel, 1); desenharTudo(); };

/* perfil / salário */
function salvarPerfil(){
  S.perfil.salario       = +$('#fSal').value || 0;
  S.perfil.jornada       = +$('#fJor').value || 44;
  S.perfil.dias_uteis      = +$('#fDias').value || 22;
  S.perfil.dias_trabalhados = +$('#fDias').value || 22;
  S.perfil.horas_dia       = +$('#fHorasDia').value || S.perfil.horas_dia;
  S.perfil.saldo_inicial = +$('#fSaldo').value || 0;
  S.demo = false; commit();
  sincronizar({ tipo:'perfil', dados:{
    salario:S.perfil.salario, jornada:S.perfil.jornada,
    dias_uteis:S.perfil.dias_uteis, dias_trabalhados:S.perfil.dias_trabalhados,
    horas_dia:S.perfil.horas_dia, saldo_inicial:S.perfil.saldo_inicial } });
}
['fSal','fJor','fDias','fSaldo'].forEach(id => $('#'+id).addEventListener('change', salvarPerfil));
['fSal','fJor','fDias','fSaldo'].forEach(id => $('#'+id).addEventListener('input', () => {
  S.perfil.salario = +$('#fSal').value||0; S.perfil.jornada = +$('#fJor').value||44;
  S.perfil.dias_uteis = +$('#fDias').value||22; S.perfil.saldo_inicial = +$('#fSaldo').value||0;
  painel(); graficos(); precos();
}));
$('#btnMinimo').onclick = () => { $('#fSal').value = SAL_MIN_2026; salvarPerfil(); };

$('#btnSalvarPerfil').onclick = () => {
  S.perfil.nome = $('#pNome').value.trim();
  S.perfil.cidade = $('#pCid').value.trim();
  S.perfil.documento = $('#pDoc').value.trim();
  commit();
  sincronizar({ tipo:'perfil', dados:{ nome:S.perfil.nome, cidade:S.perfil.cidade, documento:S.perfil.documento } });
  toast('Dados salvos', 'good');
};
$('#btnExportar').onclick = () => {
  if(!limite().exportar){ return toast('Exportar os dados é do plano pago', 'bad'); }
  const blob = new Blob([JSON.stringify(S, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clt-code-' + todayISO() + '.json';
  a.click(); URL.revokeObjectURL(a.href);
};
async function sairDaConta(){
  if(!sessao){ $('#app').hidden = true; $('#auth').hidden = false; return; }
  toast('Saindo…');
  try { await sb.auth.signOut(); } catch(e){}
  /* limpa qualquer resto de sessão guardado no aparelho */
  try {
    Object.keys(localStorage).forEach(k => { if(k.startsWith('sb-')) localStorage.removeItem(k); });
    localStorage.removeItem('cltcode.local');
  } catch(e){}
  sessao = null;
  /* recarrega sem cache para o app voltar à tela de entrada */
  location.replace(location.origin + '/?saiu=' + Date.now());
}
$('#btnSair').onclick = sairDaConta;
$('#sheetSair').onclick = () => { abrirSheet(false); sairDaConta(); };
$('#btnVirarConta').onclick = () => { $('#app').hidden = true; $('#auth').hidden = false; modoAuth('criar'); };

/* demo */
$('#btnLimparDemo').onclick = () => {
  S = vazio(); commit(); toast('Exemplos removidos');
};

/* painel */
$('#btnHoje').onclick = () => {
  const l = { id:uid(), data:todayISO(), descricao:'Ganho do dia',
    valor: Math.round(calc().dia*100)/100, tipo:'entrada', categoria:'Salário' };
  S.lancamentos.push(l); S.demo=false; mesSel = todayISO().slice(0,7); commit();
  sincronizar({ tipo:'upsert', col:'lancamentos', dados:l });
  toast('+' + money(l.valor) + ' registrado', 'good');
};
['gNome','gVal','gMes'].forEach(id => $('#'+id).addEventListener('input', () => {
  S.meta = { nome:$('#gNome').value, valor:+$('#gVal').value||0, mensal:+$('#gMes').value||0 };
  salvarLocal(); meta();
}));

/* contas */
$('#btnAddConta').onclick = () => {
  const nome = $('#cNome').value.trim(), valor = +$('#cVal').value||0;
  if(!nome || !valor) return toast('Escreva o nome da conta e um valor', 'bad');
  const c = { id:uid(), mes:mesSel, nome, valor, tipo:$('#cTipo').value,
    categoria:$('#cCat').value, dia:+$('#cDia').value||1, pago:false };
  S.contas.push(c); $('#cNome').value=''; $('#cVal').value=''; S.demo=false; commit();
  sincronizar({ tipo:'upsert', col:'contas', dados:c });
  toast('Conta adicionada');
};
$('#btnCopiar').onclick = () => {
  const prev = addMonth(mesSel,-1), src = contasDo(prev);
  if(!src.length) return toast('Não há contas em ' + monthLabel(prev), 'bad');
  src.forEach(x => {
    const c = { ...x, id:uid(), mes:mesSel, pago:false };
    S.contas.push(c); sincronizar({ tipo:'upsert', col:'contas', dados:c });
  });
  S.demo=false; commit(); toast(src.length + ' conta(s) copiadas');
};

/* lançamentos */
$('#btnAddLanc').onclick = () => {
  const valor = +$('#lVal').value||0;
  if(!valor) return toast('Informe um valor maior que zero', 'bad');
  const tipo = $('#lTipo').value, data = $('#lData').value || todayISO();
  const l = { id:uid(), data, descricao:$('#lDesc').value.trim() || (tipo==='entrada'?'Entrada':'Saída'),
    valor, tipo, categoria:$('#lCat').value };
  S.lancamentos.push(l); $('#lDesc').value=''; $('#lVal').value='';
  S.demo=false; mesSel = monthOf(data); commit();
  sincronizar({ tipo:'upsert', col:'lancamentos', dados:l });
  toast((tipo==='entrada'?'+':'−') + money(valor) + ' lançado');
};

/* preços */
$('#fSim').addEventListener('input', simular);
$('#formBusca').addEventListener('submit', e => {
  e.preventDefault();
  if(!limite().buscaPreco) return toast('Busca de preço é do plano pago', 'bad');
  const q = $('#qBusca').value.trim();
  if(q) buscarPreco(q);
});
$('#btnAddItem').onclick = () => {
  const nome = $('#iNome').value.trim(), preco = +$('#iPreco').value||0;
  if(!nome) return toast('Escreva o nome do item', 'bad');
  const it = { id:uid(), nome, preco, fonte:'manual' };
  S.itens.push(it); $('#iNome').value=''; $('#iPreco').value=''; commit();
  sincronizar({ tipo:'upsert', col:'itens', dados:it });
};

/* recibos */
['rPag','rVal','rData','rRef','rCid','rEmi','rDoc'].forEach(id => $('#'+id).addEventListener('input', recibo));
$('#btnSalvarRec').onclick = () => {
  const r = dadosRecibo();
  if(!r.valor) return toast('Informe o valor do recibo', 'bad');
  if(recibosDoMes() >= limite().recibosMes){
    irPara('conta');
    return toast('O Free emite ' + LIMITES.free.recibosMes + ' recibos por mês', 'bad');
  }
  const row = { id:uid(), ...r };
  S.recibos.push(row);
  S.perfil.nome = r.emissor !== '—' ? r.emissor : S.perfil.nome;
  S.perfil.cidade = r.cidade !== '—' ? r.cidade : S.perfil.cidade;
  S.perfil.documento = r.documento || S.perfil.documento;
  S.demo=false; commit();
  sincronizar({ tipo:'upsert', col:'recibos', dados:row });
  sincronizar({ tipo:'perfil', dados:{ nome:S.perfil.nome, cidade:S.perfil.cidade, documento:S.perfil.documento } });
  toast('Recibo nº ' + r.numero + ' salvo', 'good');
};
$('#btnPdf').onclick = () => {
  const doc = gerarPDF(); if(!doc) return;
  const r = dadosRecibo();
  doc.save('recibo-' + r.numero + '-' + r.data + '.pdf');
  $('#pdfMsg').textContent = 'PDF gerado. Confira na pasta de downloads.';
};

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */
let modo = 'entrar';
function modoAuth(m){
  modo = m;
  $('#segEntrar').setAttribute('aria-selected', m==='entrar');
  $('#segCriar').setAttribute('aria-selected', m==='criar');
  $('#authTitle').textContent = m==='entrar' ? 'Entrar na sua conta' : 'Criar sua conta';
  $('#authHint').textContent  = m==='entrar'
    ? 'Seus dados ficam salvos na nuvem e aparecem em qualquer aparelho.'
    : 'Leva 10 segundos. Só e-mail e senha — nada de cartão.';
  $('#authGo').textContent = m==='entrar' ? 'Entrar' : 'Criar conta';
  $('#wrapNome').hidden = m==='entrar';
  $('#aSenha').autocomplete = m==='entrar' ? 'current-password' : 'new-password';
  $('#authErr').hidden = true; $('#authOk').hidden = true;
  $('#authConfirma').hidden = true;
}
$('#segEntrar').onclick = () => modoAuth('entrar');
$('#segCriar').onclick  = () => modoAuth('criar');

function authErro(msg){ const e=$('#authErr'); e.textContent=msg; e.hidden=false; $('#authOk').hidden=true; }
function authOk(msg){ const e=$('#authOk'); e.textContent=msg; e.hidden=false; $('#authErr').hidden=true; }
function traduzErro(m){
  m = String(m||'');
  if(/Email not confirmed/i.test(m))  return 'Falta confirmar seu e-mail. Clique no link que enviamos e tente de novo.';
  if(/Invalid login/i.test(m))        return 'E-mail ou senha incorretos. Se acabou de se cadastrar, confirme o e-mail primeiro.';
  if(/already registered/i.test(m))   return 'Esse e-mail já tem conta. Use "Entrar".';
  if(/Password should be/i.test(m))   return 'A senha precisa ter pelo menos 6 caracteres.';
  if(/valid email/i.test(m))          return 'Digite um e-mail válido.';
  if(/rate limit|too many/i.test(m))  return 'Muitas tentativas. Espere um minuto e tente de novo.';
  return 'Não deu certo: ' + m;
}
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#aEmail').value.trim(), senha = $('#aSenha').value;
  if(!email || senha.length < 6) return authErro('Preencha o e-mail e uma senha de 6 caracteres ou mais.');
  const btn = $('#authGo'); btn.disabled = true; btn.textContent = 'Aguarde…';
  try{
    if(modo === 'criar'){
      const { data, error } = await sb.auth.signUp({
        email, password: senha, options:{ data:{ nome: $('#aNome').value.trim() } }
      });
      if(error) throw error;
      if(!data.session){ pedirConfirmacao(email); return; }
      await abrirApp(data.session);
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
      if(error) throw error;
      await abrirApp(data.session);
    }
  } catch(err){
    authErro(traduzErro(err.message));
    if(/Email not confirmed/i.test(err.message||'')) pedirConfirmacao(email);
  }
  finally{ btn.disabled = false; btn.textContent = modo==='entrar' ? 'Entrar' : 'Criar conta'; }
});
$('#btnReset').onclick = async () => {
  const email = $('#aEmail').value.trim();
  if(!email) return authErro('Escreva seu e-mail no campo acima e clique de novo.');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  if(error) authErro(traduzErro(error.message));
  else authOk('Enviamos um link de redefinição para ' + email + '.');
};
$('#btnGuest').onclick = () => { sessao = null; abrirApp(null); };

function pedirConfirmacao(email){
  emailPendente = email;
  $('#confirmaEmail').textContent = email;
  $('#authConfirma').hidden = false;
  $('#authErr').hidden = true;
  $('#authOk').hidden = true;
  modoAuth('entrar');
  $('#authConfirma').hidden = false;
}
let emailPendente = '';
$('#btnReenviar').onclick = async () => {
  const alvo = emailPendente || $('#aEmail').value.trim();
  if(!alvo) return authErro('Escreva seu e-mail no campo acima.');
  const b = $('#btnReenviar'); b.disabled = true; b.textContent = 'Enviando…';
  try{
    const { error } = await sb.auth.resend({ type:'signup', email: alvo });
    if(error) throw error;
    authOk('Mandamos de novo para ' + alvo + '. Olhe também no spam.');
  } catch(e){
    authErro(traduzErro(e.message));
  } finally { b.disabled = false; b.textContent = 'Reenviar e-mail'; }
};
/* mostrar / ocultar senha */
$('#verSenha').onclick = () => {
  const i = $('#aSenha'), b = $('#verSenha');
  const mostrando = i.type === 'text';
  i.type = mostrando ? 'password' : 'text';
  b.setAttribute('aria-pressed', String(!mostrando));
  b.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  b.querySelector('.ic-eye').hidden = !mostrando;
  b.querySelector('.ic-eye-off').hidden = mostrando;
  i.focus();
};

async function abrirApp(s){
  sessao = s || null;
  if(sessao){
    await puxarDaNuvem(); esvaziarFila();
    try { await sb.from('perfis').update({ ultimo_acesso: new Date().toISOString() }).eq('id', sessao.user.id); } catch(e){}
    if(S.perfil.admin){ carregarAdmin(); }
  }
  $('#auth').hidden = true;
  $('#boot').hidden = true;
  $('#app').hidden = false;
  desenharTudo();
}

/* ============================================================
   PWA
   ============================================================ */
let promptInstalar = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); promptInstalar = e; $('#btnInstalar').hidden = false;
});
$('#btnInstalar').onclick = async () => {
  if(!promptInstalar) return;
  promptInstalar.prompt();
  await promptInstalar.userChoice;
  promptInstalar = null; $('#btnInstalar').hidden = true;
};
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
window.addEventListener('online',  () => { esvaziarFila(); toast('De volta à internet'); });
window.addEventListener('offline', () => { marcarSync(); toast('Sem internet — salvando neste aparelho'); });


/* ============================================================
   DÍVIDAS — sair do vermelho
   ============================================================ */
const saldoDivida = d => Math.max(0, (+d.total||0) - (+d.pago||0));

function renderDividas(){
  const D = S.dividas.slice().sort((a,b) => {
    if(a.quitada !== b.quitada) return a.quitada ? 1 : -1;
    return saldoDivida(a) - saldoDivida(b);          // menor saldo primeiro (bola de neve)
  });
  const abertas   = D.filter(d => !d.quitada);
  const falta     = abertas.reduce((a,d) => a + saldoDivida(d), 0);
  const jaPago    = D.reduce((a,d) => a + (+d.pago||0), 0);
  const totalGeral= D.reduce((a,d) => a + (+d.total||0), 0);
  const parcelas  = abertas.filter(d => d.contar).reduce((a,d) => a + Math.min(+d.parcela||0, saldoDivida(d)), 0);
  const ritmo     = abertas.reduce((a,d) => a + (+d.parcela||0), 0);

  $('#dSaldo').textContent = money(falta);
  $('#dSaldoSub').innerHTML = falta
    ? '<span class="hours">' + fmtH(emHoras(falta)) + ' de trabalho</span>'
    : 'Você não deve nada. ';
  $('#dPago').textContent = money(jaPago);
  $('#dPagoSub').textContent = totalGeral ? Math.round(jaPago/totalGeral*100) + '% do total de ' + money(totalGeral) : '—';
  $('#dParc').textContent = money(parcelas);
  $('#dParcSub').textContent = abertas.filter(d=>d.contar).length + ' de ' + abertas.length + ' dívida(s) marcadas';

  if(falta > 0 && ritmo > 0){
    const meses = Math.ceil(falta / ritmo);
    $('#dPrev').textContent = meses + (meses === 1 ? ' mês' : ' meses');
    $('#dPrevSub').textContent = 'por volta de ' + monthLabel(addMonth(todayISO().slice(0,7), meses));
  } else {
    $('#dPrev').textContent = falta ? '—' : 'Livre';
    $('#dPrevSub').textContent = falta ? 'informe as parcelas' : 'nenhuma dívida em aberto';
  }

  const el = $('#dividasList');
  if(!D.length){
    el.innerHTML = '<div class="empty"><b>Nenhuma dívida cadastrada</b>Se você não deve nada, ótimo. Se deve, cadastre acima para organizar a saída.</div>';
  } else {
    el.innerHTML = D.map(d => {
      const sal = saldoDivida(d), tot = +d.total||0;
      const pct = tot ? Math.min(100, Math.round((+d.pago||0)/tot*100)) : 0;
      return '<div class="dv' + (d.quitada ? ' quitada' : '') + '">' +
        '<div class="dv-top"><div class="main"><div class="nm">' + esc(d.nome) +
          (d.quitada ? ' <span class="pill ok">Quitada</span>' : '') + '</div>' +
          '<div class="meta">' + (d.credor ? esc(d.credor) + ' · ' : '') +
          'parcela ' + money(d.parcela) + ' · vence dia ' + d.dia + '</div></div>' +
        '<div class="dv-val"><b>' + money(sal) + '</b><small>' + fmtH(emHoras(sal)) + ' de trabalho</small></div></div>' +
        '<div class="prog"><span style="width:' + pct + '%"></span></div>' +
        '<div class="dv-foot">' +
          '<label class="sw"><input type="checkbox" data-contar="' + d.id + '"' + (d.contar ? ' checked' : '') +
            (d.quitada ? ' disabled' : '') + '><i></i>Contar no total do mês</label>' +
          '<span class="grow"></span>' +
          '<span>' + pct + '% pago de ' + money(tot) + '</span>' +
        '</div>' +
        (d.quitada ? '' :
        '<div class="dv-foot">' +
          '<button class="btn ghost sm" data-parcela="' + d.id + '">Paguei a parcela</button>' +
          '<input class="num" type="number" step="0.01" min="0" placeholder="outro valor" style="max-width:130px" data-valor="' + d.id + '">' +
          '<button class="btn ghost sm" data-abater="' + d.id + '">Abater</button>' +
          '<span class="grow"></span>' +
          '<button class="x" data-deld="' + d.id + '" aria-label="Excluir">&times;</button>' +
        '</div>') +
      '</div>';
    }).join('');
  }

  /* plano de saída */
  const plano = $('#dividaPlano');
  if(!abertas.length){
    plano.innerHTML = '<div class="plano-txt">Nenhuma dívida em aberto — nada a planejar por aqui. <b>Continue assim.</b></div>';
  } else {
    const ordem = abertas.slice().sort((a,b) => saldoDivida(a) - saldoDivida(b));
    plano.innerHTML = '<div class="plano-txt"><b>Ordem sugerida (bola de neve):</b> quite primeiro a menor dívida. ' +
      'Ela sai rápido, a parcela dela sobra e você joga esse valor na próxima — é o que mantém o ânimo.' +
      '<ol>' + ordem.map(d => '<li>' + esc(d.nome) + ' — falta <b>' + money(saldoDivida(d)) + '</b>' +
        (d.parcela ? ' · ' + Math.ceil(saldoDivida(d)/Math.max(1,+d.parcela)) + ' parcela(s)' : '') + '</li>').join('') +
      '</ol></div>';
  }

  /* ações */
  $$('#dividasList [data-contar]').forEach(cb => cb.onchange = () => {
    const d = S.dividas.find(x => x.id === cb.dataset.contar);
    d.contar = cb.checked; commit();
    sincronizar({ tipo:'upsert', col:'dividas', dados:d });
  });
  $$('#dividasList [data-parcela]').forEach(b => b.onclick = () => {
    const d = S.dividas.find(x => x.id === b.dataset.parcela);
    abaterDivida(d, Math.min(+d.parcela||0, saldoDivida(d)));
  });
  $$('#dividasList [data-abater]').forEach(b => b.onclick = () => {
    const id = b.dataset.abater;
    const inp = $('#dividasList [data-valor="' + id + '"]');
    const v = +inp.value || 0;
    if(!v) return toast('Escreva quanto você pagou', 'bad');
    abaterDivida(S.dividas.find(x => x.id === id), v);
  });
  $$('#dividasList [data-deld]').forEach(b => b.onclick = () => {
    const id = b.dataset.deld;
    S.dividas = S.dividas.filter(x => x.id !== id); commit();
    sincronizar({ tipo:'delete', col:'dividas', id });
  });
}

function abaterDivida(d, valor){
  if(!d || !valor) return;
  const v = Math.min(valor, saldoDivida(d));
  if(v <= 0) return toast('Essa dívida já está quitada', 'bad');
  d.pago = Math.round(((+d.pago||0) + v) * 100) / 100;
  if(saldoDivida(d) <= 0.009){ d.quitada = true; d.contar = false; }

  const l = { id:uid(), data:todayISO(), descricao:'Pagamento — ' + d.nome,
              valor:v, tipo:'saida', categoria:'Dívidas' };
  S.lancamentos.push(l);
  S.demo = false; commit();
  sincronizar({ tipo:'upsert', col:'dividas', dados:d });
  sincronizar({ tipo:'upsert', col:'lancamentos', dados:l });
  toast(d.quitada ? d.nome + ' quitada! ' : '−' + money(v) + ' abatido', 'good');
}

$('#btnAddDivida').onclick = () => {
  const nome = $('#dNome').value.trim(), total = +$('#dTotal').value || 0;
  if(!nome || !total) return toast('Escreva o nome da dívida e o total devido', 'bad');
  if(S.dividas.length >= limite().dividas){
    irPara('conta');
    return toast('O Free guarda até ' + LIMITES.free.dividas + ' dívidas', 'bad');
  }
  const d = { id:uid(), nome, credor:$('#dCredor').value.trim(), total,
    pago: Math.min(+$('#dJaPago').value || 0, total),
    parcela:+$('#dParcela').value || 0, dia:+$('#dDia').value || 10,
    juros:0, contar:true, quitada:false };
  d.quitada = saldoDivida(d) <= 0.009;
  S.dividas.push(d);
  ['dNome','dCredor','dTotal','dParcela'].forEach(id => $('#' + id).value = '');
  $('#dJaPago').value = 0;
  S.demo = false; commit();
  sincronizar({ tipo:'upsert', col:'dividas', dados:d });
  toast('Dívida cadastrada');
};

/* ============================================================
   ESCALA DE TRABALHO
   ============================================================ */
function aplicarEscala(chave){
  const e = ESCALAS[chave]; if(!e) return;
  S.perfil.escala = chave;
  if(chave !== 'livre'){
    S.perfil.dias_trabalhados = e.diasMes;
    S.perfil.horas_dia = e.horasDia;
    S.perfil.jornada = e.jornada;
    S.perfil.dias_uteis = e.diasMes;
  }
  commit();
  sincronizar({ tipo:'perfil', dados:{ escala:S.perfil.escala, horas_dia:S.perfil.horas_dia,
    dias_trabalhados:S.perfil.dias_trabalhados, jornada:S.perfil.jornada, dias_uteis:S.perfil.dias_uteis } });
}
$('#fEscala').innerHTML = Object.entries(ESCALAS)
  .map(([k, e]) => '<option value="' + k + '">' + e.nome + '</option>').join('');
$('#fEscala').addEventListener('change', () => aplicarEscala($('#fEscala').value));
$('#fHorasDia').addEventListener('change', () => {
  S.perfil.horas_dia = +$('#fHorasDia').value || 8;
  S.perfil.escala = 'livre'; commit();
  sincronizar({ tipo:'perfil', dados:{ horas_dia:S.perfil.horas_dia, escala:'livre' } });
});

/* ============================================================
   FOLHA "MAIS" (celular)
   ============================================================ */
function abrirSheet(v){ $('#sheetMais').hidden = !v; }
$('#btnMais').onclick = () => abrirSheet(true);
$('#sheetBg').onclick = () => abrirSheet(false);
$('#sheetFechar').onclick = () => abrirSheet(false);
$$('.sheet-item[data-view]').forEach(b => b.onclick = () => { abrirSheet(false); irPara(b.dataset.view); });


/* ============================================================
   ADMINISTRAÇÃO — só para o dono do produto
   ============================================================ */
let PESSOAS = [], ASSINATURAS = [];

async function carregarAdmin(){
  if(!sessao || !S.perfil.admin) return;
  try{
    const [p, a] = await Promise.all([
      sb.from('perfis').select('*').order('criado_em', { ascending:false }),
      sb.from('assinaturas').select('*').order('criado_em', { ascending:false })
    ]);
    PESSOAS = p.data || [];
    ASSINATURAS = a.data || [];
    renderAdmin();
  } catch(e){ toast('Não consegui carregar a lista agora', 'bad'); }
}

function assinaturaAtiva(a){
  if(a.status !== 'ativa') return false;
  return !a.fim || a.fim >= todayISO();
}
function planoVigente(p){
  if(p.plano !== 'pro') return false;
  return !p.plano_expira || String(p.plano_expira).slice(0,10) >= todayISO();
}

function renderAdmin(){
  const trinta = new Date(Date.now() - 30*864e5).toISOString();
  const ativos = PESSOAS.filter(p => p.ultimo_acesso && p.ultimo_acesso >= trinta).length;
  const pros   = PESSOAS.filter(planoVigente).length;
  const mrr    = ASSINATURAS.filter(assinaturaAtiva).reduce((a,b) => a + (+b.valor||0), 0);

  $('#adminSub').textContent = PESSOAS.length + ' pessoa(s) · ' + ASSINATURAS.length + ' pagamento(s) registrado(s)';
  $('#aTotal').textContent = PESSOAS.length;
  $('#aTotalSub').textContent = PESSOAS.length
    ? 'primeira em ' + String(PESSOAS[PESSOAS.length-1].criado_em).slice(0,10).split('-').reverse().join('/')
    : '—';
  $('#aAtivos').textContent = ativos;
  $('#aPro').textContent = pros;
  $('#aProSub').textContent = PESSOAS.length ? Math.round(pros/PESSOAS.length*100) + '% da base' : '—';
  $('#aMRR').textContent = money(mrr);

  $('#adminList').innerHTML = PESSOAS.length ? PESSOAS.map(p =>
    '<div class="pessoa"><div class="main"><div class="nm">' + esc(p.nome || '(sem nome)') +
      (p.admin ? ' <span class="tagdono">dono</span>' : '') +
      (planoVigente(p) ? ' <span class="tagpro">Pro</span>' : '') + '</div>' +
      '<div class="meta">' + esc(p.email || '—') + ' · entrou em ' +
      String(p.criado_em).slice(0,10).split('-').reverse().join('/') +
      ' · último acesso ' + (p.ultimo_acesso ? String(p.ultimo_acesso).slice(0,10).split('-').reverse().join('/') : 'nunca') +
      '</div></div>' +
      '<select data-plano="' + p.id + '"><option value="free"' + (p.plano==='free'?' selected':'') + '>Free</option>' +
      '<option value="pro"' + (p.plano==='pro'?' selected':'') + '>Pro</option>' +
      '<option value="vitalicio"' + (p.plano==='vitalicio'?' selected':'') + '>Vitalício</option></select>' +
      '<input type="date" data-exp="' + p.id + '" value="' + (p.plano_expira ? String(p.plano_expira).slice(0,10) : '') + '">' +
      '<button class="btn ghost sm" data-salvar="' + p.id + '">Salvar</button></div>'
  ).join('') : '<div class="empty"><b>Ninguém cadastrado ainda</b>Quando alguém criar conta, aparece aqui.</div>';

  $$('#adminList [data-salvar]').forEach(b => b.onclick = async () => {
    const id = b.dataset.salvar;
    const plano = $('#adminList [data-plano="' + id + '"]').value;
    const exp = $('#adminList [data-exp="' + id + '"]').value || null;
    b.disabled = true;
    const { error } = await sb.from('perfis').update({ plano, plano_expira: exp }).eq('id', id);
    b.disabled = false;
    if(error) return toast('Não deu para salvar: ' + error.message, 'bad');
    toast('Plano atualizado', 'good');
    carregarAdmin();
  });

  $('#asPessoa').innerHTML = PESSOAS.map(p =>
    '<option value="' + p.id + '">' + esc(p.nome || p.email || p.id.slice(0,8)) + '</option>').join('');

  $('#assinaturasList').innerHTML = ASSINATURAS.length ? ASSINATURAS.map(a => {
    const dono = PESSOAS.find(p => p.id === a.user_id);
    return '<div class="item"><span class="stripe ' + (assinaturaAtiva(a) ? 'in' : '') + '"></span>' +
      '<div class="main"><div class="nm">' + esc(dono ? (dono.nome || dono.email) : 'usuário removido') + '</div>' +
      '<div class="meta">' + esc(a.metodo || '—') + ' · ' +
      String(a.inicio).split('-').reverse().join('/') +
      (a.fim ? ' até ' + String(a.fim).split('-').reverse().join('/') : ' (sem prazo)') +
      ' · ' + (assinaturaAtiva(a) ? 'ativa' : a.status) + '</div></div>' +
      '<div class="amt num">' + money(a.valor) + '</div>' +
      '<button class="x" data-delas="' + a.id + '" aria-label="Excluir">&times;</button></div>';
  }).join('') : '<div class="empty"><b>Nenhum pagamento registrado</b>Use o formulário acima quando alguém pagar.</div>';

  $$('#assinaturasList [data-delas]').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('assinaturas').delete().eq('id', b.dataset.delas);
    if(error) return toast('Não deu para excluir', 'bad');
    carregarAdmin();
  });
}

$('#btnRecarregarAdmin').onclick = carregarAdmin;
$('#asPlano').addEventListener('change', () => {
  $('#asValor').value = $('#asPlano').value === 'vitalicio' ? PRECOS.vitalicio : PRECOS.pro;
  $('#asFim').disabled = $('#asPlano').value === 'vitalicio';
});

$('#btnAddAssinatura').onclick = async () => {
  const user_id = $('#asPessoa').value;
  if(!user_id) return toast('Escolha a pessoa', 'bad');
  const valor = +$('#asValor').value || 0;
  const inicio = $('#asInicio').value || todayISO();
  const fim = $('#asFim').value || null;
  const b = $('#btnAddAssinatura'); b.disabled = true;
  const plano = $('#asPlano').value;
  const r1 = await sb.from('assinaturas').insert({
    user_id, plano, status:'ativa', valor, metodo:$('#asMetodo').value,
    inicio, fim: plano === 'vitalicio' ? null : fim });
  const r2 = await sb.from('perfis')
    .update({ plano, plano_expira: plano === 'vitalicio' ? null : fim }).eq('id', user_id);
  b.disabled = false;
  if(r1.error || r2.error) return toast('Não deu certo: ' + ((r1.error||r2.error).message), 'bad');
  toast(($('#asPlano').value === 'vitalicio' ? 'Vitalício' : 'Pro') + ' liberado', 'good');
  carregarAdmin();
};

/* datas padrão do formulário de assinatura: hoje até daqui a um mês */
(function datasAssinatura(){
  const hoje = new Date();
  const mais = new Date(hoje.getFullYear(), hoje.getMonth()+1, hoje.getDate());
  $('#asInicio').value = hoje.toLocaleDateString('sv-SE');
  $('#asFim').value = mais.toLocaleDateString('sv-SE');
})();
renderAdmin();   /* pinta os estados vazios antes de qualquer dado chegar */


/* ============================================================
   APLICAR O PLANO NA TELA
   ============================================================ */
function fmtData(d){ return d ? String(d).slice(0,10).split('-').reverse().join('/') : '—'; }
function diasAte(d){
  if(!d) return Infinity;
  return Math.ceil((new Date(d + 'T12:00:00') - new Date()) / 864e5);
}

function aplicarPlano(){
  const p = planoInfo(), pago = p.ativo, lim = limite();

  $('#travaDocs').hidden = pago;
  $('#docsConteudo').classList.toggle('travado', !pago);
  $('#travaPrecos').hidden = pago;
  $('#formBusca').classList.toggle('travado', !pago);
  $('#travaGraf').hidden = pago;
  $('#travaDividas').hidden = pago || S.dividas.length < lim.dividas;

  const perto = p.plano === 'pro' && p.ativo && diasAte(p.expira) <= 5;
  $('#blocoPlanos').hidden = pago && !perto;
  $('#tagFree').hidden = p.plano !== 'free';
  $('#tagPro').hidden  = p.plano !== 'pro';
  $('#tagVita').hidden = p.plano !== 'vitalicio';

  const el = $('#statusPlano');
  if(p.plano === 'vitalicio'){
    $('#planoSub').textContent = 'Acesso liberado para sempre.';
    el.innerHTML = '<div class="statusplano"><span class="selo">Vitalício</span>' +
      '<div class="det">Você pagou uma vez e tem tudo liberado, sem renovação e sem mensalidade. Obrigado.</div></div>';
  } else if(p.plano === 'pro' && p.ativo){
    const d = diasAte(p.expira);
    $('#planoSub').textContent = p.expira ? 'Ativo até ' + fmtData(p.expira) : 'Ativo';
    el.innerHTML = '<div class="statusplano"><span class="selo">Pro</span>' +
      '<div class="det">Tudo liberado' + (p.expira ? ' até <b>' + fmtData(p.expira) + '</b>' : '') +
      (isFinite(d) && d <= 5 ? ' — faltam <b>' + Math.max(0,d) + '</b> dia(s). Renove para não perder o acesso.' : '.') +
      '</div></div>';
  } else if(p.vencido){
    $('#planoSub').textContent = 'Assinatura vencida';
    el.innerHTML = '<div class="statusplano"><span class="selo">Pro vencido</span>' +
      '<div class="det">Sua assinatura venceu em <b>' + fmtData(p.expira) + '</b> e o app voltou para o Free. ' +
      'Renove abaixo para liberar tudo de novo.</div></div>';
  } else {
    $('#planoSub').textContent = 'Você está no plano gratuito.';
    el.innerHTML = '<div class="statusplano"><span class="selo">Free</span>' +
      '<div class="det">Você tem o cálculo da hora, contas e lançamentos sem limite, ' +
      LIMITES.free.dividas + ' dívidas, gráficos de ' + LIMITES.free.mesesGrafico + ' meses e ' +
      LIMITES.free.recibosMes + ' recibos por mês (usou ' + recibosDoMes() + ').</div></div>';
  }
}

function pedirPlano(plano){
  const valor = plano === 'vitalicio' ? PRECOS.vitalicio : PRECOS.pro;
  const nome  = plano === 'vitalicio' ? 'Vitalício' : 'Pro';
  let canais = '';
  if(CONTATO.pix){
    canais += '<div class="row" style="margin-top:10px"><label class="f" style="flex:2 1 200px">Chave Pix' +
      '<input type="text" id="pixChave" readonly value="' + esc(CONTATO.pix) + '"></label>' +
      '<div class="actions"><button class="btn" id="btnCopiarPix">Copiar chave</button></div></div>';
  }
  if(CONTATO.whatsapp){
    canais += '<p style="margin-top:10px"><a class="btn brass" style="display:inline-block;text-decoration:none" ' +
      'href="https://wa.me/' + esc(CONTATO.whatsapp) + '?text=' +
      encodeURIComponent('Oi! Quero o plano ' + nome + ' do CLT Code (' + money(valor) + ').') +
      '" target="_blank" rel="noopener">Falar no WhatsApp</a></p>';
  }
  if(CONTATO.email){
    canais += '<p class="hint" style="margin-top:8px">Ou por e-mail: <b>' + esc(CONTATO.email) + '</b></p>';
  }
  if(!canais){
    canais = '<p class="hint" style="margin-top:10px">O contato para pagamento ainda não foi configurado neste app. ' +
      'Quem cuida do CLT Code precisa preencher a constante <b>CONTATO</b> no arquivo app.js.</p>';
  }
  $('#statusPlano').innerHTML =
    '<div class="statusplano"><span class="selo">' + nome + '</span>' +
    '<div class="det">Valor: <b>' + money(valor) + '</b>' +
    (plano === 'vitalicio' ? ' — pagamento único, acesso para sempre.' : ' por mês.') +
    ' Assim que o pagamento cair, eu libero na hora.</div></div>' + canais;
  $('#statusPlano').scrollIntoView({ behavior:'smooth', block:'center' });
  const b = $('#btnCopiarPix');
  if(b) b.onclick = async () => {
    try { await navigator.clipboard.writeText(CONTATO.pix); toast('Chave copiada', 'good'); }
    catch(e){ $('#pixChave').select(); toast('Selecione e copie', 'bad'); }
  };
}
$$('[data-assinar]').forEach(b => b.onclick = () => pedirPlano(b.dataset.assinar));
$$('[data-ir-planos]').forEach(b => b.onclick = () => {
  irPara('conta');
  setTimeout(() => $('#blocoPlanos').scrollIntoView({ behavior:'smooth', block:'start' }), 60);
});

/* ============================================================
   DOCUMENTOS — Serasa e Registrato
   O PDF é lido aqui no navegador; o arquivo não é enviado.
   ============================================================ */
let achados = [];      // itens lidos do PDF que ainda não foram salvos
let docAtual = null;

async function lerPDF(file){
  const lib = window.pdfjsLib;
  if(!lib) throw new Error('O leitor de PDF não carregou. Recarregue a página.');
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let texto = '';
  for(let i = 1; i <= doc.numPages; i++){
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    const linhas = {};
    c.items.forEach(it => {
      const y = Math.round(it.transform[5]);
      (linhas[y] = linhas[y] || []).push(it.str);
    });
    Object.keys(linhas).sort((a,b) => b - a).forEach(y => {
      const l = linhas[y].join(' ').replace(/\s+/g,' ').trim();
      if(l) texto += l + '\n';
    });
  }
  return { texto, paginas: doc.numPages };
}

function detectarTipo(t){
  const x = t.toLowerCase();
  if(x.includes('registrato') || x.includes('banco central') || x.includes('scr') || x.includes('ccs')) return 'registrato';
  if(x.includes('serasa')) return 'serasa';
  return 'outro';
}

function extrairItens(texto){
  const RE = /R\$\s*([\d.]{1,15},\d{2})/;
  const IGNORAR = /total|somat[óo]rio|subtotal|limite|juros|multa|cpf|cnpj|p[áa]gina/i;
  const vistos = new Set();
  const out = [];
  texto.split('\n').forEach(linha => {
    const m = linha.match(RE);
    if(!m) return;
    const valor = +m[1].replace(/\./g,'').replace(',','.');
    if(!(valor > 0)) return;
    let nome = linha.slice(0, m.index)
      .replace(/\d{2}\/\d{2}\/\d{4}/g,' ')
      .replace(/[|;•]+/g,' ')
      .replace(/\s{2,}/g,' ').trim();
    if(nome.length < 3) nome = linha.replace(RE,' ').replace(/\s{2,}/g,' ').trim();
    if(nome.length > 70) nome = nome.slice(nome.length - 70).trim();
    if(!nome || IGNORAR.test(nome)) return;
    const chave = nome.toLowerCase() + '|' + valor;
    if(vistos.has(chave)) return;
    vistos.add(chave);
    out.push({ nome, valor, marcado: true });
  });
  return out.slice(0, 40);
}

async function processarArquivo(file){
  const msg = $('#docMsg');
  if(!file) return;
  if(file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)){
    msg.textContent = 'Esse arquivo não é um PDF.'; return;
  }
  msg.textContent = 'Lendo "' + file.name + '"…';
  try{
    const { texto, paginas } = await lerPDF(file);
    const tipo = detectarTipo(texto);
    achados = extrairItens(texto);
    docAtual = { tipo, arquivo: file.name, paginas };
    msg.textContent = achados.length
      ? 'Li ' + paginas + ' página(s) e encontrei ' + achados.length + ' linha(s) com valor.'
      : 'Li o arquivo, mas não encontrei valores em reais. Pode ser um PDF de imagem (digitalizado), que precisa de leitura de texto.';
    renderAchados();
  } catch(e){
    msg.textContent = 'Não consegui ler esse PDF: ' + e.message;
    achados = []; docAtual = null; renderAchados();
  }
}

function renderAchados(){
  const el = $('#docResultado');
  if(!achados.length){ el.innerHTML = ''; return; }
  const rotulo = { serasa:'Extrato Serasa', registrato:'Registrato — Banco Central', outro:'Documento' }[docAtual.tipo];
  const total = achados.filter(a => a.marcado).reduce((a,b) => a + b.valor, 0);
  el.innerHTML =
    '<div class="docmeta"><span class="tipo">' + rotulo + '</span>' +
    '<span class="hint">' + esc(docAtual.arquivo) + ' · ' + docAtual.paginas + ' página(s)</span></div>' +
    '<p class="hint" style="margin-bottom:10px">Confira antes de integrar. A leitura é automática e pode pegar linha errada — ' +
    'corrija o nome, ajuste o valor ou desmarque o que não for dívida.</p>' +
    '<div class="list">' + achados.map((a,i) =>
      '<div class="achado"><label class="sw"><input type="checkbox" data-marc="' + i + '"' + (a.marcado?' checked':'') + '><i></i></label>' +
      '<input type="text" data-nome="' + i + '" value="' + esc(a.nome) + '">' +
      '<input class="num" type="number" step="0.01" data-valor="' + i + '" value="' + a.valor + '">' +
      '</div>').join('') + '</div>' +
    '<div class="tiles" style="margin-top:14px">' +
      '<div class="tile accent"><span class="k">Total marcado</span><span class="v num">' + money(total) + '</span>' +
      '<span class="sub">' + fmtH(emHoras(total)) + ' de trabalho</span></div>' +
      '<div class="tile"><span class="k">Linhas marcadas</span><span class="v num">' +
      achados.filter(a=>a.marcado).length + '</span><span class="sub">de ' + achados.length + '</span></div>' +
    '</div>' +
    '<div class="actions" style="margin-top:14px">' +
      '<button class="btn" id="btnIntegrar">Integrar nas Dívidas</button>' +
      '<button class="btn ghost" id="btnSoGuardar">Só guardar o resumo</button>' +
      '<button class="btn ghost" id="btnDescartar">Descartar</button>' +
    '</div>';

  $$('#docResultado [data-marc]').forEach(c => c.onchange = () => { achados[+c.dataset.marc].marcado = c.checked; renderAchados(); });
  $$('#docResultado [data-nome]').forEach(c => c.onchange = () => { achados[+c.dataset.nome].nome = c.value; });
  $$('#docResultado [data-valor]').forEach(c => c.onchange = () => { achados[+c.dataset.valor].valor = +c.value||0; renderAchados(); });
  $('#btnIntegrar').onclick  = () => salvarDoc(true);
  $('#btnSoGuardar').onclick = () => salvarDoc(false);
  $('#btnDescartar').onclick = () => { achados = []; docAtual = null; $('#docMsg').textContent = ''; renderAchados(); };
}

function salvarDoc(integrar){
  const marcados = achados.filter(a => a.marcado);
  if(!marcados.length) return toast('Marque pelo menos uma linha', 'bad');
  const doc = {
    id: uid(), tipo: docAtual.tipo, arquivo: docAtual.arquivo, paginas: docAtual.paginas,
    total: Math.round(marcados.reduce((a,b) => a + b.valor, 0) * 100) / 100,
    itens: marcados.map(a => ({ nome: a.nome, valor: a.valor })),
    integrado: !!integrar, criado_em: new Date().toISOString()
  };
  S.documentos.unshift(doc);

  if(integrar){
    marcados.forEach(a => {
      const d = { id: uid(), nome: a.nome, credor: doc.tipo === 'serasa' ? 'Serasa' : 'Registrato',
        total: a.valor, pago: 0, parcela: 0, dia: 10, juros: 0, contar: false, quitada: false };
      S.dividas.push(d);
      sincronizar({ tipo:'upsert', col:'dividas', dados:d });
    });
  }
  S.demo = false;
  achados = []; docAtual = null; $('#docMsg').textContent = '';
  commit();
  sincronizar({ tipo:'upsert', col:'documentos', dados:doc });
  toast(integrar ? marcados.length + ' dívida(s) criadas' : 'Resumo guardado', 'good');
  if(integrar) irPara('dividas');
}

function renderDocs(){
  const el = $('#docsList');
  if(!S.documentos.length){
    el.innerHTML = '<div class="empty"><b>Nenhum documento importado</b>Suba o PDF do Serasa ou do Registrato acima.</div>';
    return;
  }
  const rotulo = { serasa:'Serasa', registrato:'Registrato', outro:'Documento' };
  el.innerHTML = S.documentos.map(d =>
    '<div class="item"><span class="stripe fix"></span><div class="main">' +
    '<div class="nm">' + esc(rotulo[d.tipo] || 'Documento') + ' — ' + esc(d.arquivo || 'arquivo') + '</div>' +
    '<div class="meta">' + fmtData(d.criado_em) + ' · ' + (d.itens||[]).length + ' item(ns)' +
    (d.integrado ? ' · integrado nas dívidas' : ' · só resumo') + '</div></div>' +
    '<div class="amt num">' + money(d.total) + '<small>' + fmtH(emHoras(d.total)) + '</small></div>' +
    '<button class="x" data-deldoc="' + d.id + '" aria-label="Excluir">&times;</button></div>').join('');
  $$('#docsList [data-deldoc]').forEach(b => b.onclick = () => {
    const id = b.dataset.deldoc;
    S.documentos = S.documentos.filter(x => x.id !== id); commit();
    sincronizar({ tipo:'delete', col:'documentos', id });
  });
}

$('#drop').addEventListener('click', e => { if(e.target.tagName !== 'INPUT') $('#fArquivo').click(); });
$('#fArquivo').addEventListener('change', e => processarArquivo(e.target.files[0]));
['dragenter','dragover'].forEach(ev => $('#drop').addEventListener(ev, e => {
  e.preventDefault(); $('#drop').classList.add('sobre');
}));
['dragleave','drop'].forEach(ev => $('#drop').addEventListener(ev, e => {
  e.preventDefault(); $('#drop').classList.remove('sobre');
}));
$('#drop').addEventListener('drop', e => processarArquivo(e.dataTransfer.files[0]));

/* ============================================================
   INÍCIO
   ============================================================ */
(async function inicio(){
  try { const t = localStorage.getItem('cltcode.theme'); if(t) document.documentElement.setAttribute('data-theme', t); } catch(e){}
  $('#cCat').innerHTML = CATS_CONTA.map(c=>'<option>'+c+'</option>').join('');
  $('#lCat').innerHTML = CATS_LANC.map(c=>'<option>'+c+'</option>').join('');
  $('#lData').value = todayISO();
  $('#rData').value = todayISO();
  $('#rCid').value  = S.perfil.cidade || '';
  $('#rEmi').value  = S.perfil.nome || '';
  $('#rDoc').value  = S.perfil.documento || '';
  if(S.demo){ $('#rPag').value='Maria Souza'; $('#rVal').value=150; $('#rRef').value='serviço de montagem de móveis'; }

  let s = null;
  try { const { data } = await sb.auth.getSession(); s = data.session; } catch(e){}
  $('#boot').hidden = true;
  if(s){ await abrirApp(s); }
  else if(SEM_NUVEM){ abrirApp(null); }
  else {
    const jaUsou = (() => { try { return !!localStorage.getItem('cltcode.local'); } catch(e){ return false; } })();
    if(jaUsou) abrirApp(null); else { $('#auth').hidden = false; modoAuth('entrar'); }
  }
  sb.auth.onAuthStateChange((ev, ns) => {
    if(ev === 'SIGNED_OUT'){ sessao = null; }
  });
})();
$('#btnGuest').addEventListener('click', () => { try { localStorage.setItem('cltcode.local','1'); } catch(e){} });
