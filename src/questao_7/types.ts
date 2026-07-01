export type PresencaResumo = {
  totalSessoes: number
  presencas: number
  ausenciasJustificadas: number
  ausenciasNaoJustificadas: number
  percentualPresenca: number
}

export type CustoBeneficioDeputado = {
  deputadoId: number
  nome: string
  gastoTotal: number
  totalProposicoes: number
  scoreBeneficio: number
  scoreCustoBeneficio: number
  presencaPlenario: PresencaResumo
  formula: {
    proposicao: number
    presencaPlenario: number
    escala: number
  }
}

export type CustoBeneficioFaixa =
  | 'Excelente'
  | 'Muito bom'
  | 'Regular'
  | 'Atenção'
  | 'Baixo CxB'

export type DeputadoRankingCustoBeneficio = CustoBeneficioDeputado & {
  posicaoGeral: number
  partido: string
  uf: string
  urlFoto: string | null
  faixa: CustoBeneficioFaixa
  baseCustoReduzida: boolean
}

export type RankingCustoBeneficioResponse = {
  deputados: DeputadoRankingCustoBeneficio[]
  totalDeputados: number
  page: number
  pageSize: number
  totalPages: number
  filtros: {
    nome: string | null
    partido: string | null
    uf: string | null
    gastoMinimo: number
    ordem: 'maior' | 'menor'
  }
  partidosDisponiveis: string[]
  ufsDisponiveis: string[]
  resumo: {
    melhorScore: number
    medianaScore: number
    piorScore: number
    mediaBeneficio: number
    gastoTotal: number
  }
  formula: {
    proposicao: number
    presencaPlenario: number
    escala: number
    gastoMinimoPadrao: number
  }
}
