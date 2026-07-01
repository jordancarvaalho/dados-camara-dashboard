import { Pool } from 'pg'
import type {
  DeputadoIdeologico,
  DistribuicaoIdeologica,
  IdeologiaClassificacao,
  PartidoIdeologico,
  Questao9Response,
} from '../types.ts'

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

const CLASSIFICACOES: IdeologiaClassificacao[] = [
  'Esquerda',
  'Centro-Esquerda',
  'Centro',
  'Centro-Direita',
  'Direita',
]

const POWER_ITERATIONS = 80
const CONVERGENCE_TOLERANCE = 1e-10

type VotoNumericoRow = {
  id_deputado: number
  id_votacao: string
  voto_num: number
}

type DeputadoInfoRow = {
  id_deputado: number
  nome: string
  partido: string
  uf: string
  url_foto: string | null
}

type SparseEntry = {
  column: number
  value: number
}

type SparseMatrix = {
  rows: SparseEntry[][]
  deputadoIds: number[]
  totalVotacoesDeputado: number[]
  totalVotacoes: number
  columnSums: Float64Array
  columnSquares: Float64Array
}

const QUERY_VOTOS = `
  SELECT DISTINCT ON (vd.id_deputado, vd.id_votacao)
    vd.id_deputado,
    vd.id_votacao,
    CASE vd.voto
      WHEN 'Sim' THEN 1
      WHEN 'Não' THEN -1
      ELSE 0
    END::smallint AS voto_num
  FROM voto_deputado vd
  WHERE vd.voto IN ('Sim', 'Não', 'Abstenção', 'Obstrução')
  ORDER BY
    vd.id_deputado,
    vd.id_votacao,
    vd.data_hora_voto DESC,
    vd.id_voto DESC
`

const QUERY_DEPUTADOS = `
  SELECT DISTINCT ON (vd.id_deputado)
    vd.id_deputado,
    vd.deputado_nome AS nome,
    COALESCE(NULLIF(BTRIM(vd.deputado_sigla_partido), ''), 'S.PART.') AS partido,
    COALESCE(NULLIF(BTRIM(vd.deputado_sigla_uf), ''), '—') AS uf,
    NULLIF(BTRIM(vd.deputado_url_foto), '') AS url_foto
  FROM voto_deputado vd
  WHERE vd.voto IN ('Sim', 'Não', 'Abstenção', 'Obstrução')
  ORDER BY vd.id_deputado, vd.data_hora_voto DESC, vd.id_voto DESC
`

let cached: Questao9Response | null = null
let pending: Promise<Questao9Response> | null = null

export async function getPosicionamentoIdeologico(): Promise<Questao9Response> {
  if (cached) {
    return cached
  }

  if (pending) {
    return pending
  }

  pending = calculatePosicionamentoIdeologico()

  try {
    cached = await pending
    return cached
  } finally {
    pending = null
  }
}

async function calculatePosicionamentoIdeologico(): Promise<Questao9Response> {
  const [votosResult, deputadosResult] = await Promise.all([
    pool.query<VotoNumericoRow>(QUERY_VOTOS),
    pool.query<DeputadoInfoRow>(QUERY_DEPUTADOS),
  ])

  const matrix = buildSparseMatrix(votosResult.rows)
  const infoById = new Map(
    deputadosResult.rows.map((row) => [row.id_deputado, row]),
  )
  const eixoBruto = truncatedSvdOneDimension(matrix)
  const scores = normalizeAndOrient(eixoBruto, matrix.deputadoIds, infoById)
  const varianciaExplicadaPct = calculateExplainedVariance(
    matrix,
    eixoBruto,
  )

  const baseDeputados = matrix.deputadoIds.map((id, index) => {
    const info = infoById.get(id)

    return {
      id,
      nome: info?.nome ?? `Deputado ${id}`,
      partido: info?.partido ?? 'S.PART.',
      uf: info?.uf ?? '—',
      urlFoto: info?.url_foto ?? null,
      totalVotacoes: matrix.totalVotacoesDeputado[index],
      scoreIdeologico: round(scores[index], 1),
    }
  })

  const partidosBase = aggregatePartidos(baseDeputados)
  const partyByName = new Map(
    partidosBase.map((partido) => [partido.partido, partido]),
  )
  const deputados: DeputadoIdeologico[] = baseDeputados
    .map((deputado) => {
      const partido = partyByName.get(deputado.partido)
      const scoreMedioPartido = partido?.scoreMedio ?? deputado.scoreIdeologico
      const distanciaPartido = Math.abs(
        deputado.scoreIdeologico - scoreMedioPartido,
      )

      return {
        ...deputado,
        classificacao: classificarIdeologia(deputado.scoreIdeologico),
        scoreMedioPartido: round(scoreMedioPartido, 1),
        distanciaPartido: round(distanciaPartido, 1),
        alinhamentoPartidoPct: round(
          Math.max(0, (1 - distanciaPartido / 200) * 100),
          1,
        ),
      }
    })
    .sort(
      (first, second) =>
        first.scoreIdeologico - second.scoreIdeologico ||
        first.nome.localeCompare(second.nome, 'pt-BR'),
    )

  const partidos = enrichPartidos(partidosBase, deputados)

  return {
    meta: {
      totalRegistros: votosResult.rows.length,
      totalDeputados: matrix.deputadoIds.length,
      totalVotacoes: matrix.totalVotacoes,
      varianciaExplicadaPct: round(varianciaExplicadaPct, 2),
      escalaMinima: -100,
      escalaMaxima: 100,
      metodo: 'Truncated SVD — 1 dimensão',
    },
    distribuicao: buildDistribuicao(deputados),
    partidos,
    deputados,
  }
}

function buildSparseMatrix(rows: VotoNumericoRow[]): SparseMatrix {
  const deputadoIndex = new Map<number, number>()
  const votacaoIndex = new Map<string, number>()

  for (const row of rows) {
    if (!deputadoIndex.has(row.id_deputado)) {
      deputadoIndex.set(row.id_deputado, deputadoIndex.size)
    }

    if (!votacaoIndex.has(row.id_votacao)) {
      votacaoIndex.set(row.id_votacao, votacaoIndex.size)
    }
  }

  const matrixRows = Array.from(
    { length: deputadoIndex.size },
    () => [] as SparseEntry[],
  )
  const totalVotacoesDeputado = Array.from(
    { length: deputadoIndex.size },
    () => 0,
  )
  const columnSums = new Float64Array(votacaoIndex.size)
  const columnSquares = new Float64Array(votacaoIndex.size)

  for (const row of rows) {
    const rowIndex = deputadoIndex.get(row.id_deputado)
    const columnIndex = votacaoIndex.get(row.id_votacao)

    if (rowIndex === undefined || columnIndex === undefined) {
      continue
    }

    totalVotacoesDeputado[rowIndex] += 1

    const value = Number(row.voto_num)
    if (value === 0) {
      continue
    }

    matrixRows[rowIndex].push({ column: columnIndex, value })
    columnSums[columnIndex] += value
    columnSquares[columnIndex] += value * value
  }

  return {
    rows: matrixRows,
    deputadoIds: Array.from(deputadoIndex.keys()),
    totalVotacoesDeputado,
    totalVotacoes: votacaoIndex.size,
    columnSums,
    columnSquares,
  }
}

function truncatedSvdOneDimension(matrix: SparseMatrix): Float64Array {
  let rightVector = createDeterministicUnitVector(matrix.totalVotacoes)

  for (let iteration = 0; iteration < POWER_ITERATIONS; iteration += 1) {
    const leftVector = multiplyMatrixVector(matrix.rows, rightVector)
    normalizeInPlace(leftVector)

    const nextRightVector = multiplyTransposeVector(
      matrix.rows,
      leftVector,
      matrix.totalVotacoes,
    )
    normalizeInPlace(nextRightVector)

    const similarity = Math.abs(dot(rightVector, nextRightVector))
    if (dot(rightVector, nextRightVector) < 0) {
      scaleInPlace(nextRightVector, -1)
    }

    rightVector = nextRightVector

    if (1 - similarity < CONVERGENCE_TOLERANCE) {
      break
    }
  }

  return multiplyMatrixVector(matrix.rows, rightVector)
}

function createDeterministicUnitVector(length: number): Float64Array {
  const vector = new Float64Array(length)

  for (let index = 0; index < length; index += 1) {
    vector[index] =
      Math.sin((index + 1) * 12.9898) + Math.cos((index + 1) * 78.233)
  }

  normalizeInPlace(vector)
  return vector
}

function multiplyMatrixVector(
  rows: SparseEntry[][],
  vector: Float64Array,
): Float64Array {
  const output = new Float64Array(rows.length)

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    let total = 0

    for (const entry of rows[rowIndex]) {
      total += entry.value * vector[entry.column]
    }

    output[rowIndex] = total
  }

  return output
}

function multiplyTransposeVector(
  rows: SparseEntry[][],
  vector: Float64Array,
  columns: number,
): Float64Array {
  const output = new Float64Array(columns)

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const rowWeight = vector[rowIndex]

    for (const entry of rows[rowIndex]) {
      output[entry.column] += entry.value * rowWeight
    }
  }

  return output
}

function normalizeAndOrient(
  values: Float64Array,
  deputadoIds: number[],
  infoById: Map<number, DeputadoInfoRow>,
): Float64Array {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY

  for (const value of values) {
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }

  const range = maximum - minimum
  const normalized = new Float64Array(values.length)

  for (let index = 0; index < values.length; index += 1) {
    normalized[index] =
      range > 0 ? (200 * (values[index] - minimum)) / range - 100 : 0
  }

  const ptMean = partyMean(normalized, deputadoIds, infoById, 'PT')
  const plMean = partyMean(normalized, deputadoIds, infoById, 'PL')

  if (ptMean !== null && plMean !== null && ptMean > plMean) {
    scaleInPlace(normalized, -1)
  }

  return normalized
}

function partyMean(
  scores: Float64Array,
  deputadoIds: number[],
  infoById: Map<number, DeputadoInfoRow>,
  party: string,
): number | null {
  let total = 0
  let count = 0

  for (let index = 0; index < deputadoIds.length; index += 1) {
    if (infoById.get(deputadoIds[index])?.partido === party) {
      total += scores[index]
      count += 1
    }
  }

  return count > 0 ? total / count : null
}

function calculateExplainedVariance(
  matrix: SparseMatrix,
  transformed: Float64Array,
): number {
  const rowCount = matrix.rows.length

  if (rowCount === 0) {
    return 0
  }

  let totalVariance = 0
  for (let column = 0; column < matrix.totalVotacoes; column += 1) {
    const mean = matrix.columnSums[column] / rowCount
    totalVariance += matrix.columnSquares[column] / rowCount - mean * mean
  }

  const transformedMean =
    transformed.reduce((total, value) => total + value, 0) / rowCount
  const transformedVariance =
    transformed.reduce(
      (total, value) => total + (value - transformedMean) ** 2,
      0,
    ) / rowCount

  return totalVariance > 0
    ? (transformedVariance / totalVariance) * 100
    : 0
}

function aggregatePartidos(
  deputados: Array<{
    id: number
    partido: string
    scoreIdeologico: number
  }>,
): PartidoIdeologico[] {
  const grouped = new Map<string, number[]>()

  for (const deputado of deputados) {
    const scores = grouped.get(deputado.partido) ?? []
    scores.push(deputado.scoreIdeologico)
    grouped.set(deputado.partido, scores)
  }

  return Array.from(grouped.entries()).map(([partido, scores]) => {
    const scoreMedio = mean(scores)

    return {
      partido,
      totalDeputados: scores.length,
      scoreMedio: round(scoreMedio, 1),
      scoreMinimo: round(Math.min(...scores), 1),
      scoreMaximo: round(Math.max(...scores), 1),
      dispersao: round(standardDeviation(scores, scoreMedio), 1),
      alinhamentoMedioPct: 0,
      classificacao: classificarIdeologia(scoreMedio),
    }
  })
}

function enrichPartidos(
  partidos: PartidoIdeologico[],
  deputados: DeputadoIdeologico[],
): PartidoIdeologico[] {
  const alinhamentos = new Map<string, number[]>()

  for (const deputado of deputados) {
    const values = alinhamentos.get(deputado.partido) ?? []
    values.push(deputado.alinhamentoPartidoPct)
    alinhamentos.set(deputado.partido, values)
  }

  return partidos
    .map((partido) => ({
      ...partido,
      alinhamentoMedioPct: round(
        mean(alinhamentos.get(partido.partido) ?? []),
        1,
      ),
    }))
    .sort(
      (first, second) =>
        first.scoreMedio - second.scoreMedio ||
        first.partido.localeCompare(second.partido, 'pt-BR'),
    )
}

function buildDistribuicao(
  deputados: DeputadoIdeologico[],
): DistribuicaoIdeologica[] {
  return CLASSIFICACOES.map((classificacao) => {
    const totalDeputados = deputados.filter(
      (deputado) => deputado.classificacao === classificacao,
    ).length

    return {
      classificacao,
      totalDeputados,
      percentual:
        deputados.length > 0
          ? round((totalDeputados / deputados.length) * 100, 1)
          : 0,
    }
  })
}

export function classificarIdeologia(
  score: number,
): IdeologiaClassificacao {
  if (score < -60) {
    return 'Esquerda'
  }

  if (score < -20) {
    return 'Centro-Esquerda'
  }

  if (score < 20) {
    return 'Centro'
  }

  if (score < 60) {
    return 'Centro-Direita'
  }

  return 'Direita'
}

function mean(values: number[]): number {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0
}

function standardDeviation(values: number[], average: number): number {
  if (values.length === 0) {
    return 0
  }

  const variance =
    values.reduce(
      (total, value) => total + (value - average) ** 2,
      0,
    ) / values.length

  return Math.sqrt(variance)
}

function normalizeInPlace(vector: Float64Array): void {
  const norm = Math.sqrt(dot(vector, vector))

  if (norm > 0) {
    scaleInPlace(vector, 1 / norm)
  }
}

function scaleInPlace(vector: Float64Array, factor: number): void {
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] *= factor
  }
}

function dot(first: Float64Array, second: Float64Array): number {
  let total = 0

  for (let index = 0; index < first.length; index += 1) {
    total += first[index] * second[index]
  }

  return total
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
