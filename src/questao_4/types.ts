export type EscolaridadeMetrica =
  | 'quantidade'
  | 'gasto'
  | 'proposicoes'
  | 'presencaPlenario'
  | 'presencaComissoes'
  | 'fidelidade'

export type EscolaridadeGrupo = {
  nivel: string
  ordem: number
  totalDeputados: number
  gastoMedio: number
  proposicoesMedia: number
  presencaPlenarioMedia: number
  presencaComissoesMedia: number
  fidelidadeMedia: number
}

export type EscolaridadeDeputado = {
  id: number
  nome: string
  partido: string
  uf: string
  urlFoto: string | null
  escolaridadeOriginal: string | null
  nivel: string
  ordem: number
  gastoTotal: number
  totalProposicoes: number
  presencaPlenario: number | null
  presencaComissoes: number | null
  fidelidade: number | null
}

export type EscolaridadeFiltros = {
  partido: string | null
  uf: string | null
}

export type Questao4Response = {
  grupos: EscolaridadeGrupo[]
  deputados: EscolaridadeDeputado[]
  totalDeputados: number
  partidosDisponiveis: string[]
  ufsDisponiveis: string[]
  filtros: EscolaridadeFiltros
}
