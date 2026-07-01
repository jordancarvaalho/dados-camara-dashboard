import type {
  DeputadoGastos,
  DeputadosFilterOptions,
} from '../questao_1/types'
import type { DeputadoEixoAtuacao } from '../questao_2/types'
import type { VotoDeputadoTema } from '../questao_3/types'
import type { Questao4Response } from '../questao_4/types'
import type { Questao5Response } from '../questao_5/types'
import type {
  DeputadoRankingCustoBeneficio,
  RankingCustoBeneficioResponse,
} from '../questao_7/types'
import type { Questao12Response } from '../questao_12/types'
import type { Questao13Response } from '../questao_13/types'

export type Questao1StaticData = {
  deputados: DeputadoGastos[]
  filtros: DeputadosFilterOptions
}

export type Questao4StaticData = Questao4Response

export type Questao5StaticData = {
  categoriasDisponiveis: string[]
  anosDisponiveis: number[]
  recortes: Record<string, Questao5Response>
}

export type Questao7StaticData = {
  ranking: DeputadoRankingCustoBeneficio[]
  partidosDisponiveis: string[]
  ufsDisponiveis: string[]
  formula: RankingCustoBeneficioResponse['formula']
}

export type DeputadoStaticData = {
  deputadoId: number
  eixos: DeputadoEixoAtuacao | null
  custoBeneficio: DeputadoRankingCustoBeneficio | null
  fornecedores: Questao12Response
  categoriasDespesa: Questao13Response
}

export type VotosDeputadoStaticData = {
  deputadoId: number
  deputadoNome: string
  temasDisponiveis: string[]
  votos: VotoDeputadoTema[]
}

export type StaticMetadata = {
  schemaVersion: number
  generatedAt: string
  project: string
  description: string
  source: {
    name: string
    api: string
    portal: string
  }
  coverage: {
    legislature: number
    availableThroughYear: number
    yearsByDataset: Record<
      string,
      {
        from: number | null
        through: number | null
      }
    >
    totalDeputies: number
    deputiesWithEducation: number
  }
  deployment: {
    mode: 'static'
    requiresDatabase: false
    requiresServer: false
  }
  datasets: Array<{
    id: string
    path: string
    partitionedBy?: string
    records?: number
  }>
}
