/* Dashboard Premium 2.0 — aplicação principal */
(() => {
  'use strict';
  const state = { data: [], filtered: [], page: 1, pageSize: 50, charts: {}, unsubscribe: null };
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('pt-BR');
  const pct = n => `${Number(n || 0).toFixed(1).replace('.', ',')}%`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function init(){
    $('user-name').textContent = localStorage.getItem('userName') || 'Usuário';
    const admin = localStorage.getItem('userRole') === 'admin';
    $('admin-actions').classList.toggle('hidden', !admin);
    $('excel-upload').addEventListener('change', handleUpload);
    $('btn-load-demo').addEventListener('click', loadDemoData);
    $('btn-clear-data').addEventListener('click', clearData);
    $('btn-logout').addEventListener('click', logout);
    $('table-search').addEventListener('input', debounce(()=>{state.page=1;renderTable()},150));
    $('table-filter').addEventListener('change',()=>{state.page=1;renderTable()});
    $('page-size').addEventListener('change',()=>{state.page=1;state.pageSize=Number($('page-size').value);renderTable()});
    $('btn-clear-filters').addEventListener('click',()=>{$('table-search').value='';$('table-filter').value='todos';state.page=1;renderTable()});
    window.addEventListener('online',()=>setConnection(true)); window.addEventListener('offline',()=>setConnection(false)); setConnection(navigator.onLine);
    listenFirebase();
  }

  function debounce(fn,wait){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait)}}
  function setConnection(online){$('connection-pill').classList.toggle('offline',!online);$('connection-text').textContent=online?'Online':'Sem conexão'}
  function listenFirebase(){
    try{
      state.unsubscribe = db.collection('inventario').doc('atual').onSnapshot(doc=>{
        setConnection(true);
        if(!doc.exists){applyData([],'Nenhuma base carregada','Aguardando envio');return;}
        const info=doc.data()||{}; applyData(info.dados||[],info.nomeArquivo||'Base atual',info.dataAtualizacao||'Agora');
      },err=>{console.error(err);setConnection(false);toast('Não foi possível sincronizar com o Firebase.','error')});
    }catch(e){console.error(e);toast('Erro ao inicializar o Firebase.','error')}
  }
  function applyData(data,name,updated){state.data=normalizeData(data);$('current-filename').textContent=name;$('last-update').textContent=`Atualizado em: ${updated}`;$('record-count').textContent=`${fmt(state.data.length)} registros`;updateDashboard();}
  function normalizeData(data){
    if(!Array.isArray(data))return [];
    return data.map((row,idx)=>{
      const keys=Object.keys(row||{});const norm=k=>String(k).trim().toUpperCase();
      const c=keys.find(k=>norm(k)==='CONTAGEM'||norm(k).includes('CONTA'))||keys[1]||keys[0];
      const o=keys.find(k=>norm(k).includes('OCORR')||norm(k).includes('DIVERG'))||keys[2]||keys[0];
      const l=keys.find(k=>norm(k).includes('LOCAL')||norm(k).includes('POSIC')||norm(k).includes('COD'))||keys[0];
      const cv=String(row[c]??'').trim().toUpperCase(); const ov=String(row[o]??'').trim(); const ou=ov.toUpperCase();
      const contado=['SIM','S','OK','1','VERDADEIRO','TRUE'].includes(cv); const ocorrencia=!!ov&&!['NÃO','NAO','N','SEM OCORRÊNCIA','SEM OCORRENCIA','0','OK','-'].includes(ou);
      return {id:idx+1,localizador:String(row[l]??`Local ${idx+1}`),contado,ocorrencia,ocorrenciaText:ocorrencia?ov:'Nenhuma'};
    });
  }
  function metrics(){const total=state.data.length,contados=state.data.filter(x=>x.contado).length,pendentes=total-contados,ocorrencias=state.data.filter(x=>x.ocorrencia).length,sem=state.data.filter(x=>x.contado&&!x.ocorrencia).length;return{total,contados,pendentes,ocorrencias,sem,progresso:total?contados/total*100:0,pendPct:total?pendentes/total*100:0,ocPct:total?ocorrencias/total*100:0,acuracia:contados?sem/contados*100:0}}
  function updateDashboard(){
    const m=metrics(); $('kpi-total').textContent=fmt(m.total);$('kpi-contados').textContent=fmt(m.contados);$('kpi-pendentes').textContent=fmt(m.pendentes);$('kpi-ocorrencias').textContent=fmt(m.ocorrencias);$('kpi-acuracia').textContent=pct(m.acuracia);$('kpi-contados-pct').textContent=pct(m.progresso);$('kpi-pendentes-pct').textContent=pct(m.pendPct);$('kpi-ocorrencias-pct').textContent=pct(m.ocPct);$('detail-contados').textContent=fmt(m.contados);$('detail-pendentes').textContent=fmt(m.pendentes);$('progress-center').textContent=pct(m.progresso);$('progress-badge').textContent=pct(m.progresso);$('progress-bar-fill').style.width=`${m.progresso}%`;
    $('status-summary').textContent=m.total?`${fmt(m.contados)} de ${fmt(m.total)} localizadores já foram contados. ${fmt(m.pendentes)} permanecem pendentes.`:'Nenhum inventário ativo no momento.';
    $('progress-message').textContent=m.total?(m.progresso>=90?'Contagem em fase final.':m.progresso>=70?'Bom avanço. Priorize os pendentes restantes.':'A contagem ainda precisa avançar.'):'Aguardando dados.';
    updateOperationalStatus(m);renderCharts(m);renderTable();
  }
  function updateOperationalStatus(m){
    let level='neutral',title='Aguardando dados',desc='Carregue um inventário para iniciar a análise.';
    if(m.total){if(m.ocPct>=10||m.pendPct>=30){level='danger';title='Ação necessária';desc='Há um volume elevado de pendências ou ocorrências.'}else if(m.ocPct>=5||m.pendPct>=15){level='warning';title='Atenção';desc='A operação está avançando, mas existem pontos que merecem acompanhamento.'}else{level='good';title='Operação normal';desc='Os principais indicadores estão dentro de uma faixa saudável.'}}
    $('operational-status').className=`operational-status ${level}`;$('operational-status-text').textContent=title;$('status-big-text').textContent=title;$('status-big-description').textContent=desc;$('status-big-icon').className=`status-big-icon ${level}`;$('status-big-icon').innerHTML=level==='good'?'<i class="fa-solid fa-check"></i>':level==='warning'?'<i class="fa-solid fa-triangle-exclamation"></i>':level==='danger'?'<i class="fa-solid fa-bolt"></i>':'<i class="fa-solid fa-circle-info"></i>';
    const items=[];if(m.pendentes)items.push(`<div><i class="fa-solid fa-hourglass-half"></i><span><strong>${fmt(m.pendentes)}</strong> pendentes de contagem</span></div>`);if(m.ocorrencias)items.push(`<div><i class="fa-solid fa-triangle-exclamation"></i><span><strong>${fmt(m.ocorrencias)}</strong> registros com ocorrência</span></div>`);if(m.acuracia<98&&m.contados)items.push(`<div><i class="fa-solid fa-bullseye"></i><span>Acurácia atual em <strong>${pct(m.acuracia)}</strong></span></div>`);$('attention-list').innerHTML=items.length?items.join(''):'<div class="empty-attention"><i class="fa-solid fa-circle-check"></i> Nenhuma ação prioritária identificada.</div>';
  }
  function renderCharts(m){
    Object.values(state.charts).forEach(c=>{try{c.destroy()}catch(e){}});
    state.charts.progresso=new Chart($('chartProgresso'),{type:'doughnut',data:{labels:['Contados','Pendentes'],datasets:[{data:[m.contados,m.pendentes],backgroundColor:['#10b981','#f59e0b'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'76%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.raw)}`}}}}});
    state.charts.ocorrencias=new Chart($('chartOcorrencias'),{type:'doughnut',data:{labels:['Sem ocorrência','Com ocorrência'],datasets:[{data:[m.sem,m.ocorrencias],backgroundColor:['#10b981','#f43f5e'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,padding:18}}}}});
    state.charts.visao=new Chart($('chartVisaoGeral'),{type:'bar',data:{labels:['Total','Contados','Pendentes','Ocorrências'],datasets:[{label:'Registros',data:[m.total,m.contados,m.pendentes,m.ocorrencias],backgroundColor:['#2563eb','#10b981','#f59e0b','#f43f5e'],borderRadius:8,maxBarThickness:52}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}}}});
  }
  function getFiltered(){const q=$('table-search').value.toLowerCase().trim(),f=$('table-filter').value;return state.data.filter(x=>{const search=!q||x.localizador.toLowerCase().includes(q)||x.ocorrenciaText.toLowerCase().includes(q);if(!search)return false;if(f==='contados')return x.contado;if(f==='pendentes')return !x.contado;if(f==='ocorrencias')return x.ocorrencia;if(f==='sem_ocorrencia')return x.contado&&!x.ocorrencia;return true})}
  function renderTable(){const list=getFiltered();state.filtered=list;const totalPages=Math.max(1,Math.ceil(list.length/state.pageSize));if(state.page>totalPages)state.page=totalPages;const start=(state.page-1)*state.pageSize;const pageItems=list.slice(start,start+state.pageSize);$('table-count-info').textContent=`Exibindo ${list.length?start+1:0}–${Math.min(start+state.pageSize,list.length)} de ${fmt(list.length)} filtrados · ${fmt(state.data.length)} totais`;$('table-page-info').textContent=`Página ${state.page} de ${totalPages}`;
    $('table-body').innerHTML=pageItems.length?pageItems.map(x=>`<tr><td class="index-cell">${x.id}</td><td><strong>${escapeHtml(x.localizador)}</strong></td><td>${x.contado?'<span class="badge success"><i class="fa-solid fa-check"></i> Contado</span>':'<span class="badge warning"><i class="fa-solid fa-clock"></i> Pendente</span>'}</td><td>${x.ocorrencia?`<span class="badge danger"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(x.ocorrenciaText)}</span>`:'<span class="badge neutral"><i class="fa-solid fa-minus"></i> Nenhuma</span>'}</td></tr>`).join(''):`<tr><td colspan="4" class="empty-row"><i class="fa-solid fa-inbox"></i><strong>Nenhum registro encontrado</strong><span>Ajuste a busca ou os filtros para continuar.</span></td></tr>`;
    const p=$('pagination');p.innerHTML='';for(let i=1;i<=totalPages;i++){if(totalPages>8&&i>3&&i<totalPages-2&&Math.abs(i-state.page)>1){if(!p.querySelector('.ellipsis')){const s=document.createElement('span');s.className='ellipsis';s.textContent='…';p.appendChild(s)}continue}const b=document.createElement('button');b.textContent=i;b.className=i===state.page?'active':'';b.onclick=()=>{state.page=i;renderTable()};p.appendChild(b)}
  }
  async function handleUpload(e){if(localStorage.getItem('userRole')!=='admin'){toast('Somente administradores podem importar planilhas.','error');e.target.value='';return}const file=e.target.files[0];if(!file)return;try{toast('Processando planilha...','info');const buffer=await file.arrayBuffer();const wb=XLSX.read(new Uint8Array(buffer),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const json=XLSX.utils.sheet_to_json(ws,{defval:''});if(!json.length){toast('A planilha está vazia.','error');return}applyData(json,file.name,'Agora');await saveFirebase(file.name,json);toast(`${fmt(json.length)} registros importados com sucesso.`,'success')}catch(err){console.error(err);toast('Não foi possível processar a planilha.','error')}finally{e.target.value=''}}
  async function saveFirebase(name,data){$('current-filename').textContent='Salvando na nuvem...';await db.collection('inventario').doc('atual').set({nomeArquivo:name,dataAtualizacao:new Date().toLocaleString('pt-BR'),dados:data,quantidadeRegistros:data.length,atualizadoPor:localStorage.getItem('userName')||'Usuário'})}
  function loadDemoData(){if(localStorage.getItem('userRole')!=='admin'){toast('Apenas administradores podem publicar dados demo.','error');return}const zonas=['A','B','C','D','E','F'],erros=['Divergência de quantidade','Avaria identificada','Etiqueta danificada'];const demo=Array.from({length:500},(_,i)=>{const z=zonas[Math.floor(Math.random()*zonas.length)],c=String(Math.floor(Math.random()*20)+1).padStart(2,'0'),p=String(Math.floor(Math.random()*5)+1).padStart(2,'0'),pos=String(Math.floor(Math.random()*10)+1).padStart(2,'0'),contado=Math.random()<.78;return{LOCALIZADOR:`LOC-${z}${c}-${p}-${pos}`,CONTAGEM:contado?'SIM':'NÃO',OCORRÊNCIA:contado&&Math.random()<.12?erros[Math.floor(Math.random()*erros.length)]:'NÃO'}});saveFirebase(`Dados demonstrativos (${demo.length} localizadores)`,demo).then(()=>toast('Dados demonstrativos publicados.','success')).catch(()=>toast('Erro ao publicar dados demo.','error'))}
  async function clearData(){if(localStorage.getItem('userRole')!=='admin'){toast('Apenas administradores podem arquivar dados.','error');return}const ok=await confirmModal('Arquivar inventário','Esta ação remove a base atual da visão ativa. Os dados poderão ser preservados posteriormente com histórico. Deseja continuar?','Arquivar');if(!ok)return;try{await db.collection('inventario').doc('atual').set({nomeArquivo:'Nenhum arquivo carregado',dataAtualizacao:new Date().toLocaleString('pt-BR'),dados:[],quantidadeRegistros:0,arquivadoPor:localStorage.getItem('userName')||'Usuário'});toast('Base atual arquivada.','success')}catch(e){toast('Não foi possível arquivar a base.','error')}}
  function logout(){localStorage.clear();window.location.replace('login.html')}
  function toast(msg,type='info'){const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=`<i class="fa-solid ${type==='success'?'fa-circle-check':type==='error'?'fa-circle-xmark':'fa-circle-info'}"></i><span>${escapeHtml(msg)}</span>`;$('toast-container').appendChild(el);setTimeout(()=>el.classList.add('show'),20);setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300)},3500)}
  function confirmModal(title,text,confirmLabel){return new Promise(resolve=>{const root=$('modal-container');root.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><div class="modal-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><div class="modal-actions"><button id="modal-cancel" class="btn btn-light">Cancelar</button><button id="modal-ok" class="btn btn-danger">${escapeHtml(confirmLabel)}</button></div></div></div>`;$('modal-cancel').onclick=()=>{root.innerHTML='';resolve(false)};$('modal-ok').onclick=()=>{root.innerHTML='';resolve(true)}})}
  window.processarDadosExcel=applyData;window.salvarDadosNoFirebase=saveFirebase;window.zerarDadosBanco=clearData;
  document.addEventListener('DOMContentLoaded',init);
})();
