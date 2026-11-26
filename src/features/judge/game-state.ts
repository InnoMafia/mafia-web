import { z } from 'zod'

export const roles = [
  'unassigned',
  'civilian',
  'sheriff',
  'mafia',
  'don',
] as const
export const roleLabels = {
  unassigned: 'Не назначена',
  civilian: 'Мирный',
  sheriff: 'Шериф',
  mafia: 'Мафия',
  don: 'Дон',
}
export const outcomes = ['civilian', 'mafia', 'draw'] as const
export const outcomeLabels = {
  civilian: 'Победа мирных',
  mafia: 'Победа мафии',
  draw: 'Ничья',
}
export const statusLabels = {
  alive: 'В игре',
  voted: 'Заголосован',
  killed: 'Убит',
  removed: 'Удалён',
}

const playerId = z.int().min(1).max(10)
const score = z.number().min(0).max(1.5)
const playerSchema = z.object({
  seat: playerId,
  name: z.string().max(256),
  role: z.enum(roles),
  fouls: z.int().min(0).max(4),
  status: z.enum(['alive', 'voted', 'removed']),
  restoredThrough: z.int().min(-1).default(-1),
  techFouls: z.array(z.literal([0.3, 0.6])).max(2),
  bonus: score,
  penalty: score,
  technical: score,
  bestMove: z.array(playerId).max(3),
})
const voteSchema = z.object({
  candidate: playerId,
  count: z.int().min(0).max(10).nullable(),
  voters: z.array(playerId).nullable(),
})
const daySchema = z.object({
  stage: z.enum(['main', 'runoff', 'lift', 'done']),
  main: z.array(voteSchema).max(10),
  runoff: z.array(voteSchema).max(10),
  mainElectorate: z.array(playerId).nullable(),
  runoffElectorate: z.array(playerId).nullable(),
  tied: z.array(playerId),
  out: z.array(playerId),
  opener: playerId,
  morning: z.boolean(),
})
const nightSchema = z.object({
  shot: playerId.nullable(),
  don: playerId.nullable(),
  sheriff: playerId.nullable(),
})
const reportSchema = z.object({
  player: playerId,
  black: z.array(playerId),
  red: z.array(playerId),
  sheriff: playerId.nullable(),
  manual: z.boolean(),
  dismissedNight: z.int().nonnegative().nullable(),
})
const timerSchema = z.object({
  speaker: playerId.nullable(),
  mode: z.enum(['speech', 'countdown']),
  duration: z.int().min(10).max(90),
  remainingMs: z.number().min(0).max(120_000),
  deadline: z.number().nonnegative().nullable(),
  nominees: z.array(playerId),
  extra: z.boolean(),
})
const gameSchema = z.object({
  players: z
    .array(playerSchema)
    .length(10)
    .refine((players) => new Set(players.map((p) => p.seat)).size === 10),
  days: z.array(daySchema).min(1),
  nights: z.array(nightSchema).min(1),
  reports: z.array(reportSchema),
  bestMoveOrder: z.array(playerId).max(2),
  review: z.object({ index: z.int().nonnegative(), day: daySchema }).nullable(),
  timer: timerSchema,
  notes: z.string().max(2000),
  outcome: z.enum(outcomes).nullable(),
  hideRoles: z.boolean(),
  namedVoting: z.boolean(),
})

export type Player = z.infer<typeof playerSchema>
export type Vote = z.infer<typeof voteSchema>
export type Day = z.infer<typeof daySchema>
export type Night = z.infer<typeof nightSchema>
export type Report = z.infer<typeof reportSchema>
export type Timer = z.infer<typeof timerSchema>
export type Game = z.infer<typeof gameSchema>
export type Outcome = Game['outcome']
export type PlayerStatus = keyof typeof statusLabels

export const gameStorageKey = 'innomafia.judge.v2'

export function newDay(opener: number, morning = false): Day {
  return {
    stage: 'main',
    main: [],
    runoff: [],
    mainElectorate: null,
    runoffElectorate: null,
    tied: [],
    out: [],
    opener,
    morning,
  }
}

export function newNight(): Night {
  return { shot: null, don: null, sheriff: null }
}

export function newTimer(): Timer {
  return {
    speaker: null,
    mode: 'speech',
    duration: 60,
    remainingMs: 60_000,
    deadline: null,
    nominees: [],
    extra: false,
  }
}

export function newReport(player: number, manual = false): Report {
  return {
    player,
    black: [],
    red: [],
    sheriff: null,
    manual,
    dismissedNight: null,
  }
}

export function blankVote(candidate: number): Vote {
  return { candidate, count: null, voters: null }
}

export function newGame(): Game {
  return {
    players: Array.from({ length: 10 }, (_, index) => ({
      seat: index + 1,
      name: '',
      role: 'unassigned',
      fouls: 0,
      status: 'alive',
      restoredThrough: -1,
      techFouls: [],
      bonus: 0,
      penalty: 0,
      technical: 0,
      bestMove: [],
    })),
    days: [newDay(1)],
    nights: [newNight()],
    reports: [],
    bestMoveOrder: [],
    review: null,
    timer: newTimer(),
    notes: '',
    outcome: null,
    hideRoles: false,
    namedVoting: false,
  }
}

const oldGameSchema = z.object({
  day: z.int().min(0).max(1000),
  players: z
    .array(
      z.object({
        seat: playerId,
        name: playerSchema.shape.name,
        role: playerSchema.shape.role,
        fouls: z.int().nonnegative(),
        out: z.boolean(),
        nominated: z.boolean(),
        votes: z.int().min(0).max(10),
      }),
    )
    .length(10)
    .refine((players) => new Set(players.map((p) => p.seat)).size === 10),
  speaker: playerId.nullable(),
  timer: timerSchema.pick({
    duration: true,
    remainingMs: true,
    deadline: true,
  }),
  outcome: gameSchema.shape.outcome,
})

export function loadGame(): Game {
  try {
    const raw = localStorage.getItem(gameStorageKey)
    if (raw) {
      const saved = gameSchema.safeParse(JSON.parse(raw))
      if (saved.success) return saved.data
    }
    const previous = localStorage.getItem('innomafia.judge.v1')
    if (previous) {
      const saved = oldGameSchema.safeParse(JSON.parse(previous))
      if (saved.success) {
        const game = newGame()
        const old = saved.data
        game.players = game.players.map((player, index) => {
          const oldPlayer = old.players[index]
          return {
            ...player,
            seat: oldPlayer.seat,
            name: oldPlayer.name,
            role: oldPlayer.role,
            fouls: Math.min(4, oldPlayer.fouls),
            status: oldPlayer.out ? 'removed' : 'alive',
          }
        })
        game.days = Array.from({ length: Math.max(1, old.day) }, (_, index) =>
          newDay(game.players[index % 10].seat),
        )
        const day = currentDay(game)
        day.main = old.players
          .filter((p) => p.nominated)
          .map((p) => ({ ...blankVote(p.seat), count: p.votes }))
        game.timer = { ...game.timer, ...old.timer, speaker: old.speaker }
        game.outcome = old.outcome
        return game
      }
    }
  } catch {
    // Storage can be unavailable or contain an invalid snapshot.
  }
  return newGame()
}

export function currentDay(game: Game) {
  return game.days[game.days.length - 1]
}

export function placeOf(game: Game, id: number) {
  return game.players.findIndex((player) => player.seat === id) + 1
}

export function playerLabel(game: Game, id: number) {
  const player = game.players.find((entry) => entry.seat === id)
  const number = '№' + placeOf(game, id)
  return player?.name ? number + ' · ' + player.name : number
}

export function shotNight(game: Game, id: number) {
  return game.nights.findIndex((night) => night.shot === id)
}

export function statusOf(game: Game, player: Player): PlayerStatus {
  if (shotNight(game, player.seat) >= 0) return 'killed'
  if (
    player.fouls >= 4 ||
    player.techFouls.length === 2 ||
    player.status === 'removed'
  )
    return 'removed'
  if (
    player.status === 'voted' ||
    game.days.some(
      (day, index) =>
        index > player.restoredThrough && day.out.includes(player.seat),
    )
  )
    return 'voted'
  return 'alive'
}

export function eligibleVoters(game: Game) {
  return game.players
    .filter((p) => p.name.trim() && statusOf(game, p) === 'alive')
    .map((p) => p.seat)
}

export function remainingTime(timer: Timer, at: number) {
  return timer.deadline === null
    ? timer.remainingMs
    : Math.min(timer.remainingMs, Math.max(0, timer.deadline - at))
}

export function technicalPoints(player: Player) {
  const [first, second] = player.techFouls
  return first === undefined
    ? player.technical
    : Math.round((first + (second ?? 0) * 2) * 100) / 100
}

export function reportFor(game: Game, id: number): Report | undefined {
  const night = shotNight(game, id)
  const saved = game.reports.find((entry) => entry.player === id)
  if (saved?.dismissedNight !== null && saved?.dismissedNight !== undefined) {
    return night >= 0 && saved.dismissedNight !== night
      ? newReport(id)
      : undefined
  }
  return saved ?? (night >= 0 ? newReport(id) : undefined)
}
