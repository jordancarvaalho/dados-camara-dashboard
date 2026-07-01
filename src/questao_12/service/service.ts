import { Pool } from 'pg'
import type { FornecedorDeputado, Questao12Response } from '../types.ts'

const MAX_FORNECEDORES = 8
const CONCENTRATION_THRESHOLD = 30

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

type TotalFornecedorRow = {
  total_gasto: number | string
  total_fornecedores: number
}

type FornecedorRow = {
  fornecedor: string
  cnpj_cpf: string | null
  total_gasto: number | string
  transacoes: number
  deputados_mesmo_partido: number
}

const QUERY_TOTAL_FORNECEDORES = `
  SELECT
    COALESCE(SUM(vlr_liquido), 0) AS total_gasto,
    COUNT(DISTINCT COALESCE(NULLIF(BTRIM(txt_cnpj_cpf), ''), NULLIF(BTRIM(txt_fornecedor), ''), 'Sem fornecedor'))::int
      AS total_fornecedores
  FROM despesa_parlamentar
  WHERE ide_cadastro = $1
    AND cod_legislatura = 57
`

const QUERY_FORNECEDORES = `
  WITH deputado_partido AS (
    SELECT
      COALESCE(
        (ARRAY_AGG(BTRIM(sg_partido) ORDER BY num_ano DESC, num_mes DESC)
          FILTER (WHERE sg_partido IS NOT NULL AND BTRIM(sg_partido) <> ''))[1],
        NULL
      ) AS partido
    FROM despesa_parlamentar
    WHERE ide_cadastro = $1
      AND cod_legislatura = 57
  ),
  fornecedores AS (
    SELECT
      COALESCE(NULLIF(BTRIM(txt_fornecedor), ''), 'Fornecedor não informado') AS fornecedor,
      NULLIF(BTRIM(txt_cnpj_cpf), '') AS cnpj_cpf,
      COALESCE(SUM(vlr_liquido), 0) AS total_gasto,
      COUNT(*)::int AS transacoes
    FROM despesa_parlamentar
    WHERE ide_cadastro = $1
      AND cod_legislatura = 57
    GROUP BY
      COALESCE(NULLIF(BTRIM(txt_fornecedor), ''), 'Fornecedor não informado'),
      NULLIF(BTRIM(txt_cnpj_cpf), '')
  )
  SELECT
    f.fornecedor,
    f.cnpj_cpf,
    f.total_gasto,
    f.transacoes,
    COALESCE((
      SELECT COUNT(DISTINCT dp.ide_cadastro)::int
      FROM despesa_parlamentar dp
      CROSS JOIN deputado_partido p
      WHERE p.partido IS NOT NULL
        AND dp.cod_legislatura = 57
        AND BTRIM(COALESCE(dp.sg_partido, '')) = p.partido
        AND NULLIF(BTRIM(dp.txt_cnpj_cpf), '') IS NOT DISTINCT FROM f.cnpj_cpf
        AND f.cnpj_cpf IS NOT NULL
    ), 0) AS deputados_mesmo_partido
  FROM fornecedores f
  ORDER BY f.total_gasto DESC, f.fornecedor ASC
  LIMIT $2
`

export async function getFornecedoresDeputado(
  deputadoId: number,
): Promise<Questao12Response> {
  const [totalResult, fornecedoresResult] = await Promise.all([
    pool.query<TotalFornecedorRow>(QUERY_TOTAL_FORNECEDORES, [deputadoId]),
    pool.query<FornecedorRow>(QUERY_FORNECEDORES, [deputadoId, MAX_FORNECEDORES]),
  ])
  const totalRow = totalResult.rows[0]
  const totalGasto = Number(totalRow?.total_gasto ?? 0)

  return {
    deputadoId,
    totalGasto,
    totalFornecedores: totalRow?.total_fornecedores ?? 0,
    fornecedores: fornecedoresResult.rows.map((row) =>
      toFornecedorDeputado(row, totalGasto),
    ),
  }
}

function toFornecedorDeputado(
  row: FornecedorRow,
  totalGasto: number,
): FornecedorDeputado {
  const totalFornecedor = Number(row.total_gasto)
  const percentual = totalGasto > 0 ? round((totalFornecedor / totalGasto) * 100, 2) : 0
  const deputadosMesmoPartido = row.deputados_mesmo_partido

  return {
    fornecedor: row.fornecedor,
    cnpjCpf: row.cnpj_cpf,
    totalGasto: totalFornecedor,
    transacoes: row.transacoes,
    ticketMedio: row.transacoes > 0 ? round(totalFornecedor / row.transacoes, 2) : 0,
    percentual,
    deputadosMesmoPartido,
    alertaConcentracao: percentual >= CONCENTRATION_THRESHOLD,
    alertaMesmoPartido: deputadosMesmoPartido > 1,
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
