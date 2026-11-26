import { List, Minus, Plus, Vote } from 'lucide-react'
import { playerName, type Game, type SendAction } from './game'

const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
})

export function Protocol({ events }: { events: Game['events'] }) {
  return (
    <section className="judge-panel" aria-labelledby="protocol-title">
      <div className="judge-panel-header">
        <h2 id="protocol-title">
          <List aria-hidden="true" /> Протокол
        </h2>
        <span className="judge-count">{events.length}</span>
      </div>
      {events.length > 0 ? (
        <ol className="judge-events">
          {events.map((event) => (
            <li key={event.id}>
              <time dateTime={new Date(event.at).toISOString()}>
                {timeFormat.format(event.at)}
              </time>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="judge-empty">Событий пока нет.</p>
      )}
    </section>
  )
}

export function Voting({ game, send }: { game: Game; send: SendAction }) {
  const nominees = game.players.filter(
    (player) => player.nominated && !player.out,
  )
  const voting = game.phase === 'voting'
  const locked = game.outcome !== null
  if (!voting && nominees.length === 0) return null

  return (
    <section className="judge-panel" aria-labelledby="voting-title">
      <div className="judge-panel-header">
        <h2 id="voting-title">
          <Vote aria-hidden="true" /> Голосование
        </h2>
        {voting && nominees.some((player) => player.votes > 0) && (
          <button
            type="button"
            className="judge-text-button"
            disabled={locked}
            onClick={() => send({ type: 'clearVotes' })}
          >
            Сбросить голоса
          </button>
        )}
      </div>
      {nominees.length > 0 ? (
        <ul className="judge-votes">
          {nominees.map((player) => (
            <li key={player.seat}>
              <span>{playerName(player)}</span>
              {voting && (
                <div className="judge-stepper">
                  <button
                    className="judge-icon-button"
                    type="button"
                    disabled={locked || player.votes === 0}
                    aria-label={'Убрать голос у места ' + player.seat}
                    onClick={() =>
                      send({ type: 'vote', seat: player.seat, delta: -1 })
                    }
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <span aria-label={'Голосов: ' + player.votes}>
                    {player.votes}
                  </span>
                  <button
                    className="judge-icon-button"
                    type="button"
                    disabled={locked || player.votes >= game.players.length}
                    aria-label={'Добавить голос месту ' + player.seat}
                    onClick={() =>
                      send({ type: 'vote', seat: player.seat, delta: 1 })
                    }
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="judge-empty">Выставьте кандидатов кнопкой в рассадке.</p>
      )}
    </section>
  )
}
