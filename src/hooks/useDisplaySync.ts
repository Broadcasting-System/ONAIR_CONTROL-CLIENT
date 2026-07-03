import { useEffect, useState } from 'react'
import { backendBase, backendWs } from '@/lib/backend'

export type ContentType = 'image' | 'video' | 'presentation' | 'audio' | 'standby' | 'screen' | 'timer' | 'youtube'

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

export interface ImageOverlay {
  text: string
  size: number
  color: string
  position: 'top' | 'center' | 'bottom'
  visible: boolean
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
  overlay?: ImageOverlay
  label?: string
  durationSec?: number
  mode?: 'down' | 'up'
  videoId?: string
  command?: 'display'
  [key: string]: unknown
}

export function useDisplaySync(channel: number = 1) {
  const [content, setContent] = useState<DisplayContent | null>(null)

  useEffect(() => {
    const BASE = backendBase()
    const chQs = channel > 1 ? `?channel=${channel}` : ''

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
        const res = await fetch(`${BASE}/api/display/status${chQs}`)
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
              overlay: resolved.overlay,
              label: resolved.label,
              durationSec: resolved.durationSec,
              mode: resolved.mode,
              videoId: resolved.videoId,
            })
          }
        }
      } catch {
        // 초기 status는 보조용(fast-path). 백엔드가 잠깐 안 닿아도 아래 WebSocket이
        // 자동 재연결하며 상태를 받아오므로 치명적이지 않다 → 경고만(에러 오버레이 방지).
        console.warn('초기 상태 fetch 실패 — WebSocket 연결로 복구 시도')
      }
    }

    fetchInitialStatus()

    let ws: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout

    const connect = () => {
      const wsUrl = backendWs('/api/display/ws', channel, 'control')
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
              overlay: resolved.overlay,
              label: resolved.label,
              durationSec: resolved.durationSec,
              mode: resolved.mode,
              videoId: resolved.videoId,
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
  }, [channel])

  return { content }
}
