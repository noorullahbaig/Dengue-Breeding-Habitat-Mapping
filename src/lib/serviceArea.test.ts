import { isWithinServiceArea } from '@/lib/serviceArea'

describe('service area', () => {
  it('accepts Kuala Lumpur points and rejects nearby out-of-area points', () => {
    expect(isWithinServiceArea({ latitude: 3.139, longitude: 101.6869 })).toBe(true)
    expect(isWithinServiceArea({ latitude: 2.9264, longitude: 101.6964 })).toBe(false)
  })
})
