# Monitor Amazônia & Cerrado — versão simplificada

## O que existe aqui?

Somente o necessário para o projeto:

```text
monitor-simplificado/
│
├── docker-compose.yml
├── database/
│   └── 01_banco.sql
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── index.html
    └── app.js
```

## Tecnologias

- Node.js: backend
- Express: API
- Oracle Database Free: banco
- HTML + Tailwind: interface
- JavaScript: lógica do dashboard
- Leaflet: mapa

Não existe Python.

## Como executar

Instale Docker Desktop.

Depois, na pasta do projeto:

```bash
docker compose up --build
```

Abra:

```text
http://localhost:3000
```

## O que acontece quando o sistema inicia?

1. O Docker inicia o Oracle.
2. O SQL cria o usuário e as tabelas.
3. O Node espera o Oracle ficar disponível.
4. O Node consulta o INPE.
5. O Node tenta consultar o DETER pelo WFS do TerraBrasilis.
6. Os dados são filtrados para Amazônia e Cerrado.
7. As ocorrências são gravadas no Oracle.
8. O sistema calcula o score.
9. O dashboard mostra mapa, indicadores e tabela.
10. A sincronização repete a cada 10 minutos.

## Sobre "tempo real"

O sistema faz atualização automática e frequente, mas a expressão correta para a apresentação é:

**"monitoramento com atualização periódica, próximo do tempo real, conforme a disponibilidade das fontes oficiais."**

O Programa Queimadas do INPE disponibiliza focos em intervalos de até 10 minutos. Já o DETER é um sistema de detecção de desmatamento em tempo real, mas o acesso antecipado aos alertas pode exigir credenciais destinadas a instituições responsáveis pela fiscalização. Portanto, não devemos prometer "tempo real garantido" para os dois dados sem essas credenciais.

## Como explicar o score?

O projeto calcula:

- 50% risco;
- 30% recência;
- 20% sensibilidade do bioma.

Depois:

- 80 a 100 = CRÍTICA
- 60 a 79 = ALTA
- 35 a 59 = MÉDIA
- abaixo de 35 = BAIXA

É um critério criado pelo projeto para apoiar a priorização. Não é uma classificação oficial do INPE.

## Como explicar o banco?

O Oracle guarda:

- fonte;
- tipo da ocorrência;
- bioma;
- estado;
- município;
- latitude;
- longitude;
- data/hora;
- satélite;
- risco de fogo;
- FRP;
- score;
- prioridade;
- status.

## Como explicar o sistema em 30 segundos?

"Nosso sistema não substitui o monitoramento do INPE. Ele utiliza dados públicos do Programa Queimadas e do DETER, armazena essas ocorrências em um banco Oracle e aplica um critério de priorização. Depois, disponibiliza tudo em um dashboard com mapa, indicadores e ranking para facilitar a análise das equipes responsáveis."

## Fontes oficiais

INPE / Programa Queimadas:
https://terrabrasilis.dpi.inpe.br/queimadas/portal/dados-abertos/

TerraBrasilis:
https://terrabrasilis.dpi.inpe.br/

Serviços WFS:
https://terrabrasilis.dpi.inpe.br/geoserver/ows
