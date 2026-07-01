import { useEffect, useState } from 'react'
import { getStaticRankingFornecedores } from '../../data/staticData'
import type { FornecedorRanking, Questao5Response } from '../types'
import './Questao5Page.css'

type RequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: Questao5Response; error: null }
  | { status: 'error'; data: null; error: string }

const initialState: RequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
})

export function Questao5Page() {
  const [requestState, setRequestState] = useState<RequestState>(initialState)
  const [categoria, setCategoria] = useState('')
  const [ano, setAno] = useState('')
  const [selectedFornecedor, setSelectedFornecedor] =
    useState<FornecedorRanking | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()

    if (categoria) {
      params.set('categoria', categoria)
    }

    if (ano) {
      params.set('ano', ano)
    }

    async function loadFornecedoresRanking() {
      setRequestState({ status: 'loading', data: null, error: null })

      try {
        const data = await getStaticRankingFornecedores({
          categoria: params.get('categoria'),
          ano: params.has('ano') ? Number(params.get('ano')) : null,
        })

        if (controller.signal.aborted) {
          return
        }

        setRequestState({ status: 'success', data, error: null })
        setSelectedFornecedor(data.fornecedores[0] ?? null)
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
              : 'Falha ao carregar ranking de fornecedores.',
        })
      }
    }

    loadFornecedoresRanking()

    return () => controller.abort()
  }, [ano, categoria])

  const categorias = requestState.data?.categoriasDisponiveis ?? []
  const anos = requestState.data?.anosDisponiveis ?? []
  const fornecedores = requestState.data?.fornecedores ?? []
  const activeFornecedor = selectedFornecedor ?? fornecedores[0] ?? null
  const maxTotal = fornecedores[0]?.totalRecebido ?? 0

  return (
    <section className="questao-five" aria-labelledby="questao-five-title">
      <div className="questao-five-header">
        <div>
          <h2 id="questao-five-title">
            Fornecedores por valor recebido
          </h2>
          <p>Ranking pelo volume total recebido via cota parlamentar.</p>
        </div>
        {requestState.status === 'success' ? (
          <strong>{currencyFormatter.format(requestState.data.totalRecebido)}</strong>
        ) : null}
      </div>

      <div className="q5-filters-panel">
        <label>
          <span>Categoria</span>
          <select
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
          >
            <option value="">Todas</option>
            {categoria && !categorias.includes(categoria) ? (
              <option value={categoria}>{categoria}</option>
            ) : null}
            {categorias.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Ano</span>
          <select value={ano} onChange={(event) => setAno(event.target.value)}>
            <option value="">Todos</option>
            {ano && !anos.includes(Number(ano)) ? (
              <option value={ano}>{ano}</option>
            ) : null}
            {anos.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

      </div>

      {requestState.status === 'loading' ? (
        <div className="status-box">Carregando fornecedores...</div>
      ) : null}

      {requestState.status === 'error' ? (
        <div className="status-box error">{requestState.error}</div>
      ) : null}

      {requestState.status === 'success' ? (
        <>
          {fornecedores.length === 0 ? (
            <div className="status-box">Nenhum fornecedor encontrado.</div>
          ) : (
            <div className="q5-chart-shell">
              <div
                className="q5-horizontal-chart"
                aria-label="Soma do gasto total por fornecedor"
              >
                {fornecedores.map((fornecedor, index) => (
                  <div
                    className="q5-bar-row"
                    key={`${fornecedor.fornecedor}-${fornecedor.cnpjCpf ?? index}`}
                  >
                    <span className="q5-bar-label">
                      {shortenSupplierLabel(fornecedor.fornecedor)}
                    </span>
                    <button
                      type="button"
                      className={`q5-bar${
                        activeFornecedor?.fornecedor === fornecedor.fornecedor &&
                        activeFornecedor?.cnpjCpf === fornecedor.cnpjCpf
                          ? ' active'
                          : ''
                      }`}
                      style={{
                        width: `${getBarWidth(fornecedor.totalRecebido, maxTotal)}%`,
                      }}
                      title={`${fornecedor.fornecedor}: ${currencyFormatter.format(
                        fornecedor.totalRecebido,
                      )}`}
                      onClick={() => setSelectedFornecedor(fornecedor)}
                    >
                      <span>{formatCompactCurrency(fornecedor.totalRecebido)}</span>
                    </button>
                  </div>
                ))}

                <div className="q5-axis" aria-hidden="true">
                  <span>0</span>
                  <span>{formatCompactCurrency(maxTotal / 2)}</span>
                  <span>{formatCompactCurrency(maxTotal)}</span>
                </div>
              </div>

              {activeFornecedor ? (
                <div className="q5-detail-panel">
                  <div>
                    <span>{activeFornecedor.fornecedor}</span>
                    <p>{activeFornecedor.cnpjCpf ?? 'CNPJ/CPF não informado'}</p>
                  </div>
                  <strong>
                    {currencyFormatter.format(activeFornecedor.totalRecebido)}
                  </strong>
                  <dl>
                    <div>
                      <dt>Despesas</dt>
                      <dd>{activeFornecedor.quantidadeDespesas}</dd>
                    </div>
                    <div>
                      <dt>Participação</dt>
                      <dd>{formatPercent(activeFornecedor.percentual)}</dd>
                    </div>
                    <div>
                      <dt>Fornecedores ranqueados</dt>
                      <dd>{requestState.data.totalFornecedores}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

function getBarWidth(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0
  }

  return Math.max(2, (value / maxValue) * 100)
}

function shortenSupplierLabel(value: string): string {
  return value.length > 42 ? `${value.slice(0, 39)}...` : value
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

function formatPercent(value: number): string {
  return `${numberFormatter.format(value)}%`
}
