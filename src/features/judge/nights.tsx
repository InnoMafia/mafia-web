import type { SendAction } from './game'
import { playerLabel, type Game, type Night } from './game-state'

const fields = [
  ['shot', 'Отстрел'],
  ['don', 'Дон'],
  ['sheriff', 'Шериф'],
] as const

function result(game: Game, field: keyof Night, id: number | null) {
  const player = game.players.find((p) => p.seat === id)
  if (!player || field === 'shot') return ''
  if (field === 'don') return player.role === 'sheriff' ? 'Шериф' : 'Не шериф'
  return player.role === 'mafia' || player.role === 'don' ? 'Чёрный' : 'Красный'
}

export function Nights({ game, send }: { game: Game; send: SendAction }) {
  return (
    <div className="judge-section judge-side-content">
      {game.nights.map((night, index) => (
        <details
          key={index}
          className="judge-inset"
          open={index >= game.nights.length - 2}
        >
          <summary>Ночь {index + 1}</summary>
          <div className="judge-section">
            {fields.map(([field, label]) => {
              const check = game.hideRoles
                ? ''
                : result(game, field, night[field])
              return (
                <label className="judge-night-field" key={field}>
                  <span>
                    {label}
                    {check && <strong>{check}</strong>}
                  </span>
                  <select
                    className="judge-field"
                    aria-label={label + ', ночь ' + (index + 1)}
                    value={night[field] ?? ''}
                    onChange={(event) =>
                      send({
                        type: 'night',
                        index,
                        field,
                        id: Number(event.currentTarget.value) || null,
                      })
                    }
                  >
                    <option value="">—</option>
                    {game.players.map((p) => (
                      <option
                        key={p.seat}
                        value={p.seat}
                        disabled={!p.name && night[field] !== p.seat}
                      >
                        {playerLabel(game, p.seat)}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        </details>
      ))}
    </div>
  )
}
