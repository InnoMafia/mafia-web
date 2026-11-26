import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { SendAction } from './game'
import {
  placeOf,
  playerLabel,
  reportFor,
  shotNight,
  type Game,
  type Report,
} from './game-state'
import { PlayerPicker } from './player-picker'

const fields = [
  ['red', 'Красные'],
  ['black', 'Чёрные'],
  ['sheriff', 'Шериф'],
] as const

export function DeathReports({ game, send }: { game: Game; send: SendAction }) {
  const [owner, setOwner] = useState('')
  const [edit, setEdit] = useState<{
    id: number
    field: 'red' | 'black' | 'sheriff'
  } | null>(null)
  const reports = game.players
    .map((p) => reportFor(game, p.seat))
    .filter((report): report is Report => report !== undefined)
  const owners = game.players.filter(
    (p) => !reports.some((report) => report.player === p.seat),
  )

  return (
    <div className="judge-section judge-side-content">
      <form
        className="judge-report-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!owner) return
          send({ type: 'addReport', id: Number(owner) })
          setEdit({ id: Number(owner), field: 'red' })
          setOwner('')
        }}
      >
        <select
          className="judge-field"
          aria-label="Игрок для ручного протокола"
          value={owner}
          onChange={(event) => setOwner(event.currentTarget.value)}
        >
          <option value="">Номер игрока</option>
          {owners.map((p) => (
            <option key={p.seat} value={p.seat}>
              {playerLabel(game, p.seat)}
            </option>
          ))}
        </select>
        <Button
          className="judge-compact judge-secondary"
          type="submit"
          disabled={!owners.some((p) => p.seat === Number(owner))}
        >
          Добавить протокол
        </Button>
      </form>
      {reports.length === 0 ? (
        <p className="judge-muted">Протоколов пока нет.</p>
      ) : (
        <table className="judge-reports-table">
          <thead>
            <tr>
              <th scope="col">№</th>
              {fields.map(([field, label]) => (
                <th key={field} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const id = report.player
              const night = shotNight(game, id)
              const title = playerLabel(game, id)
              const activeField = edit?.id === id ? edit.field : null
              return (
                <Fragment key={id}>
                  <tr>
                    <th scope="row" title={title}>
                      №{placeOf(game, id)}
                      <small>
                        {night >= 0
                          ? 'Ночь ' + (night + 1)
                          : report.manual
                            ? 'Вручную'
                            : 'Отстрел изменён'}
                      </small>
                      <Button
                        className="judge-icon-button"
                        aria-label={'Удалить протокол ' + title}
                        onClick={() => {
                          if (
                            window.confirm('Удалить протокол ' + title + '?')
                          ) {
                            send({ type: 'deleteReport', id })
                            if (edit?.id === id) setEdit(null)
                          }
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </th>
                    {fields.map(([field, label]) => {
                      const ids =
                        field === 'sheriff'
                          ? report.sheriff === null
                            ? []
                            : [report.sheriff]
                          : report[field]
                      return (
                        <td key={field}>
                          <Button
                            className="judge-compact judge-secondary"
                            aria-label={label + ', протокол ' + title}
                            aria-expanded={activeField === field}
                            onClick={() =>
                              setEdit(
                                activeField === field ? null : { id, field },
                              )
                            }
                          >
                            {ids
                              .map((pick) => placeOf(game, pick))
                              .join(', ') || '—'}
                          </Button>
                        </td>
                      )
                    })}
                  </tr>
                  {activeField && (
                    <tr>
                      <td colSpan={4}>
                        <PlayerPicker
                          key={activeField}
                          game={game}
                          label={
                            fields.find(
                              ([field]) => field === activeField,
                            )?.[1] ?? ''
                          }
                          chosen={
                            activeField === 'sheriff'
                              ? report.sheriff === null
                                ? []
                                : [report.sheriff]
                              : report[activeField]
                          }
                          limit={activeField === 'sheriff' ? 1 : 10}
                          onChange={(picks) =>
                            send({
                              type: 'reportPicks',
                              id,
                              field: activeField,
                              picks,
                            })
                          }
                          onClose={() => setEdit(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
