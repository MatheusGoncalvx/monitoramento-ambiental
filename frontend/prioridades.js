let ocorrencias = [];


// =====================================================
// NORMALIZA TEXTO
// =====================================================

function normalizar(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

}


// =====================================================
// NORMALIZA BIOMA
// =====================================================

function normalizarBioma(valor) {

  const texto = normalizar(valor);

  if (texto.includes("AMAZON")) {
    return "AMAZONIA";
  }

  if (texto.includes("CERRAD")) {
    return "CERRADO";
  }

  return texto;

}


// =====================================================
// CONVERTE VALOR DO FILTRO PARA O VALOR DA API
// =====================================================

function normalizarTipoFiltro(valor) {

  if (valor === "FOCO") {
    return "FOCO_CALOR";
  }

  return valor;

}


function normalizarPrioridadeFiltro(valor) {

  if (valor === "CRITICA") {
    return "CRITICA";
  }

  if (valor === "MEDIA") {
    return "MEDIA";
  }

  return valor;

}


// =====================================================
// CARREGA DADOS
// =====================================================


async function carregarPrioridades() {

  const botao = document.getElementById("btnAtualizar");
  const textoAtualizacao = document.getElementById("ultimaAtualizacao");

  if (botao) {
    botao.disabled = true;
    botao.textContent = "↻ Atualizando...";
    botao.classList.add("opacity-60", "cursor-not-allowed");
  }

  try {

    const resposta = await fetch("/api/ocorrencias");

    if (!resposta.ok) {
      throw new Error("Erro HTTP " + resposta.status);
    }

    ocorrencias = await resposta.json();

    atualizarTela();

    const agora = new Date();

    textoAtualizacao.textContent =
      "Última atualização: " +
      agora.toLocaleTimeString("pt-BR");

  } catch (erro) {

    console.error("Erro ao carregar prioridades:", erro);

    textoAtualizacao.textContent = "Erro ao atualizar dados.";

  } finally {

    if (botao) {
      botao.disabled = false;
      botao.textContent = "↻ Atualizar";
      botao.classList.remove("opacity-60", "cursor-not-allowed");
    }

  }

}


// =====================================================
// APLICA FILTROS
// =====================================================

function obterOcorrenciasFiltradas() {

  const filtroBioma =
    document.getElementById("filtroBioma").value;

  const filtroTipo =
    document.getElementById("filtroTipo").value;

  const filtroPrioridade =
    document.getElementById("filtroPrioridade").value;


  // ===================================================
  // NORMALIZA VALORES DOS FILTROS
  // ===================================================

  const biomaFiltroNormalizado =
    normalizarBioma(filtroBioma);


  const tipoFiltroNormalizado =
    normalizar(
      normalizarTipoFiltro(filtroTipo)
    );


  const prioridadeFiltroNormalizado =
    normalizar(
      normalizarPrioridadeFiltro(filtroPrioridade)
    );


  // ===================================================
  // FILTRA OCORRÊNCIAS
  // ===================================================

  return ocorrencias.filter(o => {

    const bioma =
      normalizarBioma(o.BIOMA);

    const tipo =
      normalizar(o.TIPO);

    const prioridade =
      normalizar(o.PRIORIDADE);


    // -----------------------------------------------
    // BIOMA
    // -----------------------------------------------

    const biomaOk =
      filtroBioma === "TODOS" ||
      bioma === biomaFiltroNormalizado;


    // -----------------------------------------------
    // TIPO
    // -----------------------------------------------

    const tipoOk =
      filtroTipo === "TODOS" ||
      tipo === tipoFiltroNormalizado;


    // -----------------------------------------------
    // PRIORIDADE
    // -----------------------------------------------

    const prioridadeOk =
      filtroPrioridade === "TODOS" ||
      prioridade === prioridadeFiltroNormalizado;


    return (
      biomaOk &&
      tipoOk &&
      prioridadeOk
    );

  });

}


// =====================================================
// ATUALIZA CARDS + TABELA
// =====================================================

function atualizarTela() {

  const filtradas =
    obterOcorrenciasFiltradas();


  // ===================================================
  // CONTAGEM DAS PRIORIDADES
  // ===================================================

  let criticas = 0;
  let altas = 0;
  let medias = 0;
  let baixas = 0;


  filtradas.forEach(o => {

    const prioridade =
      normalizar(o.PRIORIDADE);


    if (prioridade === "CRITICA") {
      criticas++;
    }

    else if (prioridade === "ALTA") {
      altas++;
    }

    else if (prioridade === "MEDIA") {
      medias++;
    }

    else if (prioridade === "BAIXA") {
      baixas++;
    }

  });


  // ===================================================
  // ATUALIZA CARDS
  // ===================================================

  document.getElementById("totalCriticas").textContent =
    criticas;

  document.getElementById("totalAltas").textContent =
    altas;

  document.getElementById("totalMedias").textContent =
    medias;

  document.getElementById("totalBaixas").textContent =
    baixas;


  // ===================================================
  // TABELA
  // ===================================================

  const tabela =
    document.getElementById("tabelaPrioridades");

  tabela.innerHTML = "";


  if (filtradas.length === 0) {

    tabela.innerHTML = `
      <tr>

        <td
          colspan="7"
          class="
            p-8
            text-center
            text-slate-500
          "
        >
          Nenhuma ocorrência encontrada
          com os filtros selecionados.
        </td>

      </tr>
    `;

    return;

  }


  filtradas.forEach(o => {

    const tr =
      document.createElement("tr");

    tr.className =
      "border-b border-slate-800 hover:bg-slate-800/50";


    const prioridade =
      o.PRIORIDADE || "—";


    tr.innerHTML = `

      <td class="p-3 font-semibold">
        ${prioridade}
      </td>

      <td class="p-3">
        ${o.TIPO || "—"}
      </td>

      <td class="p-3">
        ${o.BIOMA || "—"}
      </td>

      <td class="p-3">
        ${o.MUNICIPIO || "—"} / ${o.ESTADO || "—"}
      </td>

      <td class="p-3">
        ${o.LATITUDE ?? "—"}
      </td>

      <td class="p-3">
        ${o.LONGITUDE ?? "—"}
      </td>

      <td class="p-3 font-bold">
        ${o.SCORE ?? "—"}
      </td>

    `;


    tabela.appendChild(tr);

  });

}


// =====================================================
// EVENTOS DOS FILTROS
// =====================================================

document
  .getElementById("filtroBioma")
  .addEventListener(
    "change",
    atualizarTela
  );


document
  .getElementById("filtroTipo")
  .addEventListener(
    "change",
    atualizarTela
  );


document
  .getElementById("filtroPrioridade")
  .addEventListener(
    "change",
    atualizarTela
  );


// =====================================================
// BOTÃO DE ATUALIZAÇÃO MANUAL
// =====================================================

document
  .getElementById("btnAtualizar")
  .addEventListener("click", carregarPrioridades);
  

// =====================================================
// PRIMEIRA CARGA
// =====================================================

carregarPrioridades();


// =====================================================
// ATUALIZA A CADA 30 SEGUNDOS
// =====================================================

setInterval(
  carregarPrioridades,
  30000
);