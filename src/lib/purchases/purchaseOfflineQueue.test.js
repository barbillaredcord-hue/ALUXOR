import { describe, expect, it } from 'vitest'
import {
  // importa aquí la función pública real que normaliza o crea operaciones
} from './purchaseOfflineQueue'

describe('purchaseOfflineQueue identity', () => {
  it('preserves the operation id during retries', () => {
    const id = '7a367aeb-8356-443f-975e-d56d89d7845f'

    // Crea o normaliza dos veces la misma operación usando la API real.
    // Verifica que ambas conserven exactamente `id`.
  })

  it('creates a UUID for a new operation without id', () => {
    // Crea una operación sin id usando la API pública real.
    // Verifica el formato UUID.
  })
})