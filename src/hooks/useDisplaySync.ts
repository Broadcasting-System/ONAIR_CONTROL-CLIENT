import { useEffect, useState } from 'react'
import { backendBase, backendWs } from '@/lib/backend'

export type ContentType = 'image' | 'video' | 'presentation' | 'audio' | 'standby'

export interface Playback {
  playing: boolean
  anchorTs: number
  offset: number
  volume: number
  muted: boolean
  duration?: number | null
  fit?: 'contain' | 'cover'
  loop?: boolean
}

export interface DisplayContent {
  type: ContentType
  url?: string
  hlsUrl?: string
  fileId?: string
  urls?: string[]
  duration?: number
  serverTimestamp?: number
  playback?: Playback
  slideIndex?: number
  command?: 'display'
  [key: string]: unknown
}

export function useDisplaySync() {
  const [content, setContent] = useState<DisplayContent | null>(null)

  useEffect(() => {
    const BASE = backendBase()

    const resolveUrls = (data: DisplayContent) => {
      const { type, url, urls, fileId, hlsUrl } = data
      let finalUrl = hlsUrl || url
      let finalUrls = urls

      if (type === 'video' || type === 'image' || type === 'audio') {
        if (!finalUrl && fileId) {
          const normalizedFileName = typeof fileId === 'string' && fileId.startsWith('file_')
            ? fileId.slice(5)
            : fileId
          finalUrl = `/api/files/stream/${type}/${normalizedFileName}`
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
          const data = await res.json() as DisplayContent
          if (data && data.type && data.type !== 'standby') {
            const resolved = resolveUrls(data)
            setContent({
              type: resolved.type,
              url: resolved.url,
              urls: resolved.urls,
              duration: resolved.duration,
              serverTimestamp: resolved.serverTimestamp,
              playback: resolved.playback,
              slideIndex: resolved.slideIndex,
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
      const wsUrl = backendWs('/api/display/ws')
      ws = new WebSocket(wsUrl)

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as unknown
          if (typeof parsed !== 'object' || parsed === null) return

          const message = parsed as DisplayContent
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
              playback: resolved.playback,
              slideIndex: resolved.slideIndex,
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
