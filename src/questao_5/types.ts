export type Questao5Filters = {
  categoria: string | null
  ano: number | null
  deputadoId: number | null
}

export type FornecedorRanking = {
  fornecedor: string
  cnpjCpf: string | null
  totalRecebido: number
  quantidadeDespesas: number
  percentual: number
}

export type Questao5Response = {
  totalRecebido: number
  totalFornecedores: number
  filtros: Questao5Filters
  categoriasDisponiveis: string[]
  anosDisponiveis: number[]
  fornecedores: FornecedorRanking[]
}
