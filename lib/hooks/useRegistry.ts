import { useState, useEffect, useCallback } from 'react'

export interface RegistryItem {
  id: string
  name: string
  created_at: string
}

// Module-level cache: endpoint → items. Survives component unmount/remount
// so re-opening the config panel is instant. Invalidated on mutating operations.
const cache = new Map<string, RegistryItem[]>()
const inflight = new Map<string, Promise<RegistryItem[]>>()

async function fetchEndpoint(endpoint: string): Promise<RegistryItem[]> {
  if (inflight.has(endpoint)) return inflight.get(endpoint)!
  const promise = (async () => {
    try {
      const res = await fetch(endpoint)
      const text = await res.text()
      let data: unknown
      try { data = JSON.parse(text) } catch { data = [] }
      const items = Array.isArray(data) ? data as RegistryItem[] : []
      cache.set(endpoint, items)
      return items
    } catch {
      cache.set(endpoint, [])
      return []
    } finally {
      inflight.delete(endpoint)
    }
  })()
  inflight.set(endpoint, promise)
  return promise
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRegistry<T extends RegistryItem>(endpoint: string) {
  const cached = cache.get(endpoint) as T[] | undefined
  const [items, setItems] = useState<T[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!cache.has(endpoint)) setLoading(true)
    const data = await fetchEndpoint(endpoint)
    setItems(data as T[])
    setLoading(false)
  }, [endpoint])

  useEffect(() => {
    if (cached) return // already have data, skip fetch
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  const create = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = {} }
    if (!res.ok) throw new Error((data as Record<string, unknown>).error as string ?? 'Failed to save')
    setItems(prev => { const next = [data as T, ...prev]; cache.set(endpoint, next); return next })
    setSaving(false)
    return data as T
  }, [endpoint])

  const update = useCallback(async (id: string, body: Record<string, unknown>) => {
    setSaving(true)
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = {} }
    if (!res.ok) throw new Error((data as Record<string, unknown>).error as string ?? 'Failed to update')
    setItems(prev => { const next = prev.map(x => x.id === id ? { ...x, ...(data != null && typeof data === 'object' ? data : {}) } as T : x); cache.set(endpoint, next); return next })
    setSaving(false)
    return data as T
  }, [endpoint])

  const remove = useCallback(async (id: string) => {
    await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setItems(prev => { const next = prev.filter(x => x.id !== id); cache.set(endpoint, next); return next })
  }, [endpoint])

  return { items, loading, saving, create, update, remove, reload: load }
}
