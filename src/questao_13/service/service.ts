import { Pool } from 'pg'
import type { CategoriaDespesaDeputado, Questao13Response } from '../types.ts'

const MAX_CATEGORIAS = 12

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

type CategoriaDespesaRow = {
  categoria: string
  total_gasto: number | string
  quantidade_despesas: number
}

type TotalDespesaRow = {
  total_gasto: number | string
  total_categorias: number
}

const QUERY_TOTAL_DESPESAS = `
  SELECT
    COALESCE(SUM(vlr_liquido), 0) AS total_gasto,
    COUNT(DISTINCT COALESCE(NULLIF(BTRIM(txt_descricao), ''), 'Sem categoria'))::int
      AS total_categorias
  FROM despesa_parlamentar
  WHERE ide_cadastro = $1
    AND cod_legislatura = 57
`

const QUERY_CATEGORIAS_DESPESA = `
  SELECT
    COALESCE(NULLIF(BTRIM(txt_descricao), ''), 'Sem categoria') AS categoria,
    COALESCE(SUM(vlr_liquido), 0) AS total_gasto,
    COUNT(*)::int AS quantidade_despesas
  FROM despesa_parlamentar
  WHERE ide_cadastro = $1
    AND cod_legislatura = 57
  GROUP BY COALESCE(NULLIF(BTRIM(txt_descricao), ''), 'Sem categoria')
  ORDER BY total_gasto DESC, categoria ASC
  LIMIT $2
`

export async function getCategoriasDespesaDeputado(
  deputadoId: number,
): Promise<Questao13Response> {
  const [totalResult, categoriasResult] = await Promise.all([
    pool.query<TotalDespesaRow>(QUERY_TOTAL_DESPESAS, [deputadoId]),
    pool.query<CategoriaDespesaRow>(QUERY_CATEGORIAS_DESPESA, [
      deputadoId,
      MAX_CATEGORIAS,
    ]),
  ])
  const totalRow = totalResult.rows[0]
  const totalGasto = Number(totalRow?.total_gasto ?? 0)

  return {
    deputadoId,
    totalGasto,
    totalCategorias: totalRow?.total_categorias ?? 0,
    categorias: categoriasResult.rows.map((row) =>
      toCategoriaDespesa(row, totalGasto),
    ),
  }
}

function toCategoriaDespesa(
  row: CategoriaDespesaRow,
  totalGasto: number,
): CategoriaDespesaDeputado {
  const categoriaGasto = Number(row.total_gasto)

  return {
    categoria: row.categoria,
    totalGasto: categoriaGasto,
    quantidadeDespesas: row.quantidade_despesas,
    percentual: totalGasto > 0 ? round((categoriaGasto / totalGasto) * 100, 2) : 0,
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
