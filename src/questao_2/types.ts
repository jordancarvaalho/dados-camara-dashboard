export type EixoAtuacao =
  | 'social'
  | 'economico'
  | 'tributario'
  | 'seguranca'
  | 'saude'
  | 'educacao'
  | 'meio_ambiente'
  | 'infraestrutura'
  | 'administrativo'
  | 'outros'

export type TermoNuvem = {
  termo: string
  frequencia: number
  peso: number
}

export type EixoResumo = {
  eixo: EixoAtuacao
  totalDeputados: number
  totalProposicoes: number
}

export type EixoDeputadoResumo = {
  eixo: EixoAtuacao
  total: number
}

export type DeputadoEixoAtuacao = {
  id: number
  nome: string
  foto: string
  partido: string | null
  uf: string | null
  totalProposicoes: number
  eixoPredominante: EixoAtuacao
  eixos: EixoDeputadoResumo[]
  termos: TermoNuvem[]
}

export type Questao2Response = {
  totalDeputados: number
  totalProposicoes: number
  eixos: EixoResumo[]
  deputados: DeputadoEixoAtuacao[]
}
