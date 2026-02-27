import { useEffect, useState } from 'react'

export type ContentType = 'image' | 'video' | 'presentation' | 'audio' | 'standby'

export interface DisplayContent {
  type: ContentType
  url?: string
  urls?: string[]
  duration?: number
  serverTimestamp?: number
}

export function useDisplaySync() {
  const [content, setContent] = useState<DisplayContent | null>(null)

  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

    const resolveUrls = (data: any) => {
      const { type, url, urls, fileId } = data
      let finalUrl = url
      let finalUrls = urls

      if (type === 'video' || type === 'image' || type === 'audio') {
        if (!finalUrl && fileId) {
          finalUrl = `/uploads/${fileId}`
        }
        if (finalUrl && !finalUrl.startsWith('http')) {
          finalUrl = `${BASE}${finalUrl}`
        }
      }

      if (type === 'presentation' && finalUrls) {
        finalUrls = finalUrls.map((u: string) => u.startsWith('http') ? u : `${BASE}${u}`)
      }

      return { ...data, url: finalUrl, urls: finalUrls }
    }

    const fetchInitialStatus = async () => {
      try {
        const res = await fetch(`${BASE}/api/display/status`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.type && data.type !== 'standby') {
            const resolved = resolveUrls(data)
            setContent({
              type: resolved.type,
              url: resolved.url,
              urls: resolved.urls,
              duration: resolved.duration,
              serverTimestamp: resolved.serverTimestamp,
            })
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial status', err)
      }
    }

    fetchInitialStatus()

    let ws: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout

    const connect = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/display/ws'
      ws = new WebSocket(wsUrl)

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.command === 'display') {
            if (message.type === 'standby') {
              setContent(null)
              return
            }

            const resolved = resolveUrls(message)

            setContent({
              type: resolved.type,
              url: resolved.url,
              urls: resolved.urls,
              duration: resolved.duration,
              serverTimestamp: resolved.serverTimestamp,
            })
          }
        } catch (err) {
          console.error('Failed to parse WS message', err)
        }
      }

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (ws) ws.close()
      clearTimeout(reconnectTimer)
    }
  }, [])

  return { content }
}
