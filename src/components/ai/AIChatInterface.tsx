'use client'

import { Markdown } from '@bitbaum/chatkit/react'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { UI_LABELS, AI_ASSISTANT_LABELS, AI_SUGGESTED_QUESTIONS } from '@/lib/constants/labels'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AIChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Abort any in-flight stream on unmount to prevent setState-on-unmounted leaks
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)
    setStreamingText('')
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
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

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (!reader) throw new Error('No reader')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (!data.trim()) continue

          try {
            const event = JSON.parse(data) as { type: string; text?: string; message?: string }
            if (event.type === 'text' && event.text) {
              accumulated += event.text
              setStreamingText(accumulated)
            } else if (event.type === 'error') {
              accumulated = event.message ?? 'Ein Fehler ist aufgetreten.'
              setStreamingText(accumulated)
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }

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
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setStreaming(false)
      setStreamingText('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0 && !streaming

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="icon-container-lg bg-brand-primary/10">
              <Bot className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <p className="font-semibold text-ui-text">{AI_ASSISTANT_LABELS.componentTitle}</p>
              <p className="text-sm text-ui-muted mt-1">{AI_ASSISTANT_LABELS.componentSubtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {AI_SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-sm px-3 py-2 rounded-lg border border-ui-border hover:border-brand-primary hover:text-brand-primary hover:bg-brand-accent transition-colors text-ui-muted text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            onReply={i === messages.length - 1 && !streaming ? sendMessage : undefined}
          />
        ))}

        {streaming && (
          <div className="flex gap-3">
            <div className="icon-container-sm shrink-0 bg-brand-primary/10">
              <Bot className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {streamingText ? (
                <div className="prose prose-sm max-w-none text-ui-text whitespace-pre-wrap">
                  <Markdown text={streamingText} />
                  <span className="inline-block w-1 h-4 bg-brand-primary ml-0.5 animate-pulse align-middle" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-ui-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Daten werden abgerufen…
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 border-t border-ui-border pt-4">
        {error && (
          <p role="alert" className="alert-error mb-3">
            {error}
          </p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={UI_LABELS.aiChatPlaceholder}
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none input py-2.5 text-sm min-h-[44px] max-h-32 overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="btn btn-primary shrink-0 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={UI_LABELS.sendMessage}
          >
            {streaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{UI_LABELS.aiChatSend}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  onReply,
}: {
  message: Message
  onReply?: (text: string) => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`icon-container-sm shrink-0 ${isUser ? 'bg-brand-secondary/10' : 'bg-brand-primary/10'}`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-brand-secondary" />
        ) : (
          <Bot className="w-4 h-4 text-brand-primary" />
        )}
      </div>
      <div
        className={`flex-1 min-w-0 rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-brand-secondary text-ui-on-accent max-w-[80%] ml-auto'
            : 'bg-ui-subtle text-ui-text border border-ui-border'
        }`}
      >
        <div>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown text={message.content} onReply={onReply} />
          )}
        </div>
      </div>
    </div>
  )
}
