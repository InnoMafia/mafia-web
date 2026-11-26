import { Button } from '@/components/ui/button'
import { playerLabel, type Game } from './game-state'

export function PlayerPicker({
  game,
  chosen,
  limit = 10,
  label,
  onChange,
  onClose,
}: {
  game: Game
  chosen: number[]
  limit?: number
  label: string
  onChange: (ids: number[]) => void
  onClose: () => void
}) {
  return (
    <div className="judge-picker">
      <form
        className="judge-controls"
        onSubmit={(event) => {
          event.preventDefault()
          const input = event.currentTarget.elements.namedItem('places')
          if (!(input instanceof HTMLInputElement)) return
          const matches = input.value.match(/10|[1-9]/g) ?? []
          if (input.value.trim() && !matches.length) {
            input.setCustomValidity('Введите номера игроков от 1 до 10')
            input.reportValidity()
            return
          }
          const ids = [...new Set(matches)]
            .slice(0, limit)
            .map((place) => game.players[Number(place) - 1].seat)
          onChange(ids)
          onClose()
        }}
      >
        <input
          key={chosen.join(',')}
          className="judge-field"
          name="places"
          aria-label={label + ' с клавиатуры'}
          placeholder="2 9 10"
          maxLength={60}
          defaultValue={chosen
            .map((id) => game.players.findIndex((p) => p.seat === id) + 1)
            .join(' ')}
          onInput={(event) => event.currentTarget.setCustomValidity('')}
        />
        <Button className="judge-compact judge-primary" type="submit">
          Применить
        </Button>
        <Button
          className="judge-compact judge-secondary"
          type="button"
          onClick={onClose}
        >
          Готово
        </Button>
      </form>
      <div className="judge-controls" role="group" aria-label={label}>
        {game.players.map((player, index) => {
          const id = player.seat
          const picked = chosen.includes(id)
          return (
            <Button
              key={id}
              className="judge-icon-button"
              aria-label={label + ': ' + playerLabel(game, id)}
              aria-pressed={picked}
              disabled={!picked && chosen.length >= limit && limit !== 1}
              onClick={() =>
                onChange(
                  picked
                    ? chosen.filter((pick) => pick !== id)
                    : limit === 1
                      ? [id]
                      : [...chosen, id],
                )
              }
            >
              {index + 1}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
