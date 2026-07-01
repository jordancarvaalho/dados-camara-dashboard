import { useEffect, useMemo, useState } from 'react'
import { DeputadosGastosList } from '../components/DeputadosGastosList'
import type {
  DeputadoGastos,
  DeputadosFilterOptions,
  DeputadosGastosFilters,
  DeputadosGastosResponse,
} from '../types'
import {
  getStaticDeputadosFilterOptions,
  getStaticDeputadosGastos,
} from '../../data/staticData'
import './Questao1Page.css'

type RequestState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: DeputadosGastosResponse; error: null }
  | { status: 'error'; data: null; error: string }

const initialState: RequestState = {
  status: 'loading',
  data: null,
  error: null,
}

const initialFilters: DeputadosGastosFilters = {
  nome: '',
  partido: '',
  uf: '',
  metrica: 'total_gastos',
  ordem: 'maior',
}

const initialFilterOptions: DeputadosFilterOptions = {
  partidos: [],
  ufs: [],
}

type Questao1PageProps = {
  selectedDeputadoId: number | null
  onDeputadoSelect: (deputado: DeputadoGastos) => void
}

export function Questao1Page({
  selectedDeputadoId,
  onDeputadoSelect,
}: Questao1PageProps) {
  const [filters, setFilters] = useState<DeputadosGastosFilters>(initialFilters)
  const [filterOptions, setFilterOptions] =
    useState<DeputadosFilterOptions>(initialFilterOptions)
  const [page, setPage] = useState(1)
  const [requestState, setRequestState] = useState<RequestState>(initialState)

  useEffect(() => {
    const controller = new AbortController()

    async function loadFilterOptions() {
      try {
        const data = await getStaticDeputadosFilterOptions()

        if (controller.signal.aborted) {
          return
        }

        setFilterOptions(data)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error)
        }
      }
    }

    loadFilterOptions()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadDeputados() {
      setRequestState({ status: 'loading', data: null, error: null })

      try {
        const data = await getStaticDeputadosGastos({
          ordem: filters.ordem,
          metrica: filters.metrica,
          page,
          partido: filters.partido || null,
          uf: filters.uf || null,
          nome: filters.nome.trim() || null,
        })

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
              : 'Falha ao carregar deputados.',
        })
      }
    }

    loadDeputados()

    return () => controller.abort()
  }, [filters, page])

  const pageLabel = useMemo(() => {
    if (requestState.status !== 'success') {
      return `Página ${page}`
    }

    return `Página ${requestState.data.page} de ${requestState.data.totalPages}`
  }, [page, requestState])

  function handleFilterChange<Key extends keyof DeputadosGastosFilters>(
    key: Key,
    value: DeputadosGastosFilters[Key],
  ) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }))
    setPage(1)
  }

  const canGoBack = page > 1
  const canGoNext =
    requestState.status === 'success' && page < requestState.data.totalPages

  return (
    <div className="questao-one">
      <div className="questao-one-header">
        <div>
          <h2>Deputados por gasto parlamentar</h2>
          <p>Valores somados a partir de despesas líquidas da legislatura 57.</p>
        </div>
      </div>

      <form className="filters-panel" aria-label="Refinar ranking de deputados">
        <div className="filters-panel-title">
          <strong>Filtrar</strong>
          <span>
            {requestState.status === 'success'
              ? `${requestState.data.totalItems} deputados encontrados`
              : 'Selecione os critérios'}
          </span>
        </div>

        <label className="search-filter">
          <span>Buscar nome</span>
          <div className="search-input">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M10.8 5.2a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2Zm-7.4 5.6a7.4 7.4 0 1 1 13.1 4.7l4.3 4.3-1.3 1.3-4.3-4.3A7.4 7.4 0 0 1 3.4 10.8Z" />
            </svg>
            <input
              type="search"
              value={filters.nome}
              placeholder="Nome do deputado"
              onChange={(event) =>
                handleFilterChange('nome', event.target.value)
              }
            />
          </div>
        </label>

        <label>
          <span>Partido</span>
          <select
            value={filters.partido}
            onChange={(event) =>
              handleFilterChange('partido', event.target.value)
            }
          >
            <option value="">Todos</option>
            {filterOptions.partidos.map((partido) => (
              <option value={partido} key={partido}>
                {partido}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Estado (UF)</span>
          <select
            value={filters.uf}
            onChange={(event) => handleFilterChange('uf', event.target.value)}
          >
            <option value="">Todos</option>
            {filterOptions.ufs.map((uf) => (
              <option value={uf} key={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Métrica</span>
          <select
            value={filters.metrica}
            onChange={(event) =>
              handleFilterChange(
                'metrica',
                event.target.value as DeputadosGastosFilters['metrica'],
              )
            }
          >
            <option value="total_gastos">Total de Gastos</option>
            <option value="quantidade_despesas">Quantidade de Despesas</option>
          </select>
        </label>

        <label>
          <span>Ordem</span>
          <select
            value={filters.ordem}
            onChange={(event) =>
              handleFilterChange(
                'ordem',
                event.target.value as DeputadosGastosFilters['ordem'],
              )
            }
          >
            <option value="maior">Maiores valores</option>
            <option value="menor">Menores valores</option>
          </select>
        </label>
      </form>

      {requestState.status === 'loading' ? (
        <div className="status-box">Carregando deputados...</div>
      ) : null}

      {requestState.status === 'error' ? (
        <div className="status-box error">{requestState.error}</div>
      ) : null}

      {requestState.status === 'success' && requestState.data.data.length === 0 ? (
        <div className="status-box">Nenhum deputado encontrado.</div>
      ) : null}

      {requestState.status === 'success' && requestState.data.data.length > 0 ? (
        <>
          <DeputadosGastosList
            deputados={requestState.data.data}
            metrica={filters.metrica}
            page={requestState.data.page}
            pageSize={requestState.data.pageSize}
            selectedDeputadoId={selectedDeputadoId}
            onDeputadoSelect={onDeputadoSelect}
          />

          <div className="pagination">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>
            <span>{pageLabel}</span>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
