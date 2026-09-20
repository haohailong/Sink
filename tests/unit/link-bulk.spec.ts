import { describe, expect, it } from 'vitest'
import { chunkItems, createBulkEditChanges, runBulkOperation } from '../../app/utils/link-bulk'

describe('bulk link editing', () => {
  it('serializes only patched fields', () => {
    expect(createBulkEditChanges({
      comment: 'Updated comment',
      tags: ['new'],
    })).toEqual({
      comment: 'Updated comment',
      tags: ['new'],
    })
  })

  it('uses null to explicitly clear selected optional fields', () => {
    expect(createBulkEditChanges({ title: undefined })).toEqual({ title: null })
  })

  it('chunks large selections to the API request limit', () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('bulk operation runner', () => {
  it('limits concurrency, preserves input order, and records individual failures', async () => {
    let active = 0
    let maxActive = 0
    const results = await runBulkOperation([1, 2, 3, 4], async (item) => {
      active++
      maxActive = Math.max(maxActive, active)
      await Promise.resolve()
      active--
      if (item === 3)
        throw new Error('failed')
    }, 2)

    expect(maxActive).toBe(2)
    expect(results.map(result => result.item)).toEqual([1, 2, 3, 4])
    expect(results.map(result => Boolean(result.error))).toEqual([false, false, true, false])
  })
})
