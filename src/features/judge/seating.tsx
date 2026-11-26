import { Button } from '@/components/ui/button'
import { Shuffle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { SendAction } from './game'
import type { Game } from './game-state'

export function Seating({ game, send }: { game: Game; send: SendAction }) {
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(
    () => !game.players.some((player) => player.name),
  )

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const names = game.players.map((player) =>
      String(data.get('name-' + player.seat) ?? '').trim(),
    )
    const shuffle =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ===
      'shuffle'
    const occupied = names.flatMap((name, index) => (name ? [index] : []))
    if (shuffle && occupied.length < 2) {
      setNotice('Для перемешивания нужны хотя бы два участника')
      return
    }
    const order = names.map((_, index) => index)
    if (shuffle) {
      const shuffled = [...occupied]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1))
        const previous = shuffled[index]
        shuffled[index] = shuffled[target]
        shuffled[target] = previous
      }
      if (shuffled.every((value, index) => value === occupied[index])) {
        shuffled.push(shuffled.shift()!)
      }
      occupied.forEach((position, index) => {
        order[position] = shuffled[index]
      })
    }
    send({ type: 'seating', names, order })
    setNotice(shuffle ? 'Рассадка перемешана' : 'Рассадка сохранена')
  }

  return (
    <details
      className="judge-panel judge-seating"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Рассадка</summary>
      <form
        className="judge-section"
        onSubmit={save}
        onInput={() => setNotice('')}
      >
        <div className="judge-seating-fields">
          {game.players.map((player, index) => (
            <label key={player.seat + ':' + player.name}>
              <span>{index + 1}</span>
              <input
                className="judge-field"
                name={'name-' + player.seat}
                aria-label={'Ник игрока ' + (index + 1)}
                defaultValue={player.name}
                maxLength={256}
                autoComplete="off"
                placeholder="Ник игрока"
              />
            </label>
          ))}
        </div>
        <div className="judge-controls">
          <Button className="judge-compact judge-primary" type="submit">
            Сохранить рассадку
          </Button>
          <Button
            className="judge-compact judge-secondary"
            type="submit"
            value="shuffle"
          >
            <Shuffle aria-hidden="true" /> Перемешать
          </Button>
          <span className="judge-muted" role="status">
            {notice}
          </span>
        </div>
      </form>
    </details>
  )
}
