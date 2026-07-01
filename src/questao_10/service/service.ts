import { Pool } from 'pg'
import type {
  CoesaoClassificacao,
  PartidoCoesao,
  Questao10Response,
} from '../types.ts'

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

const LIMITE_AMOSTRA_PEQUENA = 100

type CoesaoRow = {
  partido: string
  total_votos_analisados: number | string
  votos_alinhados: number | string
  votos_divergentes: number | string
  total_deputados: number
  total_votacoes: number
  pct_disciplina: number | string
}

const QUERY_COESAO = `
  WITH orientacoes_expandidas AS (
    SELECT
      BTRIM(vd.deputado_sigla_partido) AS partido,
      vd.id_deputado,
      vd.id_votacao,
      vd.voto,
      bv.orientacao AS orientacao_lider
    FROM voto_deputado vd
    JOIN bancada_votacao bv
      ON vd.id_votacao = bv.id_votacao
     AND (
       UPPER(BTRIM(bv.sigla_bancada)) =
         UPPER(BTRIM(vd.deputado_sigla_partido))
       OR UPPER(bv.sigla_bancada) LIKE
         '%' || UPPER(BTRIM(vd.deputado_sigla_partido)) || '%'
     )
    WHERE vd.voto IN ('Sim', 'Não')
      AND bv.orientacao IN ('Sim', 'Não')
      AND NULLIF(BTRIM(vd.deputado_sigla_partido), '') IS NOT NULL
  )
  SELECT
    partido,
    COUNT(*)::int AS total_votos_analisados,
    COUNT(*) FILTER (
      WHERE voto = orientacao_lider
    )::int AS votos_alinhados,
    COUNT(*) FILTER (
      WHERE voto <> orientacao_lider
    )::int AS votos_divergentes,
    COUNT(DISTINCT id_deputado)::int AS total_deputados,
    COUNT(DISTINCT id_votacao)::int AS total_votacoes,
    ROUND(
      AVG(
        CASE WHEN voto = orientacao_lider THEN 100.0 ELSE 0.0 END
      ),
      2
    ) AS pct_disciplina
  FROM orientacoes_expandidas
  GROUP BY partido
  ORDER BY pct_disciplina DESC, total_votos_analisados DESC, partido ASC
`

let cached: Questao10Response | null = null

export async function getRankingCoesaoPartidaria(): Promise<Questao10Response> {
  if (cached) {
    return cached
  }

  const result = await pool.query<CoesaoRow>(QUERY_COESAO)
  const ranking = result.rows.map(toPartidoCoesao)
  const totalComparacoes = ranking.reduce(
    (total, partido) => total + partido.totalVotosAnalisados,
    0,
  )
  const totalAlinhados = ranking.reduce(
    (total, partido) => total + partido.votosAlinhados,
    0,
  )

  cached = {
    totalPartidos: ranking.length,
    totalComparacoes,
    mediaPonderadaPct:
      totalComparacoes > 0
        ? round((totalAlinhados / totalComparacoes) * 100, 2)
        : 0,
    ranking,
    metodologia: {
      votosConsiderados: ['Sim', 'Não'],
      orientacoesConsideradas: ['Sim', 'Não'],
      pareamento:
        'Orientação direta do partido ou orientação de federação/bloco cujo nome contém a sigla.',
      limiteAmostraPequena: LIMITE_AMOSTRA_PEQUENA,
    },
  }

  return cached
}

function toPartidoCoesao(row: CoesaoRow, index: number): PartidoCoesao {
  const totalVotosAnalisados = Number(row.total_votos_analisados)
  const pctDisciplina = Number(row.pct_disciplina)

  return {
    posicao: index + 1,
    partido: row.partido,
    totalVotosAnalisados,
    votosAlinhados: Number(row.votos_alinhados),
    votosDivergentes: Number(row.votos_divergentes),
    totalDeputados: row.total_deputados,
    totalVotacoes: row.total_votacoes,
    pctDisciplina,
    classificacao: classificarCoesao(pctDisciplina),
    amostraPequena: totalVotosAnalisados < LIMITE_AMOSTRA_PEQUENA,
  }
}

function classificarCoesao(pct: number): CoesaoClassificacao {
  if (pct >= 95) {
    return 'Muito alta'
  }

  if (pct >= 90) {
    return 'Alta'
  }

  if (pct >= 80) {
    return 'Moderada'
  }

  return 'Baixa'
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
