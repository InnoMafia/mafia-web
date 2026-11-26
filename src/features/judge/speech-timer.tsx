import { Button } from '@/components/ui/button'
import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SendAction } from './game'
import { playerLabel, remainingTime, type Game } from './game-state'

export function SpeechTimer({ game, send }: { game: Game; send: SendAction }) {
  const { timer } = game
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const deadline = timer.deadline
    if (deadline === null) return
    const tick = () => {
      const at = Date.now()
      setNow(at)
      if (at >= deadline) window.clearInterval(interval)
    }
    const interval = window.setInterval(tick, 100)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', tick)
    }
  }, [timer.deadline])

  const left = remainingTime(timer, now)
  const seconds = Math.ceil(left / 1000)
  const running = timer.deadline !== null && left > 0
  const time =
    String(Math.floor(seconds / 60)).padStart(2, '0') +
    ':' +
    String(seconds % 60).padStart(2, '0')
  const speaker =
    left > 0 && timer.speaker !== null
      ? 'Говорит ' + playerLabel(game, timer.speaker)
      : null
  const status =
    speaker ??
    (timer.mode === 'countdown'
      ? 'Общий отсчёт'
      : left === 0
        ? 'Время вышло'
        : 'Таймер речи')

  return (
    <section className="judge-panel judge-timer" aria-label="Таймер">
      <div className="judge-clock">
        <span
          className="judge-time"
          role="timer"
          data-expired={left === 0}
          aria-label={'Осталось ' + time}
        >
          {time}
        </span>
        <span className="judge-muted">{status}</span>
      </div>
      <div
        className="judge-controls"
        role="group"
        aria-label="Управление таймером"
      >
        <Button
          className="judge-icon-button judge-primary"
          title={running ? 'Пауза' : 'Запустить'}
          aria-label={running ? 'Приостановить таймер' : 'Запустить таймер'}
          disabled={left === 0}
          onClick={() => send({ type: running ? 'pause' : 'start' })}
        >
          {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <Button
          className="judge-icon-button"
          title="Остановить"
          aria-label="Остановить таймер"
          disabled={left === 0}
          onClick={() => send({ type: 'stop' })}
        >
          <Square aria-hidden="true" />
        </Button>
        <Button
          className="judge-icon-button"
          title="Перезапустить"
          aria-label="Перезапустить таймер"
          onClick={() => send({ type: 'restart' })}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
      <div className="judge-controls" role="group" aria-label="Общий отсчёт">
        {([10, 20, 60] as const).map((duration) => (
          <Button
            className="judge-compact judge-secondary"
            key={duration}
            aria-label={'Общий отсчёт ' + duration + ' секунд'}
            aria-pressed={
              timer.mode === 'countdown' &&
              timer.duration === duration &&
              left > 0
            }
            onClick={() => send({ type: 'countdown', duration })}
          >
            {duration} с
          </Button>
        ))}
      </div>
      <div className="judge-settings">
        <label>
          <input
            type="checkbox"
            checked={game.hideRoles}
            onChange={(event) =>
              send({
                type: 'setting',
                key: 'hideRoles',
                value: event.currentTarget.checked,
              })
            }
          />
          Скрыть роли
        </label>
        <label>
          <input
            type="checkbox"
            checked={game.namedVoting}
            onChange={(event) =>
              send({
                type: 'setting',
                key: 'namedVoting',
                value: event.currentTarget.checked,
              })
            }
          />
          Поимённые голоса
        </label>
      </div>
    </section>
  )
}
