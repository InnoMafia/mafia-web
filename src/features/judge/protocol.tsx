import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { SendAction } from './game'
import {
  placeOf,
  playerLabel,
  type Day,
  type Game,
  type Vote,
} from './game-state'
import { election } from './vote-state'

const voteCounts = Array.from({ length: 11 }, (_, count) => count)
const roundLabels = { main: 'Основное голосование', runoff: 'Переголосование' }

function VotesSummary({ game, votes }: { game: Game; votes: Vote[] }) {
  return (
    <ul className="judge-vote-summary">
      {votes.map((vote) => (
        <li key={vote.candidate}>
          <strong>
            {playerLabel(game, vote.candidate)} · {vote.count ?? '—'}
          </strong>
          {game.namedVoting && (
            <span className="judge-muted">
              {vote.voters?.length
                ? vote.voters.map((id) => placeOf(game, id)).join(', ')
                : vote.count
                  ? 'Введено числом'
                  : '—'}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function Candidate({
  game,
  vote,
  last,
  electorate,
  canRemove,
  send,
}: {
  game: Game
  vote: Vote
  last: boolean
  electorate: number[]
  canRemove: boolean
  send: SendAction
}) {
  const id = vote.candidate
  const label = playerLabel(game, id)
  return (
    <div className="judge-inset judge-ballot-row">
      <div className="judge-ballot-heading">
        <div className="judge-controls">
          {canRemove && (
            <Button
              className="judge-icon-button"
              aria-label={'Снять с голосования ' + label}
              onClick={() => send({ type: 'nominate', id })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
          <strong>{label}</strong>
        </div>
        <output aria-label={(last ? 'Остаток голосов ' : 'Голоса ') + label}>
          {last && 'Авто · '}
          {vote.count ?? '—'}
        </output>
      </div>
      {last ? (
        game.namedVoting && (
          <p className="judge-muted">
            {vote.voters?.length
              ? 'Голосовали: ' +
                vote.voters.map((voter) => placeOf(game, voter)).join(', ')
              : vote.count && !vote.voters
                ? 'Номера появятся после поимённого ввода остальных голосов.'
                : ''}
          </p>
        )
      ) : game.namedVoting ? (
        <>
          <div
            className="judge-controls"
            role="group"
            aria-label={'Кто голосовал за ' + label}
          >
            {electorate.map((voter) => (
              <Button
                key={voter}
                className="judge-icon-button"
                aria-label={playerLabel(game, voter) + ' голосует за ' + label}
                aria-pressed={Boolean(vote.voters?.includes(voter))}
                onClick={() => send({ type: 'voteVoter', id, voter })}
              >
                {placeOf(game, voter)}
              </Button>
            ))}
            <Button
              className="judge-compact judge-secondary"
              aria-label={'Ноль голосов за ' + label}
              aria-pressed={vote.count === 0}
              onClick={() => send({ type: 'voteVoter', id, voter: null })}
            >
              0 голосов
            </Button>
          </div>
          {Boolean(vote.count) && vote.voters === null && (
            <p className="judge-muted">
              Введено числом. Выбор игроков заменит это число.
            </p>
          )}
        </>
      ) : (
        <div
          className="judge-controls"
          role="group"
          aria-label={'Количество голосов за ' + label}
        >
          {voteCounts.map((value) => (
            <Button
              key={value}
              className="judge-icon-button"
              aria-label={'Голосов за ' + label + ': ' + value}
              aria-pressed={value === vote.count}
              onClick={() => send({ type: 'voteCount', id, value })}
            >
              {value}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditRoundButtons({
  day,
  index,
  send,
}: {
  day: Day
  index: number
  send: SendAction
}) {
  return (
    <div className="judge-controls">
      {(['main', 'runoff'] as const)
        .filter(
          (round) =>
            day[round].length && (day.stage !== 'runoff' || round === 'main'),
        )
        .map((round) => (
          <Button
            key={round}
            className="judge-compact judge-secondary"
            onClick={() => send({ type: 'review', index, round })}
          >
            {round === 'main'
              ? 'Исправить основное голосование'
              : 'Исправить переголосование'}
          </Button>
        ))}
    </div>
  )
}

function Ballot({ game, send }: { game: Game; send: SendAction }) {
  const { day, round, votes, electorate } = election(game)
  const review = game.review
  const voteTotal = votes.reduce((sum, vote) => sum + (vote.count ?? 0), 0)
  return (
    <div className="judge-section">
      {day.stage === 'lift' ? (
        <>
          <strong>Подъём стола</strong>
          <p>
            После переголосования снова поровну.{' '}
            {day.tied.map((id) => playerLabel(game, id)).join(', ')}
          </p>
          <div className="judge-controls">
            <Button
              className="judge-compact judge-primary"
              onClick={() => send({ type: 'lift', eliminate: true })}
            >
              Поднять всех
            </Button>
            <Button
              className="judge-compact judge-secondary"
              onClick={() => send({ type: 'lift', eliminate: false })}
            >
              Оставить всех
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="judge-controls">
            {round === 'runoff' && <strong>Переголосование</strong>}
            <span className="judge-muted">
              Голосующих · {electorate.length}
            </span>
          </div>
          {!votes.length && (
            <p className="judge-muted">Выставьте игроков в таблице стола.</p>
          )}
          {votes.map((vote, index) => (
            <Candidate
              key={vote.candidate}
              game={game}
              vote={vote}
              last={index === votes.length - 1}
              electorate={electorate}
              canRemove={!review && round === 'main'}
              send={send}
            />
          ))}
          {votes.length > 0 && (
            <div className="judge-controls">
              <span className="judge-muted">
                Голосов · {voteTotal} / {electorate.length}
              </span>
              <Button
                className="judge-compact judge-primary"
                disabled={votes.some((vote) => vote.count === null)}
                onClick={() => send({ type: 'endVote' })}
              >
                {round === 'runoff'
                  ? 'Завершить переголосование'
                  : 'Завершить голосование'}
              </Button>
            </div>
          )}
        </>
      )}
      {review ? (
        <div className="judge-controls">
          <Button
            className="judge-compact judge-secondary"
            onClick={() => send({ type: 'cancelReview' })}
          >
            Отменить исправление
          </Button>
        </div>
      ) : (
        day.stage !== 'main' && (
          <EditRoundButtons
            day={day}
            index={game.days.length - 1}
            send={send}
          />
        )
      )}
    </div>
  )
}

export function Voting({ game, send }: { game: Game; send: SendAction }) {
  const history = game.days
    .flatMap((day, index) => (day.stage !== 'main' ? [{ day, index }] : []))
    .reverse()
  const currentIndex = game.days.length - 1
  return (
    <>
      <section className="judge-panel" aria-labelledby="judge-vote-title">
        <div className="judge-panel-header">
          <h2 id="judge-vote-title">Голосование · день {game.days.length}</h2>
        </div>
        {!game.review || game.review.index === currentIndex ? (
          <Ballot game={game} send={send} />
        ) : (
          <p className="judge-section judge-muted">
            Сейчас открыто исправление предыдущего голосования.
          </p>
        )}
      </section>
      {history.length > 0 && (
        <section className="judge-panel" aria-labelledby="judge-history-title">
          <div className="judge-panel-header">
            <h2 id="judge-history-title">Предыдущие голосования</h2>
          </div>
          <div className="judge-section judge-history">
            {history.map(({ day, index }) => (
              <details
                key={index}
                className="judge-inset"
                open={
                  (game.review?.index === index && index !== currentIndex) ||
                  undefined
                }
              >
                <summary>
                  День {index + 1} ·{' '}
                  {day.stage === 'done'
                    ? day.out.length
                      ? 'Выбыли ' +
                        day.out.map((id) => '№' + placeOf(game, id)).join(', ')
                      : 'Оставили всех'
                    : roundLabels.main}
                </summary>
                {game.review?.index === index && index !== currentIndex ? (
                  <Ballot game={game} send={send} />
                ) : (
                  <div className="judge-section">
                    {(['main', 'runoff'] as const)
                      .filter(
                        (round) =>
                          day[round].length &&
                          (round !== 'runoff' || day.stage !== 'runoff'),
                      )
                      .map((round) => (
                        <div key={round} className="judge-archived-round">
                          <strong>{roundLabels[round]}</strong>
                          <VotesSummary game={game} votes={day[round]} />
                        </div>
                      ))}
                    {day.stage === 'done' && !game.review && (
                      <EditRoundButtons day={day} index={index} send={send} />
                    )}
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
