import { Button } from '@/components/ui/button'
import { Dialog } from '@base-ui/react/dialog'
import { Flag, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { outcomeLabels, outcomes, type Outcome, type SendAction } from './game'

export function GameActions({
  outcome,
  send,
}: {
  outcome: Outcome | null
  send: SendAction
}) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<Outcome | null>(null)
  const finished = outcome !== null
  const label = finished ? 'Новая игра' : 'Завершить игру'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!finished && choice === null) return
    if (finished) {
      send({ type: 'newGame' })
    } else if (choice !== null) {
      send({ type: 'finish', outcome: choice })
    }
    setOpen(false)
    setChoice(null)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setChoice(null)
      }}
    >
      <Dialog.Trigger className="judge-secondary">
        {finished ? <Plus aria-hidden="true" /> : <Flag aria-hidden="true" />}
        {label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="judge-backdrop" />
        <Dialog.Popup className="judge-dialog">
          <Dialog.Title>{label}</Dialog.Title>
          <Dialog.Description>
            {finished
              ? 'Текущая рассадка и протокол будут сброшены.'
              : 'Выберите итог игры.'}
          </Dialog.Description>
          <form onSubmit={submit}>
            {!finished && (
              <div
                className="judge-outcomes"
                role="group"
                aria-label="Итог игры"
              >
                {outcomes.map((result) => (
                  <label key={result}>
                    <input
                      type="radio"
                      name="outcome"
                      checked={choice === result}
                      onChange={() => setChoice(result)}
                    />
                    {outcomeLabels[result]}
                  </label>
                ))}
              </div>
            )}
            <div className="judge-dialog-actions">
              <Dialog.Close className="judge-secondary">Отмена</Dialog.Close>
              <Button
                className="judge-primary"
                type="submit"
                disabled={!finished && choice === null}
              >
                {finished ? 'Начать новую' : 'Подтвердить'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
