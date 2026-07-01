import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  getStaticCategoriasDeputado,
  getStaticCustoBeneficioDeputado,
  getStaticDeputadoEixos,
  getStaticFornecedoresDeputado,
  getStaticHistoricoVotos,
} from '../../data/staticData'
import type { DeputadoEixoAtuacao, EixoAtuacao } from '../types'
import type { Questao3Response, VotoDeputadoTema } from '../../questao_3/types'
import type { CustoBeneficioDeputado, PresencaResumo } from '../../questao_7/types'
import type { FornecedorDeputado, Questao12Response } from '../../questao_12/types'
import type {
  CategoriaDespesaDeputado,
  Questao13Response,
} from '../../questao_13/types'
import './Questao2Page.css'

type Questao2PageProps = {
  deputadoId: number
  onClose: () => void
}

type RequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: DeputadoEixoAtuacao; error: null }
  | { status: 'error'; data: null; error: string }

type VoteRequestState =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: Questao3Response; error: null }
  | { status: 'error'; data: null; error: string }

type VoteFilterType = 'eixo' | 'tema'

type CostBenefitRequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: CustoBeneficioDeputado; error: null }
  | { status: 'error'; data: null; error: string }

type ExpenseRequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: Questao13Response; error: null }
  | { status: 'error'; data: null; error: string }

type SupplierRequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: Questao12Response; error: null }
  | { status: 'error'; data: null; error: string }

const initialState: RequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const initialVoteState: VoteRequestState = {
  status: 'idle',
  data: null,
  error: null,
}

const initialCostBenefitState: CostBenefitRequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const initialExpenseState: ExpenseRequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const initialSupplierState: SupplierRequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const eixoOptions: EixoAtuacao[] = [
  'social',
  'economico',
  'tributario',
  'seguranca',
  'saude',
  'educacao',
  'meio_ambiente',
  'infraestrutura',
  'administrativo',
  'outros',
]

const eixoLabels: Record<EixoAtuacao, string> = {
  social: 'Social',
  economico: 'Econômico',
  tributario: 'Tributário',
  seguranca: 'Segurança',
  saude: 'Saúde',
  educacao: 'Educação',
  meio_ambiente: 'Meio ambiente',
  infraestrutura: 'Infraestrutura',
  administrativo: 'Administrativo',
  outros: 'Outros',
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
})

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 4,
})

const VOTE_PAGE_SIZE = 8

export function Questao2Page({ deputadoId, onClose }: Questao2PageProps) {
  const [requestState, setRequestState] = useState<RequestState>(initialState)
  const [voteRequestState, setVoteRequestState] =
    useState<VoteRequestState>(initialVoteState)
  const [costBenefitState, setCostBenefitState] =
    useState<CostBenefitRequestState>(initialCostBenefitState)
  const [expenseState, setExpenseState] =
    useState<ExpenseRequestState>(initialExpenseState)
  const [supplierState, setSupplierState] =
    useState<SupplierRequestState>(initialSupplierState)
  const [voteFilterType, setVoteFilterType] = useState<VoteFilterType>('eixo')
  const [selectedEixo, setSelectedEixo] = useState<EixoAtuacao>('saude')
  const [draftTema, setDraftTema] = useState('Saúde')
  const [appliedTema, setAppliedTema] = useState('Saúde')
  const [votePage, setVotePage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDeputadoEixoAtuacao() {
      setRequestState({ status: 'loading', data: null, error: null })
      setVoteFilterType('eixo')
      setDraftTema('Saúde')
      setAppliedTema('Saúde')
      setVotePage(1)

      try {
        const data = await getStaticDeputadoEixos(deputadoId)

        if (!data) {
          throw new Error('Falha ao carregar eixos do deputado.')
        }

        if (controller.signal.aborted) {
          return
        }

        setRequestState({ status: 'success', data, error: null })
        setSelectedEixo(data.eixoPredominante)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setRequestState({
          status: 'error',
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao carregar eixos do deputado.',
        })
      }
    }

    loadDeputadoEixoAtuacao()

    return () => controller.abort()
  }, [deputadoId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadFornecedores() {
      setSupplierState({ status: 'loading', data: null, error: null })

      try {
        const data = await getStaticFornecedoresDeputado(deputadoId)

        if (controller.signal.aborted) {
          return
        }

        setSupplierState({ status: 'success', data, error: null })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setSupplierState({
          status: 'error',
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao carregar fornecedores.',
        })
      }
    }

    loadFornecedores()

    return () => controller.abort()
  }, [deputadoId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCategoriasDespesa() {
      setExpenseState({ status: 'loading', data: null, error: null })

      try {
        const data = await getStaticCategoriasDeputado(deputadoId)

        if (controller.signal.aborted) {
          return
        }

        setExpenseState({ status: 'success', data, error: null })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setExpenseState({
          status: 'error',
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao carregar categorias de despesa.',
        })
      }
    }

    loadCategoriasDespesa()

    return () => controller.abort()
  }, [deputadoId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCustoBeneficio() {
      setCostBenefitState({ status: 'loading', data: null, error: null })

      try {
        const data = await getStaticCustoBeneficioDeputado(deputadoId)

        if (!data) {
          throw new Error('Falha ao carregar score custo-benefício.')
        }

        if (controller.signal.aborted) {
          return
        }

        setCostBenefitState({ status: 'success', data, error: null })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setCostBenefitState({
          status: 'error',
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao carregar score custo-benefício.',
        })
      }
    }

    loadCustoBeneficio()

    return () => controller.abort()
  }, [deputadoId])

  useEffect(() => {
    const controller = new AbortController()
    const tema = appliedTema.trim()

    if (voteFilterType === 'tema') {
      if (!tema) {
        return () => controller.abort()
      }
    }

    async function loadHistoricoVotos() {
      setVoteRequestState({ status: 'loading', data: null, error: null })

      try {
        const data = await getStaticHistoricoVotos({
          deputadoId,
          page: votePage,
          limit: VOTE_PAGE_SIZE,
          filtro:
            voteFilterType === 'tema'
              ? { tipo: 'tema', tema }
              : { tipo: 'eixo', eixo: selectedEixo },
        })

        if (controller.signal.aborted) {
          return
        }

        setVoteRequestState({ status: 'success', data, error: null })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setVoteRequestState({
          status: 'error',
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao carregar histórico de votos.',
        })
      }
    }

    loadHistoricoVotos()

    return () => controller.abort()
  }, [appliedTema, deputadoId, selectedEixo, voteFilterType, votePage])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const detailTitle = useMemo(() => {
    if (requestState.status !== 'success') {
      return 'Abrindo informações do deputado'
    }

    return `${requestState.data.nome}`
  }, [requestState])

  const temasDisponiveis =
    voteRequestState.status === 'success'
      ? voteRequestState.data.temasDisponiveis
      : []

  function handleTemaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const tema = draftTema.trim()

    if (!tema) {
      setVoteRequestState(initialVoteState)
    }

    setVotePage(1)
    setAppliedTema(tema)
  }

  return (
    <div
      className="deputy-detail-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="questao-two"
        aria-labelledby="questao-two-title"
        aria-modal="true"
        role="dialog"
      >
        <div className="questao-two-header">
          <div>
            <h2 id="questao-two-title">{detailTitle}</h2>
            <p>Informações acerca do deputado</p>
          </div>
          <button
            type="button"
            className="detail-close-button"
            aria-label="Fechar detalhes do deputado"
            onClick={onClose}
          >
            X
          </button>
        </div>

        {requestState.status === 'loading' ? (
          <div className="status-box">Carregando eixos temáticos...</div>
        ) : null}

        {requestState.status === 'error' ? (
          <div className="status-box error">{requestState.error}</div>
        ) : null}

        {requestState.status === 'success' ? (
          <article className="deputy-axis-detail">
            <div className="deputy-side-panel">
              <div className="deputy-axis-profile">
                <img
                  src={requestState.data.foto}
                  alt={`Foto de ${requestState.data.nome}`}
                  loading="lazy"
                />
                <div>
                  <h3>{requestState.data.nome}</h3>
                  <p>
                    {[requestState.data.partido, requestState.data.uf]
                      .filter(Boolean)
                      .join(' - ') || 'Sem partido/UF'}
                  </p>
                </div>
              </div>

              <CostBenefitPanel requestState={costBenefitState} />
            </div>

            <section className="axis-keywords-card">
              <div className="axis-badge-row">
                <strong
                  className={`axis-badge axis-${requestState.data.eixoPredominante}`}
                >
                  {eixoLabels[requestState.data.eixoPredominante]}
                </strong>
                <span>
                  {requestState.data.totalProposicoes} proposições analisadas
                </span>
              </div>

              <div className="axis-mini-list">
                {requestState.data.eixos.map((eixo) => (
                  <span key={eixo.eixo}>
                    {eixoLabels[eixo.eixo]} - {eixo.total}
                  </span>
                ))}
              </div>

              <div className="word-cloud" aria-label="Nuvem de palavras">
                {requestState.data.termos.map((termo) => (
                  <span
                    className={`word-cloud-term weight-${termo.peso}`}
                    title={`${termo.frequencia} ocorrências`}
                    key={termo.termo}
                  >
                    {termo.termo}
                  </span>
                ))}
              </div>
            </section>

            <SupplierStackedBarPanel
              key={`fornecedores-${deputadoId}`}
              requestState={supplierState}
            />

            <ExpenseTreemapPanel
              key={`despesas-${deputadoId}`}
              requestState={expenseState}
            />

            <section
              className="vote-history-section"
              aria-labelledby="vote-history-title"
            >
              <div className="vote-history-header">
                <div>
                  <h3 id="vote-history-title">Histórico de votos por tema</h3>
                  <p>Votações associadas ao filtro selecionado.</p>
                </div>

                <div className="vote-filter-panel">
                  <div
                    className="vote-filter-toggle"
                    aria-label="Tipo de filtro dos votos"
                    role="group"
                  >
                    <button
                      type="button"
                      className={voteFilterType === 'eixo' ? 'active' : ''}
                      onClick={() => {
                        setVoteFilterType('eixo')
                        setVotePage(1)
                      }}
                    >
                      Eixo
                    </button>
                    <button
                      type="button"
                      className={voteFilterType === 'tema' ? 'active' : ''}
                      onClick={() => {
                        setVoteFilterType('tema')
                        setVotePage(1)
                      }}
                    >
                      Tema
                    </button>
                  </div>

                  {voteFilterType === 'eixo' ? (
                    <label className="vote-filter-field">
                      <span>Eixo</span>
                      <select
                        value={selectedEixo}
                        onChange={(event) => {
                          setSelectedEixo(event.target.value as EixoAtuacao)
                          setVotePage(1)
                        }}
                      >
                        {eixoOptions.map((eixo) => (
                          <option value={eixo} key={eixo}>
                            {eixoLabels[eixo]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <form className="vote-filter-field" onSubmit={handleTemaSubmit}>
                      <label>
                        <span>Tema</span>
                        <input
                          type="search"
                          list="temas-votados"
                          value={draftTema}
                          placeholder="Ex.: Saúde"
                          onChange={(event) => setDraftTema(event.target.value)}
                        />
                      </label>
                      <datalist id="temas-votados">
                        {temasDisponiveis.map((tema) => (
                          <option value={tema} key={tema} />
                        ))}
                      </datalist>
                      <button type="submit">Filtrar</button>
                    </form>
                  )}
                </div>
              </div>

              <VoteHistoryContent
                key={`${deputadoId}-${voteFilterType}-${selectedEixo}-${appliedTema}`}
                requestState={voteRequestState}
                onPageChange={setVotePage}
              />
            </section>
          </article>
        ) : null}
      </section>
    </div>
  )
}

function CostBenefitPanel({
  requestState,
}: {
  requestState: CostBenefitRequestState
}) {
  if (requestState.status === 'loading') {
    return <div className="cost-benefit-card status-box">Carregando score...</div>
  }

  if (requestState.status === 'error') {
    return (
      <div className="cost-benefit-card status-box error">
        {requestState.error}
      </div>
    )
  }

  return (
    <section className="cost-benefit-card" aria-labelledby="cost-benefit-title">
      <div className="cost-benefit-heading">
        <h3 id="cost-benefit-title">Score custo-benefício</h3>
        <p>Proposições e presença no plenário por gasto parlamentar.</p>
      </div>

      <strong className="cost-benefit-score">
        {numberFormatter.format(requestState.data.scoreCustoBeneficio)}
      </strong>

      <div className="cost-benefit-kpis">
        <span>
          <small>Custo</small>
          {currencyFormatter.format(requestState.data.gastoTotal)}
        </span>
        <span>
          <small>Score benefício</small>
          {numberFormatter.format(requestState.data.scoreBeneficio)}
        </span>
      </div>

      <div className="benefit-breakdown">
        <span>{requestState.data.totalProposicoes} proposições</span>
        <span>
          {formatPercent(requestState.data.presencaPlenario.percentualPresenca)} presença no plenário
        </span>
      </div>

      <div className="presence-card-row">
        <PresenceCard title="Plenário" data={requestState.data.presencaPlenario} />
      </div>

      
    </section>
  )
}

function PresenceCard({
  title,
  data,
}: {
  title: string
  data: PresencaResumo
}) {
  return (
    <div className="presence-mini-card">
      <span>{title}</span>
      <strong>{formatPercent(data.percentualPresenca)}</strong>
      <p>{data.totalSessoes} sessões</p>
      <dl>
        <div>
          <dt>Justificadas</dt>
          <dd>{data.ausenciasJustificadas}</dd>
        </div>
        <div>
          <dt>Não justificadas</dt>
          <dd>{data.ausenciasNaoJustificadas}</dd>
        </div>
      </dl>
    </div>
  )
}

function SupplierStackedBarPanel({
  requestState,
}: {
  requestState: SupplierRequestState
}) {
  const [selectedSupplier, setSelectedSupplier] =
    useState<FornecedorDeputado | null>(null)

  if (requestState.status === 'loading') {
    return (
      <div className="supplier-card status-box">
        Carregando fornecedores...
      </div>
    )
  }

  if (requestState.status === 'error') {
    return (
      <div className="supplier-card status-box error">
        {requestState.error}
      </div>
    )
  }

  const fornecedores = requestState.data.fornecedores
  const activeSupplier = selectedSupplier ?? fornecedores[0] ?? null

  return (
    <section className="supplier-card" aria-labelledby="supplier-title">
      <div className="supplier-card-header">
        <div>
          <h3 id="supplier-title">Principais fornecedores usados pelo deputado</h3>
      
        </div>
        <strong>{requestState.data.totalFornecedores} fornecedores</strong>
      </div>

      {fornecedores.length === 0 ? (
        <div className="status-box">Nenhum fornecedor encontrado.</div>
      ) : (
        <>
          <div className="supplier-bar-chart" aria-label="Soma do gasto total por fornecedor">
            {fornecedores.map((fornecedor, index) => (
              <div
                className="supplier-bar-row"
                key={`${fornecedor.fornecedor}-${fornecedor.cnpjCpf ?? index}`}
              >
                <span className="supplier-bar-label">
                  {shortenSupplierAxisLabel(fornecedor.fornecedor)}
                </span>
                <button
                  type="button"
                  className={`supplier-bar${
                    activeSupplier?.fornecedor === fornecedor.fornecedor &&
                    activeSupplier?.cnpjCpf === fornecedor.cnpjCpf
                      ? ' active'
                      : ''
                  }`}
                  style={{ width: `${getSupplierBarWidth(fornecedor, fornecedores)}%` }}
                  title={`${fornecedor.fornecedor}: ${currencyFormatter.format(
                    fornecedor.totalGasto,
                  )}`}
                  onClick={() => setSelectedSupplier(fornecedor)}
                >
                  <span>{formatCompactCurrency(fornecedor.totalGasto)}</span>
                </button>
              </div>
            ))}

            <div className="supplier-axis" aria-hidden="true">
              <span>0</span>
              <span>{formatCompactCurrency((fornecedores[0]?.totalGasto ?? 0) / 2)}</span>
              <span>{formatCompactCurrency(fornecedores[0]?.totalGasto ?? 0)}</span>
            </div>
          </div>

          {activeSupplier ? (
            <div className="supplier-detail-panel">
              <div>
                <span>{activeSupplier.fornecedor}</span>
                <p>{activeSupplier.cnpjCpf ?? 'CNPJ/CPF não informado'}</p>
              </div>
              <strong>{currencyFormatter.format(activeSupplier.totalGasto)}</strong>
              <dl>
                <div>
                  <dt>Transações</dt>
                  <dd>{activeSupplier.transacoes}</dd>
                </div>
                <div>
                  <dt>Ticket médio</dt>
                  <dd>{currencyFormatter.format(activeSupplier.ticketMedio)}</dd>
                </div>
                <div>
                  <dt>Participação</dt>
                  <dd>{formatPercent(activeSupplier.percentual)}</dd>
                </div>
              </dl>

              <div className="supplier-alerts">
                {activeSupplier.alertaConcentracao ? (
                  <span>Concentração acima de 30%</span>
                ) : null}
                {activeSupplier.alertaMesmoPartido ? (
                  <span>
                    Usado por {activeSupplier.deputadosMesmoPartido} deputados do mesmo partido
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function ExpenseTreemapPanel({
  requestState,
}: {
  requestState: ExpenseRequestState
}) {
  const [selectedCategory, setSelectedCategory] =
    useState<CategoriaDespesaDeputado | null>(null)

  if (requestState.status === 'loading') {
    return (
      <div className="expense-treemap-card status-box">
        Carregando categorias de despesa...
      </div>
    )
  }

  if (requestState.status === 'error') {
    return (
      <div className="expense-treemap-card status-box error">
        {requestState.error}
      </div>
    )
  }

  const categorias = requestState.data.categorias
  const activeCategory = selectedCategory ?? categorias[0] ?? null

  return (
    <section className="expense-treemap-card" aria-labelledby="expense-title">
      <div className="expense-card-header">
        <div>
          <h3 id="expense-title">Com o que o deputado mais gasta?</h3>
          <p>Categorias predominantes da cota parlamentar.</p>
        </div>
        <strong>{currencyFormatter.format(requestState.data.totalGasto)}</strong>
      </div>

      {categorias.length === 0 ? (
        <div className="status-box">Nenhuma despesa encontrada.</div>
      ) : (
        <>
          <div className="expense-treemap" aria-label="Treemap de despesas">
            {categorias.map((categoria, index) => (
              <button
                type="button"
                className={`expense-tile tile-${(index % 6) + 1}${
                  activeCategory?.categoria === categoria.categoria ? ' active' : ''
                }`}
                style={{
                  flexGrow: Math.max(1, Math.round(categoria.totalGasto / 1000)),
                }}
                key={categoria.categoria}
                onClick={() => setSelectedCategory(categoria)}
                title={`${categoria.categoria}: ${currencyFormatter.format(
                  categoria.totalGasto,
                )}`}
              >
                <span>{categoria.categoria}</span>
                <strong>{currencyFormatter.format(categoria.totalGasto)}</strong>
                <small>{formatPercent(categoria.percentual)}</small>
              </button>
            ))}
          </div>

          {activeCategory ? (
            <div className="expense-detail-panel">
              <span>{activeCategory.categoria}</span>
              <strong>{currencyFormatter.format(activeCategory.totalGasto)}</strong>
              <p>
                {activeCategory.quantidadeDespesas} despesas ·{' '}
                {formatPercent(activeCategory.percentual)} do total
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function VoteHistoryContent({
  requestState,
  onPageChange,
}: {
  requestState: VoteRequestState
  onPageChange: (page: number) => void
}) {
  const [selectedVote, setSelectedVote] = useState('todos')

  if (requestState.status === 'idle') {
    return <div className="status-box">Informe um tema para carregar os votos.</div>
  }

  if (requestState.status === 'loading') {
    return <div className="status-box">Carregando histórico de votos...</div>
  }

  if (requestState.status === 'error') {
    return <div className="status-box error">{requestState.error}</div>
  }

  if (requestState.data.totalVotacoes === 0) {
    return (
      <div className="status-box">
        Nenhuma votação encontrada para {requestState.data.filtro.label}.
      </div>
    )
  }

  const visibleVotes =
    selectedVote === 'todos'
      ? requestState.data.votos
      : requestState.data.votos.filter((voto) => voto.voto === selectedVote)
  const firstVoteNumber = (requestState.data.page - 1) * requestState.data.pageSize + 1
  const lastVoteNumber = Math.min(
    requestState.data.page * requestState.data.pageSize,
    requestState.data.totalVotacoes,
  )
  const pageLabel =
    selectedVote === 'todos'
      ? `${firstVoteNumber}-${lastVoteNumber} de ${requestState.data.totalVotacoes} votações`
      : `${visibleVotes.length} votos nesta página, de ${requestState.data.totalVotacoes} votações`

  return (
    <>
      <div className="vote-history-summary">
        <strong>
          {visibleVotes.length === requestState.data.totalVotacoes
            ? `${requestState.data.totalVotacoes} votações encontradas`
            : `${visibleVotes.length} de ${requestState.data.totalVotacoes} votações exibidas`}
        </strong>
        <div>
          <button
            type="button"
            className={`vote-chip vote-all${selectedVote === 'todos' ? ' active' : ''}`}
            onClick={() => setSelectedVote('todos')}
          >
            Todos
          </button>
          {requestState.data.resumoVotos.map((item) => (
            <button
              type="button"
              className={`vote-chip vote-${getVoteTone(item.voto)}${
                selectedVote === item.voto ? ' active' : ''
              }`}
              key={item.voto}
              onClick={() => setSelectedVote(item.voto)}
            >
              {item.voto}: {item.total}
            </button>
          ))}
        </div>
      </div>

      {visibleVotes.length === 0 ? (
        <div className="status-box">
          Nenhuma votação com voto {selectedVote} neste filtro.
        </div>
      ) : (
        <div className="vote-history-list">
          {visibleVotes.map((voto) => (
            <VoteHistoryItem voto={voto} key={buildVoteKey(voto)} />
          ))}
        </div>
      )}

      {requestState.data.totalPages > 1 ? (
        <div className="vote-pagination">
          <button
            type="button"
            disabled={requestState.data.page <= 1}
            onClick={() => onPageChange(requestState.data.page - 1)}
          >
            Anterior
          </button>
          <span>{pageLabel}</span>
          <span>
            Página {requestState.data.page} de {requestState.data.totalPages}
          </span>
          <button
            type="button"
            disabled={requestState.data.page >= requestState.data.totalPages}
            onClick={() => onPageChange(requestState.data.page + 1)}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </>
  )
}

function VoteHistoryItem({ voto }: { voto: VotoDeputadoTema }) {
  return (
    <article className="vote-history-item">
      <div className="vote-history-meta">
        <time dateTime={voto.dataHoraVoto ?? voto.dataVotacao ?? undefined}>
          {formatVoteDate(voto)}
        </time>
        <strong className={`vote-chip vote-${getVoteTone(voto.voto)}`}>
          {voto.voto}
        </strong>
      </div>

      <div className="vote-history-body">
        <div>
          <h4>{voto.proposicaoTitulo ?? voto.idVotacao}</h4>
          <p>{voto.descricao ?? voto.proposicaoEmenta ?? 'Sem descrição disponível.'}</p>
        </div>

        <div className="vote-history-tags">
          <span>{voto.orgao ?? 'Órgão não informado'}</span>
          {voto.temas.map((tema) => (
            <span key={tema}>{tema}</span>
          ))}
        </div>
      </div>
    </article>
  )
}

function formatVoteDate(voto: VotoDeputadoTema): string {
  if (voto.dataHoraVoto) {
    return dateTimeFormatter.format(new Date(voto.dataHoraVoto))
  }

  if (voto.dataVotacao) {
    return dateFormatter.format(new Date(voto.dataVotacao))
  }

  return 'Sem data'
}

function formatPercent(value: number): string {
  return `${numberFormatter.format(value)}%`
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000000) {
    return `${numberFormatter.format(value / 1000000)} Mi`
  }

  if (value >= 1000) {
    return `${numberFormatter.format(value / 1000)} mil`
  }

  return currencyFormatter.format(value)
}

function getSupplierBarWidth(
  fornecedor: FornecedorDeputado,
  fornecedores: FornecedorDeputado[],
): number {
  const maxValue = fornecedores[0]?.totalGasto ?? 0

  if (maxValue <= 0) {
    return 0
  }

  return Math.max(2, (fornecedor.totalGasto / maxValue) * 100)
}

function shortenSupplierAxisLabel(value: string): string {
  return value.length > 36 ? `${value.slice(0, 33)}...` : value
}

function getVoteTone(voto: string): string {
  const normalizedVote = voto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalizedVote.includes('sim')) {
    return 'sim'
  }

  if (normalizedVote.includes('nao')) {
    return 'nao'
  }

  if (normalizedVote.includes('abstencao')) {
    return 'abstencao'
  }

  if (normalizedVote.includes('obstrucao')) {
    return 'obstrucao'
  }

  if (
    normalizedVote.includes('artigo 17') ||
    normalizedVote.includes('art. 17') ||
    normalizedVote.includes('art 17')
  ) {
    return 'artigo17'
  }

  return 'outros'
}

function buildVoteKey(voto: VotoDeputadoTema): string {
  return `${voto.idVotacao}-${voto.proposicaoUri ?? voto.proposicaoTitulo ?? 'sem-proposicao'}`
}
