'use client'

import { ChatScreen, ChatThread, Composer } from '@bitbaum/chatkit/react'
import { readEventStream } from '@bitbaum/ai-kit/sse'

import { useState, useRef, useEffect } from 'react'
import { UI_LABELS, AI_ASSISTANT_LABELS, AI_SUGGESTED_QUESTIONS } from '@/lib/constants/labels'

interface Message {
  role: 'user' | 'assistant'
  content: string
  failed?: boolean
}

export function AIChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight stream on unmount to prevent setState-on-unmounted leaks
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function sendMessage(text: string, history = messages) {
    if (!text.trim() || streaming || abortRef.current) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    const nextMessages = [...history, userMessage]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)
    setStreamingText('')
    setError(null)
    setStopped(false)

    const controller = new AbortController()
    abortRef.current = controller

    let accumulated = ''
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages
            .filter((message) => !message.failed)
            .map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
          const body = (await response.json()) as { error?: string }
          if (body.error) message = body.error
        } catch {
          // keep fallback status message
        }
        throw new Error(message)
      }

      if (!response.body) throw new Error('Keine Antwort empfangen.')
      await readEventStream<{ type: string; text?: string; message?: string }>(
        response.body,
        (event) => {
          if (controller.signal.aborted) throw new DOMException('Stopped', 'AbortError')
          if (event.type === 'text' && event.text) {
            accumulated += event.text
            setStreamingText(accumulated)
          } else if (event.type === 'error') {
            throw new Error(event.message ?? 'Ein Fehler ist aufgetreten.')
          }
        },
      )

      if (controller.signal.aborted) throw new DOMException('Stopped', 'AbortError')
      if (!accumulated.trim()) {
        accumulated = 'Keine Antwort erhalten. Bitte Anfrage präzisieren oder erneut versuchen.'
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }])
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Die Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.'
      setError(message)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: accumulated ? `${accumulated}\n\n${message}` : message,
          failed: true,
        },
      ])
    } finally {
      controller.abort()
      if (abortRef.current === controller) abortRef.current = null
      setStreaming(false)
      setStreamingText('')
    }
  }

  const isEmpty = messages.length === 0 && !streaming

  function stop() {
    abortRef.current?.abort()
    if (streamingText) {
      setMessages((previous) => [...previous, { role: 'assistant', content: streamingText }])
    }
    setStopped(true)
  }

  return (
    <div className="h-[calc(100dvh-220px)] min-h-[280px]">
      <ChatScreen
        fill="parent"
        composer={
          <Composer
            value={input}
            onValueChange={setInput}
            inputRef={textareaRef}
            placeholder={UI_LABELS.aiChatPlaceholder}
            ariaLabel={UI_LABELS.aiChatPlaceholder}
            onSend={(text) => {
              if (abortRef.current) return false
              void sendMessage(text)
            }}
            sending={streaming}
            onStop={stop}
            voice={false}
            labels={{ send: UI_LABELS.sendMessage, stop: 'Antwort stoppen' }}
            header={
              error ? (
                <p role="alert" className="alert-error">
                  {error}
                </p>
              ) : undefined
            }
          />
        }
      >
        <ChatThread
          messages={messages.map((message, index) => ({ ...message, id: String(index) }))}
          live={streaming ? { text: streamingText, status: 'Daten werden abgerufen…' } : null}
          onStop={stop}
          stopped={stopped}
          onRetry={() => {
            const lastUser = messages.map((message) => message.role).lastIndexOf('user')
            if (lastUser >= 0)
              void sendMessage(messages[lastUser].content, messages.slice(0, lastUser))
          }}
          onReply={(text) => {
            void sendMessage(text)
          }}
          labels={{
            jump: 'Zur neuesten Antwort',
            working: 'Daten werden abgerufen…',
            stop: 'Stoppen',
            stopped: 'Antwort gestoppt',
            retry: 'Erneut versuchen',
            failed: 'Anfrage fehlgeschlagen',
            copy: 'Kopieren',
            copied: 'Kopiert',
            listen: 'Anhören',
            share: 'Teilen',
          }}
          empty={
            isEmpty ? (
              <div className="flex flex-col items-center justify-center gap-6 text-center p-4">
                <div>
                  <p className="font-semibold text-ui-text">{AI_ASSISTANT_LABELS.componentTitle}</p>
                  <p className="text-sm text-ui-muted mt-1">
                    {AI_ASSISTANT_LABELS.componentSubtitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {AI_SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      onClick={() => {
                        void sendMessage(question)
                      }}
                      className="text-sm px-3 py-2 rounded-lg border border-ui-border hover:border-brand-primary text-ui-muted text-left"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : undefined
          }
        />
      </ChatScreen>
    </div>
  )
}
