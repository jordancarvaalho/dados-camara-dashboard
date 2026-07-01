import { useEffect, useMemo, useState } from 'react'
import { getStaticPosicionamentoIdeologico } from '../../data/staticData'
import type {
  DeputadoIdeologico,
  IdeologiaClassificacao,
  PartidoIdeologico,
  Questao9Response,
} from '../types'
import './Questao9Page.css'

type RequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: Questao9Response; error: null }
  | { status: 'error'; data: null; error: string }

const initialState: RequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})

const integerFormatter = new Intl.NumberFormat('pt-BR')

export function Questao9Page() {
  const [requestState, setRequestState] = useState<RequestState>(initialState)
  const [selectedParty, setSelectedParty] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [search, setSearch] = useState('')
  const [ideologyOrder, setIdeologyOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedDeputadoId, setSelectedDeputadoId] = useState<number | null>(
    null,
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadIdeologia() {
      try {
        const data = await getStaticPosicionamentoIdeologico()

        if (controller.signal.aborted) {
          return
        }

        setRequestState({ status: 'success', data, error: null })
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
              : 'Falha ao calcular o posicionamento ideológico.',
        })
      }
    }

    loadIdeologia()
    return () => controller.abort()
  }, [])

  const data = requestState.data
  const filteredDeputados = useMemo(() => {
    if (!data) {
      return []
    }

    const normalizedSearch = normalizeText(search)

    return data.deputados
      .filter((deputado) => {
        const matchesParty =
          selectedParty === '' || deputado.partido === selectedParty
        const matchesClass =
          selectedClass === '' || deputado.classificacao === selectedClass
        const matchesSearch =
          normalizedSearch === '' ||
          normalizeText(deputado.nome).includes(normalizedSearch) ||
          String(deputado.id).includes(normalizedSearch)

        return matchesParty && matchesClass && matchesSearch
      })
      .sort((first, second) => {
        const scoreOrder = first.scoreIdeologico - second.scoreIdeologico
        const direction = ideologyOrder === 'asc' ? 1 : -1

        return (
          scoreOrder * direction ||
          first.nome.localeCompare(second.nome, 'pt-BR')
        )
      })
  }, [data, ideologyOrder, search, selectedClass, selectedParty])

  const activeDeputado =
    filteredDeputados.find(
      (deputado) => deputado.id === selectedDeputadoId,
    ) ??
    filteredDeputados[0] ??
    null

  const activeParty =
    data?.partidos.find(
      (partido) =>
        partido.partido === (selectedParty || activeDeputado?.partido),
    ) ?? null

  if (requestState.status === 'error') {
    return (
      <section className="questao-nine">
        <div className="status-box error">{requestState.error}</div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="questao-nine">
        <div className="status-box q9-loading">
          Construindo matriz de votação e reduzindo o eixo ideológico...
        </div>
      </section>
    )
  }

  return (
    <section className="questao-nine" aria-labelledby="questao-nine-title">
      <header className="q9-hero">
        <div>
          <span className="q9-kicker">Comportamento parlamentar</span>
          <h2 id="questao-nine-title">Mapa ideológico das votações</h2>
          <p>
            Cada deputado é projetado em um único eixo a partir da matriz
            Deputado × Votação. O resultado é normalizado de −100 a +100 e
            comparado à média do partido.
          </p>
        </div>
        <div className="q9-method-badge">
          <span>Método</span>
          <strong>{data.meta.metodo}</strong>
          <small>{formatPercent(data.meta.varianciaExplicadaPct)} da variância</small>
        </div>
      </header>

      <div className="q9-kpis">
        <Kpi
          label="Matriz analisada"
          value={`${integerFormatter.format(data.meta.totalDeputados)} × ${integerFormatter.format(data.meta.totalVotacoes)}`}
          detail="deputados × votações"
        />
        <Kpi
          label="Votos válidos"
          value={integerFormatter.format(data.meta.totalRegistros)}
          detail="Sim, Não, Abstenção ou Obstrução"
        />
        <Kpi
          label="Partidos"
          value={integerFormatter.format(data.partidos.length)}
          detail="com deputados posicionados"
        />
        <Kpi
          label="Escala"
          value="−100 a +100"
          detail="esquerda → direita"
        />
      </div>

      <section className="q9-distribution" aria-labelledby="q9-distribution-title">
        <div className="q9-section-heading">
          <div>
            <span>Distribuição</span>
            <h3 id="q9-distribution-title">Classificação por faixa</h3>
          </div>
          <p>Limites: −60, −20, +20 e +60.</p>
        </div>
        <div className="q9-distribution-grid">
          {data.distribuicao.map((item) => (
            <button
              type="button"
              className={`q9-class-card ${classSlug(item.classificacao)}${
                selectedClass === item.classificacao ? ' active' : ''
              }`}
              key={item.classificacao}
              onClick={() =>
                setSelectedClass((current) =>
                  current === item.classificacao ? '' : item.classificacao,
                )
              }
            >
              <span>{item.classificacao}</span>
              <strong>{item.totalDeputados}</strong>
              <small>{formatPercent(item.percentual)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="q9-party-spectrum" aria-labelledby="q9-party-title">
        <div className="q9-section-heading">
          <div>
            <span>Score médio por partido</span>
            <h3 id="q9-party-title">Espectro partidário</h3>
          </div>
          <p>A faixa indica a amplitude dos deputados; o ponto é a média.</p>
        </div>

        <div className="q9-spectrum-axis" aria-hidden="true">
          <span>−100 · Esquerda</span>
          <span>Centro</span>
          <span>Direita · +100</span>
        </div>

        <div className="q9-party-list">
          {data.partidos.map((partido) => (
            <PartySpectrumRow
              active={selectedParty === partido.partido}
              key={partido.partido}
              partido={partido}
              onSelect={() =>
                setSelectedParty((current) =>
                  current === partido.partido ? '' : partido.partido,
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="q9-explorer" aria-labelledby="q9-explorer-title">
        <div className="q9-section-heading">
          <div>
            <span>Análise individual</span>
            <h3 id="q9-explorer-title">Deputado × média do partido</h3>
          </div>
          <p>
            Alinhamento = 100% menos a distância relativa na escala de 200
            pontos.
          </p>
        </div>

        <div className="q9-filters">
          <label>
            <span>Partido</span>
            <select
              value={selectedParty}
              onChange={(event) => {
                setSelectedParty(event.target.value)
                setSelectedDeputadoId(null)
              }}
            >
              <option value="">Todos os partidos</option>
              {[...data.partidos]
                .sort((first, second) =>
                  first.partido.localeCompare(second.partido, 'pt-BR'),
                )
                .map((partido) => (
                  <option value={partido.partido} key={partido.partido}>
                    {partido.partido}
                  </option>
                ))}
            </select>
          </label>

          <div className="q9-filter-field">
            <div className="q9-filter-label-row">
              <span>Faixa ideológica</span>
              <button
                type="button"
                className="q9-order-toggle"
                aria-label={
                  ideologyOrder === 'asc'
                    ? 'Inverter para direita até esquerda'
                    : 'Inverter para esquerda até direita'
                }
                title={
                  ideologyOrder === 'asc'
                    ? 'Exibir da direita para a esquerda'
                    : 'Exibir da esquerda para a direita'
                }
                onClick={() => {
                  setIdeologyOrder((current) =>
                    current === 'asc' ? 'desc' : 'asc',
                  )
                  setSelectedDeputadoId(null)
                }}
              >
                <span aria-hidden="true">
                  {ideologyOrder === 'asc' ? '↓' : '↑'}
                </span>
              </button>
            </div>
            <select
              aria-label="Faixa ideológica"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              <option value="">Todas as faixas</option>
              {data.distribuicao.map((item) => (
                <option value={item.classificacao} key={item.classificacao}>
                  {item.classificacao}
                </option>
              ))}
            </select>
          </div>

          <label>
            <span>Buscar deputado</span>
            <input
              type="search"
              value={search}
              placeholder="Nome ou ID"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="q9-explorer-grid">
          <div className="q9-deputy-list">
            <div className="q9-list-header">
              <strong>{filteredDeputados.length} deputados</strong>
              <span>
                {ideologyOrder === 'asc'
                  ? 'ordenados da esquerda para a direita'
                  : 'ordenados da direita para a esquerda'}
              </span>
            </div>
            <div className="q9-deputy-scroll">
              {filteredDeputados.map((deputado) => (
                <button
                  type="button"
                  className={`q9-deputy-row${
                    activeDeputado?.id === deputado.id ? ' active' : ''
                  }`}
                  key={deputado.id}
                  onClick={() => setSelectedDeputadoId(deputado.id)}
                >
                  <div>
                    <strong>{deputado.nome}</strong>
                    <span>
                      {deputado.partido} · {deputado.uf} ·{' '}
                      {deputado.totalVotacoes} votações
                    </span>
                  </div>
                  <div className="q9-row-score">
                    <strong>{formatScore(deputado.scoreIdeologico)}</strong>
                    <span>{deputado.classificacao}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <DeputadoDetail deputado={activeDeputado} partido={activeParty} />
        </div>
      </section>

      <details className="q9-methodology">
        <summary>Como o posicionamento foi calculado?</summary>
        <ol>
          <li>
            Os votos foram codificados como Sim = +1, Não = −1 e
            Abstenção/Obstrução = 0.
          </li>
          <li>
            A matriz esparsa possui deputados nas linhas e votações nas
            colunas; ausências também recebem zero.
          </li>
          <li>
            O primeiro componente do Truncated SVD reduz a matriz a um eixo.
          </li>
          <li>
            O eixo é normalizado entre −100 e +100 e seu sinal é orientado
            para manter PT à esquerda de PL.
          </li>
          <li>
            A média de cada partido é calculada após o score individual; o
            alinhamento mede a distância entre ambos.
          </li>
        </ol>
      </details>
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
    <article className="q9-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function PartySpectrumRow({
  partido,
  active,
  onSelect,
}: {
  partido: PartidoIdeologico
  active: boolean
  onSelect: () => void
}) {
  const minimum = scorePosition(partido.scoreMinimo)
  const maximum = scorePosition(partido.scoreMaximo)
  const average = scorePosition(partido.scoreMedio)

  return (
    <button
      type="button"
      className={`q9-party-row${active ? ' active' : ''}`}
      onClick={onSelect}
    >
      <span className="q9-party-name">
        <strong>{partido.partido}</strong>
        <small>{partido.totalDeputados} dep.</small>
      </span>
      <span className="q9-party-track">
        <span
          className="q9-party-range"
          style={{ left: `${minimum}%`, width: `${maximum - minimum}%` }}
        />
        <span className="q9-party-zero" />
        <span
          className={`q9-party-dot ${classSlug(partido.classificacao)}`}
          style={{ left: `${average}%` }}
        />
      </span>
      <span className="q9-party-value">
        <strong>{formatScore(partido.scoreMedio)}</strong>
        <small>{formatPercent(partido.alinhamentoMedioPct)} alinh.</small>
      </span>
    </button>
  )
}

function DeputadoDetail({
  deputado,
  partido,
}: {
  deputado: DeputadoIdeologico | null
  partido: PartidoIdeologico | null
}) {
  if (!deputado) {
    return (
      <div className="q9-detail empty">
        Nenhum deputado corresponde aos filtros selecionados.
      </div>
    )
  }

  return (
    <article className="q9-detail">
      <div className="q9-detail-heading">
        <DeputadoPortrait
          key={`${deputado.id}-${deputado.urlFoto ?? 'sem-foto'}`}
          nome={deputado.nome}
          urlFoto={deputado.urlFoto}
        />
        <div className="q9-detail-identity">
          <span>{deputado.partido} · {deputado.uf}</span>
          <h3>{deputado.nome}</h3>
          <small>Deputado federal</small>
        </div>
        <span className={`q9-class-pill ${classSlug(deputado.classificacao)}`}>
          {deputado.classificacao}
        </span>
      </div>

      <div className="q9-comparison-scale">
        <div className="q9-comparison-track">
          <span className="q9-comparison-zero" />
          <span
            className="q9-party-marker"
            style={{ left: `${scorePosition(deputado.scoreMedioPartido)}%` }}
            title={`Média do partido: ${formatScore(
              deputado.scoreMedioPartido,
            )}`}
          />
          <span
            className="q9-deputy-marker"
            style={{ left: `${scorePosition(deputado.scoreIdeologico)}%` }}
            title={`Deputado: ${formatScore(deputado.scoreIdeologico)}`}
          />
        </div>
        <div className="q9-comparison-legend">
          <span><i className="party" /> Partido</span>
          <span><i className="deputy" /> Deputado</span>
        </div>
      </div>

      <div className="q9-detail-score">
        <span>Score ideológico</span>
        <strong>{formatScore(deputado.scoreIdeologico)}</strong>
      </div>

      <dl>
        <div>
          <dt>Média do partido</dt>
          <dd>{formatScore(deputado.scoreMedioPartido)}</dd>
        </div>
        <div>
          <dt>Distância do partido</dt>
          <dd>{numberFormatter.format(deputado.distanciaPartido)} pts</dd>
        </div>
        <div>
          <dt>Alinhamento</dt>
          <dd>{formatPercent(deputado.alinhamentoPartidoPct)}</dd>
        </div>
        <div>
          <dt>Votações na matriz</dt>
          <dd>{integerFormatter.format(deputado.totalVotacoes)}</dd>
        </div>
        {partido ? (
          <>
            <div>
              <dt>Dispersão partidária</dt>
              <dd>{numberFormatter.format(partido.dispersao)} pts</dd>
            </div>
            <div>
              <dt>Faixa do partido</dt>
              <dd>{partido.classificacao}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </article>
  )
}

function DeputadoPortrait({
  nome,
  urlFoto,
}: {
  nome: string
  urlFoto: string | null
}) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!urlFoto || imageFailed) {
    return (
      <div
        className="q9-deputy-portrait fallback"
        role="img"
        aria-label={`Foto indisponível de ${nome}`}
      >
        <span>{getInitials(nome)}</span>
      </div>
    )
  }

  return (
    <div className="q9-deputy-portrait">
      <img
        src={urlFoto}
        alt={`Foto oficial de ${nome}`}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    </div>
  )
}

function formatScore(value: number): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${numberFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${numberFormatter.format(value)}%`
}

function scorePosition(score: number): number {
  return Math.max(0, Math.min(100, (score + 100) / 2))
}

function classSlug(value: IdeologiaClassificacao): string {
  return normalizeText(value).replaceAll(' ', '-')
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return '—'
  }

  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return `${first}${last}`.toUpperCase()
}
