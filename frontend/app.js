const mapa = L.map("map").setView([-10, -55], 4);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18
  }
).addTo(mapa);


/* =========================================================
   BASE DE FISCALIZAÇÃO
   Referência: unidade do IBAMA em Alta Floresta/MT
   ========================================================= */

const BASE = {
  nome: "Base de Fiscalização - IBAMA Alta Floresta/MT",

  // Coordenadas de referência da cidade de Alta Floresta/MT
  latitude: -9.8756,
  longitude: -56.0861
};


/* =========================================================
   MARCADOR DA BASE
   ========================================================= */

const iconeBase = L.divIcon({
  className: "",
  html: `
    <div style="
      font-size: 30px;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border-radius: 50%;
      border: 3px solid #2563eb;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    ">
      🏢
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});


const marcadorBase = L.marker(
  [BASE.latitude, BASE.longitude],
  {
    icon: iconeBase,
    zIndexOffset: 1000
  }
).addTo(mapa);


marcadorBase.bindPopup(`
  <div style="min-width: 220px">
    <strong style="font-size: 15px;">
      🏢 Base de Fiscalização
    </strong>

    <hr style="margin: 6px 0;">

    <b>Unidade:</b><br>
    IBAMA Alta Floresta/MT<br><br>

    <b>Latitude:</b>
    ${BASE.latitude.toFixed(5)}<br>

    <b>Longitude:</b>
    ${BASE.longitude.toFixed(5)}
  </div>
`);


/* =========================================================
   VARIÁVEIS DO MAPA
   ========================================================= */

let marcadores = [];
let todasOcorrencias = [];

// Linha entre a base e a ocorrência selecionada
let linhaRota = null;

/* =========================================================
   GRÁFICO DE OCORRÊNCIAS POR DIA
   ========================================================= */

let graficoOcorrencias = null;

function obterDataOcorrencia(o) {
  const valor =
    o.DATA_OCORRENCIA ||
    o.DATA ||
    o.DATA_HORA;

  if (!valor) return null;

  const texto = String(valor);
  const encontrada = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (encontrada) {
    return `${encontrada[1]}-${encontrada[2]}-${encontrada[3]}`;
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return null;

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function atualizarGrafico(ocorrenciasFiltradas) {
  const canvas = document.getElementById("graficoOcorrencias");

  if (!canvas || typeof Chart === "undefined") return;

  const contagem = {};

  ocorrenciasFiltradas.forEach(o => {
    const data = obterDataOcorrencia(o);

    if (!data) return;

    contagem[data] = (contagem[data] || 0) + 1;
  });

  const datasDisponiveis = Object.keys(contagem).sort();

  const ultimaData = datasDisponiveis.length
    ? new Date(`${datasDisponiveis[datasDisponiveis.length - 1]}T12:00:00`)
    : new Date();

  const datas = [];

  for (let i = 13; i >= 0; i--) {
    const data = new Date(ultimaData);
    data.setDate(data.getDate() - i);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    datas.push(`${ano}-${mes}-${dia}`);
  }

  const rotulos = datas.map(data => {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}`;
  });

  const valores = datas.map(data => contagem[data] || 0);

  if (graficoOcorrencias) {
    graficoOcorrencias.data.labels = rotulos;
    graficoOcorrencias.data.datasets[0].data = valores;
    graficoOcorrencias.update();
    return;
  }

  graficoOcorrencias = new Chart(canvas, {
    type: "line",
    data: {
      labels: rotulos,
      datasets: [{
        label: "Ocorrências",
        data: valores,
        borderColor: "#34d399",
        backgroundColor: "rgba(52, 211, 153, 0.12)",
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#34d399",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#cbd5e1"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.10)" }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#94a3b8",
            precision: 0
          },
          grid: { color: "rgba(148, 163, 184, 0.10)" }
        }
      }
    }
  });
}


/* =========================================================
   RESUMO
   ========================================================= */


function carregarResumo() {
  // Usa todas as ocorrências ativas, sem o limite de marcadores do mapa.
  const filtroBioma = document.getElementById("filtroBioma").value;
  const filtroTipo = document.getElementById("filtroTipo").value;

  const filtradas = todasOcorrencias.filter(o => {
    const biomaOk =
      filtroBioma === "TODOS" ||
      String(o.BIOMA || "").trim().toUpperCase() === filtroBioma;

    const tipoOk =
      filtroTipo === "TODOS" ||
      String(o.TIPO || "").trim().toUpperCase() === filtroTipo;

    return biomaOk && tipoOk;
  });

  document.getElementById("total").textContent = filtradas.length;

  document.getElementById("focos").textContent =
    filtradas.filter(o =>
      String(o.TIPO || "").trim().toUpperCase() === "FOCO_CALOR"
    ).length;

  document.getElementById("desmatamento").textContent =
    filtradas.filter(o =>
      String(o.TIPO || "").trim().toUpperCase() === "DESMATAMENTO"
    ).length;

  document.getElementById("criticas").textContent =
    filtradas.filter(o =>
      String(o.PRIORIDADE || "").trim().toUpperCase() === "CRÍTICA"
    ).length;

    atualizarGrafico(filtradas);
}


/* =========================================================
   CORES DE PRIORIDADE
   ========================================================= */

function corPrioridade(nivel) {
  if (nivel === "CRÍTICA") return "#ef4444";
  if (nivel === "ALTA") return "#f97316";
  if (nivel === "MÉDIA") return "#eab308";

  return "#22c55e";
}


/* =========================================================
   TIPO DE OCORRÊNCIA
   ========================================================= */

function iconeTipo(tipo) {
  if (tipo === "FOCO_CALOR") return "🔥";
  if (tipo === "DESMATAMENTO") return "🌳";

  return "📍";
}


function nomeTipo(tipo) {
  if (tipo === "FOCO_CALOR") {
    return "Foco de calor";
  }

  if (tipo === "DESMATAMENTO") {
    return "Desmatamento";
  }

  return tipo || "Ocorrência";
}


/* =========================================================
   CÁLCULO DA DISTÂNCIA
   Fórmula de Haversine
   Resultado em quilômetros
   ========================================================= */

function calcularDistanciaKm(lat1, lon1, lat2, lon2) {

  const R = 6371;

  const dLat =
    (lat2 - lat1) * Math.PI / 180;

  const dLon =
    (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}


/* =========================================================
   DESENHA A LINHA DA BASE ATÉ A OCORRÊNCIA
   ========================================================= */

function mostrarRotaParaOcorrencia(o) {

  if (
    o.LATITUDE == null ||
    o.LONGITUDE == null
  ) {
    return null;
  }

  const distancia = calcularDistanciaKm(
    BASE.latitude,
    BASE.longitude,
    Number(o.LATITUDE),
    Number(o.LONGITUDE)
  );


  // Remove a linha anterior
  if (linhaRota) {
    mapa.removeLayer(linhaRota);
  }


  // Cria a nova linha
  linhaRota = L.polyline(
    [
      [BASE.latitude, BASE.longitude],
      [Number(o.LATITUDE), Number(o.LONGITUDE)]
    ],
    {
      color: "#2563eb",
      weight: 4,
      opacity: 0.85,
      dashArray: "10, 8"
    }
  ).addTo(mapa);


  // Coloca a distância no meio da linha
  linhaRota.bindTooltip(
    `🏢 ${distancia.toFixed(1)} km`,
    {
      permanent: true,
      direction: "center",
      className: "distancia-rota"
    }
  );


  return distancia;
}


/* =========================================================
   COLOCA OCORRÊNCIA EM ANDAMENTO
   ========================================================= */

async function colocarEmAndamento(id) {

  try {

    const resposta = await fetch(
      `/api/ocorrencias/${id}/andamento`,
      {
        method: "PUT"
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Erro ao atualizar ocorrência"
      );
    }

    /*
     * Atualiza o status na ocorrência que já está
     * carregada no navegador.
     */
    const ocorrencia =
      todasOcorrencias.find(
        item => Number(item.ID) === Number(id)
      );

    if (ocorrencia) {
      ocorrencia.STATUS = "EM ANDAMENTO";
    }

    /*
     * Recarrega o dashboard para garantir que
     * o estado venha novamente do banco.
     */
    await atualizarDashboard();

  } catch (erro) {

    console.error(
      "Erro ao colocar ocorrência em andamento:",
      erro
    );

    alert(
      "Não foi possível encaminhar a ocorrência."
    );
  }
}


/* =========================================================
   CRIA MARCADOR DA OCORRÊNCIA
   ========================================================= */

function criarMarcador(o) {

  const emoji = iconeTipo(o.TIPO);


  const marcador = L.marker(
    [o.LATITUDE, o.LONGITUDE],
    {
      icon: L.divIcon({
        className: "",

        html: `
          <div style="
            font-size: 22px;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${emoji}
          </div>
        `,

        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }
  ).addTo(mapa);


  /* =======================================================
     CLIQUE NA OCORRÊNCIA
     ======================================================= */

  marcador.on("click", function() {

    const distancia = mostrarRotaParaOcorrencia(o);


    marcador.bindPopup(`
      <div style="min-width: 220px">

        <strong style="font-size: 15px;">
          ${iconeTipo(o.TIPO)}
          ${nomeTipo(o.TIPO)}
        </strong>

        <hr style="margin: 6px 0;">

        <b>Bioma:</b>
        ${o.BIOMA || "-"}<br>

        <b>Local:</b>
        ${o.MUNICIPIO || "-"} /
        ${o.ESTADO || "-"}<br>

        <b>Latitude:</b>
        ${o.LATITUDE != null
          ? Number(o.LATITUDE).toFixed(5)
          : "-"}<br>

        <b>Longitude:</b>
        ${o.LONGITUDE != null
          ? Number(o.LONGITUDE).toFixed(5)
          : "-"}<br>

        <b>Score:</b>
        ${o.SCORE || 0}<br>

        <b>Prioridade:</b>

        <span style="
          color: ${corPrioridade(o.PRIORIDADE)};
          font-weight: bold;
        ">
          ${o.PRIORIDADE || "-"}
        </span>

        <hr style="margin: 8px 0;">

        <div style="
          background: #eff6ff;
          border-radius: 6px;
          padding: 8px;
          margin-top: 6px;
        ">

          <b>🏢 Distância da base</b><br>

          <span style="
            font-size: 17px;
            color: #2563eb;
            font-weight: bold;
          ">
            ${distancia != null
              ? distancia.toFixed(2) + " km"
              : "-"}
          </span>

        </div>

        ${String(o.STATUS || "").toUpperCase() === "EM ANDAMENTO"
  ? `
    <button
      disabled
      style="
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
        padding: 10px 12px;
        background: #16a34a;
        color: white;
        text-align: center;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        font-size: 14px;
        cursor: default;
      "
    >
      🟢 EM ANDAMENTO
    </button>
  `
  : `
    <button
      onclick="colocarEmAndamento(${Number(o.ID)})"
      style="
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
        padding: 10px 12px;
        background: #2563eb;
        color: white;
        text-align: center;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
      "
    >
      🔎 Avaliar ocorrência
    </button>
  `
}

      </div>
    `).openPopup();

  });


  return marcador;
}


/* =========================================================
   CARREGA OCORRÊNCIAS
   ========================================================= */

async function carregarOcorrencias() {
  const resposta = await fetch("/api/ocorrencias", {
    cache: "no-store"
  });

  if (!resposta.ok) {
    throw new Error("Erro ao carregar ocorrências");
  }

  const dados = await resposta.json();

  todasOcorrencias = dados.filter(o =>
    String(o.STATUS || "").trim().toUpperCase() !== "RESOLVIDO"
  );

  aplicarFiltros();
}


/* =========================================================
   FILTROS
   ========================================================= */

function aplicarFiltros() {

  const filtroBioma =
    document.getElementById("filtroBioma").value;

  const filtroTipo =
    document.getElementById("filtroTipo").value;


  const ocorrenciasFiltradas =
    todasOcorrencias.filter(o => {

      const biomaOk =
        filtroBioma === "TODOS" ||
        String(o.BIOMA || "").toUpperCase() === filtroBioma;


      const tipoOk =
        filtroTipo === "TODOS" ||
        String(o.TIPO || "").toUpperCase() === filtroTipo;


      return biomaOk && tipoOk;

    });
    
    carregarResumo();


  /* Remove marcadores antigos */

  marcadores.forEach(
    m => mapa.removeLayer(m)
  );

  marcadores = [];


  /* Remove a rota quando os dados são atualizados */

  if (linhaRota) {
    mapa.removeLayer(linhaRota);
    linhaRota = null;
  }


  /*
     Limita o mapa a no máximo:
     1.000 focos de calor
     1.000 desmatamentos

     Assim, quando "TODOS" estiver selecionado,
     os dois tipos terão espaço no mapa.
  */

  let ocorrenciasMapa = [];


  if (filtroTipo === "TODOS") {

    const focos =
      ocorrenciasFiltradas
        .filter(o =>
          String(o.TIPO || "").toUpperCase() === "FOCO_CALOR"
        )
        .sort((a, b) =>
          (Number(b.SCORE) || 0) -
          (Number(a.SCORE) || 0)
        )
        .slice(0, 1000);


    const desmatamentos =
      ocorrenciasFiltradas
        .filter(o =>
          String(o.TIPO || "").toUpperCase() === "DESMATAMENTO"
        )
        .sort((a, b) =>
          (Number(b.SCORE) || 0) -
          (Number(a.SCORE) || 0)
        )
        .slice(0, 1000);


    ocorrenciasMapa = [
      ...focos,
      ...desmatamentos
    ];

  } else {

    /*
       Quando o usuário escolher apenas um tipo,
       mostra os 1.000 maiores scores daquele tipo.
    */

    ocorrenciasMapa =
      [...ocorrenciasFiltradas]
        .sort((a, b) =>
          (Number(b.SCORE) || 0) -
          (Number(a.SCORE) || 0)
        )
        .slice(0, 1000);
  }


  /* Cria os marcadores somente das ocorrências selecionadas */

  ocorrenciasMapa.forEach(o => {

    if (
      o.LATITUDE != null &&
      o.LONGITUDE != null
    ) {

      const marcador =
        criarMarcador(o);

      marcadores.push(marcador);
    }

  });
}


/* =========================================================
   STATUS
   ========================================================= */

async function carregarStatus() {

  const resposta =
    await fetch("/api/status");

  const dados =
    await resposta.json();


  document.getElementById("status").textContent =
    dados.status === "ok"
      ? "● INPE/DETER sincronizados"
      : `● ${dados.status}`;


  document.getElementById("hora").textContent =
    dados.ultimaSincronizacao
      ? `Última atualização: ${
          new Date(
            dados.ultimaSincronizacao
          ).toLocaleString("pt-BR")
        }`
      : "Aguardando atualização";
}


/* =========================================================
   ATUALIZAÇÃO DO DASHBOARD
   ========================================================= */

async function atualizarDashboard() {

  try {

    await Promise.all([
      carregarResumo(),
      carregarOcorrencias(),
      carregarStatus()
    ]);

  } catch (erro) {

    console.error(
      "Erro no dashboard:",
      erro
    );

  }
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

atualizarDashboard();


/* Atualização automática a cada 30 segundos */

setInterval(
  atualizarDashboard,
  30000
);