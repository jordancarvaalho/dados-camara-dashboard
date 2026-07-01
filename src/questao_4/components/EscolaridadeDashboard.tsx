import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { getStaticEscolaridade } from '../../data/staticData'
import { getEducationColor } from '../education'
import type {
  EscolaridadeDeputado,
  EscolaridadeGrupo,
  EscolaridadeMetrica,
  Questao4Response,
} from '../types'

type RequestState =
  | { status: 'loading'; data: Questao4Response | null; error: null }
  | { status: 'success'; data: Questao4Response; error: null }
  | { status: 'error'; data: Questao4Response | null; error: string }

type MetricaTipo = 'numero' | 'moeda' | 'percentual'

type MetricaConfig = {
  id: EscolaridadeMetrica
  label: string
  tipo: MetricaTipo
  getGrupo: (grupo: EscolaridadeGrupo) => number
  getDeputado: (deputado: EscolaridadeDeputado) => number | null
}

type EscolaridadeDashboardProps = {
  title: string
  description: string
  kicker?: string
  showScopeFilters?: boolean
  variant: 'overview' | 'parties'
}

const PAGE_SIZE = 10

const METRICAS: MetricaConfig[] = [
  {
    id: 'quantidade',
    label: 'Quantidade de deputados',
    tipo: 'numero',
    getGrupo: (grupo) => grupo.totalDeputados,
    getDeputado: () => null,
  },
  {
    id: 'gasto',
    label: 'Gasto médio (R$)',
    tipo: 'moeda',
    getGrupo: (grupo) => grupo.gastoMedio,
    getDeputado: (deputado) => deputado.gastoTotal,
  },
  {
    id: 'proposicoes',
    label: 'Proposições por deputado (média)',
    tipo: 'numero',
    getGrupo: (grupo) => grupo.proposicoesMedia,
    getDeputado: (deputado) => deputado.totalProposicoes,
  },
  {
    id: 'presencaPlenario',
    label: 'Presença no plenário (% média)',
    tipo: 'percentual',
    getGrupo: (grupo) => grupo.presencaPlenarioMedia,
    getDeputado: (deputado) => deputado.presencaPlenario,
  },
  {
    id: 'presencaComissoes',
    label: 'Presença em comissões (% média)',
    tipo: 'percentual',
    getGrupo: (grupo) => grupo.presencaComissoesMedia,
    getDeputado: (deputado) => deputado.presencaComissoes,
  },
  {
    id: 'fidelidade',
    label: 'Fidelidade partidária (% média)',
    tipo: 'percentual',
    getGrupo: (grupo) => grupo.fidelidadeMedia,
    getDeputado: (deputado) => deputado.fidelidade,
  },
]

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})

const integerFormatter = new Intl.NumberFormat('pt-BR')

export function EscolaridadeDashboard({
  title,
  description,
  kicker,
  showScopeFilters = false,
  variant,
}: EscolaridadeDashboardProps) {
  const [requestState, setRequestState] = useState<RequestState>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [metricaId, setMetricaId] =
    useState<EscolaridadeMetrica>('quantidade')
  const [selectedOrdem, setSelectedOrdem] = useState<number | null>(null)
  const [selectedParty, setSelectedParty] = useState('')
  const [selectedUf, setSelectedUf] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()

    if (selectedParty) {
      params.set('partido', selectedParty)
    }

    if (selectedUf) {
      params.set('uf', selectedUf)
    }

    async function loadEscolaridade() {
      setRequestState((current) => ({
        status: 'loading',
        data: current.data,
        error: null,
      }))

      try {
        const data = await getStaticEscolaridade({
          partido: params.get('partido'),
          uf: params.get('uf'),
        })

        if (controller.signal.aborted) {
          return
        }

        setRequestState({ status: 'success', data, error: null })
        setSelectedOrdem((current) =>
          data.grupos.some((grupo) => grupo.ordem === current)
            ? current
            : (data.grupos[0]?.ordem ?? null),
        )
        setPage(1)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setRequestState((current) => ({
          status: 'error',
          data: current.data,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao carregar dados de escolaridade.',
        }))
      }
    }

    loadEscolaridade()
    return () => controller.abort()
  }, [selectedParty, selectedUf])

  const data = requestState.data
  const metrica = useMemo(
    () => METRICAS.find((item) => item.id === metricaId) ?? METRICAS[0],
    [metricaId],
  )
  const grupos = data?.grupos ?? []
  const maxValor = grupos.reduce(
    (max, grupo) => Math.max(max, metrica.getGrupo(grupo)),
    0,
  )
  const activeGrupo =
    grupos.find((grupo) => grupo.ordem === selectedOrdem) ?? grupos[0] ?? null
  const activeDeputados = activeGrupo
    ? (data?.deputados.filter(
        (deputado) => deputado.ordem === activeGrupo.ordem,
      ) ?? [])
    : []
  const totalPages = Math.max(1, Math.ceil(activeDeputados.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageDeputados = activeDeputados.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )
  const educationStyle = activeGrupo
    ? ({
        '--education-color': getEducationColor(activeGrupo.ordem),
      } as CSSProperties)
    : undefined

  return (
    <section
      className={`questao-four q4-${variant}`}
      aria-labelledby={`questao-four-${variant}-title`}
    >
      <div className="questao-four-header">
        <div>
          {kicker ? <span>{kicker}</span> : null}
          <h2 id={`questao-four-${variant}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        {data ? (
          <strong>{integerFormatter.format(data.totalDeputados)} deputados</strong>
        ) : null}
      </div>

      <div
        className={`q4-controls${showScopeFilters ? ' with-scope' : ''}`}
      >
        {showScopeFilters ? (
          <>
            <label>
              <span>Partido</span>
              <select
                value={selectedParty}
                onChange={(event) => {
                  setSelectedParty(event.target.value)
                  setSelectedUf('')
                  setPage(1)
                }}
              >
                <option value="">Todos os partidos</option>
                {(data?.partidosDisponiveis ?? []).map((partido) => (
                  <option value={partido} key={partido}>
                    {partido}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Estado (UF)</span>
              <select
                value={selectedUf}
                onChange={(event) => {
                  setSelectedUf(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todos os estados</option>
                {(data?.ufsDisponiveis ?? []).map((uf) => (
                  <option value={uf} key={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <label>
          <span>Indicador</span>
          <select
            value={metricaId}
            onChange={(event) => {
              setMetricaId(event.target.value as EscolaridadeMetrica)
              setPage(1)
            }}
          >
            {METRICAS.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {requestState.status === 'loading' && !data ? (
        <div className="status-box">Carregando escolaridade...</div>
      ) : null}

      {requestState.status === 'loading' && data ? (
        <div className="q4-refreshing">Atualizando recorte...</div>
      ) : null}

      {requestState.status === 'error' ? (
        <div className="status-box error">{requestState.error}</div>
      ) : null}

      {data && grupos.length === 0 ? (
        <div className="status-box">
          Nenhum deputado encontrado para os filtros selecionados.
        </div>
      ) : null}

      {data && grupos.length > 0 ? (
        <div className="q4-chart-shell">
          <div
            className="q4-column-chart"
            role="img"
            aria-label={`Faixas de escolaridade ordenadas do menor ao maior grau por ${metrica.label}`}
          >
            {grupos.map((grupo) => {
              const valor = metrica.getGrupo(grupo)
              const altura =
                maxValor > 0 ? Math.max(4, (valor / maxValor) * 100) : 0
              const ativo = activeGrupo?.ordem === grupo.ordem
              const style = {
                height: `${altura}%`,
                '--education-color': getEducationColor(grupo.ordem),
              } as CSSProperties

              return (
                <div className="q4-column" key={grupo.ordem}>
                  <div className="q4-bar-area">
                    <button
                      type="button"
                      className={`q4-bar${ativo ? ' active' : ''}`}
                      style={style}
                      title={`${grupo.nivel}: ${formatValor(
                        valor,
                        metrica.tipo,
                      )}`}
                      onClick={() => {
                        setSelectedOrdem(grupo.ordem)
                        setPage(1)
                      }}
                    >
                      <span className="q4-bar-value">
                        {formatBarValor(valor, metrica.tipo)}
                      </span>
                    </button>
                  </div>
                  <span className="q4-column-label">{grupo.nivel}</span>
                  <span className="q4-column-count">
                    {grupo.totalDeputados} dep.
                  </span>
                </div>
              )
            })}
          </div>

          {activeGrupo ? (
            <>
              <div className="q4-detail-panel" style={educationStyle}>
                <div>
                  <span>{activeGrupo.nivel}</span>
                  <p>
                    {activeGrupo.totalDeputados} deputados nesta faixa
                    {showScopeFilters && (selectedParty || selectedUf)
                      ? ' no recorte'
                      : ''}
                  </p>
                </div>
                <strong>
                  {formatValor(
                    metrica.getGrupo(activeGrupo),
                    metrica.tipo,
                  )}
                </strong>
                <dl>
                  <div>
                    <dt>Gasto médio</dt>
                    <dd>{currencyFormatter.format(activeGrupo.gastoMedio)}</dd>
                  </div>
                  <div>
                    <dt>Proposições (média)</dt>
                    <dd>
                      {numberFormatter.format(activeGrupo.proposicoesMedia)}
                    </dd>
                  </div>
                  <div>
                    <dt>Presença plenário</dt>
                    <dd>
                      {formatPercent(activeGrupo.presencaPlenarioMedia)}
                    </dd>
                  </div>
                  <div>
                    <dt>Presença comissões</dt>
                    <dd>
                      {formatPercent(activeGrupo.presencaComissoesMedia)}
                    </dd>
                  </div>
                  <div>
                    <dt>Fidelidade partidária</dt>
                    <dd>{formatPercent(activeGrupo.fidelidadeMedia)}</dd>
                  </div>
                </dl>
              </div>

              <div className="q4-deputy-panel" style={educationStyle}>
                <div className="q4-deputy-heading">
                  <div>
                    <span>Deputados da faixa</span>
                    <strong>{activeGrupo.nivel}</strong>
                  </div>
                  <small>
                    {activeDeputados.length === 0
                      ? 'Nenhum deputado'
                      : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                          safePage * PAGE_SIZE,
                          activeDeputados.length,
                        )} de ${activeDeputados.length}`}
                  </small>
                </div>

                <div className="q4-deputy-list">
                  {pageDeputados.map((deputado) => (
                    <DeputadoRow
                      deputado={deputado}
                      key={deputado.id}
                      metrica={metrica}
                    />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="q4-pagination">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Anterior
                    </button>
                    <span>
                      Página {safePage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Próxima
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function DeputadoRow({
  deputado,
  metrica,
}: {
  deputado: EscolaridadeDeputado
  metrica: MetricaConfig
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const value = metrica.getDeputado(deputado)

  return (
    <article className="q4-deputy-row">
      <div className="q4-avatar">
        {deputado.urlFoto && !imageFailed ? (
          <img
            src={deputado.urlFoto}
            alt={`Foto de ${deputado.nome}`}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{getInitials(deputado.nome)}</span>
        )}
      </div>
      <div className="q4-deputy-identity">
        <strong>{deputado.nome}</strong>
        <span>
          {deputado.partido} · {deputado.uf}
        </span>
        <small>
          {deputado.escolaridadeOriginal ?? 'Escolaridade não informada'}
        </small>
      </div>
      <div className="q4-deputy-metric">
        <span>
          {metrica.id === 'quantidade' ? 'Faixa' : metrica.label}
        </span>
        <strong>
          {metrica.id === 'quantidade'
            ? deputado.nivel
            : value === null
              ? 'Sem dado'
              : formatValor(value, metrica.tipo)}
        </strong>
      </div>
    </article>
  )
}

function formatValor(valor: number, tipo: MetricaTipo): string {
  if (tipo === 'moeda') {
    return currencyFormatter.format(valor)
  }

  if (tipo === 'percentual') {
    return formatPercent(valor)
  }

  return numberFormatter.format(valor)
}

function formatBarValor(valor: number, tipo: MetricaTipo): string {
  if (tipo === 'moeda') {
    return formatCompactCurrency(valor)
  }

  return formatValor(valor, tipo)
}

function formatPercent(valor: number): string {
  return `${numberFormatter.format(valor)}%`
}

function formatCompactCurrency(valor: number): string {
  if (valor >= 1_000_000) {
    return `R$ ${numberFormatter.format(valor / 1_000_000)} Mi`
  }

  if (valor >= 1000) {
    return `R$ ${numberFormatter.format(valor / 1000)} mil`
  }

  return currencyFormatter.format(valor)
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return `${first}${last}`.toUpperCase() || '—'
}
