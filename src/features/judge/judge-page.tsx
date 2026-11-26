import { Spade } from 'lucide-react'
import { useCallback, useEffect, useReducer, useState } from 'react'
import { DeathReports } from './death-reports'
import { updateGame, type SendAction } from './game'
import { GameActions, NewGame } from './game-actions'
import { gameStorageKey, loadGame, outcomeLabels } from './game-state'
import { Nights } from './nights'
import { PlayerTable } from './player-table'
import { Voting } from './protocol'
import { Seating } from './seating'
import { SpeechTimer } from './speech-timer'
import './judge.css'

export default function JudgePage() {
  const [game, dispatch] = useReducer(updateGame, undefined, loadGame)
  const [session, setSession] = useState(0)
  const [wide, setWide] = useState(
    () => window.matchMedia('(min-width: 1180px)').matches,
  )
  const [expiredDeadline, setExpiredDeadline] = useState<number | null>(null)
  const deadline = game.timer.deadline
  const isExpired = deadline !== null && expiredDeadline === deadline

  const send = useCallback<SendAction>((action) => {
    dispatch({ ...action, at: Date.now() })
    if (action.type === 'newGame') setSession((current) => current + 1)
  }, [])

  useEffect(() => {
    document.title = 'Судейский пульт · InnoMafia'
    const media = window.matchMedia('(min-width: 1180px)')
    const resize = () => setWide(media.matches)
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])

  useEffect(() => {
    if (deadline === null || isExpired) return
    const timeout = window.setTimeout(
      () => setExpiredDeadline(deadline),
      Math.max(0, deadline - Date.now()),
    )
    return () => window.clearTimeout(timeout)
  }, [deadline, isExpired])

  useEffect(() => {
    try {
      localStorage.setItem(gameStorageKey, JSON.stringify(game))
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [game])

  return (
    <div className="judge">
      <header className="judge-header">
        <div className="judge-shell judge-header-inner">
          <a
            href="/"
            className="judge-brand"
            aria-label="InnoMafia — на главную"
          >
            <span>
              <Spade aria-hidden="true" />
            </span>
            InnoMafia
          </a>
          <h1>Судейский пульт</h1>
          {game.outcome && (
            <span className="judge-result">{outcomeLabels[game.outcome]}</span>
          )}
          <NewGame send={send} />
        </div>
      </header>
      <main className="judge-shell judge-layout" key={session}>
        <SpeechTimer game={game} send={send} />
        <details className="judge-panel judge-side judge-nights" open={wide}>
          <summary>Ночные действия</summary>
          <Nights game={game} send={send} />
        </details>
        <details className="judge-panel judge-side judge-reports" open={wide}>
          <summary>Протоколы убитых</summary>
          <DeathReports game={game} send={send} />
        </details>
        <div className="judge-main">
          <Seating game={game} send={send} />
          <PlayerTable
            game={game}
            timerActive={game.timer.remainingMs > 0 && !isExpired}
            send={send}
          />
          <Voting game={game} send={send} />
          <section className="judge-panel judge-notes">
            <label htmlFor="judge-notes">Заметки судьи</label>
            <textarea
              id="judge-notes"
              className="judge-field"
              placeholder="Заметки к игре"
              rows={4}
              maxLength={2000}
              value={game.notes}
              onChange={(event) =>
                send({ type: 'notes', notes: event.currentTarget.value })
              }
            />
          </section>
          <GameActions game={game} send={send} />
        </div>
      </main>
    </div>
  )
}
