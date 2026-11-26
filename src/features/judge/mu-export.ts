import {
  placeOf,
  shotNight,
  technicalPoints,
  type Game,
  type Player,
} from './game-state'
import { election } from './vote-state'

type SeatExport = {
  position: number
  name: string
  role: Player['role']
  fouls: number
  bonus: number
  penalty: number
  technical: number
}
type Protocol = {
  seats: SeatExport[]
  first: number | null
  bestMove: number[]
  winner: number | null
  notes: string
}

export function exportProtocol(game: Game): Protocol {
  const first = game.bestMoveOrder[0] ?? game.nights[0].shot
  const bestMove =
    game.players.find(({ seat }) => seat === first)?.bestMove ?? []
  const active = election({ ...game, review: null })
  const history = game.days.flatMap((day, index) => {
    if (!day.main.length) return []
    const display = (votes: typeof day.main) =>
      votes
        .map((entry) => {
          const place = placeOf(game, entry.candidate)
          return entry.count === null
            ? String(place)
            : place + ' (' + entry.count + ')'
        })
        .join(', ')
    const isCurrent = index === game.days.length - 1
    const main = isCurrent && active.round === 'main' ? active.votes : day.main
    const runoff =
      isCurrent && day.stage === 'runoff' ? active.votes : day.runoff
    let line = 'День ' + (index + 1) + ': ' + display(main)
    if (runoff.length) line += ' · переголосование: ' + display(runoff)
    if (day.stage === 'done')
      line += day.out.length
        ? ' → стол покидает ' +
          day.out.map((id) => placeOf(game, id)).join(', ')
        : ' → оставили всех'
    return [line]
  })
  return {
    seats: game.players.flatMap((player, index) =>
      player.name
        ? [
            {
              position: index + 1,
              name: player.name,
              role: player.role,
              fouls: player.fouls,
              bonus: player.bonus,
              penalty: player.penalty,
              technical: technicalPoints(player),
            },
          ]
        : [],
    ),
    first:
      first === null || (!bestMove.length && shotNight(game, first) < 0)
        ? null
        : placeOf(game, first),
    bestMove: bestMove.map((id) => placeOf(game, id)),
    winner:
      game.outcome === null
        ? null
        : { civilian: 1, mafia: 2, draw: 3 }[game.outcome],
    notes: [
      game.notes.trim(),
      history.length ? 'Голосования:\n' + history.join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  }
}

// Keep this function self-contained. It runs as a user-triggered bookmark on the MU editor.
async function fillMafiaUniverse(protocol: Protocol) {
  if (
    !['https://mafiauniverse.org', 'https://mafiaworld.org'].includes(
      location.origin,
    )
  ) {
    alert('Откройте редактирование игры на MafiaUniverse.')
    return
  }
  const rows = new Map<
    number,
    {
      index: string
      name?: HTMLInputElement
      id?: HTMLInputElement
      row: HTMLTableRowElement
    }
  >()
  for (const position of document.querySelectorAll<HTMLInputElement>(
    'input[name$=".Position"]',
  )) {
    const index = position.name.match(/^GamePlayers\[(\d+)\]\.Position$/)?.[1]
    const row = position.closest('tr')
    if (index === undefined || !row) continue
    const name =
      row.querySelector<HTMLInputElement>('input.GamePlayers_Player_Name') ??
      undefined
    const adjacent = name?.nextElementSibling
    const id =
      row.querySelector<HTMLInputElement>(
        'input[type="hidden"][name$=".PlayerId"], input[type="hidden"][name$=".Player.Id"]',
      ) ??
      (adjacent instanceof HTMLInputElement &&
      adjacent.type === 'hidden' &&
      adjacent !== position
        ? adjacent
        : undefined)
    rows.set(Number(position.value), { index, name, id, row })
  }
  if (!rows.size) {
    alert('Откройте редактирование игры на MafiaUniverse.')
    return
  }

  const norm = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()
  const isId = (id: unknown): id is string | number =>
    /^[1-9]\d*$/.test(String(id ?? ''))
  const initial = new Map(
    [...rows].map(([place, slot]) => [
      place,
      { name: slot.name?.value, id: slot.id?.value },
    ]),
  )
  const mismatches = protocol.seats.flatMap((seat) => {
    const slot = rows.get(seat.position)
    if (!slot) return ['Место ' + seat.position + ' отсутствует в редакторе MU']
    return slot.name?.value.trim() && norm(slot.name.value) !== norm(seat.name)
      ? [
          'Место ' +
            seat.position +
            ': в MU «' +
            slot.name.value +
            '», в протоколе «' +
            seat.name +
            '»',
        ]
      : []
  })
  if (
    mismatches.length &&
    !confirm(mismatches.join('\n') + '\n\nЗаполнить протокол?')
  )
    return

  type Match = { name: string; id: string }
  const known = new Map<string, Map<string, Match>>()
  for (const slot of rows.values()) {
    if (!slot.name?.value.trim() || !isId(slot.id?.value)) continue
    const key = norm(slot.name.value)
    const matches = known.get(key) ?? new Map<string, Match>()
    matches.set(slot.id.value, { name: slot.name.value, id: slot.id.value })
    known.set(key, matches)
  }

  const searches = new Map<string, string>()
  for (const seat of protocol.seats) {
    const key = norm(seat.name)
    if (rows.get(seat.position)?.id && !known.has(key))
      searches.set(key, seat.name)
  }
  const queue = [...searches]
  async function lookup() {
    while (queue.length) {
      const search = queue.shift()
      if (!search) return
      const [key, name] = search
      const form = new URLSearchParams({ term: name })
      for (const [parameter, id] of [
        ['tournamentId', 'TournamentIdForFilter'],
        ['withJudges', 'WithJudges'],
      ]) {
        const field = document.getElementById(id) as HTMLInputElement | null
        if (field?.value) form.set(parameter, field.value)
      }
      try {
        const response = await fetch('/Players/Search/', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: form,
          signal: AbortSignal.timeout(8000),
        })
        if (!response.ok) continue
        const candidates: unknown = await response.json()
        if (!Array.isArray(candidates)) continue
        const matches = new Map<string, Match>()
        for (const candidate of candidates) {
          if (
            typeof candidate?.label === 'string' &&
            norm(candidate.label) === key &&
            isId(candidate.id)
          ) {
            matches.set(String(candidate.id), {
              name: candidate.label,
              id: String(candidate.id),
            })
          }
        }
        known.set(key, matches)
      } catch {
        // Missing lookups are reported before any fields are applied.
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, () => lookup()),
  )

  const issues: string[] = []
  const assignments = new Map<number, Match>()
  const duplicates = new Set<string>()
  for (const seat of protocol.seats) {
    const slot = rows.get(seat.position)
    const before = initial.get(seat.position)
    const key = norm(seat.name)
    const matches = known.get(key)
    const label = '№' + seat.position + ' · ' + seat.name
    if (!slot?.name || !slot.id) issues.push(label + ' · нет поля игрока')
    else if (slot.name.value !== before?.name || slot.id.value !== before.id)
      issues.push(label + ' · рассадка изменилась во время поиска')
    else if (!matches) issues.push(label + ' · поиск не ответил')
    else if (matches.size !== 1)
      issues.push(
        label +
          (matches.size
            ? ' · несколько точных совпадений'
            : ' · точное совпадение не найдено'),
      )
    else {
      const match = [...matches.values()][0]
      if (
        [...assignments.values()].some((assigned) => assigned.id === match.id)
      )
        duplicates.add(match.id)
      assignments.set(seat.position, match)
    }
  }
  for (const [place, match] of assignments) {
    if (duplicates.has(match.id)) {
      assignments.delete(place)
      issues.push('№' + place + ' · игрок указан на нескольких местах')
    }
  }

  let changed = true
  while (changed) {
    changed = false
    const occupied = new Set(
      [...rows].flatMap(([place, slot]) =>
        !assignments.has(place) && isId(slot.id?.value) ? [slot.id.value] : [],
      ),
    )
    for (const [place, match] of assignments) {
      if (occupied.has(match.id) && rows.get(place)?.id?.value !== match.id) {
        assignments.delete(place)
        issues.push('№' + place + ' · игрок остался на другом месте')
        changed = true
      }
    }
  }
  if (
    issues.length &&
    !confirm(
      issues.join('\n') +
        '\n\nЗаполнить поля для однозначно найденных игроков?',
    )
  )
    return

  function field(place: number, key: string) {
    const slot = rows.get(place)
    return slot
      ? (document.getElementById('GamePlayers_' + slot.index + '__' + key) as
          HTMLInputElement | HTMLSelectElement | null)
      : null
  }
  function change(
    element: HTMLInputElement | HTMLSelectElement,
    value: string,
  ) {
    element.value = value
    const jquery = (
      window as Window & {
        jQuery?: (element: Element) => { trigger: (event: string) => void }
      }
    ).jQuery
    if (jquery) jquery(element).trigger('change')
    else element.dispatchEvent(new Event('change', { bubbles: true }))
  }
  for (const [place, match] of assignments) {
    const slot = rows.get(place)
    if (slot?.name && slot.id) {
      slot.name.value = match.name
      slot.id.value = match.id
    }
  }

  const seats = protocol.seats.filter((seat) => assignments.has(seat.position))
  const roleIds = {
    unassigned: '1',
    civilian: '1',
    sheriff: '2',
    mafia: '3',
    don: '4',
  }
  for (const seat of seats) {
    const role = field(seat.position, 'GameRoleId')
    if (role && role.value !== '1') change(role, '1')
  }
  const hasScores = protocol.seats.some(
    ({ bonus, penalty, technical }) => bonus || penalty || technical,
  )
  for (const seat of seats) {
    const role = field(seat.position, 'GameRoleId')
    if (role && roleIds[seat.role] !== '1') change(role, roleIds[seat.role])
    const foul = field(seat.position, 'Foul')
    if (foul) foul.value = String(seat.fouls)
    const count = rows.get(seat.position)?.row.querySelector('.hasfoul')
    if (count) count.textContent = seat.fouls ? String(seat.fouls) : ''
    const first = seat.position === protocol.first
    const killedFirst = field(seat.position, 'KilledFirst')
    if (killedFirst) killedFirst.value = first ? 'True' : 'False'
    const bestMove = field(seat.position, 'BestMove')
    if (bestMove) {
      bestMove.value = first ? protocol.bestMove.join(',') : ''
      bestMove.style.display = first ? '' : 'none'
    }
    if (hasScores) {
      const scoring = [
        ['BonusScore', seat.bonus],
        ['PenaltyScore', seat.penalty],
        ['TechPenaltyScore', seat.technical],
      ] as const
      for (const [key, value] of scoring) {
        const input = field(seat.position, key)
        if (input) change(input, value.toFixed(2).replace('.', ','))
      }
    }
  }
  const winner = document.querySelector<HTMLSelectElement>('#GameWinnerId')
  if (winner && protocol.winner !== null)
    change(winner, String(protocol.winner))
  const note = document.querySelector<HTMLTextAreaElement>('#Note')
  if (note && protocol.notes && !note.value.includes(protocol.notes)) {
    note.value = [note.value.trim(), protocol.notes]
      .filter(Boolean)
      .join('\n\n')
    note.dispatchEvent(new Event('change', { bubbles: true }))
  }
  alert('Протокол заполнен. Проверьте поля и нажмите «Сохранить».')
}

export function bookmarklet(game: Game) {
  const code =
    'void (' +
    fillMafiaUniverse.toString() +
    ')(' +
    JSON.stringify(exportProtocol(game)) +
    ')'
  return 'javascript:' + encodeURIComponent(code)
}
