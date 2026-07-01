import { Pool } from 'pg'
import type {
  EscolaridadeDeputado,
  EscolaridadeGrupo,
  EscolaridadeFiltros,
  Questao4Response,
} from '../types.ts'

const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'camara_db',
  user: process.env.PGUSER ?? 'camara_user',
  password: process.env.PGPASSWORD ?? 'camara_pass',
})

type Faixa = { nivel: string; ordem: number; valores: string[] }

const FAIXAS: Faixa[] = [
  {
    nivel: 'Fundamental',
    ordem: 1,
    valores: ['primario incompleto', 'ensino fundamental'],
  },
  {
    nivel: 'Médio',
    ordem: 2,
    valores: [
      'ensino medio incompleto',
      'secundario incompleto',
      'secundario',
      'ensino medio',
    ],
  },
  { nivel: 'Superior incompleto', ordem: 3, valores: ['superior incompleto'] },
  { nivel: 'Superior', ordem: 4, valores: ['superior'] },
  {
    nivel: 'Pós-graduação',
    ordem: 5,
    valores: ['pos-graduacao', 'pos graduacao'],
  },
  { nivel: 'Mestrado', ordem: 6, valores: ['mestrado incompleto', 'mestrado'] },
  {
    nivel: 'Doutorado',
    ordem: 7,
    valores: ['doutorado incompleto', 'doutorado'],
  },
]

const FAIXA_NAO_INFORMADO: Faixa = {
  nivel: 'Não informado',
  ordem: 99,
  valores: [],
}

const FAIXA_POR_VALOR = new Map<string, Faixa>(
  FAIXAS.flatMap((faixa) => faixa.valores.map((valor) => [valor, faixa])),
)

const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')
const ACCENTED_CHARS =
  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'
const UNACCENTED_CHARS =
  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'

const NORMALIZE_VOTO = (column: string) =>
  `LOWER(TRANSLATE(TRIM(${column}), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'))`

const QUERY_INDICADORES = `
  WITH gastos AS (
    SELECT dp.ide_cadastro AS id, SUM(dp.vlr_liquido) AS gasto_total
    FROM despesa_parlamentar dp
    WHERE dp.cod_legislatura = 57
    GROUP BY dp.ide_cadastro
  ),
  proposicoes AS (
    SELECT a.id_deputado_autor AS id, COUNT(DISTINCT a.id_proposicao) AS total
    FROM autoria a
    JOIN proposicao p ON p.id_proposicao = a.id_proposicao
    WHERE p.ano BETWEEN 2023 AND 2026
    GROUP BY a.id_deputado_autor
  ),
  plenario AS (
    SELECT dp.id_deputado AS id,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(dp.status_normalizado, '')) = 'presente'
      )::numeric / NULLIF(COUNT(*), 0) * 100 AS pct
    FROM deputado_plenario dp
    GROUP BY dp.id_deputado
  ),
  comissao AS (
    SELECT dc.id_deputado AS id,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(dc.status_normalizado, '')) = 'presente'
      )::numeric / NULLIF(COUNT(*), 0) * 100 AS pct
    FROM deputado_comissao dc
    GROUP BY dc.id_deputado
  ),
  fidelidade AS (
    SELECT vd.id_deputado AS id,
      COUNT(*) FILTER (
        WHERE ${NORMALIZE_VOTO('vd.voto')} =
          ${NORMALIZE_VOTO('bv.orientacao')}
      )::numeric / NULLIF(COUNT(*), 0) * 100 AS pct
    FROM voto_deputado vd
    JOIN bancada_votacao bv
      ON bv.id_votacao = vd.id_votacao
     AND UPPER(TRIM(bv.sigla_bancada)) =
       UPPER(TRIM(vd.deputado_sigla_partido))
    WHERE NULLIF(TRIM(vd.voto), '') IS NOT NULL
      AND NULLIF(TRIM(bv.orientacao), '') IS NOT NULL
      AND ${NORMALIZE_VOTO('bv.orientacao')} NOT LIKE 'libera%'
    GROUP BY vd.id_deputado
  ),
  status_atual AS (
    SELECT DISTINCT ON (vd.id_deputado)
      vd.id_deputado AS id,
      vd.deputado_nome AS nome,
      NULLIF(BTRIM(vd.deputado_sigla_partido), '') AS partido,
      NULLIF(BTRIM(vd.deputado_sigla_uf), '') AS uf,
      NULLIF(BTRIM(vd.deputado_url_foto), '') AS url_foto
    FROM voto_deputado vd
    ORDER BY vd.id_deputado, vd.data_hora_voto DESC, vd.id_voto DESC
  )
  SELECT
    d.id_deputado AS id,
    COALESCE(sa.nome, d.nome) AS nome,
    COALESCE(sa.partido, 'S.PART.') AS partido,
    COALESCE(sa.uf, '—') AS uf,
    COALESCE(sa.url_foto, NULLIF(BTRIM(d.foto), '')) AS url_foto,
    NULLIF(BTRIM(d.escolaridade), '') AS escolaridade,
    COALESCE(g.gasto_total, 0)::double precision AS gasto_total,
    COALESCE(pr.total, 0)::int AS total_proposicoes,
    pl.pct AS plenario_pct,
    co.pct AS comissao_pct,
    fi.pct AS fidelidade_pct
  FROM deputado d
  LEFT JOIN status_atual sa ON sa.id = d.id_deputado
  LEFT JOIN gastos g ON g.id = d.id_deputado
  LEFT JOIN proposicoes pr ON pr.id = d.id_deputado
  LEFT JOIN plenario pl ON pl.id = d.id_deputado
  LEFT JOIN comissao co ON co.id = d.id_deputado
  LEFT JOIN fidelidade fi ON fi.id = d.id_deputado
`

type IndicadorRow = {
  id: number
  nome: string
  partido: string
  uf: string
  url_foto: string | null
  escolaridade: string | null
  gasto_total: number | string
  total_proposicoes: number
  plenario_pct: number | string | null
  comissao_pct: number | string | null
  fidelidade_pct: number | string | null
}

type Acumulador = {
  faixa: Faixa
  totalDeputados: number
  somaGasto: number
  somaProposicoes: number
  somaPlenario: number
  countPlenario: number
  somaComissao: number
  countComissao: number
  somaFidelidade: number
  countFidelidade: number
}

let cachedRows: IndicadorRow[] | null = null
let pendingRows: Promise<IndicadorRow[]> | null = null

export async function getEscolaridadeAgrupada(
  filters: {
    partido?: string | null
    uf?: string | null
  } = {},
): Promise<Questao4Response> {
  const rows = await getIndicadores()
  const normalizedFilters: EscolaridadeFiltros = {
    partido: filters.partido?.trim() || null,
    uf: filters.uf?.trim() || null,
  }
  const filteredRows = rows.filter(
    (row) =>
      (!normalizedFilters.partido ||
        row.partido === normalizedFilters.partido) &&
      (!normalizedFilters.uf || row.uf === normalizedFilters.uf),
  )
  const deputados = filteredRows
    .map(toDeputado)
    .sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'))

  return {
    grupos: aggregateGroups(deputados),
    deputados,
    totalDeputados: deputados.length,
    partidosDisponiveis: uniqueSorted(
      rows.map((row) => row.partido).filter(Boolean),
    ),
    ufsDisponiveis: uniqueSorted(
      rows.map((row) => row.uf).filter((value) => value !== '—'),
    ),
    filtros: normalizedFilters,
  }
}

async function getIndicadores(): Promise<IndicadorRow[]> {
  if (cachedRows) {
    return cachedRows
  }

  if (pendingRows) {
    return pendingRows
  }

  pendingRows = pool
    .query<IndicadorRow>(QUERY_INDICADORES)
    .then((result) => result.rows)

  try {
    cachedRows = await pendingRows
    return cachedRows
  } finally {
    pendingRows = null
  }
}

function toDeputado(row: IndicadorRow): EscolaridadeDeputado {
  const faixa = resolveFaixa(row.escolaridade)

  return {
    id: row.id,
    nome: row.nome,
    partido: row.partido,
    uf: row.uf,
    urlFoto: row.url_foto,
    escolaridadeOriginal: row.escolaridade,
    nivel: faixa.nivel,
    ordem: faixa.ordem,
    gastoTotal: Number(row.gasto_total ?? 0),
    totalProposicoes: Number(row.total_proposicoes ?? 0),
    presencaPlenario: nullableNumber(row.plenario_pct),
    presencaComissoes: nullableNumber(row.comissao_pct),
    fidelidade: nullableNumber(row.fidelidade_pct),
  }
}

function aggregateGroups(
  deputados: EscolaridadeDeputado[],
): EscolaridadeGrupo[] {
  const acumuladores = new Map<number, Acumulador>()

  for (const deputado of deputados) {
    const faixa =
      FAIXAS.find((item) => item.ordem === deputado.ordem) ??
      FAIXA_NAO_INFORMADO
    const acc = getAcumulador(acumuladores, faixa)

    acc.totalDeputados += 1
    acc.somaGasto += deputado.gastoTotal
    acc.somaProposicoes += deputado.totalProposicoes
    addPercentual(
      acc,
      'somaPlenario',
      'countPlenario',
      deputado.presencaPlenario,
    )
    addPercentual(
      acc,
      'somaComissao',
      'countComissao',
      deputado.presencaComissoes,
    )
    addPercentual(
      acc,
      'somaFidelidade',
      'countFidelidade',
      deputado.fidelidade,
    )
  }

  return Array.from(acumuladores.values())
    .map(toGrupo)
    .sort((first, second) => first.ordem - second.ordem)
}

function resolveFaixa(escolaridade: string | null): Faixa {
  const normalizada = normalizeText(escolaridade ?? '')
  return FAIXA_POR_VALOR.get(normalizada) ?? FAIXA_NAO_INFORMADO
}

function getAcumulador(
  acumuladores: Map<number, Acumulador>,
  faixa: Faixa,
): Acumulador {
  const existente = acumuladores.get(faixa.ordem)

  if (existente) {
    return existente
  }

  const novo: Acumulador = {
    faixa,
    totalDeputados: 0,
    somaGasto: 0,
    somaProposicoes: 0,
    somaPlenario: 0,
    countPlenario: 0,
    somaComissao: 0,
    countComissao: 0,
    somaFidelidade: 0,
    countFidelidade: 0,
  }
  acumuladores.set(faixa.ordem, novo)
  return novo
}

function addPercentual(
  acc: Acumulador,
  somaKey: 'somaPlenario' | 'somaComissao' | 'somaFidelidade',
  countKey: 'countPlenario' | 'countComissao' | 'countFidelidade',
  value: number | null,
) {
  if (value === null) {
    return
  }

  acc[somaKey] += value
  acc[countKey] += 1
}

function toGrupo(acc: Acumulador): EscolaridadeGrupo {
  return {
    nivel: acc.faixa.nivel,
    ordem: acc.faixa.ordem,
    totalDeputados: acc.totalDeputados,
    gastoMedio: round(acc.somaGasto / acc.totalDeputados, 2),
    proposicoesMedia: round(acc.somaProposicoes / acc.totalDeputados, 1),
    presencaPlenarioMedia: media(acc.somaPlenario, acc.countPlenario),
    presencaComissoesMedia: media(acc.somaComissao, acc.countComissao),
    fidelidadeMedia: media(acc.somaFidelidade, acc.countFidelidade),
  }
}

function nullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function media(soma: number, count: number): number {
  return count > 0 ? round(soma / count, 1) : 0
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(DIACRITICOS, '').trim().toLowerCase()
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((first, second) =>
    first.localeCompare(second, 'pt-BR'),
  )
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
