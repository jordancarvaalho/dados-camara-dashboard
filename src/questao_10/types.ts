export type CoesaoClassificacao =
  | 'Muito alta'
  | 'Alta'
  | 'Moderada'
  | 'Baixa'

export type PartidoCoesao = {
  posicao: number
  partido: string
  totalVotosAnalisados: number
  votosAlinhados: number
  votosDivergentes: number
  totalDeputados: number
  totalVotacoes: number
  pctDisciplina: number
  classificacao: CoesaoClassificacao
  amostraPequena: boolean
}

export type Questao10Response = {
  totalPartidos: number
  totalComparacoes: number
  mediaPonderadaPct: number
  ranking: PartidoCoesao[]
  metodologia: {
    votosConsiderados: string[]
    orientacoesConsideradas: string[]
    pareamento: string
    limiteAmostraPequena: number
  }
}
