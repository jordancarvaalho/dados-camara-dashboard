import type { DeputadoGastos, MetricaRanking } from '../types'

type DeputadosGastosListProps = {
  deputados: DeputadoGastos[]
  metrica: MetricaRanking
  page: number
  pageSize: number
  selectedDeputadoId: number | null
  onDeputadoSelect: (deputado: DeputadoGastos) => void
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function DeputadosGastosList({
  deputados,
  metrica,
  page,
  pageSize,
  selectedDeputadoId,
  onDeputadoSelect,
}: DeputadosGastosListProps) {
  return (
    <ol className="deputados-list">
      {deputados.map((deputado, index) => (
        <li className="deputado-item" key={deputado.id}>
          <button
            type="button"
            className={`deputado-item-button${
              selectedDeputadoId === deputado.id ? ' selected' : ''
            }`}
            onClick={() => onDeputadoSelect(deputado)}
          >
            <span className="deputado-rank">
              {(page - 1) * pageSize + index + 1}
            </span>
            <img
              className="deputado-photo"
              src={deputado.foto}
              alt={`Foto de ${deputado.nome}`}
              loading="lazy"
            />
            <div className="deputado-main">
              <h3>{deputado.nome}</h3>
              <p>
                {[deputado.partido, deputado.uf].filter(Boolean).join(' - ') ||
                  'Sem partido/UF'}
              </p>
            </div>
            <div className="deputado-values">
              <strong>
                {metrica === 'quantidade_despesas'
                  ? `${deputado.quantidadeDespesas} despesas`
                  : currencyFormatter.format(deputado.totalGastos)}
              </strong>
              <span>
                {metrica === 'quantidade_despesas'
                  ? currencyFormatter.format(deputado.totalGastos)
                  : `${deputado.quantidadeDespesas} despesas`}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ol>
  )
}
