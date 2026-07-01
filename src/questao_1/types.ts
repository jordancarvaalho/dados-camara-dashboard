export type OrdemGastos = 'maior' | 'menor'
export type MetricaRanking = 'total_gastos' | 'quantidade_despesas'

export type DeputadosGastosFilters = {
  nome: string
  partido: string
  uf: string
  metrica: MetricaRanking
  ordem: OrdemGastos
}

export type DeputadosFilterOptions = {
  partidos: string[]
  ufs: string[]
}

export type DeputadoGastos = {
  id: number
  nome: string
  foto: string
  partido: string | null
  uf: string | null
  totalGastos: number
  quantidadeDespesas: number
}

export type DeputadosGastosResponse = {
  data: DeputadoGastos[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  ordem: OrdemGastos
  metrica: MetricaRanking
  nome: string | null
  partido: string | null
  uf: string | null
}
