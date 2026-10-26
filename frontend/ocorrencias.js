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

function normalizarStatus(valor) {
  const texto = normalizar(valor).replace(/\s+/g, "_");

  if (texto === "EM_ANDAMENTO") {
    return "EM ANDAMENTO";
  }

  if (
    texto === "RESOLVIDO" ||
    texto === "RESOLVIDA"
  ) {
    return "RESOLVIDO";
  }

  return texto;
}

// =====================================================
// NORMALIZA TIPO
// =====================================================

function normalizarTipo(valor) {

  const texto = normalizar(valor);

  if (texto === "FOCO" || texto === "FOCO_CALOR") {
    return "FOCO_CALOR";
  }

  if (texto === "DESMATAMENTO") {
    return "DESMATAMENTO";
  }

  return texto;

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
// NORMALIZA STATUS
// =====================================================

function formatarStatus(valor) {
  if (!valor) {
    return "Pendente";
  }

  const status = normalizarStatus(valor);

  if (status === "EM ANDAMENTO") {
    return "Em andamento";
  }

  if (status === "RESOLVIDO") {
    return "Resolvido";
  }

  return valor;
}


// =====================================================
// CARREGA DADOS
// =====================================================

async function carregarOcorrencias() {
  const botao = document.getElementById("btnAtualizar");

  try {
    if (botao) {
      botao.disabled = true;
      botao.textContent = "↻ Atualizando...";
      botao.classList.add("opacity-50", "cursor-wait");
    }

    const resposta = await fetch("/api/ocorrencias");

    if (!resposta.ok) {
      throw new Error("Erro HTTP " + resposta.status);
    }

    ocorrencias = await resposta.json();

    atualizarTela();

    document.getElementById("ultimaAtualizacao").textContent =
      "Última atualização: " +
      new Date().toLocaleTimeString("pt-BR");

  } catch (erro) {
    console.error("Erro ao carregar ocorrências:", erro);

    document.getElementById("contadorOcorrencias").textContent =
      "Erro ao carregar ocorrências.";

    document.getElementById("ultimaAtualizacao").textContent =
      "Falha na atualização.";

  } finally {
    if (botao) {
      botao.disabled = false;
      botao.textContent = "↻ Atualizar";
      botao.classList.remove("opacity-50", "cursor-wait");
    }
  }
}


// =====================================================
// OBTÉM OCORRÊNCIAS FILTRADAS
// =====================================================

function obterOcorrenciasFiltradas() {

  const filtroTipo =
    document
      .getElementById("filtroTipo")
      .value;


  const filtroBioma =
    document
      .getElementById("filtroBioma")
      .value;


  const filtroStatus =
    document
      .getElementById("filtroStatus")
      .value;

      const busca =
    document
      .getElementById("buscaOcorrencia")
      .value
      .trim()
      .toLowerCase();

  return ocorrencias.filter(o => {


    const tipo =
      normalizarTipo(o.TIPO);


    const bioma =
      normalizarBioma(o.BIOMA);


    const status =
      normalizarStatus(o.STATUS);


    const tipoOk =
      filtroTipo === "TODOS" ||
      tipo === normalizarTipo(filtroTipo);


    const biomaOk =
      filtroBioma === "TODOS" ||
      bioma === normalizarBioma(filtroBioma);


    const statusOk =
      filtroStatus === "TODOS" ||
      status === normalizarStatus(filtroStatus);

      const buscaOK =
      busca === "" ||
      String(o.ID ?? "")
        .toLowerCase()
        .includes(busca);

    return (
      tipoOk &&
      biomaOk &&
      statusOk &&
      buscaOK
    );

  });

}


// =====================================================
// FORMATA DATA
// =====================================================

function formatarData(valor) {

  if (!valor) {
    return "—";
  }


  const data =
    new Date(valor);


  if (Number.isNaN(data.getTime())) {
    return valor;
  }


  return data.toLocaleString(
    "pt-BR"
  );

}


// =====================================================
// FORMATA TIPO
// =====================================================

function formatarTipo(valor) {

  const tipo =
    normalizarTipo(valor);


  if (tipo === "FOCO_CALOR") {
    return "Foco de calor";
  }


  if (tipo === "DESMATAMENTO") {
    return "Desmatamento";
  }


  return valor || "—";

}


// =====================================================
// FORMATA STATUS
// =====================================================


// =====================================================
// LOCALIZAÇÃO
// =====================================================

function obterLocalizacao(o) {

  const municipio =
    o.MUNICIPIO || "";


  const estado =
    o.ESTADO || "";


  const bioma =
    o.BIOMA || "";


  const partes = [];


  if (municipio) {
    partes.push(municipio);
  }


  if (estado) {
    partes.push(estado);
  }


  if (bioma) {
    partes.push(bioma);
  }


  if (partes.length > 0) {
    return partes.join(" / ");
  }


  if (
    o.LATITUDE != null &&
    o.LONGITUDE != null
  ) {

    return (
      o.LATITUDE +
      ", " +
      o.LONGITUDE
    );

  }


  return "—";

}


// =====================================================
// ATUALIZA TELA
// =====================================================

function atualizarTela() {

  const filtradas =
    obterOcorrenciasFiltradas();


  const tabela =
    document.getElementById(
      "tabelaOcorrencias"
    );


  tabela.innerHTML = "";


  document
    .getElementById("contadorOcorrencias")
    .textContent =
      filtradas.length +
      (
        filtradas.length === 1
          ? " ocorrência"
          : " ocorrências"
      );


  if (filtradas.length === 0) {

    tabela.innerHTML = `

      <tr>

        <td
          colspan="5"
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


    const status = normalizarStatus(o.STATUS);

let classeStatus = "text-slate-300";

if (status === "EM ANDAMENTO") {
  classeStatus = "text-blue-400";
} else if (status === "RESOLVIDO") {
  classeStatus = "text-green-400";
} else {
  classeStatus = "text-yellow-400";
}


    tr.innerHTML = `

      <td class="p-4 font-semibold">
        ${o.ID ?? "—"}
      </td>

      <td class="p-4">
        ${formatarTipo(o.TIPO)}
      </td>

      <td class="p-4">
        ${obterLocalizacao(o)}
      </td>

      <td class="p-4">
        ${formatarData(
          o.DATA_OCORRENCIA ||
          o.DATA ||
          o.DATA_HORA
        )}
      </td>

      <td
        class="
          p-4
          font-semibold
          ${classeStatus}
        "
      >
        ${formatarStatus(o.STATUS)}
      </td>

    `;


    tabela.appendChild(tr);

  });

}


// =====================================================
// EXPORTA PARA EXCEL
// =====================================================

function baixarExcel() {

  const filtradas =
    obterOcorrenciasFiltradas();


  if (filtradas.length === 0) {

    alert(
      "Não há ocorrências para exportar."
    );

    return;

  }


  const dadosExcel =
    filtradas.map(o => ({

      ID:
        o.ID ?? "",

      "Tipo de ocorrência":
        formatarTipo(o.TIPO),

      "Localização":
        obterLocalizacao(o),

      "Data da ocorrência":
        formatarData(
          o.DATA_OCORRENCIA ||
          o.DATA ||
          o.DATA_HORA
        ),

      Status:
        formatarStatus(o.STATUS)

    }));


  const planilha =
    XLSX.utils.json_to_sheet(
      dadosExcel
    );


  planilha["!cols"] = [

    { wch: 12 },

    { wch: 25 },

    { wch: 35 },

    { wch: 22 },

    { wch: 18 }

  ];


  const livro =
    XLSX.utils.book_new();


  XLSX.utils.book_append_sheet(
    livro,
    planilha,
    "Ocorrências"
  );


  const data =
    new Date()
      .toISOString()
      .slice(0, 10);


  XLSX.writeFile(
    livro,
    `ocorrencias_${data}.xlsx`
  );

}


// =====================================================
// EVENTOS DOS FILTROS
// =====================================================

document
  .getElementById("buscaOcorrencia")
  .addEventListener("input", atualizarTela);

document
  .getElementById("filtroTipo")
  .addEventListener(
    "change",
    atualizarTela
  );


document
  .getElementById("filtroBioma")
  .addEventListener(
    "change",
    atualizarTela
  );


document
  .getElementById("filtroStatus")
  .addEventListener(
    "change",
    atualizarTela
  );


// =====================================================
// BOTÃO EXCEL
// =====================================================

document
  .getElementById("btnExcel")
  .addEventListener(
    "click",
    baixarExcel
  );

document
  .getElementById("btnExcel")
  .addEventListener(
    "click",
    baixarExcel
  );

// =====================================================
// PRIMEIRA CARGA
// =====================================================

carregarOcorrencias();


// =====================================================
// ATUALIZA A CADA 30 SEGUNDOS
// =====================================================

setInterval(
  carregarOcorrencias,
  30000
);