# mafia-web

Веб-интерфейс платформы спортивной мафии InnoMafia. С главной страницы
можно открыть судейский пульт по маршруту `/judge`.

## Разработка

Требуются Node.js 26.13.1, pnpm 11.25.0 и Make.

```bash
pnpm install --frozen-lockfile
pnpm dev
make check
```

Откройте [судейский пульт](http://localhost:5173/judge). Рассадка, таймер,
голосование и протокол одной текущей игры сохраняются в браузере.
Пульт работает локально. Для проверки интеграции с API поднимите стенд
из [mafia-ops](https://github.com/InnoMafia/mafia-ops).

Vite проксирует `/api` на `http://127.0.0.1:8080`. Для другого адреса
укажите `API_DEV_URL` при запуске `pnpm dev`. В контейнере Caddy раздаёт
SPA и проксирует запросы с того же домена на `API_UPSTREAM` (`api:8080`
по умолчанию). Нативные gRPC-вызовы Caddy проксирует на `GRPC_UPSTREAM`
(`api:9090` по умолчанию). `SITE_ADDRESS` задаёт адрес прослушивания,
по умолчанию `:8080`.

UI использует Tailwind 4 и конфигурацию shadcn/ui для Base UI. Общие
компоненты находятся в `src/components/ui`, палитра — в `src/theme.css`.

## Контракт API

`contracts/openapi.json` — копия OpenAPI 3.1, сгенерированного из Protobuf в
`mafia-api`. `make generate` обновляет `src/lib/api.gen.ts`. Интеграционная
проверка в `mafia-ops` сравнивает эту копию со спецификацией проверяемой
ревизии API и документом, отданным запущенным сервером.
