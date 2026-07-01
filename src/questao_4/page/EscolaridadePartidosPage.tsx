import { EscolaridadeDashboard } from '../components/EscolaridadeDashboard'
import './Questao4Page.css'

export function EscolaridadePartidosPage() {
  return (
    <EscolaridadeDashboard
      title="Escolaridade por partido"
      description="Compare o grau de instrução dos deputados por legenda e estado, mantendo as médias dos indicadores no recorte selecionado."
      kicker="Perfil educacional das bancadas"
      showScopeFilters
      variant="parties"
    />
  )
}
