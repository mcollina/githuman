/**
 * Hook for subscribing to server-sent events (SSE)
 * Provides real-time updates when data changes (e.g., from CLI)
 */
import { useEffect, useRef } from 'react'
import { getAuthToken } from '../api/client'

export type EventType = 'todos' | 'reviews' | 'comments' | 'files' | 'connected'

interface ServerEvent {
  type: EventType;
  data?: { action?: 'created' | 'updated' | 'deleted' };
  timestamp: number;
}

interface UseServerEventsOptions {
  /** Event types to listen for */
  eventTypes: EventType[];
  /** Callback when matching event is received */
  onEvent: (event: ServerEvent) => void;
  /** Whether to connect (default: true) */
  enabled?: boolean;
}

/**
 * Subscribe to server-sent events for real-time updates
 *
 * @example
 * ```tsx
 * useServerEvents({
 *   eventTypes: ['todos'],
 *   onEvent: () => refetch(),
 * });
 * ```
 */
export function useServerEvents ({
  eventTypes,
  onEvent,
  enabled = true,
}: UseServerEventsOptions): void {
  const eventSourceRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)
  const eventTypesRef = useRef(eventTypes)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const enabledRef = useRef(enabled)

  // Keep refs updated without causing re-renders
  onEventRef.current = onEvent
  eventTypesRef.current = eventTypes
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) {
      return
    }

    const connect = () => {
      // Build URL with auth token if needed
      const token = getAuthToken()
      const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events'

      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (messageEvent) => {
        try {
          const event = JSON.parse(messageEvent.data) as ServerEvent
          // Check if this event type is one we're listening for
          if (eventTypesRef.current.includes(event.type)) {
            onEventRef.current(event)
          }
        } catch {
          // Ignore parse errors (e.g., heartbeats)
        }
      }

      eventSource.onerror = () => {
        // Close and schedule reconnect
        eventSource.close()
        eventSourceRef.current = null

        // Reconnect quickly (1 second) to minimize missed events
        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current) {
            connect()
            // Trigger a refetch on reconnect to catch any missed events
            onEventRef.current({ type: 'connected', timestamp: Date.now() })
          }
        }, 1000)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [enabled])
}
