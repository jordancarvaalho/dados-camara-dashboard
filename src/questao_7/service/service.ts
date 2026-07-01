import { Pool } from 'pg'
import type {
  CustoBeneficioDeputado,
  CustoBeneficioFaixa,
  DeputadoRankingCustoBeneficio,
  PresencaResumo,
  RankingCustoBeneficioResponse,
} from '../types.ts'

const PESO_PROPOSICAO = 1
const PESO_PRESENCA_PLENARIO = 1
const SCORE_SCALE = 100000
const GASTO_MINIMO_PADRAO = 10000
const PAGE_SIZE = 25
const LIMITE_CUSTO_REDUZIDO = 100000

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

type RankingCustoBeneficioRow = {
  deputado_id: number
  nome: string
  partido: string
  uf: string
  url_foto: string | null
  gasto_total: number | string | null
  total_proposicoes: number
  plenario_total: number
  plenario_presencas: number
  plenario_ausencias_justificadas: number
  plenario_ausencias_nao_justificadas: number
  percentual_presenca: number | string | null
}

export type RankingCustoBeneficioFilters = {
  nome?: string | null
  partido?: string | null
  uf?: string | null
  gastoMinimo?: number
  ordem?: 'maior' | 'menor'
  page?: number
}

/*
 * A consulta replica a definição usada no Power BI:
 * - despesas, proposições e presenças são agregadas por nome;
 * - os relacionamentos usam UPPER(TRIM(nome));
 * - benefício = proposições + percentual de presença no plenário;
 * - o conjunto parte de quem possui despesa parlamentar.
 *
 * O id é mantido apenas para integrar o resultado ao dashboard. Registros de
 * liderança sem ide_cadastro são excluídos, pois não representam deputados.
 */
const QUERY_RANKING_CUSTO_BENEFICIO = `
  WITH gastos AS (
    SELECT
      dp.tx_nome_parlamentar AS nome,
      MIN(dp.ide_cadastro) AS deputado_id,
      SUM(dp.vlr_liquido) AS gasto_total
    FROM despesa_parlamentar dp
    GROUP BY dp.tx_nome_parlamentar
  ),
  proposicoes AS (
    SELECT
      a.nome_autor AS nome,
      COUNT(DISTINCT a.id_proposicao)::int AS total_proposicoes
    FROM autoria a
    WHERE a.nome_autor IS NOT NULL
    GROUP BY a.nome_autor
  ),
  presenca AS (
    SELECT
      dp.nome_deputado AS nome,
      COUNT(*)::int AS total_sessoes,
      COUNT(*) FILTER (
        WHERE LOWER(dp.status_normalizado) LIKE '%presente%'
      )::int AS presencas,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(dp.status_normalizado, '')) = 'ausente_justificado'
      )::int AS ausencias_justificadas,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(dp.status_normalizado, '')) = 'ausente'
      )::int AS ausencias_nao_justificadas,
      ROUND(
        100.0 * COUNT(*) FILTER (
          WHERE LOWER(dp.status_normalizado) LIKE '%presente%'
        ) / NULLIF(COUNT(*), 0),
        2
      ) AS percentual_presenca
    FROM deputado_plenario dp
    GROUP BY dp.nome_deputado
  ),
  status_atual AS (
    SELECT DISTINCT ON (vd.id_deputado)
      vd.id_deputado,
      NULLIF(BTRIM(vd.deputado_nome), '') AS nome,
      NULLIF(BTRIM(vd.deputado_sigla_partido), '') AS partido,
      NULLIF(BTRIM(vd.deputado_sigla_uf), '') AS uf,
      NULLIF(BTRIM(vd.deputado_url_foto), '') AS url_foto
    FROM voto_deputado vd
    ORDER BY vd.id_deputado, vd.data_hora_voto DESC, vd.id_voto DESC
  )
  SELECT
    g.deputado_id,
    COALESCE(sa.nome, d.nome, g.nome) AS nome,
    COALESCE(sa.partido, 'S.PART.') AS partido,
    COALESCE(sa.uf, '—') AS uf,
    COALESCE(sa.url_foto, NULLIF(BTRIM(d.foto), '')) AS url_foto,
    g.gasto_total,
    COALESCE(p.total_proposicoes, 0) AS total_proposicoes,
    COALESCE(pr.total_sessoes, 0) AS plenario_total,
    COALESCE(pr.presencas, 0) AS plenario_presencas,
    COALESCE(pr.ausencias_justificadas, 0) AS
      plenario_ausencias_justificadas,
    COALESCE(pr.ausencias_nao_justificadas, 0) AS
      plenario_ausencias_nao_justificadas,
    COALESCE(pr.percentual_presenca, 0) AS percentual_presenca
  FROM gastos g
  LEFT JOIN proposicoes p
    ON UPPER(TRIM(p.nome)) = UPPER(TRIM(g.nome))
  LEFT JOIN presenca pr
    ON UPPER(TRIM(pr.nome)) = UPPER(TRIM(g.nome))
  LEFT JOIN deputado d
    ON d.id_deputado = g.deputado_id
  LEFT JOIN status_atual sa
    ON sa.id_deputado = g.deputado_id
  WHERE g.deputado_id IS NOT NULL
    AND g.gasto_total >= ${GASTO_MINIMO_PADRAO}
`

let rankingCache: DeputadoRankingCustoBeneficio[] | null = null
let rankingPending: Promise<DeputadoRankingCustoBeneficio[]> | null = null

export async function getCustoBeneficioDeputado(
  deputadoId: number,
): Promise<CustoBeneficioDeputado | null> {
  const ranking = await getRankingCompleto()
  const deputado = ranking.find((item) => item.deputadoId === deputadoId)

  if (!deputado) {
    return null
  }

  return {
    deputadoId: deputado.deputadoId,
    nome: deputado.nome,
    gastoTotal: deputado.gastoTotal,
    totalProposicoes: deputado.totalProposicoes,
    scoreBeneficio: deputado.scoreBeneficio,
    scoreCustoBeneficio: deputado.scoreCustoBeneficio,
    presencaPlenario: deputado.presencaPlenario,
    formula: deputado.formula,
  }
}

export async function getRankingCustoBeneficio(
  filters: RankingCustoBeneficioFilters = {},
): Promise<RankingCustoBeneficioResponse> {
  const ranking = await getRankingCompleto()
  const normalizedFilters = {
    nome: filters.nome?.trim() || null,
    partido: filters.partido?.trim() || null,
    uf: filters.uf?.trim() || null,
    gastoMinimo: Math.max(
      GASTO_MINIMO_PADRAO,
      filters.gastoMinimo ?? GASTO_MINIMO_PADRAO,
    ),
    ordem: filters.ordem === 'menor' ? ('menor' as const) : ('maior' as const),
  }
  const page = Math.max(1, filters.page ?? 1)
  const nomeNormalizado = normalizeText(normalizedFilters.nome ?? '')
  const filtered = ranking.filter(
    (deputado) =>
      (!nomeNormalizado ||
        normalizeText(deputado.nome).includes(nomeNormalizado)) &&
      (!normalizedFilters.partido ||
        deputado.partido === normalizedFilters.partido) &&
      (!normalizedFilters.uf || deputado.uf === normalizedFilters.uf) &&
      deputado.gastoTotal >= normalizedFilters.gastoMinimo,
  )
  const ordered =
    normalizedFilters.ordem === 'menor' ? [...filtered].reverse() : filtered
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = ordered.slice(start, start + PAGE_SIZE)
  const scores = filtered
    .map((deputado) => deputado.scoreCustoBeneficio)
    .sort((first, second) => first - second)

  return {
    deputados: pageRows,
    totalDeputados: filtered.length,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages,
    filtros: normalizedFilters,
    partidosDisponiveis: uniqueSorted(ranking.map((item) => item.partido)),
    ufsDisponiveis: uniqueSorted(
      ranking.map((item) => item.uf).filter((uf) => uf !== '—'),
    ),
    resumo: {
      melhorScore: scores.at(-1) ?? 0,
      medianaScore: median(scores),
      piorScore: scores[0] ?? 0,
      mediaBeneficio:
        filtered.length > 0
          ? round(
              filtered.reduce(
                (total, item) => total + item.scoreBeneficio,
                0,
              ) / filtered.length,
              2,
            )
          : 0,
      gastoTotal: round(
        filtered.reduce((total, item) => total + item.gastoTotal, 0),
        2,
      ),
    },
    formula: {
      proposicao: PESO_PROPOSICAO,
      presencaPlenario: PESO_PRESENCA_PLENARIO,
      escala: SCORE_SCALE,
      gastoMinimoPadrao: GASTO_MINIMO_PADRAO,
    },
  }
}

async function getRankingCompleto(): Promise<
  DeputadoRankingCustoBeneficio[]
> {
  if (rankingCache) {
    return rankingCache
  }

  if (rankingPending) {
    return rankingPending
  }

  rankingPending = pool
    .query<RankingCustoBeneficioRow>(QUERY_RANKING_CUSTO_BENEFICIO)
    .then((result) => {
      const calculated = result.rows
        .map(toRankingDeputado)
        .sort(
          (first, second) =>
            second.scoreCustoBeneficio - first.scoreCustoBeneficio ||
            second.scoreBeneficio - first.scoreBeneficio ||
            first.nome.localeCompare(second.nome, 'pt-BR'),
        )
      const total = calculated.length

      return calculated.map((deputado, index) => ({
        ...deputado,
        posicaoGeral: index + 1,
        faixa: classifyRank(index, total),
      }))
    })

  try {
    rankingCache = await rankingPending
    return rankingCache
  } finally {
    rankingPending = null
  }
}

function toRankingDeputado(
  row: RankingCustoBeneficioRow,
): Omit<DeputadoRankingCustoBeneficio, 'posicaoGeral' | 'faixa'> {
  const gastoTotal = Number(row.gasto_total ?? 0)
  const presencaPlenario = toPresencaResumo(row)
  const scoreBeneficio =
    row.total_proposicoes * PESO_PROPOSICAO +
    presencaPlenario.percentualPresenca * PESO_PRESENCA_PLENARIO

  return {
    deputadoId: Number(row.deputado_id),
    nome: row.nome,
    partido: row.partido,
    uf: row.uf,
    urlFoto: row.url_foto,
    gastoTotal,
    totalProposicoes: Number(row.total_proposicoes),
    scoreBeneficio: round(scoreBeneficio, 2),
    scoreCustoBeneficio:
      gastoTotal > 0 ? round((scoreBeneficio / gastoTotal) * SCORE_SCALE, 4) : 0,
    presencaPlenario,
    formula: {
      proposicao: PESO_PROPOSICAO,
      presencaPlenario: PESO_PRESENCA_PLENARIO,
      escala: SCORE_SCALE,
    },
    baseCustoReduzida:
      gastoTotal >= GASTO_MINIMO_PADRAO &&
      gastoTotal < LIMITE_CUSTO_REDUZIDO,
  }
}

function toPresencaResumo(row: RankingCustoBeneficioRow): PresencaResumo {
  return {
    totalSessoes: Number(row.plenario_total),
    presencas: Number(row.plenario_presencas),
    ausenciasJustificadas: Number(row.plenario_ausencias_justificadas),
    ausenciasNaoJustificadas: Number(
      row.plenario_ausencias_nao_justificadas,
    ),
    percentualPresenca: Number(row.percentual_presenca ?? 0),
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function classifyRank(index: number, total: number): CustoBeneficioFaixa {
  const percentile = total > 1 ? index / (total - 1) : 0

  if (percentile < 0.2) {
    return 'Excelente'
  }

  if (percentile < 0.4) {
    return 'Muito bom'
  }

  if (percentile < 0.6) {
    return 'Regular'
  }

  if (percentile < 0.8) {
    return 'Atenção'
  }

  return 'Baixo CxB'
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((first, second) =>
    first.localeCompare(second, 'pt-BR'),
  )
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const middle = Math.floor(values.length / 2)

  return values.length % 2 === 0
    ? round((values[middle - 1] + values[middle]) / 2, 4)
    : values[middle]
}
