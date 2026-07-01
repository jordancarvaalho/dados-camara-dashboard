import { useEffect, useState, type CSSProperties } from 'react'
import { getStaticRankingCustoBeneficio } from '../../data/staticData'
import type {
  CustoBeneficioFaixa,
  DeputadoRankingCustoBeneficio,
  PresencaResumo,
  RankingCustoBeneficioResponse,
} from '../types'
import './RankingCustoBeneficioPage.css'

type RequestState =
  | { status: 'loading'; data: RankingCustoBeneficioResponse | null; error: null }
  | { status: 'success'; data: RankingCustoBeneficioResponse; error: null }
  | { status: 'error'; data: RankingCustoBeneficioResponse | null; error: string }

type Ordem = 'maior' | 'menor'

const initialState: RequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 4,
})

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})

const integerFormatter = new Intl.NumberFormat('pt-BR')

export function RankingCustoBeneficioPage() {
  const [requestState, setRequestState] = useState<RequestState>(initialState)
  const [nome, setNome] = useState('')
  const [partido, setPartido] = useState('')
  const [uf, setUf] = useState('')
  const [gastoMinimo, setGastoMinimo] = useState('10000')
  const [ordem, setOrdem] = useState<Ordem>('maior')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      page: String(page),
      ordem,
      gastoMinimo,
    })

    if (nome.trim()) {
      params.set('nome', nome.trim())
    }

    if (partido) {
      params.set('partido', partido)
    }

    if (uf) {
      params.set('uf', uf)
    }

    async function loadRanking() {
      setRequestState((current) => ({
        status: 'loading',
        data: current.data,
        error: null,
      }))

      try {
        const data = await getStaticRankingCustoBeneficio({
          page: Number(params.get('page')),
          ordem: params.get('ordem') === 'menor' ? 'menor' : 'maior',
          gastoMinimo: Number(params.get('gastoMinimo')),
          nome: params.get('nome'),
          partido: params.get('partido'),
          uf: params.get('uf'),
        })

        if (controller.signal.aborted) {
          return
        }

        setRequestState({ status: 'success', data, error: null })
        setSelectedId((current) =>
          data.deputados.some((item) => item.deputadoId === current)
            ? current
            : (data.deputados[0]?.deputadoId ?? null),
        )
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
              : 'Falha ao carregar o ranking de custo-benefício.',
        }))
      }
    }

    loadRanking()
    return () => controller.abort()
  }, [gastoMinimo, nome, ordem, page, partido, uf])

  const data = requestState.data
  const activeDeputado =
    data?.deputados.find((item) => item.deputadoId === selectedId) ??
    data?.deputados[0] ??
    null

  return (
    <section
      className="cost-ranking"
      aria-labelledby="cost-ranking-title"
    >
      <header className="cost-ranking-header">
        <div>
          <span>Desempenho parlamentar</span>
          <h2 id="cost-ranking-title">Ranking de custo-benefício</h2>
          <p>
            Compara proposições e presença no plenário com o gasto da cota
            parlamentar, seguindo a fórmula definida para a questão 7.
          </p>
        </div>
        {data ? (
          <div className="cost-ranking-formula">
            <span>Fórmula</span>
            <strong>(Proposições + presença) ÷ custo × 100 mil</strong>
            <small>25 deputados por página</small>
          </div>
        ) : null}
      </header>

      {data ? (
        <div className="cost-ranking-kpis">
          <Kpi
            label="Deputados no recorte"
            value={integerFormatter.format(data.totalDeputados)}
            detail="ordenados pelo score CxB"
          />
          <Kpi
            label="Mediana do score"
            value={formatScore(data.resumo.medianaScore)}
            detail="referência menos sensível a extremos"
          />
          <Kpi
            label="Benefício médio"
            value={numberFormatter.format(data.resumo.mediaBeneficio)}
            detail="proposições + presença no plenário"
          />
          <Kpi
            label="Custo total"
            value={formatCompactCurrency(data.resumo.gastoTotal)}
            detail="cota parlamentar do recorte"
          />
        </div>
      ) : null}

      <div className="cost-ranking-filters">
        <label>
          <span>Buscar deputado</span>
          <input
            type="search"
            value={nome}
            placeholder="Nome"
            onChange={(event) => {
              setNome(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <label>
          <span>Partido</span>
          <select
            value={partido}
            onChange={(event) => {
              setPartido(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Todos</option>
            {(data?.partidosDisponiveis ?? []).map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Estado (UF)</span>
          <select
            value={uf}
            onChange={(event) => {
              setUf(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Todos</option>
            {(data?.ufsDisponiveis ?? []).map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Gasto mínimo</span>
          <select
            value={gastoMinimo}
            onChange={(event) => {
              setGastoMinimo(event.target.value)
              setPage(1)
            }}
          >
            <option value="10000">R$ 10 mil</option>
            <option value="100000">R$ 100 mil</option>
            <option value="500000">R$ 500 mil</option>
            <option value="1000000">R$ 1 milhão</option>
          </select>
        </label>
        <label>
          <span>Ordenação</span>
          <select
            value={ordem}
            onChange={(event) => {
              setOrdem(event.target.value as Ordem)
              setPage(1)
            }}
          >
            <option value="maior">Maior CxB primeiro</option>
            <option value="menor">Menor CxB primeiro</option>
          </select>
        </label>
      </div>

      {requestState.status === 'loading' && !data ? (
        <div className="status-box cost-ranking-loading">
          Calculando scores de todos os deputados...
        </div>
      ) : null}

      {requestState.status === 'loading' && data ? (
        <div className="cost-ranking-refresh">Atualizando ranking...</div>
      ) : null}

      {requestState.status === 'error' ? (
        <div className="status-box error">{requestState.error}</div>
      ) : null}

      {data && data.deputados.length === 0 ? (
        <div className="status-box">
          Nenhum deputado corresponde aos filtros selecionados.
        </div>
      ) : null}

      {data && data.deputados.length > 0 ? (
        <>
          <div className="cost-ranking-dashboard">
            <div className="cost-ranking-list-card">
              <div className="cost-ranking-list-heading">
                <div>
                  <strong>
                    Página {data.page} de {data.totalPages}
                  </strong>
                  <span>
                    {data.deputados.length} deputados exibidos · posição geral
                    preservada
                  </span>
                </div>
                <div className="cost-ranking-legend">
                  <span className="excellent">Melhor CxB</span>
                  <span className="regular">Intermediário</span>
                  <span className="low">Baixo CxB</span>
                </div>
              </div>

              <div className="cost-ranking-list">
                {data.deputados.map((deputado) => (
                  <RankingRow
                    active={activeDeputado?.deputadoId === deputado.deputadoId}
                    deputado={deputado}
                    key={deputado.deputadoId}
                    onSelect={() => setSelectedId(deputado.deputadoId)}
                  />
                ))}
              </div>
            </div>

            <DeputadoDetail deputado={activeDeputado} />
          </div>

          <div className="cost-ranking-pagination">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </button>
            <span>
              Página {data.page} de {data.totalPages} ·{' '}
              {integerFormatter.format(data.totalDeputados)} deputados
            </span>
            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      ) : null}

      {data ? (
        <details className="cost-ranking-methodology">
          <summary>Como interpretar o ranking?</summary>
          <p>
            O benefício soma proposições × {data.formula.proposicao} e o
            percentual de presença no plenário ×{' '}
            {data.formula.presencaPlenario}. Esse valor é dividido pelo gasto
            total e multiplicado por {integerFormatter.format(data.formula.escala)}.
            O ranking considera deputados com gasto mínimo de{' '}
            {currencyFormatter.format(data.formula.gastoMinimoPadrao)}. A cor
            representa a posição relativa: verde indica os melhores quintis e
            vermelho, os menores.
          </p>
        </details>
      ) : null}
    </section>
  )
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="cost-ranking-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function RankingRow({
  deputado,
  active,
  onSelect,
}: {
  deputado: DeputadoRankingCustoBeneficio
  active: boolean
  onSelect: () => void
}) {
  const style = {
    '--rank-color': getRankColor(deputado.faixa),
  } as CSSProperties

  return (
    <button
      type="button"
      className={`cost-ranking-row${active ? ' active' : ''}`}
      style={style}
      onClick={onSelect}
    >
      <span className="cost-rank-position">#{deputado.posicaoGeral}</span>
      <DeputadoAvatar deputado={deputado} />
      <span className="cost-rank-identity">
        <strong>{deputado.nome}</strong>
        <small>
          {deputado.partido} · {deputado.uf}
        </small>
      </span>
      <span className="cost-rank-indicator">
        <small>Benefício</small>
        <strong>{numberFormatter.format(deputado.scoreBeneficio)}</strong>
      </span>
      <span className="cost-rank-indicator cost-column">
        <small>Custo</small>
        <strong>{formatCompactCurrency(deputado.gastoTotal)}</strong>
      </span>
      <span className="cost-rank-indicator">
        <small>Presença</small>
        <strong>{formatPercent(deputado.presencaPlenario.percentualPresenca)}</strong>
      </span>
      <span className="cost-rank-score">
        <strong title={formatScore(deputado.scoreCustoBeneficio)}>
          {formatCompactScore(deputado.scoreCustoBeneficio)}
        </strong>
        <small>{deputado.faixa}</small>
      </span>
    </button>
  )
}

function DeputadoDetail({
  deputado,
}: {
  deputado: DeputadoRankingCustoBeneficio | null
}) {
  if (!deputado) {
    return null
  }

  const style = {
    '--rank-color': getRankColor(deputado.faixa),
  } as CSSProperties

  return (
    <aside className="cost-ranking-detail" style={style}>
      <div className="cost-detail-heading">
        <DeputadoAvatar deputado={deputado} large />
        <div>
          <span>
            #{deputado.posicaoGeral} · {deputado.partido} · {deputado.uf}
          </span>
          <h3>{deputado.nome}</h3>
          <small>{deputado.faixa}</small>
        </div>
      </div>

      <div className="cost-detail-score">
        <span>Score custo-benefício</span>
        <strong>{formatScore(deputado.scoreCustoBeneficio)}</strong>
      </div>

      {deputado.baseCustoReduzida ? (
        <div className="cost-base-warning">
          Base de custo inferior a R$ 100 mil. O denominador reduzido pode
          ampliar o score; compare também benefício e presença.
        </div>
      ) : null}

      <div className="cost-detail-benefit">
        <div>
          <span>Score benefício</span>
          <strong>{numberFormatter.format(deputado.scoreBeneficio)}</strong>
        </div>
        <div>
          <span>Gasto total</span>
          <strong>{currencyFormatter.format(deputado.gastoTotal)}</strong>
        </div>
      </div>

      <dl className="cost-detail-kpis">
        <div>
          <dt>Proposições</dt>
          <dd>{integerFormatter.format(deputado.totalProposicoes)}</dd>
        </div>
        <div>
          <dt>Presenças</dt>
          <dd>{integerFormatter.format(deputado.presencaPlenario.presencas)}</dd>
        </div>
        <div>
          <dt>Presença no plenário</dt>
          <dd>{formatPercent(deputado.presencaPlenario.percentualPresenca)}</dd>
        </div>
        <div>
          <dt>Sessões avaliadas</dt>
          <dd>{integerFormatter.format(deputado.presencaPlenario.totalSessoes)}</dd>
        </div>
      </dl>

      <div className="cost-presence-grid">
        <PresenceDetail title="Plenário" data={deputado.presencaPlenario} />
      </div>
    </aside>
  )
}

function PresenceDetail({
  title,
  data,
}: {
  title: string
  data: PresencaResumo
}) {
  return (
    <section className="cost-presence-detail">
      <div>
        <span>{title}</span>
        <strong>{formatPercent(data.percentualPresenca)}</strong>
      </div>
      <dl>
        <div>
          <dt>Sessões</dt>
          <dd>{integerFormatter.format(data.totalSessoes)}</dd>
        </div>
        <div>
          <dt>Justificadas</dt>
          <dd>{integerFormatter.format(data.ausenciasJustificadas)}</dd>
        </div>
        <div>
          <dt>Não justificadas</dt>
          <dd>{integerFormatter.format(data.ausenciasNaoJustificadas)}</dd>
        </div>
      </dl>
    </section>
  )
}

function DeputadoAvatar({
  deputado,
  large = false,
}: {
  deputado: DeputadoRankingCustoBeneficio
  large?: boolean
}) {
  const [failed, setFailed] = useState(false)

  return (
    <span className={`cost-rank-avatar${large ? ' large' : ''}`}>
      {deputado.urlFoto && !failed ? (
        <img
          src={deputado.urlFoto}
          alt={`Foto de ${deputado.nome}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{getInitials(deputado.nome)}</span>
      )}
    </span>
  )
}

function getRankColor(faixa: CustoBeneficioFaixa): string {
  const colors: Record<CustoBeneficioFaixa, string> = {
    Excelente: '#247553',
    'Muito bom': '#5a9868',
    Regular: '#a7a34b',
    Atenção: '#c77b3f',
    'Baixo CxB': '#b5443e',
  }

  return colors[faixa]
}

function formatScore(value: number): string {
  return numberFormatter.format(value)
}

function formatCompactScore(value: number): string {
  if (value >= 1_000_000) {
    return `${percentFormatter.format(value / 1_000_000)} Mi`
  }

  if (value >= 1000) {
    return `${percentFormatter.format(value / 1000)} mil`
  }

  return formatScore(value)
}

function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${percentFormatter.format(value / 1_000_000)} Mi`
  }

  if (value >= 1000) {
    return `R$ ${percentFormatter.format(value / 1000)} mil`
  }

  return currencyFormatter.format(value)
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return `${first}${last}`.toUpperCase() || '—'
}
