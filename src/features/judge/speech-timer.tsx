import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { durations, remainingTime, type Game, type SendAction } from './game'

type SpeechTimerProps = {
  game: Game
  send: SendAction
}

export function SpeechTimer({ game, send }: SpeechTimerProps) {
  const [now, setNow] = useState(Date.now)
  const { timer } = game
  const locked = game.outcome !== null
  const activeSpeaker = game.players.find(
    (player) => player.seat === game.speaker,
  )
  const remainingMs = remainingTime(timer, now)
  const seconds = Math.ceil(remainingMs / 1000)
  const running = timer.deadline !== null && remainingMs > 0
  const paused =
    !running && remainingMs > 0 && remainingMs < timer.duration * 1000
  const time =
    String(Math.floor(seconds / 60)).padStart(2, '0') +
    ':' +
    String(seconds % 60).padStart(2, '0')

  useEffect(() => {
    const deadline = timer.deadline
    if (deadline === null) return
    const tick = () => {
      const current = Date.now()
      setNow(current)
      if (current >= deadline) window.clearInterval(interval)
    }
    const interval = window.setInterval(tick, 150)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', tick)
    }
  }, [timer.deadline])

  let status = 'Готов к запуску'
  if (running) status = 'Идёт речь'
  if (paused) status = 'Пауза'
  if (remainingMs === 0) status = 'Время вышло'
  if (locked) status = 'Игра завершена'

  return (
    <section className="judge-panel judge-timer" aria-labelledby="timer-title">
      <div className="judge-panel-header">
        <h2 id="timer-title">
          <TimerIcon aria-hidden="true" /> Таймер речи
        </h2>
        <div
          className="judge-presets"
          role="group"
          aria-label="Длительность речи"
        >
          {durations.map((duration) => (
            <button
              key={duration}
              type="button"
              aria-pressed={timer.duration === duration}
              disabled={locked || running}
              onClick={() => send({ type: 'duration', duration })}
            >
              {duration} с
            </button>
          ))}
        </div>
      </div>
      <div className="judge-timer-body">
        <p className="judge-speaker">
          {activeSpeaker
            ? 'Место ' +
              activeSpeaker.seat +
              (activeSpeaker.name.trim()
                ? ' · ' + activeSpeaker.name.trim()
                : '')
            : 'Спикер не выбран'}
        </p>
        <div
          className="judge-time"
          data-expired={remainingMs === 0}
          role="timer"
          aria-label={'Осталось ' + time}
        >
          {time}
        </div>
        <div className="judge-time-track" aria-hidden="true">
          <span
            style={{
              transform:
                'scaleX(' + remainingMs / (timer.duration * 1000) + ')',
            }}
          />
        </div>
        <p className="judge-timer-status" role="status">
          {status}
        </p>
        <div className="judge-timer-actions">
          <Button
            className="judge-primary"
            disabled={locked}
            onClick={() => send({ type: running ? 'pause' : 'start' })}
          >
            {running ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {running ? 'Пауза' : paused ? 'Продолжить' : 'Запустить'}
          </Button>
          <button
            className="judge-icon-button judge-timer-reset"
            type="button"
            aria-label="Сбросить таймер"
            title="Сбросить таймер"
            onClick={() => send({ type: 'reset' })}
            disabled={locked}
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
        <button
          className="judge-next-speaker"
          type="button"
          onClick={() => send({ type: 'nextSpeaker' })}
          disabled={locked || game.players.every((player) => player.out)}
        >
          Следующий спикер <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
