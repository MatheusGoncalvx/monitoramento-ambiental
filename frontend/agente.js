
const listaOcorrencias = document.getElementById("listaOcorrencias");
const mensagem = document.getElementById("mensagem");
const busca = document.getElementById("busca");

let ocorrencias = [];
let totalResolvidasSessao = 0;

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caractere]);
}

function formatarData(valor) {
  if (!valor) return "Não informada";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return String(valor);
  }

  return data.toLocaleString("pt-BR");
}

function corPrioridade(prioridade) {
  const nivel = normalizar(prioridade);

  if (nivel === "CRITICA") return "bg-red-100 text-red-700";
  if (nivel === "ALTA") return "bg-orange-100 text-orange-700";
  if (nivel === "MEDIA") return "bg-yellow-100 text-yellow-700";

  return "bg-slate-100 text-slate-700";
}

function atualizarIndicadores() {
  document.getElementById("totalAndamento").textContent =
    ocorrencias.length;

  document.getElementById("totalCriticas").textContent =
    ocorrencias.filter(o =>
      normalizar(o.PRIORIDADE) === "CRITICA"
    ).length;

  document.getElementById("totalResolvidas").textContent =
    totalResolvidasSessao;
}

function criarCartao(o) {
  const cartao = document.createElement("article");

  cartao.className =
    "ocorrencia bg-white rounded-xl shadow-sm border border-slate-200 p-5";

  const prioridadeClasse = corPrioridade(o.PRIORIDADE);

  cartao.innerHTML = `
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <p class="text-xs text-slate-500">Ocorrência #${escapar(o.ID)}</p>
        <h3 class="text-lg font-bold text-slate-800 mt-1">
          ${escapar(o.TIPO || "Ocorrência ambiental")}
        </h3>
      </div>

      <span class="text-xs font-bold px-3 py-1 rounded-full ${prioridadeClasse}">
        ${escapar(o.PRIORIDADE || "SEM PRIORIDADE")}
      </span>
    </div>

    <div class="space-y-2 text-sm text-slate-600">
      <p><strong>Bioma:</strong> ${escapar(o.BIOMA || "Não informado")}</p>
      <p><strong>Estado:</strong> ${escapar(o.ESTADO || "Não informado")}</p>
      <p><strong>Município:</strong> ${escapar(o.MUNICIPIO || "Não informado")}</p>
      <p><strong>Data:</strong> ${escapar(formatarData(o.DATA_HORA))}</p>
      <p><strong>Satélite/fonte:</strong> ${escapar(o.SATELITE || "Não informado")}</p>
      <p><strong>Score:</strong> ${escapar(o.SCORE ?? "Não informado")}</p>
      <p><strong>Latitude:</strong> ${escapar(o.LATITUDE ?? "Não informada")}</p>
      <p><strong>Longitude:</strong> ${escapar(o.LONGITUDE ?? "Não informada")}</p>
    </div>

    <div class="mt-5 pt-4 border-t border-slate-100">
      <p class="text-sm font-semibold text-blue-700 mb-3">
        ● EM ANDAMENTO
      </p>

      <button
        type="button"
        data-resolver="${escapar(o.ID)}"
        class="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg px-4 py-3"
      >
        ✓ Resolver ocorrência
      </button>
    </div>
  `;

  return cartao;
}

function renderizarOcorrencias() {
  const termo = normalizar(busca.value);

  const filtradas = ocorrencias.filter(o => {
    const conteudo = normalizar([
      o.ID,
      o.TIPO,
      o.BIOMA,
      o.ESTADO,
      o.MUNICIPIO,
      o.PRIORIDADE
    ].join(" "));

    return conteudo.includes(termo);
  });

  listaOcorrencias.replaceChildren();

  if (filtradas.length === 0) {
    mensagem.textContent = ocorrencias.length === 0
      ? "Nenhuma ocorrência em andamento no momento."
      : "Nenhuma ocorrência corresponde à sua busca.";

    return;
  }

  mensagem.textContent =
    `${filtradas.length} ocorrência(s) encontrada(s).`;

  const fragmento = document.createDocumentFragment();

  filtradas.forEach(o => {
    fragmento.appendChild(criarCartao(o));
  });

  listaOcorrencias.appendChild(fragmento);
}

async function carregarOcorrencias() {
  mensagem.textContent = "Carregando ocorrências...";
  listaOcorrencias.replaceChildren();

  try {
    const resposta = await fetch("/api/ocorrencias", {
      cache: "no-store"
    });

    if (!resposta.ok) {
      throw new Error("Não foi possível consultar as ocorrências.");
    }

    const dados = await resposta.json();

    if (!Array.isArray(dados)) {
      throw new Error("A API retornou um formato inesperado.");
    }

    ocorrencias = dados.filter(o =>
      normalizar(o.STATUS) === "EM ANDAMENTO"
    );

    atualizarIndicadores();
    renderizarOcorrencias();

  } catch (erro) {
    console.error("Erro ao carregar ocorrências:", erro);

    mensagem.textContent =
      "Erro ao carregar ocorrências. Verifique a conexão com o servidor.";

    listaOcorrencias.replaceChildren();
  }
}

async function resolverOcorrencia(id) {
  const confirmado = window.confirm(
    `Confirma a resolução da ocorrência #${id}?\n\n` +
    "O status será alterado para RESOLVIDO."
  );

  if (!confirmado) return;

  try {
    const resposta = await fetch(
      `/api/ocorrencias/${encodeURIComponent(id)}/resolver`,
      {
        method: "PUT"
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Não foi possível resolver a ocorrência."
      );
    }

    totalResolvidasSessao++;

    await carregarOcorrencias();

    mensagem.textContent =
      `Ocorrência #${id} resolvida com sucesso.`;

  } catch (erro) {
    console.error("Erro ao resolver ocorrência:", erro);

    window.alert(
      erro.message || "Erro ao resolver ocorrência."
    );
  }
}

listaOcorrencias.addEventListener("click", evento => {
  const botao = evento.target.closest("[data-resolver]");

  if (!botao) return;

  resolverOcorrencia(botao.dataset.resolver);
});

busca.addEventListener("input", renderizarOcorrencias);

document.getElementById("atualizar").addEventListener(
  "click",
  carregarOcorrencias
);

carregarOcorrencias();