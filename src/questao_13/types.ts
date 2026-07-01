export type CategoriaDespesaDeputado = {
  categoria: string
  totalGasto: number
  quantidadeDespesas: number
  percentual: number
}

export type Questao13Response = {
  deputadoId: number
  totalGasto: number
  totalCategorias: number
  categorias: CategoriaDespesaDeputado[]
}
