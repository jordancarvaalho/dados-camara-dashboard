import { useEffect, useMemo, useState } from 'react'
import { getStaticCoesaoPartidaria } from '../../data/staticData'
import type {
  CoesaoClassificacao,
  PartidoCoesao,
  Questao10Response,
} from '../types'
import './Questao10Page.css'

type RequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: Questao10Response; error: null }
  | { status: 'error'; data: null; error: string }

type Ordenacao = 'disciplina' | 'amostra'

const initialState: RequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const integerFormatter = new Intl.NumberFormat('pt-BR')
const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

export function Questao10Page() {
  const [requestState, setRequestState] = useState<RequestState>(initialState)
  const [minimoObservacoes, setMinimoObservacoes] = useState(0)
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('disciplina')
  const [busca, setBusca] = useState('')
  const [selectedParty, setSelectedParty] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCoesao() {
      try {
        const data = await getStaticCoesaoPartidaria()

        if (controller.signal.aborted) {
          return
        }

        setRequestState({ status: 'success', data, error: null })
        setSelectedParty(data.ranking[0]?.partido ?? null)
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
              : 'Falha ao carregar o ranking de coesão partidária.',
        })
      }
    }

    loadCoesao()
    return () => controller.abort()
  }, [])

  const data = requestState.data
  const rankingFiltrado = useMemo(() => {
    if (!data) {
      return []
    }

    const buscaNormalizada = busca.trim().toLocaleUpperCase('pt-BR')
    const resultado = data.ranking.filter(
      (partido) =>
        partido.totalVotosAnalisados >= minimoObservacoes &&
        (buscaNormalizada === '' ||
          partido.partido
            .toLocaleUpperCase('pt-BR')
            .includes(buscaNormalizada)),
    )

    return [...resultado].sort((first, second) => {
      if (ordenacao === 'amostra') {
        return (
          second.totalVotosAnalisados - first.totalVotosAnalisados ||
          second.pctDisciplina - first.pctDisciplina
        )
      }

      return (
        second.pctDisciplina - first.pctDisciplina ||
        second.totalVotosAnalisados - first.totalVotosAnalisados
      )
    })
  }, [busca, data, minimoObservacoes, ordenacao])

  if (requestState.status === 'error') {
    return (
      <section className="questao-ten">
        <div className="status-box error">{requestState.error}</div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="questao-ten">
        <div className="status-box q10-loading">
          Comparando votos e orientações partidárias...
        </div>
      </section>
    )
  }

  const activeParty =
    rankingFiltrado.find((partido) => partido.partido === selectedParty) ??
    rankingFiltrado[0] ??
    null
  const leader = data.ranking[0] ?? null
  const robustLeader =
    data.ranking.find(
      (partido) =>
        partido.totalVotosAnalisados >=
        data.metodologia.limiteAmostraPequena,
    ) ?? leader

  return (
    <section className="questao-ten" aria-labelledby="questao-ten-title">
      <header className="q10-header">
        <div>
          <h2 id="questao-ten-title">Ranking de coesão partidária</h2>
          <p>
            Mede a proporção de votos individuais iguais à orientação da
            bancada. Apenas decisões conclusivas — Sim ou Não — entram no
            índice.
          </p>
        </div>
        {robustLeader ? (
          <div className="q10-highlight">
            <span>Destaque com amostra robusta</span>
            <strong>{robustLeader.partido}</strong>
            <small>{formatPercent(robustLeader.pctDisciplina)} de disciplina</small>
          </div>
        ) : null}
      </header>

      <div className="q10-kpis">
        <Kpi
          label="Legendas avaliadas"
          value={integerFormatter.format(data.totalPartidos)}
          detail="com orientação conclusiva"
        />
        <Kpi
          label="Comparações"
          value={integerFormatter.format(data.totalComparacoes)}
          detail="voto individual × liderança"
        />
        <Kpi
          label="Disciplina ponderada"
          value={formatPercent(data.mediaPonderadaPct)}
          detail="considerando o volume de votos"
        />
        <Kpi
          label="Maior amostra"
          value={
            data.ranking.length > 0
              ? integerFormatter.format(
                  Math.max(
                    ...data.ranking.map(
                      (partido) => partido.totalVotosAnalisados,
                    ),
                  ),
                )
              : '0'
          }
          detail="comparações em uma legenda"
        />
      </div>

      <div className="q10-controls">
        <label>
          <span>Partido</span>
          <input
            type="search"
            value={busca}
            placeholder="Buscar sigla"
            onChange={(event) => setBusca(event.target.value)}
          />
        </label>
        <label>
          <span>Amostra mínima</span>
          <select
            value={minimoObservacoes}
            onChange={(event) => {
              setMinimoObservacoes(Number(event.target.value))
              setSelectedParty(null)
            }}
          >
            <option value={0}>Todas as legendas</option>
            <option value={100}>100 comparações</option>
            <option value={1000}>1.000 comparações</option>
            <option value={5000}>5.000 comparações</option>
          </select>
        </label>
        <label>
          <span>Ordenar por</span>
          <select
            value={ordenacao}
            onChange={(event) => setOrdenacao(event.target.value as Ordenacao)}
          >
            <option value="disciplina">Maior disciplina</option>
            <option value="amostra">Maior amostra</option>
          </select>
        </label>
      </div>

      <div className="q10-dashboard">
        <div className="q10-ranking-card">
          <div className="q10-ranking-heading">
            <div>
              <strong>{rankingFiltrado.length} legendas</strong>
              <span>clique em uma linha para detalhar</span>
            </div>
            <div className="q10-legend" aria-label="Faixas de coesão">
              <span className="muito-alta">≥ 95%</span>
              <span className="alta">90–94,9%</span>
              <span className="moderada">80–89,9%</span>
              <span className="baixa">&lt; 80%</span>
            </div>
          </div>

          {rankingFiltrado.length === 0 ? (
            <div className="status-box">
              Nenhuma legenda corresponde aos filtros.
            </div>
          ) : (
            <div className="q10-ranking-list">
              {rankingFiltrado.map((partido, index) => (
                <RankingRow
                  active={activeParty?.partido === partido.partido}
                  displayPosition={index + 1}
                  key={partido.partido}
                  partido={partido}
                  onSelect={() => setSelectedParty(partido.partido)}
                />
              ))}
            </div>
          )}
        </div>

        <PartyDetail
          leader={leader}
          partido={activeParty}
          limiteAmostraPequena={data.metodologia.limiteAmostraPequena}
        />
      </div>

      <details className="q10-methodology">
        <summary>Critérios do índice de coesão</summary>
        <p>
          {data.metodologia.pareamento} São considerados somente votos e
          orientações “Sim” ou “Não”. Abstenção, obstrução, liberação e campos
          vazios são excluídos.
        </p>
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
    <article className="q10-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function RankingRow({
  partido,
  displayPosition,
  active,
  onSelect,
}: {
  partido: PartidoCoesao
  displayPosition: number
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`q10-ranking-row${active ? ' active' : ''}`}
      onClick={onSelect}
    >
      <span className="q10-position">{displayPosition}</span>
      <span className="q10-party">
        <strong>{partido.partido}</strong>
        <small>
          {integerFormatter.format(partido.totalVotosAnalisados)} comparações
        </small>
      </span>
      <span className="q10-bar-track">
        <span
          className={`q10-bar-fill ${classSlug(partido.classificacao)}`}
          style={{ width: `${partido.pctDisciplina}%` }}
        />
      </span>
      <span className="q10-row-value">
        <strong>{formatPercent(partido.pctDisciplina)}</strong>
        {partido.amostraPequena ? <small>Amostra pequena</small> : null}
      </span>
    </button>
  )
}

function PartyDetail({
  partido,
  leader,
  limiteAmostraPequena,
}: {
  partido: PartidoCoesao | null
  leader: PartidoCoesao | null
  limiteAmostraPequena: number
}) {
  if (!partido) {
    return (
      <aside className="q10-detail empty">
        Selecione uma legenda para ver os detalhes.
      </aside>
    )
  }

  const diferencaLider = leader
    ? Math.max(0, leader.pctDisciplina - partido.pctDisciplina)
    : 0

  return (
    <aside className="q10-detail">
      <div className="q10-detail-heading">
        <div>
          <span>Posição original #{partido.posicao}</span>
          <h3>{partido.partido}</h3>
        </div>
        <span className={`q10-status ${classSlug(partido.classificacao)}`}>
          {partido.classificacao}
        </span>
      </div>

      <div className="q10-score">
        <span>Índice de disciplina</span>
        <strong>{formatPercent(partido.pctDisciplina)}</strong>
        <div className="q10-score-track">
          <span
            className={classSlug(partido.classificacao)}
            style={{ width: `${partido.pctDisciplina}%` }}
          />
        </div>
      </div>

      {partido.totalVotosAnalisados < limiteAmostraPequena ? (
        <div className="q10-sample-warning">
          Resultado baseado em menos de {limiteAmostraPequena} comparações;
          interprete com cautela.
        </div>
      ) : null}

      <dl>
        <div>
          <dt>Votos alinhados</dt>
          <dd>{integerFormatter.format(partido.votosAlinhados)}</dd>
        </div>
        <div>
          <dt>Votos divergentes</dt>
          <dd>{integerFormatter.format(partido.votosDivergentes)}</dd>
        </div>
        <div>
          <dt>Deputados avaliados</dt>
          <dd>{integerFormatter.format(partido.totalDeputados)}</dd>
        </div>
        <div>
          <dt>Votações distintas</dt>
          <dd>{integerFormatter.format(partido.totalVotacoes)}</dd>
        </div>
        <div>
          <dt>Total analisado</dt>
          <dd>{integerFormatter.format(partido.totalVotosAnalisados)}</dd>
        </div>
        <div>
          <dt>Distância do líder</dt>
          <dd>{decimalFormatter.format(diferencaLider)} p.p.</dd>
        </div>
      </dl>
    </aside>
  )
}

function formatPercent(value: number): string {
  return `${decimalFormatter.format(value)}%`
}

function classSlug(value: CoesaoClassificacao): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(' ', '-')
}
