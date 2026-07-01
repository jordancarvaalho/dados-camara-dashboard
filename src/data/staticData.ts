import type {
  DeputadoGastos,
  DeputadosFilterOptions,
  DeputadosGastosResponse,
  MetricaRanking,
  OrdemGastos,
} from '../questao_1/types'
import type { DeputadoEixoAtuacao, EixoAtuacao } from '../questao_2/types'
import type {
  HistoricoVotosFiltro,
  Questao3Response,
  ResumoVotoDeputado,
} from '../questao_3/types'
import type {
  EscolaridadeDeputado,
  EscolaridadeGrupo,
  Questao4Response,
} from '../questao_4/types'
import type { Questao5Response } from '../questao_5/types'
import type {
  CustoBeneficioDeputado,
  RankingCustoBeneficioResponse,
} from '../questao_7/types'
import type { Questao9Response } from '../questao_9/types'
import type { Questao10Response } from '../questao_10/types'
import type { Questao12Response } from '../questao_12/types'
import type { Questao13Response } from '../questao_13/types'
import type {
  DeputadoStaticData,
  Questao1StaticData,
  Questao4StaticData,
  Questao5StaticData,
  Questao7StaticData,
  StaticMetadata,
  VotosDeputadoStaticData,
} from './types'

const QUESTAO_1_PAGE_SIZE = 5
const QUESTAO_7_PAGE_SIZE = 25
const DEFAULT_VOTE_PAGE_SIZE = 8

const jsonCache = new Map<string, Promise<unknown>>()

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

export async function getStaticMetadata(): Promise<StaticMetadata> {
  return loadJson<StaticMetadata>('metadata.json')
}

export async function getStaticDeputadosFilterOptions(): Promise<DeputadosFilterOptions> {
  const data = await loadJson<Questao1StaticData>('questao-1.json')
  return data.filtros
}

export async function getStaticDeputadosGastos(params: {
  ordem: OrdemGastos
  metrica: MetricaRanking
  nome: string | null
  partido: string | null
  uf: string | null
  page: number
}): Promise<DeputadosGastosResponse> {
  const source = await loadJson<Questao1StaticData>('questao-1.json')
  const normalizedName = normalizeText(params.nome ?? '')
  const filtered = source.deputados.filter(
    (deputado) =>
      (!normalizedName ||
        normalizeText(deputado.nome).includes(normalizedName)) &&
      (!params.partido || deputado.partido === params.partido) &&
      (!params.uf || deputado.uf === params.uf),
  )
  const ordered = [...filtered].sort((first, second) => {
    const firstValue = metricValue(first, params.metrica)
    const secondValue = metricValue(second, params.metrica)
    const difference =
      params.ordem === 'menor'
        ? firstValue - secondValue
        : secondValue - firstValue

    return (
      difference || first.nome.localeCompare(second.nome, 'pt-BR')
    )
  })
  const totalPages = Math.max(
    1,
    Math.ceil(ordered.length / QUESTAO_1_PAGE_SIZE),
  )
  const page = Math.min(Math.max(1, Math.trunc(params.page)), totalPages)
  const start = (page - 1) * QUESTAO_1_PAGE_SIZE

  return {
    data: ordered.slice(start, start + QUESTAO_1_PAGE_SIZE),
    page,
    pageSize: QUESTAO_1_PAGE_SIZE,
    totalItems: ordered.length,
    totalPages,
    ordem: params.ordem,
    metrica: params.metrica,
    nome: params.nome,
    partido: params.partido,
    uf: params.uf,
  }
}

export async function getStaticDeputado(
  deputadoId: number,
): Promise<DeputadoStaticData> {
  return loadJson<DeputadoStaticData>(`deputados/${deputadoId}.json`)
}

export async function getStaticDeputadoEixos(
  deputadoId: number,
): Promise<DeputadoEixoAtuacao | null> {
  return (await getStaticDeputado(deputadoId)).eixos
}

export async function getStaticFornecedoresDeputado(
  deputadoId: number,
): Promise<Questao12Response> {
  return (await getStaticDeputado(deputadoId)).fornecedores
}

export async function getStaticCategoriasDeputado(
  deputadoId: number,
): Promise<Questao13Response> {
  return (await getStaticDeputado(deputadoId)).categoriasDespesa
}

export async function getStaticCustoBeneficioDeputado(
  deputadoId: number,
): Promise<CustoBeneficioDeputado | null> {
  const deputado = (await getStaticDeputado(deputadoId)).custoBeneficio

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

export async function getStaticHistoricoVotos(params: {
  deputadoId: number
  filtro: HistoricoVotosFiltro
  page?: number
  limit?: number
}): Promise<Questao3Response> {
  const source = await loadJson<VotosDeputadoStaticData>(
    `votos/${params.deputadoId}.json`,
  )
  const patterns =
    params.filtro.tipo === 'tema'
      ? [normalizeText(params.filtro.tema.trim())]
      : EIXO_TERMOS[params.filtro.eixo].map(normalizeText)
  const filtered = source.votos.filter((voto) =>
    voto.temas.some((tema) => {
      const normalizedTema = normalizeText(tema)
      return patterns.some((pattern) => normalizedTema.includes(pattern))
    }),
  )
  const pageSize = Math.max(1, Math.trunc(params.limit ?? DEFAULT_VOTE_PAGE_SIZE))
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(
    Math.max(1, Math.trunc(params.page ?? 1)),
    totalPages,
  )
  const start = (page - 1) * pageSize

  return {
    deputadoId: source.deputadoId,
    deputadoNome: source.deputadoNome,
    filtro: {
      tipo: params.filtro.tipo,
      valor:
        params.filtro.tipo === 'tema'
          ? params.filtro.tema.trim()
          : params.filtro.eixo,
      label:
        params.filtro.tipo === 'tema'
          ? params.filtro.tema.trim()
          : EIXO_LABELS[params.filtro.eixo],
    },
    totalVotacoes: filtered.length,
    page,
    pageSize,
    totalPages,
    resumoVotos: summarizeVotes(filtered),
    temasDisponiveis: source.temasDisponiveis,
    votos: filtered.slice(start, start + pageSize),
  }
}

export async function getStaticEscolaridade(filters: {
  partido?: string | null
  uf?: string | null
}): Promise<Questao4Response> {
  const source = await loadJson<Questao4StaticData>('questao-4.json')
  const partido = filters.partido?.trim() || null
  const uf = filters.uf?.trim() || null
  const deputados = source.deputados.filter(
    (deputado) =>
      (!partido || deputado.partido === partido) &&
      (!uf || deputado.uf === uf),
  )

  return {
    grupos: aggregateEducationGroups(deputados),
    deputados,
    totalDeputados: deputados.length,
    partidosDisponiveis: source.partidosDisponiveis,
    ufsDisponiveis: source.ufsDisponiveis,
    filtros: { partido, uf },
  }
}

export async function getStaticRankingFornecedores(filters: {
  categoria?: string | null
  ano?: number | null
}): Promise<Questao5Response> {
  const source = await loadJson<Questao5StaticData>('questao-5.json')
  const categoria = filters.categoria?.trim() || null
  const ano = filters.ano ?? null
  const key = JSON.stringify([categoria, ano])
  const response = source.recortes[key]

  if (!response) {
    return {
      totalRecebido: 0,
      totalFornecedores: 0,
      filtros: { categoria, ano, deputadoId: null },
      categoriasDisponiveis: source.categoriasDisponiveis,
      anosDisponiveis: source.anosDisponiveis,
      fornecedores: [],
    }
  }

  return response
}

export async function getStaticPosicionamentoIdeologico(): Promise<Questao9Response> {
  return loadJson<Questao9Response>('questao-9.json')
}

export async function getStaticCoesaoPartidaria(): Promise<Questao10Response> {
  return loadJson<Questao10Response>('questao-10.json')
}

export async function getStaticRankingCustoBeneficio(filters: {
  nome?: string | null
  partido?: string | null
  uf?: string | null
  gastoMinimo?: number
  ordem?: 'maior' | 'menor'
  page?: number
}): Promise<RankingCustoBeneficioResponse> {
  const source = await loadJson<Questao7StaticData>('questao-7.json')
  const nome = filters.nome?.trim() || null
  const partido = filters.partido?.trim() || null
  const uf = filters.uf?.trim() || null
  const gastoMinimo = Math.max(
    source.formula.gastoMinimoPadrao,
    filters.gastoMinimo ?? source.formula.gastoMinimoPadrao,
  )
  const ordem = filters.ordem === 'menor' ? 'menor' : 'maior'
  const normalizedName = normalizeText(nome ?? '')
  const filtered = source.ranking.filter(
    (deputado) =>
      (!normalizedName ||
        normalizeText(deputado.nome).includes(normalizedName)) &&
      (!partido || deputado.partido === partido) &&
      (!uf || deputado.uf === uf) &&
      deputado.gastoTotal >= gastoMinimo,
  )
  const ordered = ordem === 'menor' ? [...filtered].reverse() : filtered
  const totalPages = Math.max(
    1,
    Math.ceil(ordered.length / QUESTAO_7_PAGE_SIZE),
  )
  const page = Math.min(
    Math.max(1, Math.trunc(filters.page ?? 1)),
    totalPages,
  )
  const start = (page - 1) * QUESTAO_7_PAGE_SIZE
  const scores = filtered
    .map((deputado) => deputado.scoreCustoBeneficio)
    .sort((first, second) => first - second)

  return {
    deputados: ordered.slice(start, start + QUESTAO_7_PAGE_SIZE),
    totalDeputados: filtered.length,
    page,
    pageSize: QUESTAO_7_PAGE_SIZE,
    totalPages,
    filtros: { nome, partido, uf, gastoMinimo, ordem },
    partidosDisponiveis: source.partidosDisponiveis,
    ufsDisponiveis: source.ufsDisponiveis,
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
    formula: source.formula,
  }
}

async function loadJson<T>(relativePath: string): Promise<T> {
  const url = dataUrl(relativePath)
  let request = jsonCache.get(url)

  if (!request) {
    request = fetch(url).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar dados estáticos (${response.status}).`)
      }

      return response.json() as Promise<T>
    })
    jsonCache.set(url, request)
  }

  try {
    return (await request) as T
  } catch (error) {
    jsonCache.delete(url)
    throw error
  }
}

function dataUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return `${base}data/${relativePath}`
}

function metricValue(
  deputado: DeputadoGastos,
  metric: MetricaRanking,
): number {
  return metric === 'quantidade_despesas'
    ? deputado.quantidadeDespesas
    : deputado.totalGastos
}

function summarizeVotes(
  votos: VotosDeputadoStaticData['votos'],
): ResumoVotoDeputado[] {
  const summary = new Map<string, number>()

  votos.forEach((voto) => {
    summary.set(voto.voto, (summary.get(voto.voto) ?? 0) + 1)
  })

  return [...summary.entries()]
    .map(([voto, total]) => ({ voto, total }))
    .sort(
      (first, second) =>
        second.total - first.total ||
        first.voto.localeCompare(second.voto, 'pt-BR'),
    )
}

function aggregateEducationGroups(
  deputados: EscolaridadeDeputado[],
): EscolaridadeGrupo[] {
  const groups = new Map<
    number,
    {
      nivel: string
      ordem: number
      totalDeputados: number
      gasto: number
      proposicoes: number
      plenario: number
      plenarioCount: number
      comissoes: number
      comissoesCount: number
      fidelidade: number
      fidelidadeCount: number
    }
  >()

  deputados.forEach((deputado) => {
    const group = groups.get(deputado.ordem) ?? {
      nivel: deputado.nivel,
      ordem: deputado.ordem,
      totalDeputados: 0,
      gasto: 0,
      proposicoes: 0,
      plenario: 0,
      plenarioCount: 0,
      comissoes: 0,
      comissoesCount: 0,
      fidelidade: 0,
      fidelidadeCount: 0,
    }

    group.totalDeputados += 1
    group.gasto += deputado.gastoTotal
    group.proposicoes += deputado.totalProposicoes

    if (deputado.presencaPlenario !== null) {
      group.plenario += deputado.presencaPlenario
      group.plenarioCount += 1
    }

    if (deputado.presencaComissoes !== null) {
      group.comissoes += deputado.presencaComissoes
      group.comissoesCount += 1
    }

    if (deputado.fidelidade !== null) {
      group.fidelidade += deputado.fidelidade
      group.fidelidadeCount += 1
    }

    groups.set(deputado.ordem, group)
  })

  return [...groups.values()]
    .map((group) => ({
      nivel: group.nivel,
      ordem: group.ordem,
      totalDeputados: group.totalDeputados,
      gastoMedio: round(group.gasto / group.totalDeputados, 2),
      proposicoesMedia: round(
        group.proposicoes / group.totalDeputados,
        1,
      ),
      presencaPlenarioMedia: mean(group.plenario, group.plenarioCount),
      presencaComissoesMedia: mean(
        group.comissoes,
        group.comissoesCount,
      ),
      fidelidadeMedia: mean(group.fidelidade, group.fidelidadeCount),
    }))
    .sort((first, second) => first.ordem - second.ordem)
}

function mean(total: number, count: number): number {
  return count > 0 ? round(total / count, 1) : 0
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
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

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
