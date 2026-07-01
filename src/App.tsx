import { useState } from 'react'
import './App.css'
import { LayoutApp, type LayoutSectionId } from './layout/layoutApp'
import { Questao1Page } from './questao_1/page/Questao1Page'
import { Questao2Page } from './questao_2/page/Questao2Page'
import { Questao4Page } from './questao_4/page/Questao4Page'
import { Questao5Page } from './questao_5/page/Questao5Page'
import { Questao9Page } from './questao_9/page/Questao9Page'
import { Questao10Page } from './questao_10/page/Questao10Page'
import { EscolaridadePartidosPage } from './questao_4/page/EscolaridadePartidosPage'
import { RankingCustoBeneficioPage } from './questao_7/page/RankingCustoBeneficioPage'

function App() {
  const [activeSection, setActiveSection] =
    useState<LayoutSectionId>('visao-geral')
  const [selectedDeputadoId, setSelectedDeputadoId] = useState<number | null>(
    null,
  )

  return (
    <LayoutApp
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {activeSection === 'visao-geral' ? (
        <section
          className="overview-section"
          id="visao-geral-panel"
          role="tabpanel"
          aria-labelledby="visao-geral-tab"
        >
          <div className="overview-card">
            <Questao1Page
              selectedDeputadoId={selectedDeputadoId}
              onDeputadoSelect={(deputado) => setSelectedDeputadoId(deputado.id)}
            />
            <Questao5Page />
            <Questao4Page />
            {selectedDeputadoId ? (
              <Questao2Page
                deputadoId={selectedDeputadoId}
                onClose={() => setSelectedDeputadoId(null)}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {activeSection === 'partidos' ? (
        <section
          className="parties-section"
          id="partidos-panel"
          role="tabpanel"
          aria-labelledby="partidos-tab"
        >
          <Questao9Page />
          <Questao10Page />
          <EscolaridadePartidosPage />
        </section>
      ) : null}

      {activeSection === 'deputado' ? (
        <section
          className="deputies-section"
          id="deputado-panel"
          role="tabpanel"
          aria-labelledby="deputado-tab"
        >
          <RankingCustoBeneficioPage />
        </section>
      ) : null}
    </LayoutApp>
  )
}

export default App
