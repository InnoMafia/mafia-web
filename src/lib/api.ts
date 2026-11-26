import createClient from 'openapi-fetch'
import type { paths } from './api.gen'

const client = createClient<paths>()

export async function fetchServiceStatus(signal: AbortSignal) {
  const { data } = await client.GET('/api/v1/status', { signal })
  if (data?.status !== 'ready') {
    throw new Error('API unavailable')
  }
  return data.status
}
