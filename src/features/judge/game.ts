import { z } from 'zod'

export const phases = ['setup', 'day', 'voting', 'night'] as const
const roles = ['unassigned', 'civilian', 'sheriff', 'mafia', 'don'] as const
export const outcomes = ['civilian', 'mafia', 'draw'] as const
export const durations = [30, 60, 90] as const

export type Phase = (typeof phases)[number]
export type Role = (typeof roles)[number]
export type Outcome = (typeof outcomes)[number]
export type Duration = (typeof durations)[number]

export const phaseLabels: Record<Phase, string> = {
  setup: 'Подготовка',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
}

export const roleLabels: Record<Role, string> = {
  unassigned: 'Не назначена',
  civilian: 'Мирный',
  sheriff: 'Шериф',
  mafia: 'Мафия',
  don: 'Дон',
}

export const outcomeLabels: Record<Outcome, string> = {
  civilian: 'Победа мирных',
  mafia: 'Победа мафии',
  draw: 'Ничья',
}

const seatCount = 10
const eventLimit = 100
export const gameStorageKey = 'innomafia.judge.v1'

const seatSchema = z.int().min(1).max(seatCount)
const playerSchema = z.object({
  seat: seatSchema,
  name: z.string().max(40),
  role: z.enum(roles),
  fouls: z.int().nonnegative(),
  out: z.boolean(),
  nominated: z.boolean(),
  votes: z.int().min(0).max(seatCount),
})

const timestampSchema = z.number().min(0).max(8.64e15)

const timerSchema = z
  .object({
    duration: z.literal(durations),
    remainingMs: z.number().min(0).max(90_000),
    deadline: timestampSchema.nullable(),
  })
  .refine((timer) => timer.remainingMs <= timer.duration * 1000)

const gameSchema = z.object({
  phase: z.enum(phases),
  day: z.int().nonnegative(),
  players: z
    .array(playerSchema)
    .length(seatCount)
    .refine((players) =>
      players.every((player, index) => player.seat === index + 1),
    ),
  speaker: seatSchema.nullable(),
  timer: timerSchema,
  events: z
    .array(
      z.object({
        id: z.int().positive(),
        at: timestampSchema,
        text: z.string(),
      }),
    )
    .max(eventLimit),
  outcome: z.enum(outcomes).nullable(),
})

export type Player = z.infer<typeof playerSchema>
export type Timer = z.infer<typeof timerSchema>
export type Game = z.infer<typeof gameSchema>

export type GameAction =
  | { type: 'phase'; phase: Phase }
  | { type: 'rename'; seat: number; name: string }
  | { type: 'role'; seat: number; role: Role }
  | { type: 'foul' | 'vote'; seat: number; delta: -1 | 1 }
  | { type: 'speaker' | 'nominate' | 'eliminate'; seat: number }
  | {
      type:
        'nextSpeaker' | 'clearVotes' | 'start' | 'pause' | 'reset' | 'newGame'
    }
  | { type: 'duration'; duration: Duration }
  | { type: 'finish'; outcome: Outcome }

export type SendAction = (action: GameAction) => void

type TimedAction = GameAction & { at: number }

function freshTimer(duration: Duration): Timer {
  return { duration, remainingMs: duration * 1000, deadline: null }
}

function newGame(): Game {
  return {
    phase: 'setup',
    day: 0,
    players: Array.from({ length: seatCount }, (_, index) => ({
      seat: index + 1,
      name: '',
      role: 'unassigned',
      fouls: 0,
      out: false,
      nominated: false,
      votes: 0,
    })),
    speaker: null,
    timer: freshTimer(60),
    events: [],
    outcome: null,
  }
}

export function loadGame(): Game {
  try {
    const raw = localStorage.getItem(gameStorageKey)
    if (raw) {
      const restored = gameSchema.safeParse(JSON.parse(raw))
      if (restored.success) return restored.data
    }
  } catch {
    // An unavailable or corrupt store should still allow a session.
  }
  return newGame()
}

export function playerName(player: Player) {
  return player.name.trim() || 'Место ' + player.seat
}

export function phaseName(phase: Phase, day: number) {
  if (day > 0 && (phase === 'day' || phase === 'night')) {
    return phaseLabels[phase] + ' ' + day
  }
  return phaseLabels[phase]
}

export function remainingTime(timer: Timer, at: number) {
  if (timer.deadline === null) return timer.remainingMs
  return Math.min(timer.remainingMs, Math.max(0, timer.deadline - at))
}

function log(game: Game, at: number, text: string): Game {
  const id = (game.events[0]?.id ?? 0) + 1
  return {
    ...game,
    events: [{ id, at, text }, ...game.events].slice(0, eventLimit),
  }
}

function changePlayer(game: Game, player: Player): Game {
  return {
    ...game,
    players: game.players.map((other) =>
      other.seat === player.seat ? player : other,
    ),
  }
}

function selectSpeaker(game: Game, player: Player, at: number): Game {
  if (player.out || player.seat === game.speaker) return game
  return log(
    {
      ...game,
      speaker: player.seat,
      timer: freshTimer(game.timer.duration),
    },
    at,
    'Слово у ' + playerName(player),
  )
}

function updateSeat(
  game: Game,
  action: Extract<TimedAction, { seat: number }>,
): Game {
  const player = game.players.find((entry) => entry.seat === action.seat)
  if (!player) return game
  const name = playerName(player)

  switch (action.type) {
    case 'rename':
      return changePlayer(game, { ...player, name: action.name })
    case 'role':
      return changePlayer(game, { ...player, role: action.role })
    case 'foul': {
      const fouls = Math.max(0, player.fouls + action.delta)
      if (fouls === player.fouls || player.out) return game
      return log(
        changePlayer(game, { ...player, fouls }),
        action.at,
        name + ' · фолы: ' + fouls,
      )
    }
    case 'speaker':
      return selectSpeaker(game, player, action.at)
    case 'nominate': {
      if (player.out) return game
      const nominated = !player.nominated
      return log(
        changePlayer(game, { ...player, nominated, votes: 0 }),
        action.at,
        name +
          (nominated ? ' · в списке на голосование' : ' · снят с голосования'),
      )
    }
    case 'eliminate': {
      const out = !player.out
      const updated = changePlayer(game, {
        ...player,
        out,
        nominated: false,
        votes: 0,
      })
      if (out && game.speaker === player.seat) {
        updated.speaker = null
        updated.timer = freshTimer(game.timer.duration)
      }
      return log(
        updated,
        action.at,
        name + (out ? ' · выбыл' : ' · снова в игре'),
      )
    }
    case 'vote': {
      if (game.phase !== 'voting' || !player.nominated || player.out)
        return game
      const votes = Math.max(
        0,
        Math.min(seatCount, player.votes + action.delta),
      )
      if (votes === player.votes) return game
      return log(
        changePlayer(game, { ...player, votes }),
        action.at,
        name + ' · голоса: ' + votes,
      )
    }
  }
}

function changePhase(game: Game, phase: Phase, at: number): Game {
  if (phase === game.phase) return game
  let day = game.day
  if (phase === 'setup') day = 0
  if (phase === 'day' && game.phase === 'night') day += 1
  if (phase === 'day' || phase === 'voting') day = Math.max(1, day)

  const players =
    phase === 'night' || phase === 'setup'
      ? game.players.map((player) => ({
          ...player,
          nominated: false,
          votes: 0,
        }))
      : game.players

  return log(
    {
      ...game,
      phase,
      day,
      players,
      speaker: null,
      timer: freshTimer(game.timer.duration),
    },
    at,
    phaseName(phase, day),
  )
}

export function updateGame(game: Game, action: TimedAction): Game {
  if (action.type === 'newGame') return newGame()
  if (game.outcome) return game
  if ('seat' in action) return updateSeat(game, action)

  switch (action.type) {
    case 'phase':
      return changePhase(game, action.phase, action.at)
    case 'nextSpeaker': {
      const active = game.players.filter((player) => !player.out)
      const next =
        active.find((player) => player.seat > (game.speaker ?? 0)) ?? active[0]
      return next ? selectSpeaker(game, next, action.at) : game
    }
    case 'clearVotes':
      return log(
        {
          ...game,
          players: game.players.map((player) => ({ ...player, votes: 0 })),
        },
        action.at,
        'Голоса сброшены',
      )
    case 'duration':
      return { ...game, timer: freshTimer(action.duration) }
    case 'start': {
      const remainingMs =
        remainingTime(game.timer, action.at) || game.timer.duration * 1000
      return {
        ...game,
        timer: {
          ...game.timer,
          remainingMs,
          deadline: action.at + remainingMs,
        },
      }
    }
    case 'pause':
      return {
        ...game,
        timer: {
          ...game.timer,
          remainingMs: remainingTime(game.timer, action.at),
          deadline: null,
        },
      }
    case 'reset':
      return { ...game, timer: freshTimer(game.timer.duration) }
    case 'finish':
      return log(
        {
          ...game,
          outcome: action.outcome,
          timer: {
            ...game.timer,
            remainingMs: remainingTime(game.timer, action.at),
            deadline: null,
          },
        },
        action.at,
        outcomeLabels[action.outcome],
      )
  }
}
