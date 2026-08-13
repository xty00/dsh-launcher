import type { DshmApi } from '../shared/types'

declare global {
  interface Window {
    dshm: DshmApi
  }
}

export {}
