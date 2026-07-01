import { Pool } from 'pg'
import type { EixoAtuacao } from '../../questao_2/types.ts'
import type {
  HistoricoVotosFiltro,
  Questao3Response,
  ResumoVotoDeputado,
  VotoDeputadoTema,
} from '../types.ts'

const DEFAULT_LIMIT = 60
const MAX_LIMIT = 120

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

const EIXO_LABELS: Record<EixoAtuacao, string> = {
  social: 'Social',
  economico: 'Econômico',
  tributario: 'Tributário',
  seguranca: 'Segurança',
  saude: 'Saúde',
  educacao: 'Educação',
  meio_ambiente: 'Meio ambiente',
  infraestrutura: 'Infraestrutura',
  administrativo: 'Administrativo',
  outros: 'Outros',
}

const EIXO_TERMOS: Record<EixoAtuacao, string[]> = {
  social: [
    'direitos humanos',
    'minorias',
    'assistencia social',
    'previdencia',
    'trabalho',
    'emprego',
    'cultura',
    'esporte',
    'habitacao',
    'familia',
    'crianca',
    'mulher',
    'idoso',
  ],
  economico: [
    'economia',
    'financas',
    'orcamento',
    'industria',
    'comercio',
    'servicos',
    'agricultura',
    'pecuaria',
    'credito',
    'empresa',
    'mercado',
  ],
  tributario: [
    'tribut',
    'imposto',
    'taxa',
    'fiscal',
    'arrecadacao',
    'isencao',
    'deducao',
  ],
  seguranca: [
    'seguranca',
    'defesa',
    'penal',
    'crime',
    'criminal',
    'policia',
    'violencia',
    'prisao',
    'trafico',
  ],
  saude: [
    'saude',
    'hospital',
    'medicamento',
    'vacina',
    'doenca',
    'paciente',
    'tratamento',
  ],
  educacao: [
    'educacao',
    'ensino',
    'escola',
    'universidade',
    'professor',
    'estudante',
    'aluno',
    'creche',
    'fundeb',
  ],
  meio_ambiente: [
    'meio ambiente',
    'ambient',
    'sustentavel',
    'floresta',
    'clima',
    'carbono',
    'biodiversidade',
    'desmatamento',
  ],
  infraestrutura: [
    'infraestrutura',
    'transporte',
    'mobilidade',
    'viacao',
    'rodovia',
    'ferrovia',
    'energia',
    'comunicacoes',
    'saneamento',
  ],
  administrativo: [
    'administracao publica',
    'processo legislativo',
    'politica',
    'partidos',
    'eleicoes',
    'constitucional',
    'justica',
    'servidor',
    'governo',
    'gestao',
    'licitacao',
  ],
  outros: ['outros'],
}

const ACCENTED_CHARS =
  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'
const UNACCENTED_CHARS =
  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'

type DeputadoRow = {
  nome: string
}

type HistoricoVotosRow = {
  id_votacao: string
  data_hora_voto: Date | null
  data_votacao: Date | null
  voto: string | null
  descricao: string | null
  orgao: string | null
  proposicao_uri: string | null
  proposicao_titulo: string | null
  proposicao_ementa: string | null
  temas: string | null
  total_registros: number
}

type ResumoVotoRow = {
  voto: string | null
  total: number
}

type TemaDisponivelRow = {
  tema: string
}

type FilterSql = {
  clause: string
  patterns: string[]
  label: string
  value: string
}

export async function getHistoricoVotosDeputado(params: {
  deputadoId: number
  filtro: HistoricoVotosFiltro
  limit?: number
  page?: number
}): Promise<Questao3Response | null> {
  const deputadoResult = await pool.query<DeputadoRow>(
    'SELECT nome FROM deputado WHERE id_deputado = $1',
    [params.deputadoId],
  )

  const deputado = deputadoResult.rows[0]

  if (!deputado) {
    return null
  }

  const filterSql = buildFilterSql(params.filtro)
  const limit = normalizeLimit(params.limit)
  const page = normalizePage(params.page)
  const offset = (page - 1) * limit
  const queryParams = [params.deputadoId, filterSql.patterns, limit, offset]

  const [votosResult, resumoResult, temasResult] = await Promise.all([
    pool.query<HistoricoVotosRow>(buildHistoricoQuery(filterSql.clause), queryParams),
    pool.query<ResumoVotoRow>(buildResumoQuery(filterSql.clause), [
      params.deputadoId,
      filterSql.patterns,
    ]),
    pool.query<TemaDisponivelRow>(
      `
        SELECT DISTINCT pt.tema
        FROM voto_deputado vd
        JOIN votacao_proposicao vp
          ON vp.id_votacao = vd.id_votacao
        JOIN proposicao_tema pt
          ON pt.uri_proposicao = vp.proposicao_uri
        WHERE vd.id_deputado = $1
          AND NULLIF(TRIM(pt.tema), '') IS NOT NULL
        ORDER BY pt.tema ASC
        LIMIT 100
      `,
      [params.deputadoId],
    ),
  ])

  const totalVotacoes =
    votosResult.rows[0]?.total_registros ??
    resumoResult.rows.reduce((total, row) => total + row.total, 0)

  return {
    deputadoId: params.deputadoId,
    deputadoNome: deputado.nome,
    filtro: {
      tipo: params.filtro.tipo,
      valor: filterSql.value,
      label: filterSql.label,
    },
    totalVotacoes,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(totalVotacoes / limit)),
    resumoVotos: resumoResult.rows.map(toResumoVoto),
    temasDisponiveis: temasResult.rows.map((row) => row.tema),
    votos: votosResult.rows.map(toVotoDeputadoTema),
  }
}

function buildHistoricoQuery(filterClause: string): string {
  return `
    WITH votos_filtrados AS (
      SELECT
        vd.id_votacao,
        vd.data_hora_voto,
        vd.voto,
        v.data AS data_votacao,
        v.descricao,
        v.sigla_orgao AS orgao,
        vp.proposicao_uri,
        vp.proposicao_titulo,
        vp.proposicao_ementa,
        STRING_AGG(DISTINCT pt.tema, ', ' ORDER BY pt.tema) AS temas
      FROM voto_deputado vd
      JOIN votacao v
        ON v.id_votacao = vd.id_votacao
      JOIN votacao_proposicao vp
        ON vp.id_votacao = vd.id_votacao
      JOIN proposicao_tema pt
        ON pt.uri_proposicao = vp.proposicao_uri
      WHERE vd.id_deputado = $1
        AND ${filterClause}
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
    )
    SELECT
      *,
      COUNT(*) OVER()::int AS total_registros
    FROM votos_filtrados
    ORDER BY COALESCE(data_hora_voto, data_votacao::timestamp) DESC, id_votacao DESC
    LIMIT $3
    OFFSET $4
  `
}

function buildResumoQuery(filterClause: string): string {
  return `
    WITH votos_filtrados AS (
      SELECT DISTINCT
        vd.id_votacao,
        vp.proposicao_uri,
        vd.voto
      FROM voto_deputado vd
      JOIN votacao v
        ON v.id_votacao = vd.id_votacao
      JOIN votacao_proposicao vp
        ON vp.id_votacao = vd.id_votacao
      JOIN proposicao_tema pt
        ON pt.uri_proposicao = vp.proposicao_uri
      WHERE vd.id_deputado = $1
        AND ${filterClause}
    )
    SELECT
      COALESCE(NULLIF(TRIM(voto), ''), 'Sem registro') AS voto,
      COUNT(*)::int AS total
    FROM votos_filtrados
    GROUP BY COALESCE(NULLIF(TRIM(voto), ''), 'Sem registro')
    ORDER BY total DESC, voto ASC
  `
}

function buildFilterSql(filtro: HistoricoVotosFiltro): FilterSql {
  if (filtro.tipo === 'tema') {
    const tema = filtro.tema.trim()

    return {
      clause: `${normalizeColumn('pt.tema')} LIKE ANY($2::text[])`,
      patterns: [`%${normalizeText(tema)}%`],
      label: tema,
      value: tema,
    }
  }

  const terms: string[] = EIXO_TERMOS[filtro.eixo]
  const patterns = terms.map((term: string) => `%${normalizeText(term)}%`)

  return {
    clause: `${normalizeColumn('pt.tema')} LIKE ANY($2::text[])`,
    patterns,
    label: EIXO_LABELS[filtro.eixo],
    value: filtro.eixo,
  }
}

function normalizeColumn(column: string): string {
  return `LOWER(TRANSLATE(COALESCE(${column}, ''), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'))`
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeLimit(limit: number | undefined): number {
  if (!limit) {
    return DEFAULT_LIMIT
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit)))
}

function normalizePage(page: number | undefined): number {
  if (!page) {
    return 1
  }

  return Math.max(1, Math.trunc(page))
}

function toResumoVoto(row: ResumoVotoRow): ResumoVotoDeputado {
  return {
    voto: row.voto ?? 'Sem registro',
    total: row.total,
  }
}

function toVotoDeputadoTema(row: HistoricoVotosRow): VotoDeputadoTema {
  return {
    idVotacao: row.id_votacao,
    dataHoraVoto: row.data_hora_voto?.toISOString() ?? null,
    dataVotacao: row.data_votacao?.toISOString() ?? null,
    voto: row.voto?.trim() || 'Sem registro',
    descricao: row.descricao,
    orgao: row.orgao,
    proposicaoUri: row.proposicao_uri,
    proposicaoTitulo: row.proposicao_titulo,
    proposicaoEmenta: row.proposicao_ementa,
    temas: row.temas
      ? row.temas
          .split(',')
          .map((tema) => tema.trim())
          .filter(Boolean)
      : [],
  }
}
