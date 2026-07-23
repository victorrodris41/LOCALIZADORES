// ESTADO GLOBAL DA APLICAÇÃO
let rawData = [];
let parsedData = [];
let chartInstanceProgresso = null;
let chartInstanceOcorrencias = null;
let chartInstanceVisaoGeral = null;

// INICIALIZAÇÃO AO CARREGAR A PÁGINA
window.addEventListener('DOMContentLoaded', () => {
    // Configura escutadores de eventos de tela
    setupEventListeners();
});

// Configurar Event Listeners
function setupEventListeners() {
    const fileInput = document.getElementById('excel-upload');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    const btnDemo = document.getElementById('btn-load-demo');
    if (btnDemo) {
        btnDemo.addEventListener('click', () => {
            loadDemoData();
        });
    }

    const inputSearch = document.getElementById('table-search');
    if (inputSearch) {
        inputSearch.addEventListener('input', renderTable);
    }

    const filterSelect = document.getElementById('table-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', renderTable);
    }
}

// CARREGAR DADOS DEMO
function loadDemoData() {
    const demo = [];
    const totalItems = 500;
    const zonas = ['A', 'B', 'C', 'D', 'E', 'F'];

    for (let i = 1; i <= totalItems; i++) {
        const zona = zonas[Math.floor(Math.random() * zonas.length)];
        const corredor = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
        const prateleira = String(Math.floor(Math.random() * 5) + 1).padStart(2, '0');
        const posicao = String(Math.floor(Math.random() * 10) + 1).padStart(2, '0');
        
        const locCode = `LOC-${zona}${corredor}-${prateleira}-${posicao}`;
        const isContado = Math.random() < 0.78; // ~78% contados
        let comOcorrencia = "NÃO";

        if (isContado) {
            // Se foi contado, ~12% chance de ter divergência
            if (Math.random() < 0.12) {
                const erros = ["Divergência de Qtd", "Avaria Identificada", "Etiqueta Danificada"];
                comOcorrencia = erros[Math.floor(Math.random() * erros.length)];
            }
        } else {
            // Se não foi contado, pode estar com pendência/bloqueio
            if (Math.random() < 0.05) {
                comOcorrencia = "Local Bloqueado";
            }
        }

        demo.push({
            'LOCALIZADOR': locCode,
            'CONTAGEM': isContado ? 'SIM' : 'NÃO',
            'OCORRÊNCIA': comOcorrencia
        });
    }

    const nomeArquivo = `Dados demonstrativos de Exemplo (${totalItems} Localizadores)`;
    
    // Se for admin, salva no Firebase para sincronizar com todos
    if (localStorage.getItem('userRole') === 'admin' && typeof window.salvarDadosNoFirebase === 'function') {
        window.salvarDadosNoFirebase(nomeArquivo, demo);
    } else {
        processSpreadsheetData(demo);
    }
}

// LEITURA DO ARQUIVO ENVIADO PELO USUÁRIO (EXCEL / CSV)
function handleFileUpload(e) {
    // PROTEÇÃO DE ACESSO: Apenas administrador (Victor) pode carregar planilhas
    if (localStorage.getItem('userRole') !== 'admin') {
        alertModal("Apenas o usuário Victor possui permissão para carregar novas planilhas.");
        e.target.value = ''; // Limpa a seleção do arquivo
        return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Pegar primeira planilha do arquivo
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Converter para JSON
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (!json || json.length === 0) {
                alertModal("A planilha enviada parece estar vazia.");
                return;
            }

            // 1. Processa localmente
            processSpreadsheetData(json);

            // 2. SALVA NO FIREBASE (Sincronização em Tempo Real)
            if (typeof window.salvarDadosNoFirebase === 'function') {
                window.salvarDadosNoFirebase(file.name, json);
            }

        } catch (err) {
            console.error("Erro ao ler arquivo:", err);
            alertModal("Erro ao processar o arquivo Excel. Verifique se o formato está correto.");
        }
    };

    reader.readAsArrayBuffer(file);
}

// FUNÇÃO GLOBAL CHAMADA TANTO LOCALMENTE QUANTO PELO LISTENER DO FIREBASE
window.processarDadosExcel = function(data) {
    processSpreadsheetData(data);
};

// PROCESSAMENTO DE DADOS E REGRA DE NEGÓCIO
function processSpreadsheetData(data) {
    rawData = data || [];
    parsedData = [];

    // Se os dados estiverem vazios/zerados, limpa e atualiza o painel imediatamente
    if (!data || data.length === 0) {
        updateDashboard();
        return;
    }

    // Identificar colunas corretas flexivelmente
    const sampleRow = data[0];
    const keys = Object.keys(sampleRow);

    let colContagem = keys.find(k => k.trim().toUpperCase() === 'CONTAGEM' || k.trim().toUpperCase().includes('CONTA'));
    let colOcorrencia = keys.find(k => k.trim().toUpperCase().includes('OCORR') || k.trim().toUpperCase().includes('DIVERG'));
    let colLocalizador = keys.find(k => k.trim().toUpperCase().includes('LOCAL') || k.trim().toUpperCase().includes('POSIC') || k.trim().toUpperCase().includes('COD'));

    // Fallback caso não ache pelo nome
    colContagem = colContagem || keys[1] || keys[0];
    colOcorrencia = colOcorrencia || keys[2] || keys[0];
    colLocalizador = colLocalizador || keys[0];

    data.forEach((row, idx) => {
        const valContagemRaw = String(row[colContagem] || '').trim().toUpperCase();
        const valOcorrenciaRaw = String(row[colOcorrencia] || '').trim();

        // Regra para Contagem == "SIM"
        const isContado = (valContagemRaw === 'SIM' || valContagemRaw === 'S' || valContagemRaw === 'OK' || valContagemRaw === '1' || valContagemRaw === 'VERDADEIRO');

        // Regra para Ocorrência / Divergência
        const valUpper = valOcorrenciaRaw.toUpperCase();
        const temOcorrencia = valOcorrenciaRaw !== '' && 
                              valUpper !== 'NÃO' && 
                              valUpper !== 'NAO' && 
                              valUpper !== 'N' && 
                              valUpper !== 'SEM OCORRÊNCIA' && 
                              valUpper !== 'SEM OCORRENCIA' && 
                              valUpper !== '0' && 
                              valUpper !== 'OK' && 
                              valUpper !== '-';

        parsedData.push({
            id: idx + 1,
            localizador: row[colLocalizador] || `Local ${idx + 1}`,
            contado: isContado,
            contadoText: isContado ? 'SIM' : 'NÃO',
            ocorrencia: temOcorrencia,
            ocorrenciaText: valOcorrenciaRaw || (temOcorrencia ? 'SIM' : 'NÃO')
        });
    });

    // Atualizar Indicadores e Gráficos
    updateDashboard();
}

// ATUALIZAÇÃO GERAL DOS KPIS E GRÁFICOS
function updateDashboard() {
    const total = parsedData.length;

    // TRATAMENTO PARA DADOS ZERADOS
    if (total === 0) {
        document.getElementById('kpi-total').innerText = '0';
        document.getElementById('kpi-contados').innerText = '0';
        document.getElementById('kpi-contados-pct').innerText = '0.0% do total';
        document.getElementById('kpi-pendentes').innerText = '0';
        document.getElementById('kpi-pendentes-pct').innerText = '0.0% pendente';
        document.getElementById('kpi-ocorrencias').innerText = '0';
        document.getElementById('kpi-ocorrencias-pct').innerText = '0.0% com divergência';
        document.getElementById('acuracia-valor').innerText = '0.0%';

        renderCharts(0, 0, 0, 0, 0);
        renderTable();
        return;
    }

    const contados = parsedData.filter(d => d.contado).length;
    const pendentes = total - contados;
    const comOcorrencia = parsedData.filter(d => d.ocorrencia).length;
    const contadosSemOcorrencia = parsedData.filter(d => d.contado && !d.ocorrencia).length;

    const pctContado = (contados / total) * 100;
    const pctPendente = (pendentes / total) * 100;
    const pctOcorrenciaTotal = (comOcorrencia / total) * 100;
    const acuraciaContados = contados > 0 ? (contadosSemOcorrencia / contados) * 100 : 0;

    // Atualizar KPIs na Tela
    document.getElementById('kpi-total').innerText = total.toLocaleString('pt-BR');
    document.getElementById('kpi-contados').innerText = contados.toLocaleString('pt-BR');
    document.getElementById('kpi-contados-pct').innerText = `${pctContado.toFixed(1)}% do total`;
    
    document.getElementById('kpi-pendentes').innerText = pendentes.toLocaleString('pt-BR');
    document.getElementById('kpi-pendentes-pct').innerText = `${pctPendente.toFixed(1)}% pendente`;

    document.getElementById('kpi-ocorrencias').innerText = comOcorrencia.toLocaleString('pt-BR');
    document.getElementById('kpi-ocorrencias-pct').innerText = `${pctOcorrenciaTotal.toFixed(1)}% com divergência`;

    document.getElementById('acuracia-valor').innerText = `${acuraciaContados.toFixed(1)}%`;

    // Renderizar Gráficos
    renderCharts(contados, pendentes, comOcorrencia, total, contadosSemOcorrencia);

    // Renderizar Tabela
    renderTable();
}

// RENDERIZAR GRÁFICOS COM CHART.JS
function renderCharts(contados, pendentes, ocorrencias, total, semOcorrencia) {
    
    // Destruir instâncias anteriores se existirem
    if (chartInstanceProgresso) chartInstanceProgresso.destroy();
    if (chartInstanceOcorrencias) chartInstanceOcorrencias.destroy();
    if (chartInstanceVisaoGeral) chartInstanceVisaoGeral.destroy();

    const pctContado = total > 0 ? ((contados / total) * 100).toFixed(1) : "0.0";
    const pctPendente = total > 0 ? ((pendentes / total) * 100).toFixed(1) : "0.0";

    // 1. GRÁFICO DE PROGRESSO DA CONTAGEM (DONUT)
    const elProg = document.getElementById('chartProgresso');
    if (elProg) {
        const ctxProgresso = elProg.getContext('2d');
        chartInstanceProgresso = new Chart(ctxProgresso, {
            type: 'doughnut',
            data: {
                labels: ['Contados (SIM)', 'Pendentes (NÃO)'],
                datasets: [{
                    data: [contados, pendentes],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${value} localizadores (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '72%'
            }
        });
    }

    // Legenda do Gráfico 1
    const elProgLegend = document.getElementById('progresso-legend');
    if (elProgLegend) {
        elProgLegend.innerHTML = `
            <div class="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                <span class="block text-emerald-800 font-bold text-sm">${pctContado}%</span>
                <span class="text-emerald-600">Contado (${contados})</span>
            </div>
            <div class="p-2 bg-amber-50 rounded-lg border border-amber-100">
                <span class="block text-amber-800 font-bold text-sm">${pctPendente}%</span>
                <span class="text-amber-600">Pendente (${pendentes})</span>
            </div>
        `;
    }

    // 2. GRÁFICO DE OCORRÊNCIAS / DIVERGÊNCIAS (PIE)
    const semOcorrenciaTotal = total - ocorrencias;
    const pctSemOcorrencia = total > 0 ? ((semOcorrenciaTotal / total) * 100).toFixed(1) : "0.0";
    const pctComOcorrencia = total > 0 ? ((ocorrencias / total) * 100).toFixed(1) : "0.0";

    const elOcor = document.getElementById('chartOcorrencias');
    if (elOcor) {
        const ctxOcorrencias = elOcor.getContext('2d');
        chartInstanceOcorrencias = new Chart(ctxOcorrencias, {
            type: 'doughnut',
            data: {
                labels: ['Sem Ocorrência', 'Com Ocorrência'],
                datasets: [{
                    data: [semOcorrenciaTotal, ocorrencias],
                    backgroundColor: ['#6366f1', '#f43f5e'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${value} localizadores (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '72%'
            }
        });
    }

    // Legenda do Gráfico 2
    const elOcorLegend = document.getElementById('ocorrencia-legend');
    if (elOcorLegend) {
        elOcorLegend.innerHTML = `
            <div class="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                <span class="block text-indigo-800 font-bold text-sm">${pctSemOcorrencia}%</span>
                <span class="text-indigo-600">Sem Ocorrência (${semOcorrenciaTotal})</span>
            </div>
            <div class="p-2 bg-rose-50 rounded-lg border border-rose-100">
                <span class="block text-rose-800 font-bold text-sm">${pctComOcorrencia}%</span>
                <span class="text-rose-600">Com Divergência (${ocorrencias})</span>
            </div>
        `;
    }

    // 3. GRÁFICO DE VISÃO GERAL DA OPERAÇÃO (BARRAS)
    const elVisao = document.getElementById('chartVisaoGeral');
    if (elVisao) {
        const ctxVisaoGeral = elVisao.getContext('2d');
        chartInstanceVisaoGeral = new Chart(ctxVisaoGeral, {
            type: 'bar',
            data: {
                labels: ['Contado OK', 'Com Ocorrência', 'Não Contado'],
                datasets: [{
                    label: 'Qtd Localizadores',
                    data: [semOcorrencia, ocorrencias, pendentes],
                    backgroundColor: ['#10b981', '#f43f5e', '#f59e0b'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    }
}

// RENDERIZAR TABELA DE DADOS DETALHADA
function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('table-search');
    const filterInput = document.getElementById('table-filter');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const filterVal = filterInput ? filterInput.value : 'todos';

    tbody.innerHTML = '';

    let filtered = parsedData.filter(item => {
        // Filtro de Busca
        const matchesSearch = item.localizador.toLowerCase().includes(searchVal) || 
                              item.ocorrenciaText.toLowerCase().includes(searchVal);

        if (!matchesSearch) return false;

        // Filtro Dropdown
        if (filterVal === 'contados') return item.contado;
        if (filterVal === 'pendentes') return !item.contado;
        if (filterVal === 'ocorrencias') return item.ocorrencia;
        if (filterVal === 'sem_ocorrencia') return item.contado && !item.ocorrencia;

        return true;
    });

    const infoCount = document.getElementById('table-count-info');
    if (infoCount) {
        infoCount.innerText = `Exibindo ${filtered.length} de ${parsedData.length} localizadores`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-8 text-slate-400">
                    <i class="fa-solid fa-inbox text-3xl mb-2 block"></i>
                    Nenhum localizador encontrado com os filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    // Limitar exibição a no máximo 100 itens para performance na tabela DOM
    const displayList = filtered.slice(0, 100);

    displayList.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';

        const badgeContagem = item.contado 
            ? `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[11px] inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> SIM</span>`
            : `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-[11px] inline-flex items-center gap-1"><i class="fa-solid fa-clock"></i> NÃO</span>`;

        const badgeOcorrencia = item.ocorrencia 
            ? `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-full text-[11px] inline-flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> ${item.ocorrenciaText}</span>`
            : `<span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] inline-flex items-center gap-1"><i class="fa-solid fa-minus"></i> Nenhuma</span>`;

        tr.innerHTML = `
            <td class="py-3 px-4 font-mono text-slate-400">${item.id}</td>
            <td class="py-3 px-4 font-bold text-slate-800">${item.localizador}</td>
            <td class="py-3 px-4 text-center">${badgeContagem}</td>
            <td class="py-3 px-4 text-center">${badgeOcorrencia}</td>
        `;

        tbody.appendChild(tr);
    });
}

// UTILITÁRIO: Modal de Alerta Customizado (Evitando alert nativo)
function alertModal(msg) {
    const div = document.createElement('div');
    div.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    div.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
            <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl">
                <i class="fa-solid fa-circle-info"></i>
            </div>
            <h3 class="font-bold text-slate-800 text-base">Aviso do Sistema</h3>
            <p class="text-xs text-slate-600">${msg}</p>
            <button onclick="this.closest('.fixed').remove()" class="w-full py-2 bg-indigo-600 text-white font-semibold rounded-xl text-xs hover:bg-indigo-700 transition">Entendido</button>
        </div>
    `;
    document.body.appendChild(div);
}
