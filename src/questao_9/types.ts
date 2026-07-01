export type IdeologiaClassificacao =
  | 'Esquerda'
  | 'Centro-Esquerda'
  | 'Centro'
  | 'Centro-Direita'
  | 'Direita'

export type Questao9Meta = {
  totalRegistros: number
  totalDeputados: number
  totalVotacoes: number
  varianciaExplicadaPct: number
  escalaMinima: number
  escalaMaxima: number
  metodo: string
}

export type DeputadoIdeologico = {
  id: number
  nome: string
  partido: string
  uf: string
  urlFoto: string | null
  totalVotacoes: number
  scoreIdeologico: number
  classificacao: IdeologiaClassificacao
  scoreMedioPartido: number
  distanciaPartido: number
  alinhamentoPartidoPct: number
}

export type PartidoIdeologico = {
  partido: string
  totalDeputados: number
  scoreMedio: number
  scoreMinimo: number
  scoreMaximo: number
  dispersao: number
  alinhamentoMedioPct: number
  classificacao: IdeologiaClassificacao
}

export type DistribuicaoIdeologica = {
  classificacao: IdeologiaClassificacao
  totalDeputados: number
  percentual: number
}

export type Questao9Response = {
  meta: Questao9Meta
  distribuicao: DistribuicaoIdeologica[]
  partidos: PartidoIdeologico[]
  deputados: DeputadoIdeologico[]
}
