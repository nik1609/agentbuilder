import { useState, useEffect, useCallback } from 'react'

export interface RegistryItem {
  id: string
  name: string
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRegistry<T extends RegistryItem>(endpoint: string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(endpoint)
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [endpoint])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to save')
    setItems(prev => [data as T, ...prev])
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
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to update')
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...data } as T : x))
    setSaving(false)
    return data as T
  }, [endpoint])

  const remove = useCallback(async (id: string) => {
    await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setItems(prev => prev.filter(x => x.id !== id))
  }, [endpoint])

  return { items, loading, saving, create, update, remove, reload: load }
}
