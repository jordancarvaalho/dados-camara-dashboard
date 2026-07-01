import type { ReactNode } from 'react'
import './layoutApp.css'

export type LayoutSectionId = 'visao-geral' | 'partidos' | 'deputado'

type LayoutAppProps = {
  activeSection: LayoutSectionId
  children: ReactNode
  onSectionChange: (section: LayoutSectionId) => void
}

const sections: Array<{ id: LayoutSectionId; label: string }> = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'partidos', label: 'Partidos' },
  { id: 'deputado', label: 'Deputados' },
]

export function LayoutApp({
  activeSection,
  children,
  onSectionChange,
}: LayoutAppProps) {
  return (
    <main className="layout-app">
      <header className="layout-header">
        <div>
          <h1>Análise da Câmara dos Deputados</h1>
        </div>

        <nav
          className="layout-sections"
          role="tablist"
          aria-label="Seções principais"
        >
          {sections.map((section) => (
            <button
              aria-controls={`${section.id}-panel`}
              aria-selected={activeSection === section.id}
              className={activeSection === section.id ? 'active' : ''}
              id={`${section.id}-tab`}
              key={section.id}
              role="tab"
              type="button"
              onClick={() => onSectionChange(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="layout-content">{children}</div>
    </main>
  )
}
