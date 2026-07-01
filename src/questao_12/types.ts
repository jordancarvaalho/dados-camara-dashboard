export type FornecedorDeputado = {
  fornecedor: string
  cnpjCpf: string | null
  totalGasto: number
  transacoes: number
  ticketMedio: number
  percentual: number
  deputadosMesmoPartido: number
  alertaConcentracao: boolean
  alertaMesmoPartido: boolean
}

export type Questao12Response = {
  deputadoId: number
  totalGasto: number
  totalFornecedores: number
  fornecedores: FornecedorDeputado[]
}
