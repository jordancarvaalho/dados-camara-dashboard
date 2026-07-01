import { EscolaridadeDashboard } from '../components/EscolaridadeDashboard'
import './Questao4Page.css'

export function Questao4Page() {
  return (
    <EscolaridadeDashboard
      title="Deputados por escolaridade"
      description="Distribuição por grau de instrução, do menor ao maior, com a média de cada indicador por faixa."
      variant="overview"
    />
  )
}
