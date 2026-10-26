import { useEffect, useRef, useState } from 'react'
import { backendBase, backendWs, resolveMediaUrl } from '@/lib/backend'
import { useReconnectingSocket } from '@/lib/reconnectingSocket'
import type { SwitchLayout, SwitchSlot, SwitchSource } from '@/lib/switchApi'

export type ContentType = 'image' | 'video' | 'presentation' | 'audio' | 'standby' | 'screen' | 'timer' | 'youtube' | 'switch'

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
  // 스위처(type==='switch') — lib/switchApi 의 모양
  layout?: SwitchLayout
  slots?: SwitchSlot[]
  sources?: SwitchSource[]
  command?: 'display'
  [key: string]: unknown
}

/** role — control(컨트롤 미리보기) · live(학생용 live 화면, 서버가 보는 사람 수로 센다)
 *  status·staleSince — 끊겨 있으면 화면 내용이 서버와 다를 수 있다 (lib/reconnectingSocket) */
export function useDisplaySync(channel: number = 1, role: 'control' | 'live' = 'control') {
  const [content, setContent] = useState<DisplayContent | null>(null)
  // WebSocket이 먼저 상태를 줬으면 늦게 도착한 초기 fetch 결과로 덮어쓰지 않는다.
  const gotSocketState = useRef(false)

  useEffect(() => {
    const BASE = backendBase()
    const chQs = channel > 1 ? `?channel=${channel}` : ''
    // 채널을 바꾸면 이전 채널 내용을 즉시 비운다 — 새 채널이 대기 상태면 서버가 standby를
    // 보내기 전까지 이전 채널 영상·진행바가 남아 '다른 채널을 조작하는' 착각을 일으켰다.
    setContent(null)
    gotSocketState.current = false
    // 채널이 바뀌어 이 effect가 정리되면 true — 늦게 온 옛 채널 fetch 결과를 버린다.
    // (옛 채널 소켓이 다시 붙지 않게 막는 것은 useReconnectingSocket 이 한다)
    let cancelled = false

    const fetchInitialStatus = async () => {
      try {
        const res = await fetch(`${BASE}/api/display/status${chQs}`)
        if (res.ok) {
          const data = await res.json() as DisplayContent
          if (cancelled || gotSocketState.current) return
          if (!data || !data.type || data.type === 'standby') {
            setContent(null)
          } else {
            setContent(pick(resolveUrls(data)))
          }
        }
      } catch {
        // 초기 status는 보조용(fast-path). 백엔드가 잠깐 안 닿아도 아래 WebSocket이
        // 자동 재연결하며 상태를 받아오므로 치명적이지 않다 → 경고만(에러 오버레이 방지).
        console.warn('초기 상태 fetch 실패 — WebSocket 연결로 복구 시도')
      }
    }

    fetchInitialStatus()
    return () => {
      cancelled = true
    }
  }, [channel, role])

  const { status, staleSince } = useReconnectingSocket(backendWs('/api/display/ws', channel, role), {
    onMessage: (parsed) => {
      if (typeof parsed !== 'object' || parsed === null) return
      const message = parsed as DisplayContent
      if (message.command !== 'display') return
      gotSocketState.current = true
      if (message.type === 'standby') {
        setContent(null)
        return
      }
      setContent(pick(resolveUrls(message)))
    },
  })

  return { content, status, staleSince }
}

function resolveUrls(data: DisplayContent): DisplayContent {
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
    if (finalUrl) finalUrl = resolveMediaUrl(finalUrl)
  }

  if (type === 'presentation' && finalUrls) {
    finalUrls = finalUrls.map((u: string) => resolveMediaUrl(u))
  }

  return { ...data, url: finalUrl, urls: finalUrls }
}

/** 화면이 쓰는 값만 남긴다 */
function pick(resolved: DisplayContent): DisplayContent {
  return {
    type: resolved.type,
    url: resolved.url,
    fileId: resolved.fileId,
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
    layout: resolved.layout,
    slots: resolved.slots,
    sources: resolved.sources,
  }
}
