import { Button } from '@/components/ui/button'
import { Dialog } from '@base-ui/react/dialog'
import { Download, Plus } from 'lucide-react'
import { useState } from 'react'
import type { SendAction } from './game'
import { outcomes, type Game } from './game-state'
import { bookmarklet } from './mu-export'

export function NewGame({ send }: { send: SendAction }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="judge-compact judge-secondary">
        <Plus aria-hidden="true" /> Новая игра
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="judge-backdrop" />
        <Dialog.Popup className="judge-dialog">
          <Dialog.Title>Новая игра</Dialog.Title>
          <Dialog.Description>
            Текущая рассадка и протокол будут сброшены.
          </Dialog.Description>
          <div className="judge-controls">
            <Dialog.Close className="judge-compact judge-secondary">
              Отмена
            </Dialog.Close>
            <Dialog.Close
              className="judge-compact judge-primary"
              onClick={() => send({ type: 'newGame' })}
            >
              Начать новую
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function GameActions({ game, send }: { game: Game; send: SendAction }) {
  const [address, setAddress] = useState('')
  const [feedback, setFeedback] = useState('')
  const results = { civilian: 'Мирные', mafia: 'Мафия', draw: 'Ничья' }
  return (
    <section className="judge-panel">
      <div className="judge-panel-header">
        <h2>Итог игры</h2>
      </div>
      <div className="judge-section judge-controls">
        <div className="judge-controls" role="group" aria-label="Победитель">
          {outcomes.map((value) => (
            <Button
              className="judge-compact judge-secondary"
              key={value}
              aria-pressed={game.outcome === value}
              onClick={() =>
                send({
                  type: 'outcome',
                  value: game.outcome === value ? null : value,
                })
              }
            >
              {results[value]}
            </Button>
          ))}
        </div>
        <Dialog.Root
          onOpenChange={(open) => {
            if (open) {
              setAddress(bookmarklet(game))
              setFeedback('')
            }
          }}
        >
          <Dialog.Trigger
            className="judge-compact judge-primary"
            disabled={!game.players.some((player) => player.name)}
          >
            <Download aria-hidden="true" /> Экспорт в MU
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="judge-backdrop" />
            <Dialog.Popup className="judge-dialog">
              <Dialog.Title>Экспорт в MafiaUniverse</Dialog.Title>
              <Dialog.Description>
                Создайте закладку с этим адресом. Откройте редактирование игры в
                MU, запустите закладку и проверьте заполненные поля перед
                сохранением.
              </Dialog.Description>
              <Button
                className="judge-compact judge-secondary"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/uri-list', address)
                  event.dataTransfer.setData('text/plain', address)
                  event.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() =>
                  setFeedback(
                    'Перетащите кнопку на панель закладок браузера или скопируйте адрес',
                  )
                }
              >
                Заполнить протокол MU
              </Button>
              <textarea
                className="judge-field judge-bookmark"
                aria-label="Адрес закладки"
                value={address}
                readOnly
                rows={3}
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className="judge-controls">
                <Button
                  className="judge-compact judge-primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(address)
                      setFeedback('Адрес скопирован')
                    } catch {
                      setFeedback('Выделите адрес в поле и скопируйте вручную')
                    }
                  }}
                >
                  Копировать адрес закладки
                </Button>
                <Dialog.Close className="judge-compact judge-secondary">
                  Закрыть
                </Dialog.Close>
              </div>
              <p className="judge-muted" role="status">
                {feedback}
              </p>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  )
}
