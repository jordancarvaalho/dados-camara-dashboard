import { Pool } from 'pg'
import type {
  DeputadosFilterOptions,
  DeputadoGastos,
  DeputadosGastosResponse,
  MetricaRanking,
  OrdemGastos,
} from '../types.ts'

const PAGE_SIZE = 5

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

const DEPUTADOS_GASTOS_CTE = `
  WITH deputados_gastos AS (
    SELECT
      d.id_deputado AS id,
      d.nome,
      d.foto,
      COALESCE(
        (ARRAY_AGG(dp.sg_partido ORDER BY dp.num_ano DESC, dp.num_mes DESC)
          FILTER (WHERE dp.sg_partido IS NOT NULL AND BTRIM(dp.sg_partido) <> ''))[1],
        NULL
      ) AS partido,
      COALESCE(
        (ARRAY_AGG(dp.sg_uf ORDER BY dp.num_ano DESC, dp.num_mes DESC)
          FILTER (WHERE dp.sg_uf IS NOT NULL AND BTRIM(dp.sg_uf) <> ''))[1],
        NULL
      ) AS uf,
      COALESCE(SUM(dp.vlr_liquido), 0)::double precision AS total_gastos,
      COUNT(dp.id_despesa)::int AS quantidade_despesas
    FROM deputado d
    LEFT JOIN despesa_parlamentar dp
      ON dp.ide_cadastro = d.id_deputado
     AND dp.cod_legislatura = 57
    GROUP BY d.id_deputado, d.nome, d.foto
  )
`

const FILTER_DEPUTADOS_GASTOS = `
  WHERE ($1::text IS NULL OR partido = $1)
    AND ($2::text IS NULL OR uf = $2)
    AND ($3::text IS NULL OR nome ILIKE '%' || $3 || '%')
`

const QUERY_FILTER_OPTIONS = `
  SELECT
    ARRAY(
      SELECT DISTINCT BTRIM(sg_partido)
      FROM despesa_parlamentar
      WHERE cod_legislatura = 57
        AND sg_partido IS NOT NULL
        AND BTRIM(sg_partido) <> ''
      ORDER BY BTRIM(sg_partido)
    ) AS partidos,
    ARRAY(
      SELECT DISTINCT BTRIM(sg_uf)
      FROM despesa_parlamentar
      WHERE cod_legislatura = 57
        AND sg_uf IS NOT NULL
        AND BTRIM(sg_uf) <> ''
      ORDER BY BTRIM(sg_uf)
    ) AS ufs
`

type QueryRow = {
  id: number
  nome: string
  foto: string
  partido: string | null
  uf: string | null
  total_gastos: number
  quantidade_despesas: number
}

type TotalRow = {
  total: number
}

type FilterOptionsRow = {
  partidos: string[]
  ufs: string[]
}

export async function getDeputadosGastos(params: {
  ordem: OrdemGastos
  metrica: MetricaRanking
  nome: string | null
  partido: string | null
  uf: string | null
  page: number
}): Promise<DeputadosGastosResponse> {
  const page = Math.max(1, Math.trunc(params.page))
  const offset = (page - 1) * PAGE_SIZE
  const orderDirection = params.ordem === 'menor' ? 'ASC' : 'DESC'
  const orderColumn =
    params.metrica === 'quantidade_despesas'
      ? 'quantidade_despesas'
      : 'total_gastos'
  const queryParams = [params.partido, params.uf, params.nome]
  const totalQuery = `
    ${DEPUTADOS_GASTOS_CTE}
    SELECT COUNT(*)::int AS total
    FROM deputados_gastos
    ${FILTER_DEPUTADOS_GASTOS}
  `
  const listQuery = `
    ${DEPUTADOS_GASTOS_CTE}
    SELECT *
    FROM deputados_gastos
    ${FILTER_DEPUTADOS_GASTOS}
    ORDER BY ${orderColumn} ${orderDirection}, nome ASC
    LIMIT $4 OFFSET $5
  `

  const [totalResult, listResult] = await Promise.all([
    pool.query<TotalRow>(totalQuery, queryParams),
    pool.query<QueryRow>(listQuery, [...queryParams, PAGE_SIZE, offset]),
  ])

  const totalItems = totalResult.rows[0]?.total ?? 0

  return {
    data: listResult.rows.map(toDeputadoGastos),
    page,
    pageSize: PAGE_SIZE,
    totalItems,
    totalPages: Math.ceil(totalItems / PAGE_SIZE),
    ordem: params.ordem,
    metrica: params.metrica,
    nome: params.nome,
    partido: params.partido,
    uf: params.uf,
  }
}

export async function getDeputadosFilterOptions(): Promise<DeputadosFilterOptions> {
  const result = await pool.query<FilterOptionsRow>(QUERY_FILTER_OPTIONS)
  const row = result.rows[0]

  return {
    partidos: row?.partidos ?? [],
    ufs: row?.ufs ?? [],
  }
}

export async function getTodosDeputadosGastos(): Promise<{
  deputados: DeputadoGastos[]
  filtros: DeputadosFilterOptions
}> {
  const [deputadosResult, filtros] = await Promise.all([
    pool.query<QueryRow>(`
      ${DEPUTADOS_GASTOS_CTE}
      SELECT *
      FROM deputados_gastos
      ORDER BY nome ASC
    `),
    getDeputadosFilterOptions(),
  ])

  return {
    deputados: deputadosResult.rows.map(toDeputadoGastos),
    filtros,
  }
}

function toDeputadoGastos(row: QueryRow): DeputadoGastos {
  return {
    id: row.id,
    nome: row.nome,
    foto: row.foto,
    partido: row.partido,
    uf: row.uf,
    totalGastos: row.total_gastos,
    quantidadeDespesas: row.quantidade_despesas,
  }
}
