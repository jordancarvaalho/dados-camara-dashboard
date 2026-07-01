import { Pool } from 'pg'
import type {
  DeputadoEixoAtuacao,
  EixoAtuacao,
  EixoDeputadoResumo,
  EixoResumo,
  Questao2Response,
  TermoNuvem,
} from '../types.ts'

const DEFAULT_LIMIT = 6

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

const EIXOS: EixoAtuacao[] = [
  'social',
  'economico',
  'tributario',
  'seguranca',
  'saude',
  'educacao',
  'meio_ambiente',
  'infraestrutura',
  'administrativo',
  'outros',
]

const AXIS_RULES: Array<{ eixo: EixoAtuacao; terms: string[] }> = [
  {
    eixo: 'tributario',
    terms: [
      'tribut',
      'imposto',
      'taxa',
      'fiscal',
      'ipi',
      'icms',
      'irpf',
      'irpj',
      'cofins',
      'contribuição',
      'arrecadação',
      'isenção',
      'dedução',
    ],
  },
  {
    eixo: 'saude',
    terms: [
      'saúde',
      'sus',
      'hospital',
      'medicamento',
      'vacina',
      'doença',
      'paciente',
      'tratamento',
      'epidemi',
      'enfermagem',
    ],
  },
  {
    eixo: 'educacao',
    terms: [
      'educação',
      'ensino',
      'escola',
      'universidade',
      'professor',
      'estudante',
      'aluno',
      'creche',
      'fundeb',
      'aprendizagem',
    ],
  },
  {
    eixo: 'seguranca',
    terms: [
      'segurança',
      'defesa e segurança',
      'penal',
      'crime',
      'criminal',
      'polícia',
      'violência',
      'arma',
      'prisão',
      'tráfico',
      'homicídio',
    ],
  },
  {
    eixo: 'meio_ambiente',
    terms: [
      'meio ambiente',
      'ambient',
      'sustentável',
      'sustentabilidade',
      'floresta',
      'clima',
      'carbono',
      'reciclagem',
      'biodiversidade',
      'desmatamento',
    ],
  },
  {
    eixo: 'infraestrutura',
    terms: [
      'infraestrutura',
      'transporte',
      'mobilidade',
      'viação',
      'rodovia',
      'ferrovia',
      'energia',
      'minerais',
      'comunicações',
      'telecomunicações',
      'urbano',
      'saneamento',
    ],
  },
  {
    eixo: 'economico',
    terms: [
      'economia',
      'finanças',
      'orçamento',
      'indústria',
      'comércio',
      'serviços',
      'agricultura',
      'pecuária',
      'pesca',
      'extrativismo',
      'crédito',
      'consumidor',
      'empresa',
      'mercado',
    ],
  },
  {
    eixo: 'social',
    terms: [
      'direitos humanos',
      'minorias',
      'assistência social',
      'previdência',
      'trabalho',
      'emprego',
      'cultura',
      'esporte',
      'lazer',
      'habitação',
      'família',
      'criança',
      'mulher',
      'idoso',
    ],
  },
  {
    eixo: 'administrativo',
    terms: [
      'administração pública',
      'processo legislativo',
      'política',
      'partidos',
      'eleições',
      'constitucional',
      'justiça',
      'servidor',
      'governo',
      'gestão',
      'licitação',
      'contrato',
    ],
  },
]

const STOP_WORDS = new Set([
  'ainda',
  'altera',
  'alteracao',
  'aplausos',
  'artigo',
  'apreciacao',
  'brasil',
  'brasileira',
  'brasileiro',
  'carioca',
  'codigo',
  'camara',
  'comissao',
  'congratulacoes',
  'congresso',
  'decreto',
  'define',
  'dispoe',
  'encaminha',
  'estado',
  'estabelece',
  'federal',
  'forma',
  'geral',
  'homenagem',
  'homenagens',
  'informacoes',
  'institui',
  'janeiro',
  'junto',
  'legislativo',
  'louvor',
  'medida',
  'ministerio',
  'mocao',
  'municipal',
  'municipio',
  'nacional',
  'normas',
  'outras',
  'parlamentar',
  'prestados',
  'presidente',
  'processado',
  'providencias',
  'projeto',
  'publica',
  'publico',
  'reger',
  'regozijo',
  'regime',
  'requer',
  'requerimento',
  'revisao',
  'senado',
  'servicos',
  'senhor',
  'senhora',
  'silva',
  'solicita',
  'sociedade',
  'sobre',
  'termos',
  'uniao',
  'urgencia',
  'voto',
  'excelente',
  'excelentes',
  'pelas',
  'pelo',
  'pelos',
])

const TERM_LABELS: Record<string, string> = {
  administracao: 'Administração',
  ambiente: 'Ambiente',
  assistencia: 'Assistência',
  biodiversidade: 'Biodiversidade',
  ciencia: 'Ciência',
  comunicacoes: 'Comunicações',
  constitucional: 'Constitucional',
  criacao: 'Criação',
  crianca: 'Criança',
  deducao: 'Dedução',
  direitos: 'Direitos',
  doenca: 'Doença',
  economico: 'Econômico',
  economica: 'Econômica',
  economia: 'Economia',
  educacao: 'Educação',
  eleicoes: 'Eleições',
  financas: 'Finanças',
  gestao: 'Gestão',
  hidricos: 'Hídricos',
  industria: 'Indústria',
  indigenas: 'Indígenas',
  inovacao: 'Inovação',
  isencao: 'Isenção',
  licitacao: 'Licitação',
  mineracao: 'Mineração',
  minorias: 'Minorias',
  orcamento: 'Orçamento',
  pecuaria: 'Pecuária',
  previdencia: 'Previdência',
  proposicoes: 'Proposições',
  protecao: 'Proteção',
  publica: 'Pública',
  publicas: 'Públicas',
  publico: 'Público',
  publicos: 'Públicos',
  relacoes: 'Relações',
  saude: 'Saúde',
  seguranca: 'Segurança',
  servicos: 'Serviços',
  sustentavel: 'Sustentável',
  tributario: 'Tributário',
  tributaria: 'Tributária',
  viacao: 'Viação',
  violencia: 'Violência',
}

const LOWERCASE_TERMS = new Set(['a', 'as', 'da', 'das', 'de', 'do', 'dos', 'e'])

const QUERY_DEPUTY_CORPUS = `
  WITH proposicoes_por_deputado AS (
    SELECT
      d.id_deputado AS id,
      d.nome,
      d.foto,
      NULLIF(MAX(a.sigla_partido_autor), '') AS partido,
      NULLIF(MAX(a.sigla_uf_autor), '') AS uf,
      a.id_proposicao,
      COALESCE(p.keywords, '') AS keywords,
      COALESCE(p.ementa, '') AS ementa,
      COALESCE(STRING_AGG(DISTINCT pt.tema, ' | '), '') AS temas
    FROM deputado d
    JOIN autoria a
      ON a.id_deputado_autor = d.id_deputado
    JOIN proposicao p
      ON p.id_proposicao = a.id_proposicao
    LEFT JOIN proposicao_tema pt
      ON pt.id_proposicao = p.id_proposicao
    WHERE p.ano BETWEEN 2023 AND 2026
    GROUP BY
      d.id_deputado,
      d.nome,
      d.foto,
      a.id_proposicao,
      p.keywords,
      p.ementa
  )
  SELECT
    id,
    nome,
    foto,
    MAX(partido) AS partido,
    MAX(uf) AS uf,
    COUNT(*)::int AS total_proposicoes,
    STRING_AGG(keywords, ', ') AS keywords_corpus,
    STRING_AGG(ementa, ' ') AS ementa_corpus,
    STRING_AGG(temas, ' | ') AS tema_corpus
  FROM proposicoes_por_deputado
  GROUP BY id, nome, foto
  ORDER BY total_proposicoes DESC, nome ASC
`

type DeputyCorpusRow = {
  id: number
  nome: string
  foto: string
  partido: string | null
  uf: string | null
  total_proposicoes: number
  keywords_corpus: string | null
  ementa_corpus: string | null
  tema_corpus: string | null
}

type DeputyScore = {
  row: DeputyCorpusRow
  eixoPredominante: EixoAtuacao
  eixos: EixoDeputadoResumo[]
  termos: TermoNuvem[]
}

type CachedQuestao2Data = {
  scores: DeputyScore[]
  axisSummary: EixoResumo[]
  totalDeputados: number
  totalProposicoes: number
}

let cachedData: CachedQuestao2Data | null = null

export async function getDeputadosEixosAtuacao(params?: {
  limit?: number
}): Promise<Questao2Response> {
  const limit = Math.max(1, Math.min(12, Math.trunc(params?.limit ?? DEFAULT_LIMIT)))
  const data = await getCachedData()
  const selectedDeputies = selectDeputiesByAxis(data, limit).map(
    toDeputadoEixoAtuacao,
  )

  return {
    totalDeputados: data.totalDeputados,
    totalProposicoes: data.totalProposicoes,
    eixos: data.axisSummary,
    deputados: selectedDeputies,
  }
}

export async function getDeputadoEixoAtuacao(
  deputadoId: number,
): Promise<DeputadoEixoAtuacao | null> {
  const data = await getCachedData()
  const score = data.scores.find((item) => item.row.id === deputadoId)

  return score ? toDeputadoEixoAtuacao(score) : null
}

function selectDeputiesByAxis(
  data: CachedQuestao2Data,
  limit: number,
): DeputyScore[] {
  const selected = new Map<number, DeputyScore>()

  data.axisSummary.forEach((axis) => {
    if (selected.size >= limit) {
      return
    }

    const deputy = data.scores.find(
      (score) =>
        score.eixoPredominante === axis.eixo && !selected.has(score.row.id),
    )

    if (deputy) {
      selected.set(deputy.row.id, deputy)
    }
  })

  data.scores.forEach((score) => {
    if (selected.size < limit && !selected.has(score.row.id)) {
      selected.set(score.row.id, score)
    }
  })

  return Array.from(selected.values())
}

async function getCachedData(): Promise<CachedQuestao2Data> {
  if (cachedData) {
    return cachedData
  }

  const result = await pool.query<DeputyCorpusRow>(QUERY_DEPUTY_CORPUS)
  const scores = result.rows.map(scoreDeputy)

  cachedData = {
    scores,
    axisSummary: buildAxisSummary(scores),
    totalDeputados: scores.length,
    totalProposicoes: scores.reduce(
      (total, score) => total + score.row.total_proposicoes,
      0,
    ),
  }

  return cachedData
}

function scoreDeputy(row: DeputyCorpusRow): DeputyScore {
  const corpus = [
    row.keywords_corpus,
    row.ementa_corpus,
    row.tema_corpus,
  ].join(' ')
  const eixos = buildAxisScores(corpus)
  const eixoPredominante = eixos[0]?.eixo ?? 'outros'

  return {
    row,
    eixoPredominante,
    eixos,
    termos: buildWordCloud(row),
  }
}

function buildAxisScores(corpus: string): EixoDeputadoResumo[] {
  const normalizedCorpus = normalizeText(corpus)
  const scores = AXIS_RULES.map((rule) => ({
    eixo: rule.eixo,
    total: rule.terms.reduce(
      (total, term) => total + countOccurrences(normalizedCorpus, term),
      0,
    ),
  }))

  const sortedScores = scores
    .filter((score) => score.total > 0)
    .sort((first, second) => second.total - first.total)

  if (sortedScores.length === 0) {
    return [{ eixo: 'outros', total: 1 }]
  }

  return sortedScores
}

function buildAxisSummary(scores: DeputyScore[]): EixoResumo[] {
  const summary = new Map<EixoAtuacao, EixoResumo>()

  EIXOS.forEach((eixo) => {
    summary.set(eixo, {
      eixo,
      totalDeputados: 0,
      totalProposicoes: 0,
    })
  })

  scores.forEach((score) => {
    const item = summary.get(score.eixoPredominante)

    if (!item) {
      return
    }

    item.totalDeputados += 1
    item.totalProposicoes += score.row.total_proposicoes
  })

  return EIXOS.map((eixo) => summary.get(eixo))
    .filter((item): item is EixoResumo => Boolean(item))
    .filter((item) => item.totalDeputados > 0)
    .sort((first, second) => second.totalDeputados - first.totalDeputados)
}

function buildWordCloud(row: DeputyCorpusRow): TermoNuvem[] {
  const terms = new Map<string, number>()

  addDelimitedTerms(terms, row.tema_corpus, '|', 4)
  addDelimitedTerms(terms, row.keywords_corpus, ',', 2)
  addTextTerms(terms, row.ementa_corpus, 1)

  const rankedTerms = Array.from(terms.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 14)

  const maxFrequency = rankedTerms[0]?.[1] ?? 1

  return rankedTerms.map(([termo, frequencia]) => ({
    termo: toTermLabel(termo),
    frequencia,
    peso: Math.max(1, Math.ceil((frequencia / maxFrequency) * 5)),
  }))
}

function addDelimitedTerms(
  terms: Map<string, number>,
  value: string | null,
  delimiter: string,
  weight: number,
) {
  value
    ?.split(delimiter)
    .map(cleanTerm)
    .filter(Boolean)
    .forEach((term) => addTerm(terms, term, weight))
}

function addTextTerms(
  terms: Map<string, number>,
  value: string | null,
  weight: number,
) {
  cleanTerm(value ?? '')
    .split(' ')
    .filter((term) => term.length > 4)
    .forEach((term) => addTerm(terms, term, weight))
}

function addTerm(terms: Map<string, number>, term: string, weight: number) {
  if (!shouldKeepTerm(term)) {
    return
  }

  terms.set(term, (terms.get(term) ?? 0) + weight)
}

function shouldKeepTerm(term: string): boolean {
  if (term.length <= 3 || STOP_WORDS.has(term)) {
    return false
  }

  const words = term.split(' ')
  return words.some((word) => word.length > 3 && !STOP_WORDS.has(word))
}

function cleanTerm(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function toTermLabel(value: string): string {
  return value
    .split(' ')
    .slice(0, 4)
    .map((word, index) => {
      if (index > 0 && LOWERCASE_TERMS.has(word)) {
        return word
      }

      return TERM_LABELS[word] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    })
    .join(' ')
}

function countOccurrences(value: string, term: string): number {
  const normalizedTerm = normalizeText(term)
  let count = 0
  let position = value.indexOf(normalizedTerm)

  while (position !== -1) {
    count += 1
    position = value.indexOf(normalizedTerm, position + normalizedTerm.length)
  }

  return count
}

function toDeputadoEixoAtuacao(score: DeputyScore): DeputadoEixoAtuacao {
  return {
    id: score.row.id,
    nome: score.row.nome,
    foto: score.row.foto,
    partido: score.row.partido,
    uf: score.row.uf,
    totalProposicoes: score.row.total_proposicoes,
    eixoPredominante: score.eixoPredominante,
    eixos: score.eixos.slice(0, 3),
    termos: score.termos,
  }
}
