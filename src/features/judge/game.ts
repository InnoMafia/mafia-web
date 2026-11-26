import {
  currentDay,
  eligibleVoters,
  newGame,
  newNight,
  newReport,
  newTimer,
  remainingTime,
  reportFor,
  shotNight,
  statusOf,
  type Game,
  type Night,
  type Outcome,
  type Player,
  type Report,
} from './game-state'
import { nextOpener, updateVote, type VoteAction } from './vote-state'

type PlayerAction =
  | { type: 'role'; id: number; role: Player['role'] }
  | { type: 'status'; id: number; status: Player['status'] }
  | { type: 'foul'; id: number; delta: -1 | 1 }
  | { type: 'techFoul'; id: number; value: 0.3 | 0.6 }
  | { type: 'undoTechFoul'; id: number; value: 0.3 | 0.6 }
  | {
      type: 'score'
      id: number
      field: 'bonus' | 'penalty' | 'technical'
      value: number
    }
  | { type: 'bestMove'; id: number; picks: number[] }

type TimerAction =
  | { type: 'speech'; id: number; duration: 30 | 60 }
  | { type: 'countdown'; duration: 10 | 20 | 60 }
  | { type: 'extraSpeech'; id: number }
  | { type: 'start' | 'pause' | 'restart' | 'stop' }

type NightAction =
  | { type: 'night'; index: number; field: keyof Night; id: number | null }
  | { type: 'shot'; id: number }

type ReportAction =
  | { type: 'addReport' | 'deleteReport'; id: number }
  | {
      type: 'reportPicks'
      id: number
      field: 'red' | 'black' | 'sheriff'
      picks: number[]
    }

export type GameAction =
  | PlayerAction
  | TimerAction
  | NightAction
  | ReportAction
  | VoteAction
  | { type: 'seating'; names: string[]; order: number[] }
  | { type: 'notes'; notes: string }
  | { type: 'outcome'; value: Outcome }
  | { type: 'setting'; key: 'hideRoles' | 'namedVoting'; value: boolean }
  | { type: 'newGame' }

export type SendAction = (action: GameAction) => void

function updatePlayer(game: Game, action: PlayerAction): Game {
  const player = game.players.find(({ seat }) => seat === action.id)
  if (!player) return game
  let bestMoveOrder = game.bestMoveOrder
  let updated: Player
  switch (action.type) {
    case 'role':
      updated = { ...player, role: action.role }
      break
    case 'status':
      updated = {
        ...player,
        status: action.status,
        restoredThrough:
          action.status === 'alive'
            ? game.days.length - 2
            : player.restoredThrough,
        fouls:
          action.status === 'alive' ? Math.min(3, player.fouls) : player.fouls,
        techFouls:
          action.status === 'alive'
            ? player.techFouls.slice(0, 1)
            : player.techFouls,
      }
      break
    case 'foul':
      updated = {
        ...player,
        fouls: Math.max(0, Math.min(4, player.fouls + action.delta)),
      }
      break
    case 'techFoul':
      if (player.techFouls.length >= 2) return game
      updated = {
        ...player,
        techFouls: [...player.techFouls, action.value],
        technical: 0,
      }
      break
    case 'undoTechFoul':
      updated = {
        ...player,
        techFouls: player.techFouls.filter(
          (_, index) => index !== player.techFouls.lastIndexOf(action.value),
        ),
      }
      break
    case 'score':
      if (
        !Number.isFinite(action.value) ||
        action.value < 0 ||
        action.value > 1.5 ||
        (action.field === 'technical' && player.techFouls.length > 0)
      )
        return game
      updated = {
        ...player,
        [action.field]: Math.round(action.value * 100) / 100,
      }
      break
    case 'bestMove': {
      const picks = [...new Set(action.picks)]
        .filter((id) => game.players.some((p) => p.seat === id))
        .slice(0, 3)
      if (picks.length === 0) {
        bestMoveOrder = bestMoveOrder.filter((id) => id !== player.seat)
      } else if (!bestMoveOrder.includes(player.seat)) {
        if (bestMoveOrder.length === 2) return game
        bestMoveOrder = [...bestMoveOrder, player.seat]
      }
      updated = { ...player, bestMove: picks }
      break
    }
  }
  return {
    ...game,
    bestMoveOrder,
    players: game.players.map((p) => (p.seat === player.seat ? updated : p)),
  }
}

function updateTimer(game: Game, action: TimerAction, at: number): Game {
  const { timer } = game
  const left = remainingTime(timer, at)
  switch (action.type) {
    case 'speech': {
      const player = game.players.find((p) => p.seat === action.id)
      if (!player?.name.trim()) return game
      const day = currentDay(game)
      const days =
        day.morning && statusOf(game, player) === 'alive'
          ? [...game.days.slice(0, -1), { ...day, morning: false }]
          : game.days
      return {
        ...game,
        days,
        timer: {
          ...newTimer(),
          speaker: action.id,
          duration: action.duration,
          remainingMs: action.duration * 1000,
          deadline: at + action.duration * 1000,
        },
      }
    }
    case 'countdown':
      return {
        ...game,
        timer: {
          ...newTimer(),
          mode: 'countdown',
          duration: action.duration,
          remainingMs: action.duration * 1000,
          deadline: at + action.duration * 1000,
        },
      }
    case 'extraSpeech': {
      const player = game.players.find((p) => p.seat === action.id)
      if (
        !player ||
        timer.speaker !== player.seat ||
        left <= 0 ||
        timer.extra ||
        player.fouls > 1
      )
        return game
      const players = game.players.map((p) =>
        p.seat === player.seat ? { ...p, fouls: p.fouls + 2 } : p,
      )
      return {
        ...game,
        players,
        timer: {
          ...timer,
          extra: true,
          remainingMs: left + 30_000,
          deadline: timer.deadline === null ? null : at + left + 30_000,
        },
      }
    }
    case 'start':
      if (left === 0 || timer.deadline !== null) return game
      return { ...game, timer: { ...timer, deadline: at + left } }
    case 'pause':
      return { ...game, timer: { ...timer, remainingMs: left, deadline: null } }
    case 'restart':
      return {
        ...game,
        timer: {
          ...timer,
          remainingMs: timer.duration * 1000,
          deadline: at + timer.duration * 1000,
        },
      }
    case 'stop':
      return { ...game, timer: { ...timer, remainingMs: 0, deadline: null } }
  }
}

function updateNight(game: Game, action: NightAction): Game {
  const previous = action.id === null ? -1 : shotNight(game, action.id)
  const trailing = game.nights.length - 1
  let index =
    action.type === 'night' ? action.index : previous >= 0 ? previous : trailing
  const field = action.type === 'night' ? action.field : 'shot'
  const value = action.type === 'shot' && previous >= 0 ? null : action.id
  if (
    action.type === 'shot' &&
    previous < 0 &&
    Object.values(game.nights[trailing]).every((target) => target === null)
  ) {
    const last = game.nights[trailing - 1]
    if (last && last.shot === null && currentDay(game).morning) index -= 1
  }
  const nights = game.nights.map((night, i) => {
    if (i === index) return { ...night, [field]: value }
    if (field === 'shot' && value !== null && night.shot === value)
      return { ...night, shot: null }
    return night
  })
  if (Object.values(nights[nights.length - 1]).some((id) => id !== null))
    nights.push(newNight())
  return { ...game, nights }
}

function updateReport(game: Game, action: ReportAction): Game {
  const report = reportFor(game, action.id)
  const night = shotNight(game, action.id)
  let next: Report | null
  switch (action.type) {
    case 'addReport':
      if (report) return game
      next = newReport(action.id, true)
      break
    case 'deleteReport':
      next =
        night >= 0 ? { ...newReport(action.id), dismissedNight: night } : null
      break
    case 'reportPicks': {
      if (!report) return game
      const { field, picks } = action
      if (field === 'sheriff') next = { ...report, sheriff: picks[0] ?? null }
      else {
        const opposite = field === 'red' ? 'black' : 'red'
        next = {
          ...report,
          [field]: picks,
          [opposite]: report[opposite].filter((id) => !picks.includes(id)),
        }
      }
      if (
        !next.manual &&
        next.red.length === 0 &&
        next.black.length === 0 &&
        next.sheriff === null
      )
        next = null
      break
    }
  }
  const reports = game.reports.filter((entry) => entry.player !== action.id)
  return { ...game, reports: next ? [...reports, next] : reports }
}

function update(game: Game, action: GameAction, at: number): Game {
  switch (action.type) {
    case 'role':
    case 'status':
    case 'foul':
    case 'techFoul':
    case 'undoTechFoul':
    case 'score':
    case 'bestMove':
      return updatePlayer(game, action)
    case 'speech':
    case 'countdown':
    case 'extraSpeech':
    case 'start':
    case 'pause':
    case 'restart':
    case 'stop':
      return updateTimer(game, action, at)
    case 'night':
    case 'shot':
      return updateNight(game, action)
    case 'addReport':
    case 'deleteReport':
    case 'reportPicks':
      return updateReport(game, action)
    case 'nominate':
      if (!action.confirmed && nominationNeedsConfirmation(game, action.id, at))
        return game
      return updateVote(game, action)
    case 'voteCount':
    case 'voteVoter':
    case 'endVote':
    case 'lift':
    case 'review':
    case 'cancelReview':
      return updateVote(game, action)
    case 'seating': {
      if (
        action.names.length !== game.players.length ||
        action.order.length !== game.players.length ||
        new Set(action.order).size !== game.players.length ||
        action.order.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= game.players.length,
        )
      )
        return game
      const names = action.names.map((name) => name.trim().slice(0, 256))
      const assigned = names.map((name, index) =>
        name && name === game.players[index]?.name ? index : -1,
      )
      const unused = new Set(
        game.players
          .map((_, index) => index)
          .filter((index) => !assigned.includes(index)),
      )
      assigned.forEach((source, index) => {
        if (source >= 0 || !names[index]) return
        const match = [...unused].find(
          (candidate) => game.players[candidate].name === names[index],
        )
        if (match !== undefined) {
          unused.delete(match)
          assigned[index] = match
        }
      })
      const players = assigned.map((source, index) => {
        if (source < 0) {
          const fallback = unused.has(index) ? index : [...unused][0]
          unused.delete(fallback)
          source = fallback
        }
        return { ...game.players[source], name: names[index] ?? '' }
      })
      return { ...game, players: action.order.map((index) => players[index]) }
    }
    case 'notes':
      return { ...game, notes: action.notes.slice(0, 2000) }
    case 'outcome':
      return { ...game, outcome: action.value }
    case 'setting':
      return { ...game, [action.key]: action.value }
    case 'newGame':
      return {
        ...newGame(),
        hideRoles: game.hideRoles,
        namedVoting: game.namedVoting,
      }
  }
}

export function nominationNeedsConfirmation(
  game: Game,
  id: number,
  now: number,
) {
  const day = currentDay(game)
  return (
    game.timer.speaker !== null &&
    remainingTime(game.timer, now) > 0 &&
    !day.main.some((vote) => vote.candidate === id) &&
    day.main.some((vote) => game.timer.nominees.includes(vote.candidate))
  )
}

export function updateGame(
  game: Game,
  action: GameAction & { at: number },
): Game {
  const next = update(game, action, action.at)
  const day = currentDay(next)
  const previous = next.days.at(-2)
  if (day.morning && previous) {
    const opener = nextOpener(next, previous.opener)
    if (opener !== day.opener)
      return { ...next, days: [...next.days.slice(0, -1), { ...day, opener }] }
  }
  if (
    next.days.length === 1 &&
    day.main.length === 0 &&
    !eligibleVoters(next).includes(day.opener)
  ) {
    const opener = eligibleVoters(next)[0]
    if (opener !== undefined) return { ...next, days: [{ ...day, opener }] }
  }
  return next
}
