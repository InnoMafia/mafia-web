import {
  blankVote,
  currentDay,
  eligibleVoters,
  newDay,
  newTimer,
  type Day,
  type Game,
  type Vote,
} from './game-state'

export type Round = 'main' | 'runoff'
export type VoteAction =
  | { type: 'nominate'; id: number; confirmed?: boolean }
  | { type: 'voteCount'; id: number; value: number | null }
  | { type: 'voteVoter'; id: number; voter: number | null }
  | { type: 'endVote' | 'cancelReview' }
  | { type: 'lift'; eliminate: boolean }
  | { type: 'review'; index: number; round: Round }

export function roundVotes(entries: Vote[], electorate: number[]): Vote[] {
  if (!entries.length) return []
  const earlier = entries.slice(0, -1).map((vote) => {
    if (vote.voters === null) return vote
    const voters = vote.voters.filter((id) => electorate.includes(id))
    return { ...vote, voters, count: voters.length }
  })
  const remaining =
    electorate.length -
    earlier.reduce((sum, vote) => sum + (vote.count ?? 0), 0)
  const count =
    remaining >= 0 && earlier.every((vote) => vote.count !== null)
      ? remaining
      : null
  const assigned = new Set(earlier.flatMap((vote) => vote.voters ?? []))
  const voters =
    count !== null &&
    earlier.every((vote) => vote.count === 0 || vote.voters !== null)
      ? electorate.filter((id) => !assigned.has(id))
      : null
  return [
    ...earlier,
    { candidate: entries[entries.length - 1].candidate, count, voters },
  ]
}

export function election(game: Game) {
  const day = game.review?.day ?? currentDay(game)
  const round =
    day.stage === 'runoff' || day.stage === 'lift' ? 'runoff' : 'main'
  const electorate =
    (round === 'runoff' ? day.runoffElectorate : day.mainElectorate) ??
    eligibleVoters(game)
  return {
    day,
    round,
    electorate,
    votes: roundVotes(day[round], electorate),
  } as const
}

export function nextOpener(game: Game, after: number) {
  const eligible = eligibleVoters(game)
  const start = game.players.findIndex((player) => player.seat === after)
  for (let offset = 1; offset <= game.players.length; offset += 1) {
    const { seat } = game.players[(start + offset) % game.players.length]
    if (eligible.includes(seat)) return seat
  }
  return after
}

function setDay(game: Game, day: Day): Game {
  if (game.review) return { ...game, review: { ...game.review, day } }
  return { ...game, days: [...game.days.slice(0, -1), day] }
}

function finishVote(game: Game, day: Day, out: number[]) {
  const completed: Day = { ...day, out, stage: 'done' }
  if (game.review) {
    const { index } = game.review
    if (index === game.days.length - 1)
      return finishVote({ ...game, review: null }, day, out)
    return {
      ...game,
      days: game.days.map((item, i) => (i === index ? completed : item)),
      review: null,
    }
  }
  const updated = setDay(game, completed)
  const next = newDay(nextOpener(updated, day.opener), true)
  return { ...updated, days: [...updated.days, next], timer: newTimer() }
}

export function updateVote(game: Game, action: VoteAction): Game {
  const { day, round, electorate, votes } = election(game)
  switch (action.type) {
    case 'nominate': {
      if (game.review || day.stage !== 'main') return game
      const exists = day.main.some((vote) => vote.candidate === action.id)
      if (!exists && !electorate.includes(action.id)) return game
      const main = exists
        ? day.main.filter((vote) => vote.candidate !== action.id)
        : [
            ...day.main.slice(0, -1),
            ...day.main.slice(-1).map((vote) => blankVote(vote.candidate)),
            blankVote(action.id),
          ]
      if (exists && day.main.at(-1)?.candidate === action.id && main.length) {
        main[main.length - 1] = blankVote(main[main.length - 1].candidate)
      }
      const nominees = exists
        ? game.timer.nominees.filter((id) => id !== action.id)
        : game.timer.speaker === null
          ? game.timer.nominees
          : [...game.timer.nominees, action.id]
      return setDay(
        { ...game, timer: { ...game.timer, nominees } },
        { ...day, main, morning: false },
      )
    }
    case 'voteCount':
    case 'voteVoter': {
      if (day.stage !== 'main' && day.stage !== 'runoff') return game
      const candidates = day[round].slice(0, -1)
      if (!candidates.some((vote) => vote.candidate === action.id)) return game
      if (action.type === 'voteCount') {
        if (
          action.value !== null &&
          (!Number.isInteger(action.value) ||
            action.value < 0 ||
            action.value > 10)
        )
          return game
        return setDay(game, {
          ...day,
          [round]: day[round].map((vote) =>
            vote.candidate === action.id
              ? { ...vote, count: action.value, voters: null }
              : vote,
          ),
        })
      }
      if (action.voter !== null && !electorate.includes(action.voter))
        return game
      const previous = candidates.find(
        (vote) => action.voter !== null && vote.voters?.includes(action.voter),
      )?.candidate
      return setDay(game, {
        ...day,
        [round]: day[round].map((vote) => {
          if (vote.candidate !== action.id && vote.candidate !== previous)
            return vote
          const voters = (vote.voters ?? []).filter((id) => id !== action.voter)
          if (
            vote.candidate === action.id &&
            action.voter !== null &&
            previous !== action.id
          )
            voters.push(action.voter)
          return {
            ...vote,
            voters: action.voter === null ? [] : voters,
            count: action.voter === null ? 0 : voters.length,
          }
        }),
      })
    }
    case 'endVote': {
      if (
        (day.stage !== 'main' && day.stage !== 'runoff') ||
        !votes.length ||
        votes.some((v) => v.count === null)
      )
        return game
      const max = Math.max(...votes.map((vote) => vote.count ?? 0))
      const leaders = votes
        .filter((vote) => vote.count === max)
        .map((vote) => vote.candidate)
      const updated = {
        ...day,
        [round]: votes,
        [round === 'main' ? 'mainElectorate' : 'runoffElectorate']: electorate,
      }
      if (leaders.length === 1) return finishVote(game, updated, leaders)
      if (round === 'main') {
        if (game.review) {
          const previous = game.days[game.review.index]
          if (
            JSON.stringify(previous.main.slice(0, -1)) ===
            JSON.stringify(votes.slice(0, -1))
          )
            return { ...game, review: null }
        }
        return setDay(game, {
          ...updated,
          stage: 'runoff',
          runoff: leaders.map(blankVote),
          runoffElectorate: game.review ? electorate : null,
        })
      }
      return setDay(game, { ...updated, stage: 'lift', tied: leaders })
    }
    case 'lift':
      return day.stage === 'lift'
        ? finishVote(game, day, action.eliminate ? day.tied : [])
        : game
    case 'review': {
      if (game.review) return game
      const saved = game.days[action.index]
      if (!saved || !saved[action.round].length) return game
      if (
        saved.stage !== 'done' &&
        saved.stage !== 'lift' &&
        !(saved.stage === 'runoff' && action.round === 'main')
      )
        return game
      return {
        ...game,
        review: {
          index: action.index,
          day: {
            ...saved,
            stage: action.round,
            out: [],
            tied: [],
            ...(action.round === 'main'
              ? { runoff: [], runoffElectorate: null }
              : {}),
          },
        },
      }
    }
    case 'cancelReview':
      return { ...game, review: null }
  }
}
