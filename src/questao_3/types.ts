import type { EixoAtuacao } from '../questao_2/types.ts'

export type HistoricoVotosFiltro =
  | {
      tipo: 'eixo'
      eixo: EixoAtuacao
    }
  | {
      tipo: 'tema'
      tema: string
    }

export type VotoDeputadoTema = {
  idVotacao: string
  dataHoraVoto: string | null
  dataVotacao: string | null
  voto: string
  descricao: string | null
  orgao: string | null
  proposicaoUri: string | null
  proposicaoTitulo: string | null
  proposicaoEmenta: string | null
  temas: string[]
}

export type ResumoVotoDeputado = {
  voto: string
  total: number
}

export type Questao3Response = {
  deputadoId: number
  deputadoNome: string
  filtro: {
    tipo: HistoricoVotosFiltro['tipo']
    valor: string
    label: string
  }
  totalVotacoes: number
  page: number
  pageSize: number
  totalPages: number
  resumoVotos: ResumoVotoDeputado[]
  temasDisponiveis: string[]
  votos: VotoDeputadoTema[]
}
