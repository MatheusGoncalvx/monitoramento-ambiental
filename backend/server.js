import express from "express";
import mysql from "mysql2/promise";
import { parse } from "csv-parse/sync";

const app = express();

app.use(express.json());
app.use(express.static("frontend"));

// -------------------------
// CONFIGURAÇÕES
// -------------------------

const PORT = 3000;

const INTERVALO =
  Number(process.env.SYNC_MINUTES || 10) * 60 * 1000;

const MYSQL = {
  host: process.env.MYSQL_HOST || "mysql",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE || "monitor_ambiental",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z"
};

const pool = mysql.createPool(MYSQL);

const DETER_WFS =
  process.env.DETER_WFS ||
  "https://terrabrasilis.dpi.inpe.br/geoserver/ows";

let ultimaSincronizacao = null;
let statusSync = "iniciando";
let erroSync = null;

// -------------------------
// CONEXÃO COM MYSQL
// -------------------------

async function banco(fn) {
  const conexao = await pool.getConnection();

  try {
    return await fn(conexao);
  } finally {
    conexao.release();
  }
}

// -------------------------
// DATAS
// -------------------------

function dataBrasilia(deslocamentoDias = 0) {
  const agora = new Date();

  const brasilia = new Date(
    agora.toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo"
    })
  );

  brasilia.setDate(
    brasilia.getDate() + deslocamentoDias
  );

  const ano = brasilia.getFullYear();
  const mes = String(brasilia.getMonth() + 1).padStart(2, "0");
  const dia = String(brasilia.getDate()).padStart(2, "0");

  return `${ano}${mes}${dia}`;
}

function urlINPEDiario(data) {
  return (
    "https://dataserver-coids.inpe.br" +
    "/queimadas/queimadas" +
    "/focos/csv/diario/Brasil/" +
    `focos_diario_br_${data}.csv`
  );
}

function dataINPE(valor) {
  // O INPE normalmente fornece YYYY/MM/DD HH:mm:ss.
  const m = String(valor || "").match(
    /(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );

  if (!m) return null;

  return new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    )
  );
}

function dataValida(valor) {
  if (!valor) return null;

  const data = valor instanceof Date
    ? valor
    : new Date(valor);

  return Number.isNaN(data.getTime()) ? null : data;
}

// -------------------------
// FUNÇÕES DE CONVERSÃO
// -------------------------

function numero(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const n = Number(
    String(valor).replace(",", ".")
  );

  return Number.isFinite(n) ? n : null;
}

// -------------------------
// CÁLCULO DA PRIORIDADE
// -------------------------
// Esta pontuação é uma regra do projeto.
// Não é um score oficial do INPE.

function prioridade({ risco, frp, data, bioma }) {
  let riscoScore = numero(risco);

  if (riscoScore !== null) {
    riscoScore = Math.min(100, riscoScore * 100);
  } else {
    riscoScore = frp
      ? Math.min(100, Math.log10(frp + 1) * 35)
      : 30;
  }

  const dataOcorrencia = dataValida(data);

  const horas = dataOcorrencia
    ? Math.max(
        0,
        Date.now() - dataOcorrencia.getTime()
      ) / 3600000
    : Infinity;

  let recencia = 20;

  if (horas <= 2) recencia = 100;
  else if (horas <= 6) recencia = 85;
  else if (horas <= 12) recencia = 70;
  else if (horas <= 24) recencia = 55;

  const sensibilidade = String(bioma || "")
    .toUpperCase()
    .includes("AMAZ")
      ? 100
      : 85;

  const score =
    riscoScore * 0.50 +
    recencia * 0.30 +
    sensibilidade * 0.20;

  let nivel = "BAIXA";

  if (score >= 80) nivel = "CRÍTICA";
  else if (score >= 60) nivel = "ALTA";
  else if (score >= 35) nivel = "MÉDIA";

  return {
    riscoScore: Number(riscoScore.toFixed(2)),
    recencia: Number(recencia.toFixed(2)),
    sensibilidade,
    score: Number(score.toFixed(2)),
    nivel
  };
}

// -------------------------
// BUSCA INPE - FOCOS
// -------------------------

async function buscarINPE() {
  const datas = [
    dataBrasilia(0),
    dataBrasilia(-1)
  ];

  let ultimoErro = null;

  for (const dataArquivo of datas) {
    const url = urlINPEDiario(dataArquivo);

    console.log("Buscando focos INPE:", url);

    try {
      const resposta = await fetch(url);

      if (!resposta.ok) {
        console.log(
          `Arquivo INPE não disponível: HTTP ${resposta.status} (${dataArquivo})`
        );

        ultimoErro = new Error(
          `INPE respondeu HTTP ${resposta.status} para ${url}`
        );

        continue;
      }

      const csv = await resposta.text();

      if (!csv.trim()) {
        console.log(`Arquivo INPE vazio: ${dataArquivo}`);

        ultimoErro = new Error(
          `Arquivo INPE vazio: ${url}`
        );

        continue;
      }

      const linhas = parse(csv, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true
      });

      console.log(
        `INPE: ${linhas.length} registros encontrados no arquivo ${dataArquivo}.`
      );

      const resultado = linhas
        .map(linha => {
          const r = {};

          for (const [chave, valor] of Object.entries(linha)) {
            r[String(chave).trim().toUpperCase()] =
              typeof valor === "string"
                ? valor.trim()
                : valor;
          }

          const latitude = numero(r.LAT);
          const longitude = numero(r.LON);
          const data = dataINPE(r.DATA_HORA_GMT);

          return {
            tipo: "FOCO_CALOR",
            bioma: r.BIOMA,
            estado: r.ESTADO,
            municipio: r.MUNICIPIO,
            latitude,
            longitude,
            data,
            satelite: r.SATELITE,
            risco: numero(r.RISCO_FOGO),
            frp: numero(r.FRP),
            chave: `INPE|${r.DATA_HORA_GMT}|${r.LAT}|${r.LON}|${r.SATELITE}`
          };
        })
        .filter(r => {
          const bioma = String(r.bioma || "")
            .trim()
            .toLowerCase();

          return (
            r.latitude !== null &&
            r.longitude !== null &&
            r.data !== null &&
            (bioma === "amazônia" || bioma === "cerrado")
          );
        });

      console.log(
        `INPE: ${resultado.length} focos de Amazônia/Cerrado após filtro.`
      );

      return resultado;
    } catch (erro) {
      console.error(
        `Erro ao buscar arquivo INPE ${dataArquivo}:`,
        erro.message
      );

      ultimoErro = erro;
    }
  }

  throw (
    ultimoErro ||
    new Error("Não foi possível obter dados do INPE.")
  );
}

// -------------------------
// BUSCA DETER - WFS
// -------------------------

async function buscarCamadaDETER() {
  const url =
    `${DETER_WFS}?service=WFS&version=1.0.0&request=GetCapabilities`;

  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error(
      "Não foi possível acessar o WFS do DETER."
    );
  }

  const xml = await resposta.text();

  const nomes = [
    ...xml.matchAll(/<Name>([^<]+)<\/Name>/gi)
  ]
    .map(m => m[1])
    .filter(n => /deter/i.test(n));

  return nomes[0] || null;
}

async function buscarDETER() {
  const camada = await buscarCamadaDETER();

  if (!camada) {
    console.log(
      "Nenhuma camada DETER pública foi encontrada no WFS."
    );

    return [];
  }

  const url =
    `${DETER_WFS}?service=WFS&version=1.0.0&request=GetFeature` +
    `&typeName=${encodeURIComponent(camada)}` +
    `&outputFormat=application/json` +
    `&maxFeatures=1000`;

  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error(
      "Não foi possível ler a camada DETER."
    );
  }

  const geojson = await resposta.json();

  return (geojson.features || [])
    .map(f => {
      const p = f.properties || {};
      const g = f.geometry;

      let coordenadas;

      if (g?.type === "Point") {
        coordenadas = g.coordinates;
      } else if (g?.type === "Polygon") {
        coordenadas = g.coordinates?.[0]?.[0];
      } else if (g?.type === "MultiPolygon") {
        coordenadas = g.coordinates?.[0]?.[0]?.[0];
      }

      if (!coordenadas) return null;

      const [longitude, latitude] = coordenadas;

      const bioma =
        p.BIOMA ||
        p.bioma ||
        "Amazônia";

      if (!/amaz[oô]nia|cerrado/i.test(String(bioma))) {
        return null;
      }

      const data =
        p.DATA ||
        p.data ||
        p.DATA_ALERTA ||
        p.data_alerta ||
        new Date();

      const dataConvertida = dataValida(data);

      if (
        !Number.isFinite(Number(latitude)) ||
        !Number.isFinite(Number(longitude)) ||
        !dataConvertida
      ) {
        return null;
      }

      return {
        tipo: "DESMATAMENTO",
        bioma,
        estado:
          p.ESTADO ||
          p.estado ||
          p.UF ||
          "",
        municipio:
          p.MUNICIPIO ||
          p.municipio ||
          "",
        latitude: Number(latitude),
        longitude: Number(longitude),
        data: dataConvertida,
        satelite: "DETER",
        risco: null,
        frp: null,
        chave: `DETER|${f.id || JSON.stringify(p).slice(0, 100)}|${latitude}|${longitude}`
      };
    })
    .filter(Boolean);
}

// -------------------------
// SALVA UMA OCORRÊNCIA
// -------------------------

async function salvarOcorrencia(c, r, fonteId) {
  const p = prioridade(r);
  const dataOcorrencia = dataValida(r.data);

  // MySQL: insere a ocorrência ou atualiza o score
  // quando a CHAVE única já existe.
  const [resultado] = await c.execute(
    `
    INSERT INTO OCORRENCIA (
      FONTE_ID,
      TIPO,
      BIOMA,
      ESTADO,
      MUNICIPIO,
      LATITUDE,
      LONGITUDE,
      DATA_HORA,
      SATELITE,
      RISCO_FOGO,
      FRP,
      SCORE,
      PRIORIDADE,
      CHAVE
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ID = LAST_INSERT_ID(ID),
      SCORE = VALUES(SCORE),
      PRIORIDADE = VALUES(PRIORIDADE)
    `,
    [
      fonteId,
      r.tipo,
      r.bioma || null,
      r.estado || null,
      r.municipio || null,
      r.latitude,
      r.longitude,
      dataOcorrencia,
      r.satelite || null,
      r.risco,
      r.frp,
      p.score,
      p.nivel,
      r.chave
    ]
  );

  const ocorrenciaId = resultado.insertId;

  if (!ocorrenciaId) {
    throw new Error(
      `Não foi possível obter o ID da ocorrência ${r.chave}.`
    );
  }

  // Uma linha de prioridade por ocorrência.
  const [prioridadeResult] = await c.execute(
    `
    INSERT INTO PRIORIDADE (
      OCORRENCIA_ID,
      SCORE_RISCO,
      SCORE_RECENCIA,
      SCORE_SENSIBILIDADE,
      SCORE_FINAL,
      NIVEL
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      SCORE_RISCO = VALUES(SCORE_RISCO),
      SCORE_RECENCIA = VALUES(SCORE_RECENCIA),
      SCORE_SENSIBILIDADE = VALUES(SCORE_SENSIBILIDADE),
      SCORE_FINAL = VALUES(SCORE_FINAL),
      NIVEL = VALUES(NIVEL),
      CALCULADO_EM = CURRENT_TIMESTAMP
    `,
    [
      ocorrenciaId,
      p.riscoScore,
      p.recencia,
      p.sensibilidade,
      p.score,
      p.nivel
    ]
  );

  return prioridadeResult;
}

// -------------------------
// SINCRONIZAÇÃO
// -------------------------

async function sincronizar() {
  statusSync = "atualizando";
  erroSync = null;

  try {
    const focos = await buscarINPE();

    // DETER pode estar indisponível em uma sincronização.
    let alertas = [];

    try {
      alertas = await buscarDETER();
    } catch (e) {
      console.log(
        "DETER indisponível nesta sincronização:",
        e.message
      );
    }

    await banco(async c => {
      await c.beginTransaction();

      try {
        const [fontes] = await c.execute(
          "SELECT ID, NOME FROM FONTE"
        );

        const fontesNormalizadas = fontes.map(r => ({
          id: r.ID,
          nome: String(r.NOME || "").trim()
        }));

        const inpeFonte = fontesNormalizadas.find(r =>
          /queimadas|inpe/i.test(r.nome)
        );

        const deterFonte = fontesNormalizadas.find(r =>
          /deter/i.test(r.nome)
        );

        if (!inpeFonte) {
          throw new Error(
            `Fonte INPE/Queimadas não encontrada na tabela FONTE. Fontes disponíveis: ${
              fontesNormalizadas
                .map(r => `${r.id}:${r.nome}`)
                .join(", ")
            }`
          );
        }

        if (!deterFonte) {
          throw new Error(
            `Fonte DETER não encontrada na tabela FONTE. Fontes disponíveis: ${
              fontesNormalizadas
                .map(r => `${r.id}:${r.nome}`)
                .join(", ")
            }`
          );
        }

        for (const foco of focos) {
          await salvarOcorrencia(c, foco, inpeFonte.id);
        }

        for (const alerta of alertas) {
          await salvarOcorrencia(c, alerta, deterFonte.id);
        }

        await c.execute(
          "UPDATE FONTE SET ATUALIZADO_EM = CURRENT_TIMESTAMP"
        );

        await c.commit();
      } catch (erro) {
        await c.rollback();
        throw erro;
      }
    });

    ultimaSincronizacao = new Date();
    statusSync = "ok";

    console.log(
      `Sincronização concluída: ${focos.length} focos + ${alertas.length} DETER`
    );
  } catch (e) {
    statusSync = "erro";
    erroSync = e.message;

    console.error("Erro na sincronização:", e.message);
  }
}

// -------------------------
// API DO DASHBOARD
// -------------------------

app.get("/api/status", (req, res) => {
  res.json({
    status: statusSync,
    ultimaSincronizacao,
    erro: erroSync
  });
});

app.get("/api/ocorrencias", async (req, res) => {
  try {
    const linhas = await banco(async c => {
      const [rows] = await c.execute(`
        SELECT
          ID,
          TIPO,
          BIOMA,
          ESTADO,
          MUNICIPIO,
          LATITUDE,
          LONGITUDE,
          DATA_HORA,
          SATELITE,
          RISCO_FOGO,
          FRP,
          SCORE,
          PRIORIDADE,
          STATUS
        FROM OCORRENCIA
        WHERE BIOMA IS NOT NULL
        ORDER BY SCORE DESC, DATA_HORA DESC
      `);

      return rows;
    });

    // Mantém os nomes das propriedades e os valores numéricos
    // compatíveis com o formato que o dashboard espera.
    const resultado = linhas.map(r => ({
      ...r,
      ID: Number(r.ID),
      LATITUDE: r.LATITUDE === null ? null : Number(r.LATITUDE),
      LONGITUDE: r.LONGITUDE === null ? null : Number(r.LONGITUDE),
      RISCO_FOGO: r.RISCO_FOGO === null ? null : Number(r.RISCO_FOGO),
      FRP: r.FRP === null ? null : Number(r.FRP),
      SCORE: r.SCORE === null ? null : Number(r.SCORE)
    }));

    res.json(resultado);
  } catch (erro) {
    console.error("Erro ao buscar ocorrências:", erro);

    res.status(500).json({
      erro: "Erro ao buscar ocorrências"
    });
  }
});

// -------------------------
// COLOCA OCORRÊNCIA EM ANDAMENTO
// -------------------------

app.put("/api/ocorrencias/:id/andamento", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        erro: "ID da ocorrência inválido"
      });
    }

    const linhas = await banco(async c => {
      const [resultado] = await c.execute(
        `
        UPDATE OCORRENCIA
        SET STATUS = 'EM ANDAMENTO'
        WHERE ID = ?
        `,
        [id]
      );

      if (resultado.affectedRows > 0) {
        return 1;
      }

      // No MySQL, affectedRows pode ser zero se o valor
      // já era EM ANDAMENTO. Verificamos se o ID existe.
      const [existentes] = await c.execute(
        "SELECT ID FROM OCORRENCIA WHERE ID = ?",
        [id]
      );

      return existentes.length > 0 ? 1 : 0;
    });

    if (linhas === 0) {
      return res.status(404).json({
        erro: "Ocorrência não encontrada"
      });
    }

    return res.json({
      sucesso: true,
      id,
      status: "EM ANDAMENTO"
    });
  } catch (erro) {
    console.error(
      "Erro ao colocar ocorrência em andamento:",
      erro
    );

    return res.status(500).json({
      erro: "Erro ao atualizar ocorrência"
    });
  }
});

// -------------------------
// RESUMO DO DASHBOARD
// -------------------------

app.get("/api/resumo", async (req, res) => {
  try {
    const resultado = await banco(async c => {
      const [rows] = await c.execute(`
        SELECT
          COUNT(*) AS TOTAL,
          SUM(CASE WHEN TIPO = 'FOCO_CALOR' THEN 1 ELSE 0 END) AS FOCOS,
          SUM(CASE WHEN TIPO = 'DESMATAMENTO' THEN 1 ELSE 0 END) AS DESMATAMENTO,
          SUM(CASE WHEN PRIORIDADE = 'CRÍTICA' THEN 1 ELSE 0 END) AS CRITICAS
        FROM OCORRENCIA
        WHERE STATUS IS NULL
          OR UPPER(TRIM(STATUS)) <> 'RESOLVIDO'
      `);

      const r = rows[0];

      return {
        TOTAL: Number(r.TOTAL || 0),
        FOCOS: Number(r.FOCOS || 0),
        DESMATAMENTO: Number(r.DESMATAMENTO || 0),
        CRITICAS: Number(r.CRITICAS || 0)
      };
    });

    res.json(resultado);
  } catch (erro) {
    console.error("Erro ao gerar resumo:", erro);

    res.status(500).json({
      erro: "Erro ao gerar resumo"
    });
  }
});

// -------------------------
// RESOLVE OCORRÊNCIA
// -------------------------

app.put("/api/ocorrencias/:id/resolver", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        erro: "ID da ocorrência inválido"
      });
    }

    const linhas = await banco(async c => {
      const [resultado] = await c.execute(
        `
        UPDATE OCORRENCIA
        SET STATUS = 'RESOLVIDO'
        WHERE ID = ?
          AND STATUS = 'EM ANDAMENTO'
        `,
        [id]
      );

      return resultado.affectedRows;
    });

    if (linhas === 0) {
      return res.status(409).json({
        erro: "Ocorrência não encontrada ou não está em andamento."
      });
    }

    return res.json({
      sucesso: true,
      id,
      status: "RESOLVIDO"
    });
  } catch (erro) {
    console.error("Erro ao resolver ocorrência:", erro);

    return res.status(500).json({
      erro: "Erro ao registrar a resolução da ocorrência."
    });
  }
});

// -------------------------
// INICIA A APLICAÇÃO
// -------------------------

async function iniciar() {
  while (true) {
    try {
      const conexao = await pool.getConnection();
      conexao.release();
      break;
    } catch (erro) {
      console.log(
        "Aguardando MySQL...",
        erro.message
      );

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log("MySQL conectado.");

  // Primeira sincronização.
  await sincronizar();

  // Sincronizações seguintes.
  setInterval(sincronizar, INTERVALO);

  app.listen(PORT, () => {
    console.log(`Dashboard: http://localhost:${PORT}`);
  });
}

iniciar().catch(erro => {
  console.error("Falha ao iniciar a aplicação:", erro);
  process.exit(1);
});
