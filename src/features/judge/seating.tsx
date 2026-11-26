import {
  Mic,
  Minus,
  Plus,
  RotateCcw,
  UserMinus,
  Users,
  Vote,
} from 'lucide-react'
import { roleLabels, type Game, type Role, type SendAction } from './game'

type SeatingProps = {
  game: Game
  send: SendAction
}

export function Seating({ game, send }: SeatingProps) {
  const locked = game.outcome !== null
  const activeCount = game.players.filter((player) => !player.out).length

  return (
    <section
      className="judge-panel judge-seating"
      aria-labelledby="seating-title"
    >
      <div className="judge-panel-header">
        <h2 id="seating-title">
          <Users aria-hidden="true" /> Рассадка
        </h2>
        <span className="judge-count">{activeCount} в игре</span>
      </div>
      <div
        className="judge-table-scroll"
        role="region"
        aria-label="Таблица мест"
        tabIndex={0}
      >
        <table className="judge-table">
          <thead>
            <tr>
              <th scope="col">Место</th>
              <th scope="col">Игрок</th>
              <th scope="col">Роль</th>
              <th scope="col">Фолы</th>
              <th scope="col">Действия</th>
            </tr>
          </thead>
          <tbody>
            {game.players.map((player) => {
              const { seat, name, role, fouls, out, nominated } = player
              const speaking = game.speaker === seat
              const nominateLabel = nominated
                ? 'Снять кандидатуру места '
                : 'Выставить место '
              const eliminateLabel = out
                ? 'Вернуть в игру место '
                : 'Отметить выбывшим место '

              return (
                <tr key={seat} data-speaking={speaking} data-out={out}>
                  <th scope="row">
                    <span className="judge-seat">{seat}</span>
                  </th>
                  <td>
                    <div className="judge-player-name">
                      <input
                        aria-label={'Ник места ' + seat}
                        placeholder="Ник игрока"
                        value={name}
                        onChange={(event) =>
                          send({
                            type: 'rename',
                            seat,
                            name: event.currentTarget.value,
                          })
                        }
                        maxLength={40}
                        autoComplete="off"
                        disabled={locked}
                      />
                      {out && <span className="judge-out-label">Выбыл</span>}
                    </div>
                  </td>
                  <td>
                    <select
                      aria-label={'Роль места ' + seat}
                      data-role={role}
                      value={role}
                      onChange={(event) =>
                        send({
                          type: 'role',
                          seat,
                          role: event.currentTarget.value as Role,
                        })
                      }
                      disabled={locked}
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="judge-stepper" data-warn={fouls > 0}>
                      <button
                        className="judge-icon-button"
                        type="button"
                        aria-label={'Снять фол места ' + seat}
                        title="Снять фол"
                        disabled={locked || out || fouls === 0}
                        onClick={() => send({ type: 'foul', seat, delta: -1 })}
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <span>{fouls}</span>
                      <button
                        className="judge-icon-button"
                        type="button"
                        aria-label={'Добавить фол места ' + seat}
                        title="Добавить фол"
                        disabled={locked || out}
                        onClick={() => send({ type: 'foul', seat, delta: 1 })}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="judge-row-actions">
                      <button
                        className="judge-icon-button"
                        type="button"
                        aria-label={'Дать слово месту ' + seat}
                        aria-pressed={speaking}
                        title="Дать слово"
                        disabled={locked || out}
                        onClick={() => send({ type: 'speaker', seat })}
                      >
                        <Mic aria-hidden="true" />
                      </button>
                      <button
                        className="judge-icon-button"
                        type="button"
                        aria-label={nominateLabel + seat}
                        aria-pressed={nominated}
                        title={
                          nominated
                            ? 'Снять кандидатуру'
                            : 'Выставить на голосование'
                        }
                        disabled={locked || out}
                        onClick={() => send({ type: 'nominate', seat })}
                      >
                        <Vote aria-hidden="true" />
                      </button>
                      <button
                        className="judge-icon-button judge-eliminate"
                        type="button"
                        aria-label={eliminateLabel + seat}
                        title={out ? 'Вернуть в игру' : 'Отметить выбывшим'}
                        disabled={locked}
                        onClick={() => send({ type: 'eliminate', seat })}
                      >
                        {out ? (
                          <RotateCcw aria-hidden="true" />
                        ) : (
                          <UserMinus aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
