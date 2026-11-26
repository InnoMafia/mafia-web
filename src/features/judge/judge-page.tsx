import { ClipboardList, Moon, Spade, Sun, Vote } from 'lucide-react'
import { useEffect, useReducer } from 'react'
import {
  gameStorageKey,
  loadGame,
  outcomeLabels,
  phaseLabels,
  phaseName,
  phases,
  updateGame,
  type SendAction,
} from './game'
import { GameActions } from './game-actions'
import { Protocol, Voting } from './protocol'
import { Seating } from './seating'
import { SpeechTimer } from './speech-timer'
import './judge.css'

const phaseIcons = { setup: ClipboardList, day: Sun, voting: Vote, night: Moon }

export default function JudgePage() {
  const [game, dispatch] = useReducer(updateGame, undefined, loadGame)
  const locked = game.outcome !== null
  const send: SendAction = (action) => dispatch({ ...action, at: Date.now() })

  useEffect(() => {
    document.title = 'Судейский пульт · InnoMafia'
  }, [])

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
          <GameActions outcome={game.outcome} send={send} />
        </div>
      </header>
      <main className="judge-shell judge-main">
        <div className="judge-heading">
          <h1>Судейский пульт</h1>
          {game.outcome && (
            <span className="judge-result">{outcomeLabels[game.outcome]}</span>
          )}
        </div>
        <div className="judge-phases" role="group" aria-label="Фаза игры">
          {phases.map((phase) => {
            const Icon = phaseIcons[phase]
            const selected = game.phase === phase
            return (
              <button
                type="button"
                key={phase}
                aria-pressed={selected}
                disabled={locked}
                onClick={() => send({ type: 'phase', phase })}
              >
                <Icon aria-hidden="true" />
                {selected ? phaseName(phase, game.day) : phaseLabels[phase]}
              </button>
            )
          })}
        </div>
        <div className="judge-workspace">
          <Seating game={game} send={send} />
          <div className="judge-sidebar">
            <SpeechTimer game={game} send={send} />
            <Voting game={game} send={send} />
            <Protocol events={game.events} />
          </div>
        </div>
      </main>
    </div>
  )
}
