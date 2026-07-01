import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { getTodosDeputadosGastos } from '../src/questao_1/service/service.ts'
import { getDeputadoEixoAtuacao } from '../src/questao_2/service/service.ts'
import type { VotoDeputadoTema } from '../src/questao_3/types.ts'
import { getEscolaridadeAgrupada } from '../src/questao_4/service/service.ts'
import type {
  FornecedorRanking,
  Questao5Response,
} from '../src/questao_5/types.ts'
import { getRankingCustoBeneficio } from '../src/questao_7/service/service.ts'
import { getPosicionamentoIdeologico } from '../src/questao_9/service/service.ts'
import { getRankingCoesaoPartidaria } from '../src/questao_10/service/service.ts'
import type {
  FornecedorDeputado,
  Questao12Response,
} from '../src/questao_12/types.ts'
import type {
  CategoriaDespesaDeputado,
  Questao13Response,
} from '../src/questao_13/types.ts'
import type {
  DeputadoStaticData,
  Questao5StaticData,
  Questao7StaticData,
  StaticMetadata,
  VotosDeputadoStaticData,
} from '../src/data/types.ts'

const LEGISLATURA = 57
const VOTE_EXPORT_CONCURRENCY = 6
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputDirectory = resolve(scriptDirectory, '../public/data')

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

type Questao5Row = {
  categoria: string | null
  ano: number | null
  fornecedor: string
  cnpj_cpf: string | null
  total_recebido: number | string
  quantidade_despesas: number
  total_geral: number | string
  total_fornecedores: number
}

type Questao12Row = {
  deputado_id: number
  fornecedor: string
  cnpj_cpf: string | null
  total_gasto_fornecedor: number | string
  transacoes: number
  total_gasto_deputado: number | string
  total_fornecedores: number
  deputados_mesmo_partido: number
}

type Questao13Row = {
  deputado_id: number
  categoria: string
  total_gasto_categoria: number | string
  quantidade_despesas: number
  total_gasto_deputado: number | string
  total_categorias: number
}

type VoteRow = {
  id_votacao: string
  data_hora_voto: Date | string | null
  data_votacao: Date | string | null
  voto: string | null
  descricao: string | null
  orgao: string | null
  proposicao_uri: string | null
  proposicao_titulo: string | null
  proposicao_ementa: string | null
  temas: string[] | null
}

type CoverageRow = {
  despesas_de: number | null
  despesas_ate: number | null
  proposicoes_de: number | null
  proposicoes_ate: number | null
  votacoes_de: number | null
  votacoes_ate: number | null
  presencas_de: number | null
  presencas_ate: number | null
  total_deputados: number
  deputados_com_escolaridade: number
}

async function main() {
  console.log(`Limpando ${outputDirectory}`)
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(resolve(outputDirectory, 'deputados'), { recursive: true })
  await mkdir(resolve(outputDirectory, 'votos'), { recursive: true })

  console.log('Exportando questão 1 e lista de deputados...')
  const questao1 = await getTodosDeputadosGastos()
  await writeJson('questao-1.json', questao1)
  const deputados = questao1.deputados

  console.log('Exportando questão 2...')
  const eixosPorDeputado = new Map<
    number,
    Awaited<ReturnType<typeof getDeputadoEixoAtuacao>>
  >()

  for (const [index, deputado] of deputados.entries()) {
    eixosPorDeputado.set(
      deputado.id,
      await getDeputadoEixoAtuacao(deputado.id),
    )

    if ((index + 1) % 100 === 0 || index + 1 === deputados.length) {
      console.log(`  eixos: ${index + 1}/${deputados.length}`)
    }
  }

  console.log('Exportando questão 4...')
  const questao4 = await getEscolaridadeAgrupada()
  await writeJson('questao-4.json', questao4)

  console.log('Exportando questão 5...')
  const questao5 = await exportQuestao5()
  await writeJson('questao-5.json', questao5)

  console.log('Exportando questão 7...')
  const questao7 = await exportQuestao7()
  await writeJson('questao-7.json', questao7)
  const custoBeneficioPorDeputado = new Map(
    questao7.ranking.map((deputado) => [deputado.deputadoId, deputado]),
  )

  console.log('Exportando questão 9...')
  const questao9 = await getPosicionamentoIdeologico()
  await writeJson('questao-9.json', questao9)

  console.log('Exportando questão 10...')
  const questao10 = await getRankingCoesaoPartidaria()
  await writeJson('questao-10.json', questao10)

  console.log('Exportando questões 12 e 13...')
  const [fornecedoresPorDeputado, categoriasPorDeputado] = await Promise.all([
    exportQuestao12(deputados.map((deputado) => deputado.id)),
    exportQuestao13(deputados.map((deputado) => deputado.id)),
  ])

  console.log('Gravando detalhes estáticos por deputado...')
  await Promise.all(
    deputados.map((deputado) => {
      const data: DeputadoStaticData = {
        deputadoId: deputado.id,
        eixos: eixosPorDeputado.get(deputado.id) ?? null,
        custoBeneficio:
          custoBeneficioPorDeputado.get(deputado.id) ?? null,
        fornecedores:
          fornecedoresPorDeputado.get(deputado.id) ??
          emptyQuestao12(deputado.id),
        categoriasDespesa:
          categoriasPorDeputado.get(deputado.id) ??
          emptyQuestao13(deputado.id),
      }

      return writeJson(`deputados/${deputado.id}.json`, data)
    }),
  )

  console.log('Exportando histórico de votos por deputado...')
  await exportVotes(deputados.map(({ id, nome }) => ({ id, nome })))

  console.log('Gerando metadata.json...')
  const metadata = await buildMetadata({
    totalDeputies: deputados.length,
    deputiesWithEducation: questao4.deputados.filter(
      (deputado) => Boolean(deputado.escolaridadeOriginal),
    ).length,
    ideologyRecords: questao9.deputados.length,
    parties: questao10.ranking.length,
  })
  await writeJson('metadata.json', metadata, true)

  await pool.end()
  console.log('Exportação estática concluída.')
}

async function exportQuestao5(): Promise<Questao5StaticData> {
  const result = await pool.query<Questao5Row>(`
    WITH base AS (
      SELECT
        NULLIF(BTRIM(txt_descricao), '') AS categoria,
        num_ano AS ano,
        COALESCE(
          NULLIF(BTRIM(txt_fornecedor), ''),
          'Fornecedor não informado'
        ) AS fornecedor,
        NULLIF(BTRIM(txt_cnpj_cpf), '') AS cnpj_cpf,
        COALESCE(
          NULLIF(BTRIM(txt_cnpj_cpf), ''),
          NULLIF(BTRIM(txt_fornecedor), ''),
          'Sem fornecedor'
        ) AS identidade_fornecedor,
        COALESCE(vlr_liquido, 0) AS valor
      FROM despesa_parlamentar
      WHERE cod_legislatura = ${LEGISLATURA}
    ),
    variacoes AS (
      SELECT categoria, ano, fornecedor, cnpj_cpf, identidade_fornecedor, valor
      FROM base
      UNION ALL
      SELECT categoria, NULL::int, fornecedor, cnpj_cpf, identidade_fornecedor, valor
      FROM base
      UNION ALL
      SELECT NULL::text, ano, fornecedor, cnpj_cpf, identidade_fornecedor, valor
      FROM base
      UNION ALL
      SELECT NULL::text, NULL::int, fornecedor, cnpj_cpf, identidade_fornecedor, valor
      FROM base
    ),
    totais AS (
      SELECT
        categoria,
        ano,
        SUM(valor) AS total_geral,
        COUNT(DISTINCT identidade_fornecedor)::int AS total_fornecedores
      FROM variacoes
      GROUP BY categoria, ano
    ),
    fornecedores AS (
      SELECT
        categoria,
        ano,
        fornecedor,
        cnpj_cpf,
        SUM(valor) AS total_recebido,
        COUNT(*)::int AS quantidade_despesas
      FROM variacoes
      GROUP BY categoria, ano, fornecedor, cnpj_cpf
    ),
    ranqueados AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY categoria, ano
          ORDER BY total_recebido DESC, fornecedor ASC
        ) AS posicao
      FROM fornecedores
    )
    SELECT
      r.categoria,
      r.ano,
      r.fornecedor,
      r.cnpj_cpf,
      r.total_recebido,
      r.quantidade_despesas,
      t.total_geral,
      t.total_fornecedores
    FROM ranqueados r
    JOIN totais t
      ON t.categoria IS NOT DISTINCT FROM r.categoria
     AND t.ano IS NOT DISTINCT FROM r.ano
    WHERE r.posicao <= 20
    ORDER BY r.categoria NULLS FIRST, r.ano NULLS FIRST, r.posicao
  `)

  const categoriasDisponiveis = uniqueSorted(
    result.rows
      .map((row) => row.categoria)
      .filter((value): value is string => Boolean(value)),
  )
  const anosDisponiveis = [
    ...new Set(
      result.rows
        .map((row) => row.ano)
        .filter((value): value is number => value !== null),
    ),
  ].sort((first, second) => second - first)
  const grouped = new Map<string, Questao5Row[]>()

  result.rows.forEach((row) => {
    const key = JSON.stringify([row.categoria, row.ano])
    const rows = grouped.get(key) ?? []
    rows.push(row)
    grouped.set(key, rows)
  })

  const recortes: Record<string, Questao5Response> = {}

  grouped.forEach((rows, key) => {
    const first = rows[0]
    const totalRecebido = Number(first?.total_geral ?? 0)

    recortes[key] = {
      totalRecebido,
      totalFornecedores: first?.total_fornecedores ?? 0,
      filtros: {
        categoria: first?.categoria ?? null,
        ano: first?.ano ?? null,
        deputadoId: null,
      },
      categoriasDisponiveis,
      anosDisponiveis,
      fornecedores: rows.map((row): FornecedorRanking => {
        const totalFornecedor = Number(row.total_recebido)

        return {
          fornecedor: row.fornecedor,
          cnpjCpf: row.cnpj_cpf,
          totalRecebido: totalFornecedor,
          quantidadeDespesas: row.quantidade_despesas,
          percentual:
            totalRecebido > 0
              ? round((totalFornecedor / totalRecebido) * 100, 2)
              : 0,
        }
      }),
    }
  })

  return { categoriasDisponiveis, anosDisponiveis, recortes }
}

async function exportQuestao7(): Promise<Questao7StaticData> {
  const firstPage = await getRankingCustoBeneficio({ page: 1 })
  const ranking = [...firstPage.deputados]

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const response = await getRankingCustoBeneficio({ page })
    ranking.push(...response.deputados)
  }

  return {
    ranking,
    partidosDisponiveis: firstPage.partidosDisponiveis,
    ufsDisponiveis: firstPage.ufsDisponiveis,
    formula: firstPage.formula,
  }
}

async function exportQuestao12(
  deputadoIds: number[],
): Promise<Map<number, Questao12Response>> {
  const result = await pool.query<Questao12Row>(`
    WITH base AS (
      SELECT
        ide_cadastro AS deputado_id,
        num_ano,
        num_mes,
        id_despesa,
        NULLIF(BTRIM(sg_partido), '') AS partido,
        COALESCE(
          NULLIF(BTRIM(txt_fornecedor), ''),
          'Fornecedor não informado'
        ) AS fornecedor,
        NULLIF(BTRIM(txt_cnpj_cpf), '') AS cnpj_cpf,
        COALESCE(
          NULLIF(BTRIM(txt_cnpj_cpf), ''),
          NULLIF(BTRIM(txt_fornecedor), ''),
          'Sem fornecedor'
        ) AS identidade_fornecedor,
        COALESCE(vlr_liquido, 0) AS valor
      FROM despesa_parlamentar
      WHERE cod_legislatura = ${LEGISLATURA}
        AND ide_cadastro IS NOT NULL
    ),
    partidos_atuais AS (
      SELECT DISTINCT ON (deputado_id)
        deputado_id,
        partido
      FROM base
      WHERE partido IS NOT NULL
      ORDER BY deputado_id, num_ano DESC, num_mes DESC, id_despesa DESC
    ),
    totais_deputado AS (
      SELECT
        deputado_id,
        SUM(valor) AS total_gasto_deputado,
        COUNT(DISTINCT identidade_fornecedor)::int AS total_fornecedores
      FROM base
      GROUP BY deputado_id
    ),
    fornecedores AS (
      SELECT
        deputado_id,
        fornecedor,
        cnpj_cpf,
        SUM(valor) AS total_gasto_fornecedor,
        COUNT(*)::int AS transacoes
      FROM base
      GROUP BY deputado_id, fornecedor, cnpj_cpf
    ),
    fornecedores_ranqueados AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY deputado_id
          ORDER BY total_gasto_fornecedor DESC, fornecedor ASC
        ) AS posicao
      FROM fornecedores
    ),
    fornecedores_partido AS (
      SELECT
        partido,
        cnpj_cpf,
        COUNT(DISTINCT deputado_id)::int AS deputados_mesmo_partido
      FROM base
      WHERE partido IS NOT NULL
        AND cnpj_cpf IS NOT NULL
      GROUP BY partido, cnpj_cpf
    )
    SELECT
      r.deputado_id,
      r.fornecedor,
      r.cnpj_cpf,
      r.total_gasto_fornecedor,
      r.transacoes,
      t.total_gasto_deputado,
      t.total_fornecedores,
      COALESCE(fp.deputados_mesmo_partido, 0) AS deputados_mesmo_partido
    FROM fornecedores_ranqueados r
    JOIN totais_deputado t USING (deputado_id)
    LEFT JOIN partidos_atuais pa USING (deputado_id)
    LEFT JOIN fornecedores_partido fp
      ON fp.partido = pa.partido
     AND fp.cnpj_cpf = r.cnpj_cpf
    WHERE r.posicao <= 8
    ORDER BY r.deputado_id, r.posicao
  `)

  const rowsByDeputy = groupBy(result.rows, (row) => row.deputado_id)
  const responses = new Map<number, Questao12Response>()

  deputadoIds.forEach((deputadoId) => {
    const rows = rowsByDeputy.get(deputadoId) ?? []
    const first = rows[0]
    const totalGasto = Number(first?.total_gasto_deputado ?? 0)

    responses.set(deputadoId, {
      deputadoId,
      totalGasto,
      totalFornecedores: first?.total_fornecedores ?? 0,
      fornecedores: rows.map((row): FornecedorDeputado => {
        const totalFornecedor = Number(row.total_gasto_fornecedor)
        const percentual =
          totalGasto > 0
            ? round((totalFornecedor / totalGasto) * 100, 2)
            : 0

        return {
          fornecedor: row.fornecedor,
          cnpjCpf: row.cnpj_cpf,
          totalGasto: totalFornecedor,
          transacoes: row.transacoes,
          ticketMedio:
            row.transacoes > 0
              ? round(totalFornecedor / row.transacoes, 2)
              : 0,
          percentual,
          deputadosMesmoPartido: row.deputados_mesmo_partido,
          alertaConcentracao: percentual >= 30,
          alertaMesmoPartido: row.deputados_mesmo_partido > 1,
        }
      }),
    })
  })

  return responses
}

async function exportQuestao13(
  deputadoIds: number[],
): Promise<Map<number, Questao13Response>> {
  const result = await pool.query<Questao13Row>(`
    WITH categorias AS (
      SELECT
        ide_cadastro AS deputado_id,
        COALESCE(
          NULLIF(BTRIM(txt_descricao), ''),
          'Sem categoria'
        ) AS categoria,
        SUM(COALESCE(vlr_liquido, 0)) AS total_gasto_categoria,
        COUNT(*)::int AS quantidade_despesas
      FROM despesa_parlamentar
      WHERE cod_legislatura = ${LEGISLATURA}
        AND ide_cadastro IS NOT NULL
      GROUP BY
        ide_cadastro,
        COALESCE(NULLIF(BTRIM(txt_descricao), ''), 'Sem categoria')
    ),
    ranqueadas AS (
      SELECT
        *,
        SUM(total_gasto_categoria) OVER (
          PARTITION BY deputado_id
        ) AS total_gasto_deputado,
        COUNT(*) OVER (
          PARTITION BY deputado_id
        )::int AS total_categorias,
        ROW_NUMBER() OVER (
          PARTITION BY deputado_id
          ORDER BY total_gasto_categoria DESC, categoria ASC
        ) AS posicao
      FROM categorias
    )
    SELECT
      deputado_id,
      categoria,
      total_gasto_categoria,
      quantidade_despesas,
      total_gasto_deputado,
      total_categorias
    FROM ranqueadas
    WHERE posicao <= 12
    ORDER BY deputado_id, posicao
  `)

  const rowsByDeputy = groupBy(result.rows, (row) => row.deputado_id)
  const responses = new Map<number, Questao13Response>()

  deputadoIds.forEach((deputadoId) => {
    const rows = rowsByDeputy.get(deputadoId) ?? []
    const first = rows[0]
    const totalGasto = Number(first?.total_gasto_deputado ?? 0)

    responses.set(deputadoId, {
      deputadoId,
      totalGasto,
      totalCategorias: first?.total_categorias ?? 0,
      categorias: rows.map((row): CategoriaDespesaDeputado => {
        const totalCategoria = Number(row.total_gasto_categoria)

        return {
          categoria: row.categoria,
          totalGasto: totalCategoria,
          quantidadeDespesas: row.quantidade_despesas,
          percentual:
            totalGasto > 0
              ? round((totalCategoria / totalGasto) * 100, 2)
              : 0,
        }
      }),
    })
  })

  return responses
}

async function exportVotes(
  deputados: Array<{ id: number; nome: string }>,
) {
  for (
    let offset = 0;
    offset < deputados.length;
    offset += VOTE_EXPORT_CONCURRENCY
  ) {
    const batch = deputados.slice(
      offset,
      offset + VOTE_EXPORT_CONCURRENCY,
    )

    await Promise.all(
      batch.map(async (deputado) => {
        const result = await pool.query<VoteRow>(
          `
            SELECT
              vd.id_votacao,
              vd.data_hora_voto,
              v.data AS data_votacao,
              vd.voto,
              v.descricao,
              v.sigla_orgao AS orgao,
              vp.proposicao_uri,
              vp.proposicao_titulo,
              vp.proposicao_ementa,
              ARRAY_AGG(DISTINCT pt.tema ORDER BY pt.tema)
                FILTER (WHERE NULLIF(BTRIM(pt.tema), '') IS NOT NULL) AS temas
            FROM voto_deputado vd
            JOIN votacao v
              ON v.id_votacao = vd.id_votacao
            JOIN votacao_proposicao vp
              ON vp.id_votacao = vd.id_votacao
            JOIN proposicao_tema pt
              ON pt.uri_proposicao = vp.proposicao_uri
            WHERE vd.id_deputado = $1
            GROUP BY
              vd.id_votacao,
              vd.data_hora_voto,
              vd.voto,
              v.data,
              v.descricao,
              v.sigla_orgao,
              vp.proposicao_uri,
              vp.proposicao_titulo,
              vp.proposicao_ementa
            ORDER BY
              COALESCE(vd.data_hora_voto, v.data::timestamp) DESC,
              vd.id_votacao DESC
          `,
          [deputado.id],
        )
        const votos = result.rows.map(toVote)
        const temasDisponiveis = uniqueSorted(
          votos.flatMap((voto) => voto.temas),
        )
        const data: VotosDeputadoStaticData = {
          deputadoId: deputado.id,
          deputadoNome: deputado.nome,
          temasDisponiveis,
          votos,
        }

        await writeJson(`votos/${deputado.id}.json`, data)
      }),
    )

    const completed = Math.min(
      offset + VOTE_EXPORT_CONCURRENCY,
      deputados.length,
    )

    if (completed % 60 === 0 || completed === deputados.length) {
      console.log(`  votos: ${completed}/${deputados.length}`)
    }
  }
}

async function buildMetadata(stats: {
  totalDeputies: number
  deputiesWithEducation: number
  ideologyRecords: number
  parties: number
}): Promise<StaticMetadata> {
  const result = await pool.query<CoverageRow>(`
    SELECT
      (SELECT MIN(num_ano) FROM despesa_parlamentar
        WHERE cod_legislatura = ${LEGISLATURA}) AS despesas_de,
      (SELECT MAX(num_ano) FROM despesa_parlamentar
        WHERE cod_legislatura = ${LEGISLATURA}) AS despesas_ate,
      (SELECT MIN(ano) FROM proposicao
        WHERE ano BETWEEN 2023 AND 2026) AS proposicoes_de,
      (SELECT MAX(ano) FROM proposicao
        WHERE ano BETWEEN 2023 AND 2026) AS proposicoes_ate,
      (SELECT MIN(EXTRACT(YEAR FROM data))::int FROM votacao
        WHERE data IS NOT NULL) AS votacoes_de,
      (SELECT MAX(EXTRACT(YEAR FROM data))::int FROM votacao
        WHERE data IS NOT NULL) AS votacoes_ate,
      (SELECT MIN(ano) FROM deputado_plenario) AS presencas_de,
      (SELECT MAX(ano) FROM deputado_plenario) AS presencas_ate,
      (SELECT COUNT(*)::int FROM deputado) AS total_deputados,
      (SELECT COUNT(*)::int FROM deputado
        WHERE NULLIF(BTRIM(escolaridade), '') IS NOT NULL)
        AS deputados_com_escolaridade
  `)
  const row = result.rows[0]
  const yearsByDataset = {
    despesas: {
      from: row?.despesas_de ?? null,
      through: row?.despesas_ate ?? null,
    },
    proposicoes: {
      from: row?.proposicoes_de ?? null,
      through: row?.proposicoes_ate ?? null,
    },
    votacoes: {
      from: row?.votacoes_de ?? null,
      through: row?.votacoes_ate ?? null,
    },
    presencas: {
      from: row?.presencas_de ?? null,
      through: row?.presencas_ate ?? null,
    },
  }
  const availableThroughYear = Math.max(
    ...Object.values(yearsByDataset)
      .map((period) => period.through)
      .filter((year): year is number => year !== null),
  )

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: 'Análise da Câmara dos Deputados',
    description:
      'Snapshot estático dos resultados das questões analíticas do projeto.',
    source: {
      name: 'Dados Abertos da Câmara dos Deputados',
      api: 'https://dadosabertos.camara.leg.br/api/v2',
      portal: 'https://dadosabertos.camara.leg.br/',
    },
    coverage: {
      legislature: LEGISLATURA,
      availableThroughYear,
      yearsByDataset,
      totalDeputies: row?.total_deputados ?? stats.totalDeputies,
      deputiesWithEducation:
        row?.deputados_com_escolaridade ??
        stats.deputiesWithEducation,
    },
    deployment: {
      mode: 'static',
      requiresDatabase: false,
      requiresServer: false,
    },
    datasets: [
      {
        id: 'questao-1',
        path: 'data/questao-1.json',
        records: stats.totalDeputies,
      },
      {
        id: 'questao-2-7-12-13',
        path: 'data/deputados/{id}.json',
        partitionedBy: 'deputadoId',
        records: stats.totalDeputies,
      },
      {
        id: 'questao-3',
        path: 'data/votos/{id}.json',
        partitionedBy: 'deputadoId',
        records: stats.totalDeputies,
      },
      {
        id: 'questao-4',
        path: 'data/questao-4.json',
        records: stats.totalDeputies,
      },
      {
        id: 'questao-5',
        path: 'data/questao-5.json',
      },
      {
        id: 'questao-7',
        path: 'data/questao-7.json',
      },
      {
        id: 'questao-9',
        path: 'data/questao-9.json',
        records: stats.ideologyRecords,
      },
      {
        id: 'questao-10',
        path: 'data/questao-10.json',
        records: stats.parties,
      },
    ],
  }
}

function toVote(row: VoteRow): VotoDeputadoTema {
  return {
    idVotacao: row.id_votacao,
    dataHoraVoto: toIsoString(row.data_hora_voto),
    dataVotacao: toIsoString(row.data_votacao),
    voto: row.voto?.trim() || 'Sem registro',
    descricao: row.descricao,
    orgao: row.orgao,
    proposicaoUri: row.proposicao_uri,
    proposicaoTitulo: row.proposicao_titulo,
    proposicaoEmenta: row.proposicao_ementa,
    temas: row.temas?.filter(Boolean) ?? [],
  }
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(value).toISOString()
}

function emptyQuestao12(deputadoId: number): Questao12Response {
  return {
    deputadoId,
    totalGasto: 0,
    totalFornecedores: 0,
    fornecedores: [],
  }
}

function emptyQuestao13(deputadoId: number): Questao13Response {
  return {
    deputadoId,
    totalGasto: 0,
    totalCategorias: 0,
    categorias: [],
  }
}

async function writeJson(
  relativePath: string,
  value: unknown,
  pretty = false,
) {
  const path = resolve(outputDirectory, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`,
    'utf8',
  )
}

function groupBy<Row, Key>(
  rows: Row[],
  getKey: (row: Row) => Key,
): Map<Key, Row[]> {
  const grouped = new Map<Key, Row[]>()

  rows.forEach((row) => {
    const key = getKey(row)
    const values = grouped.get(key) ?? []
    values.push(row)
    grouped.set(key, values)
  })

  return grouped
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((first, second) =>
    first.localeCompare(second, 'pt-BR'),
  )
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
