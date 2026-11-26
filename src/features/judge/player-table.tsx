import { Button } from '@/components/ui/button'
import { Dialog } from '@base-ui/react/dialog'
import { ThumbsUp } from 'lucide-react'
import { Fragment, useState } from 'react'
import { nominationNeedsConfirmation, type SendAction } from './game'
import {
  currentDay,
  placeOf,
  playerLabel,
  roleLabels,
  roles,
  shotNight,
  statusLabels,
  statusOf,
  technicalPoints,
  type Game,
  type Player,
} from './game-state'

import { PlayerPicker } from './player-picker'

type ScoreField = 'bonus' | 'penalty' | 'technical'

const scoreLabels: Record<ScoreField, string> = {
  bonus: 'Допы',
  penalty: 'Минус',
  technical: 'Тех. минус',
}

function decimal(value: number) {
  return value.toFixed(2).replace('.', ',')
}

function ScoreInput({
  player,
  field,
  place,
  send,
}: {
  player: Player
  field: ScoreField
  place: number
  send: SendAction
}) {
  const value = player[field]
  return (
    <input
      key={value}
      className="judge-field judge-score"
      aria-label={scoreLabels[field] + ', игрок ' + place}
      defaultValue={value ? decimal(value) : ''}
      placeholder="0,00"
      inputMode="decimal"
      list="judge-score-values"
      disabled={!player.name}
      onInput={(event) => event.currentTarget.setCustomValidity('')}
      onBlur={(event) => {
        const input = event.currentTarget
        const next = Number(input.value.trim().replace(',', '.'))
        if (!Number.isFinite(next) || next < 0 || next > 1.5) {
          input.setCustomValidity('Введите число от 0 до 1,5')
          input.reportValidity()
          return
        }
        input.value = next ? decimal(next) : ''
        send({ type: 'score', id: player.seat, field, value: next })
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        const fields = Array.from(
          event.currentTarget
            .closest('table')
            ?.querySelectorAll<HTMLInputElement>(
              'input.judge-score:not(:disabled)',
            ) ?? [],
        ).filter((input) =>
          input
            .getAttribute('aria-label')
            ?.startsWith(scoreLabels[field] + ','),
        )
        const next = fields[fields.indexOf(event.currentTarget) + 1]
        if (next) {
          next.focus()
          next.select()
        } else event.currentTarget.blur()
      }}
    />
  )
}

function TechnicalScore({
  player,
  place,
  send,
}: {
  player: Player
  place: number
  send: SendAction
}) {
  return (
    <div className="judge-tech">
      {player.techFouls.length > 0 ? (
        <output aria-label={'Тех. минус, игрок ' + place}>
          −{decimal(technicalPoints(player))}
        </output>
      ) : (
        <ScoreInput
          player={player}
          place={place}
          field="technical"
          send={send}
        />
      )}
      {([0.3, 0.6] as const).map((value) => {
        const count = player.techFouls.filter((entry) => entry === value).length
        const label =
          (value === 0.3 ? 'малый' : 'большой') + ' техфол, игрок ' + place
        return (
          <div key={value} className="judge-stepper">
            <Button
              className="judge-icon-button"
              disabled={!count}
              aria-label={'Снять ' + label}
              onClick={() =>
                send({ type: 'undoTechFoul', id: player.seat, value })
              }
            >
              −
            </Button>
            <span title={label}>
              {value === 0.3 ? 'М' : 'Б'} {count}
            </span>
            <Button
              className="judge-icon-button"
              disabled={!player.name || player.techFouls.length >= 2}
              aria-label={'Начислить ' + label}
              onClick={() => send({ type: 'techFoul', id: player.seat, value })}
            >
              +
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export function PlayerTable({
  game,
  timerActive,
  send,
}: {
  game: Game
  timerActive: boolean
  send: SendAction
}) {
  const [mode, setMode] = useState<'game' | 'points'>('game')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [bestMoveOwner, setBestMoveOwner] = useState<number | null>(null)
  const [nomination, setNomination] = useState<number | null>(null)
  const day = currentDay(game)
  const nominations =
    day.stage === 'lift'
      ? day.tied
      : day[day.stage === 'runoff' ? 'runoff' : 'main'].map(
          (vote) => vote.candidate,
        )

  return (
    <section
      className="judge-panel judge-table-panel"
      aria-labelledby="judge-table-title"
    >
      <div className="judge-panel-header">
        <h2 id="judge-table-title">Игровой стол</h2>
        <span className="judge-muted">
          Открывает {playerLabel(game, day.opener)}
        </span>
        <div
          className="judge-mode judge-controls"
          role="group"
          aria-label="Колонки стола"
        >
          <Button
            className="judge-compact judge-secondary"
            aria-pressed={mode === 'game'}
            onClick={() => setMode('game')}
          >
            Игра
          </Button>
          <Button
            className="judge-compact judge-secondary"
            aria-pressed={mode === 'points'}
            onClick={() => setMode('points')}
          >
            Баллы
          </Button>
        </div>
      </div>
      <datalist id="judge-score-values">
        {Array.from({ length: 15 }, (_, index) => (
          <option key={index} value={decimal((index + 1) / 10)} />
        ))}
      </datalist>
      <div className="judge-table-wrap">
        <table className="judge-table" data-mode={mode}>
          <thead>
            <tr>
              <th className="judge-game-column" scope="col">
                Вын.
              </th>
              <th scope="col">№</th>
              <th scope="col">Игрок</th>
              <th className="judge-game-column" scope="col">
                Фолы
              </th>
              <th className="judge-game-column" scope="col">
                ЛХ
              </th>
              {!game.hideRoles && (
                <th className="judge-game-column" scope="col">
                  Роль
                </th>
              )}
              <th className="judge-score-column" scope="col">
                Допы
              </th>
              <th className="judge-score-column" scope="col">
                Минус
              </th>
              <th className="judge-score-column" scope="col">
                Тех. минус
              </th>
            </tr>
          </thead>
          <tbody>
            {game.players.map((player, index) => {
              const id = player.seat
              const place = index + 1
              const status = statusOf(game, player)
              const speaking = game.timer.speaker === id && timerActive
              const colspan = game.hideRoles ? 8 : 9
              return (
                <Fragment key={id}>
                  <tr data-out={status !== 'alive'} data-speaking={speaking}>
                    <td className="judge-game-column">
                      <Button
                        className="judge-icon-button"
                        aria-label={'Выставить игрока ' + place}
                        aria-pressed={nominations.includes(id)}
                        disabled={
                          !player.name ||
                          (status !== 'alive' && !nominations.includes(id)) ||
                          day.stage !== 'main' ||
                          Boolean(game.review)
                        }
                        onClick={() =>
                          nominationNeedsConfirmation(game, id, Date.now())
                            ? setNomination(id)
                            : send({ type: 'nominate', id })
                        }
                      >
                        <ThumbsUp aria-hidden="true" />
                      </Button>
                    </td>
                    <th
                      scope="row"
                      className="judge-seat-number"
                      data-opener={day.opener === id}
                    >
                      {place}
                    </th>
                    <td className="judge-player-cell">
                      <div className="judge-player">
                        <Button
                          className="judge-player-name"
                          disabled={!player.name}
                          aria-expanded={expanded === id}
                          onClick={() =>
                            setExpanded(expanded === id ? null : id)
                          }
                        >
                          <span>{player.name || 'Свободно'}</span>
                          {status !== 'alive' && (
                            <small>
                              {statusLabels[status]}
                              {status === 'killed'
                                ? ' · ночь ' + (shotNight(game, id) + 1)
                                : ''}
                            </small>
                          )}
                        </Button>
                        <div className="judge-controls judge-speech-options">
                          {([60, 30] as const).map((duration) => (
                            <Button
                              key={duration}
                              className="judge-compact judge-secondary"
                              disabled={!player.name}
                              aria-label={
                                'Речь ' + duration + ' секунд, игрок ' + place
                              }
                              aria-pressed={
                                speaking && game.timer.duration === duration
                              }
                              onClick={() =>
                                send({ type: 'speech', id, duration })
                              }
                            >
                              {duration} с
                            </Button>
                          ))}
                          <Button
                            className="judge-compact judge-secondary"
                            disabled={
                              !speaking || player.fouls >= 2 || game.timer.extra
                            }
                            aria-label={
                              'Дополнительные 30 секунд и два фола, игрок ' +
                              place
                            }
                            onClick={() => send({ type: 'extraSpeech', id })}
                          >
                            +30
                          </Button>
                        </div>
                      </div>
                    </td>
                    <td className="judge-game-column">
                      <div className="judge-stepper">
                        <Button
                          className="judge-icon-button"
                          disabled={!player.fouls}
                          aria-label={'Снять фол, игрок ' + place}
                          onClick={() => send({ type: 'foul', id, delta: -1 })}
                        >
                          −
                        </Button>
                        <span
                          data-warning={player.fouls >= 3}
                          aria-label={'Фолы игрока ' + place}
                        >
                          {player.fouls}
                        </span>
                        <Button
                          className="judge-icon-button"
                          disabled={!player.name || player.fouls >= 4}
                          aria-label={'Фол, игрок ' + place}
                          onClick={() => send({ type: 'foul', id, delta: 1 })}
                        >
                          +
                        </Button>
                      </div>
                    </td>
                    <td className="judge-game-column">
                      <Button
                        className="judge-compact judge-secondary"
                        disabled={
                          !player.name ||
                          (!player.bestMove.length &&
                            game.bestMoveOrder.length === 2)
                        }
                        aria-label={'Лучший ход, игрок ' + place}
                        aria-expanded={bestMoveOwner === id}
                        onClick={() =>
                          setBestMoveOwner(bestMoveOwner === id ? null : id)
                        }
                      >
                        {player.bestMove
                          .map((pick) => placeOf(game, pick))
                          .join(' · ') || 'ЛХ'}
                      </Button>
                    </td>
                    {!game.hideRoles && (
                      <td className="judge-game-column">
                        <select
                          className="judge-field judge-role"
                          data-role={player.role}
                          disabled={!player.name}
                          aria-label={'Роль игрока ' + place}
                          value={player.role}
                          onChange={(event) =>
                            send({
                              type: 'role',
                              id,
                              role: event.currentTarget.value as Player['role'],
                            })
                          }
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role === 'unassigned' ? '—' : roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="judge-score-column">
                      <ScoreInput
                        player={player}
                        place={place}
                        field="bonus"
                        send={send}
                      />
                    </td>
                    <td className="judge-score-column">
                      <ScoreInput
                        player={player}
                        place={place}
                        field="penalty"
                        send={send}
                      />
                    </td>
                    <td className="judge-score-column">
                      <TechnicalScore
                        player={player}
                        place={place}
                        send={send}
                      />
                    </td>
                  </tr>
                  {expanded === id && (
                    <tr className="judge-expanded-row">
                      <td colSpan={colspan}>
                        <div className="judge-controls">
                          <Button
                            className="judge-compact judge-secondary"
                            aria-pressed={status === 'killed'}
                            onClick={() => send({ type: 'shot', id })}
                          >
                            Убит
                          </Button>
                          <Button
                            className="judge-compact judge-secondary"
                            aria-pressed={status === 'voted'}
                            onClick={() =>
                              send({
                                type: 'status',
                                id,
                                status: status === 'voted' ? 'alive' : 'voted',
                              })
                            }
                          >
                            Заголосован
                          </Button>
                          <Button
                            className="judge-compact judge-secondary"
                            aria-pressed={status === 'removed'}
                            disabled={player.techFouls.length === 2}
                            onClick={() =>
                              send({
                                type: 'status',
                                id,
                                status:
                                  status === 'removed' ? 'alive' : 'removed',
                              })
                            }
                          >
                            Удалён
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {bestMoveOwner === id && (
                    <tr className="judge-expanded-row">
                      <td colSpan={colspan}>
                        <PlayerPicker
                          game={game}
                          chosen={player.bestMove}
                          limit={3}
                          label="Лучший ход"
                          onChange={(picks) =>
                            send({ type: 'bestMove', id, picks })
                          }
                          onClose={() => setBestMoveOwner(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <Dialog.Root
        open={nomination !== null}
        onOpenChange={(open) => {
          if (!open) setNomination(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="judge-backdrop" />
          <Dialog.Popup className="judge-dialog">
            <Dialog.Title>Выставить ещё одного игрока?</Dialog.Title>
            <Dialog.Description>
              Во время этой речи уже выставили кандидата.
            </Dialog.Description>
            <div className="judge-controls">
              <Dialog.Close className="judge-compact judge-secondary">
                Отмена
              </Dialog.Close>
              <Button
                className="judge-compact judge-primary"
                onClick={() => {
                  if (nomination !== null)
                    send({ type: 'nominate', id: nomination, confirmed: true })
                  setNomination(null)
                }}
              >
                Выставить
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
