import { Pool } from 'pg'
import type {
  FornecedorRanking,
  Questao5Filters,
  Questao5Response,
} from '../types.ts'

const MAX_FORNECEDORES = 20

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

type TotalRankingRow = {
  total_recebido: number | string
  total_fornecedores: number
}

type FornecedorRankingRow = {
  fornecedor: string
  cnpj_cpf: string | null
  total_recebido: number | string
  quantidade_despesas: number
}

type FilterOptionsRow = {
  categorias: string[]
  anos: number[]
}

const FILTER_CLAUSE = `
  WHERE cod_legislatura = 57
    AND ($1::text IS NULL OR txt_descricao = $1)
    AND ($2::int IS NULL OR num_ano = $2)
    AND ($3::int IS NULL OR ide_cadastro = $3)
`

const QUERY_TOTAL_RANKING = `
  SELECT
    COALESCE(SUM(vlr_liquido), 0) AS total_recebido,
    COUNT(DISTINCT COALESCE(NULLIF(BTRIM(txt_cnpj_cpf), ''), NULLIF(BTRIM(txt_fornecedor), ''), 'Sem fornecedor'))::int
      AS total_fornecedores
  FROM despesa_parlamentar
  ${FILTER_CLAUSE}
`

const QUERY_FORNECEDORES_RANKING = `
  SELECT
    COALESCE(NULLIF(BTRIM(txt_fornecedor), ''), 'Fornecedor não informado') AS fornecedor,
    NULLIF(BTRIM(txt_cnpj_cpf), '') AS cnpj_cpf,
    COALESCE(SUM(vlr_liquido), 0) AS total_recebido,
    COUNT(*)::int AS quantidade_despesas
  FROM despesa_parlamentar
  ${FILTER_CLAUSE}
  GROUP BY
    COALESCE(NULLIF(BTRIM(txt_fornecedor), ''), 'Fornecedor não informado'),
    NULLIF(BTRIM(txt_cnpj_cpf), '')
  ORDER BY total_recebido DESC, fornecedor ASC
  LIMIT $4
`

const QUERY_FILTER_OPTIONS = `
  SELECT
    ARRAY(
      SELECT DISTINCT BTRIM(txt_descricao)
      FROM despesa_parlamentar
      WHERE cod_legislatura = 57
        AND txt_descricao IS NOT NULL
        AND BTRIM(txt_descricao) <> ''
      ORDER BY BTRIM(txt_descricao)
    ) AS categorias,
    ARRAY(
      SELECT DISTINCT num_ano
      FROM despesa_parlamentar
      WHERE cod_legislatura = 57
        AND num_ano IS NOT NULL
      ORDER BY num_ano DESC
    ) AS anos
`

export async function getRankingFornecedores(
  filters: {
    categoria?: string | null
    ano?: number | null
    deputadoId?: number | null
  } = {},
): Promise<Questao5Response> {
  const normalizedFilters: Questao5Filters = {
    categoria: filters.categoria?.trim() || null,
    ano: filters.ano ?? null,
    deputadoId: filters.deputadoId ?? null,
  }
  const queryParams = [
    normalizedFilters.categoria,
    normalizedFilters.ano,
    normalizedFilters.deputadoId,
  ]

  const [totalResult, fornecedoresResult, optionsResult] = await Promise.all([
    pool.query<TotalRankingRow>(QUERY_TOTAL_RANKING, queryParams),
    pool.query<FornecedorRankingRow>(QUERY_FORNECEDORES_RANKING, [
      ...queryParams,
      MAX_FORNECEDORES,
    ]),
    pool.query<FilterOptionsRow>(QUERY_FILTER_OPTIONS),
  ])
  const totalRow = totalResult.rows[0]
  const totalRecebido = Number(totalRow?.total_recebido ?? 0)
  const optionsRow = optionsResult.rows[0]

  return {
    totalRecebido,
    totalFornecedores: totalRow?.total_fornecedores ?? 0,
    filtros: normalizedFilters,
    categoriasDisponiveis: optionsRow?.categorias ?? [],
    anosDisponiveis: optionsRow?.anos ?? [],
    fornecedores: fornecedoresResult.rows.map((row) =>
      toFornecedorRanking(row, totalRecebido),
    ),
  }
}

function toFornecedorRanking(
  row: FornecedorRankingRow,
  totalRecebido: number,
): FornecedorRanking {
  const totalFornecedor = Number(row.total_recebido)

  return {
    fornecedor: row.fornecedor,
    cnpjCpf: row.cnpj_cpf,
    totalRecebido: totalFornecedor,
    quantidadeDespesas: row.quantidade_despesas,
    percentual:
      totalRecebido > 0 ? round((totalFornecedor / totalRecebido) * 100, 2) : 0,
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
