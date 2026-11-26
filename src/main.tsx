import { Button } from '@/components/ui/button'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { fetchServiceStatus } from './lib/api'
import './theme.css'

const queryClient = new QueryClient()
const JudgePage = lazy(() => import('./features/judge/judge-page'))

function App() {
  const status = useQuery({
    queryKey: ['service-status'],
    queryFn: ({ signal }) => fetchServiceStatus(signal),
    retry: false,
  })

  const message = {
    pending: 'Проверяем доступность API…',
    error: 'API недоступен',
    success: 'API доступен',
  }[status.fetchStatus === 'paused' ? 'error' : status.status]

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <section
        aria-labelledby="title"
        className="bg-card border-border w-full max-w-md rounded-xl border px-8 py-9 shadow-lg"
      >
        <h1 id="title" className="text-3xl font-semibold tracking-tight">
          InnoMafia
        </h1>
        <p className="text-muted-foreground mt-2">Платформа спортивной мафии</p>
        <a
          href="/judge"
          className="bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:outline-ring mt-6 inline-flex rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Открыть судейский пульт
        </a>
        <p role="status" className="border-border mt-7 border-t pt-5">
          {message}
        </p>
        {status.isError && (
          <Button
            className="mt-4"
            disabled={status.isFetching}
            onClick={() => void status.refetch()}
          >
            Проверить снова
          </Button>
        )}
      </section>
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element is missing')

const isJudgePage = /^\/judge\/?$/.test(window.location.pathname)

createRoot(root).render(
  <StrictMode>
    {isJudgePage ? (
      <Suspense fallback={null}>
        <JudgePage />
      </Suspense>
    ) : (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )}
  </StrictMode>,
)
