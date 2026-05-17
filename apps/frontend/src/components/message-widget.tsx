import { useState, useMemo } from 'react'
import { MessageSquare, X, Search, PenSquare, ChevronRight, ArrowLeft, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  from: 'me' | 'them'
  text: string
  time: string
}

interface Conversation {
  id: string
  name: string
  role: string
  initials: string
  avatarColor: string
  lastMessage: string
  time: string
  unread: number
  messages: Message[]
}

// ── Placeholder data ──────────────────────────────────────────────────────────

const CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    name: 'LGU Admin — Butuan City',
    role: 'LGU Administrator',
    initials: 'BC',
    avatarColor: 'bg-blue-500/20 text-blue-400',
    lastMessage: 'The zoning data has been updated for Q2.',
    time: '9:41 AM',
    unread: 2,
    messages: [
      { id: 'm1', from: 'them', text: 'Good morning! The updated zoning map for the commercial district is now available.', time: '9:38 AM' },
      { id: 'm2', from: 'them', text: 'The zoning data has been updated for Q2.', time: '9:41 AM' },
    ],
  },
  {
    id: '2',
    name: 'Investment Office',
    role: 'City Investment Desk',
    initials: 'IO',
    avatarColor: 'bg-emerald-500/20 text-emerald-400',
    lastMessage: 'Your inquiry about Lot 24-B has been received.',
    time: 'Yesterday',
    unread: 0,
    messages: [
      { id: 'm1', from: 'me', text: 'Hi, I would like to inquire about the commercial lot availability near the port area.', time: 'Yesterday 2:10 PM' },
      { id: 'm2', from: 'them', text: 'Your inquiry about Lot 24-B has been received.', time: 'Yesterday 3:05 PM' },
    ],
  },
  {
    id: '3',
    name: 'BizNest Support',
    role: 'Platform Support',
    initials: 'BN',
    avatarColor: 'bg-violet-500/20 text-violet-400',
    lastMessage: 'Welcome to BizNest! Let us know if you need help.',
    time: 'Mon',
    unread: 0,
    messages: [
      { id: 'm1', from: 'them', text: 'Welcome to BizNest! Let us know if you need any help navigating the platform.', time: 'Mon 8:00 AM' },
    ],
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ initials, colorClass, size = 'md' }: { initials: string; colorClass: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn(
      'shrink-0 rounded-full flex items-center justify-center font-semibold',
      colorClass,
      size === 'md' ? 'size-9 text-xs' : 'size-7 text-[10px]',
    )}>
      {initials}
    </div>
  )
}

function ConversationThread({
  conversation,
  onBack,
}: {
  conversation: Conversation
  onBack: () => void
}) {
  const [draft, setDraft] = useState('')

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <Avatar initials={conversation.initials} colorClass={conversation.avatarColor} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{conversation.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{conversation.role}</div>
        </div>
      </div>

      <Separator className="shrink-0" />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-3 space-y-3">
          {conversation.messages.map(msg => (
            <div
              key={msg.id}
              className={cn('flex gap-2', msg.from === 'me' ? 'flex-row-reverse' : 'flex-row')}
            >
              {msg.from === 'them' && (
                <Avatar initials={conversation.initials} colorClass={conversation.avatarColor} size="sm" />
              )}
              <div className={cn(
                'max-w-[75%] space-y-0.5',
                msg.from === 'me' ? 'items-end' : 'items-start',
                'flex flex-col',
              )}>
                <div className={cn(
                  'rounded-2xl px-3 py-2 text-[11px] leading-relaxed',
                  msg.from === 'me'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm',
                )}>
                  {msg.text}
                </div>
                <span className="text-[9px] text-muted-foreground px-1">{msg.time}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Separator className="shrink-0" />

      {/* Compose */}
      <div className="px-3 py-2.5 shrink-0 flex items-center gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="h-8 text-xs bg-muted/50 border-transparent focus-visible:border-border"
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) setDraft('') }}
        />
        <Button
          size="icon"
          className="size-8 shrink-0"
          disabled={!draft.trim()}
          onClick={() => setDraft('')}
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ConversationList({
  query,
  onSelect,
}: {
  query: string
  onSelect: (c: Conversation) => void
}) {
  const filtered = useMemo(
    () => CONVERSATIONS.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(query.toLowerCase())
    ),
    [query],
  )

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-6 py-12">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center">
          <MessageSquare className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">No conversations found</p>
          <p className="text-[11px] text-muted-foreground">
            {query ? 'Try a different search term.' : 'Start a conversation to get in touch.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="py-1">
        {filtered.map((c, i) => (
          <div key={c.id}>
            {i > 0 && <Separator className="mx-3 opacity-50" />}
            <button
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="relative shrink-0">
                <Avatar initials={c.initials} colorClass={c.avatarColor} />
                {c.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-xs font-semibold truncate', c.unread > 0 ? 'text-foreground' : 'text-foreground/80')}>
                    {c.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{c.time}</span>
                </div>
                <p className={cn(
                  'text-[11px] truncate mt-0.5 leading-tight',
                  c.unread > 0 ? 'text-foreground/80' : 'text-muted-foreground',
                )}>
                  {c.lastMessage}
                </p>
              </div>
              <ChevronRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

const TOTAL_UNREAD = CONVERSATIONS.reduce((sum, c) => sum + c.unread, 0)

export function MessageWidget() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<Conversation | null>(null)

  function handleOpen() {
    setOpen(true)
    setActive(null)
    setQuery('')
  }

  function handleClose() {
    setOpen(false)
    setActive(null)
    setQuery('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">

      {/* Panel */}
      <div className={cn(
        'pointer-events-auto w-80 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden',
        'transition-all duration-200 origin-bottom-right',
        open
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 translate-y-2 pointer-events-none',
      )}
        style={{ height: '460px' }}
      >
        {active ? (
          <ConversationThread
            conversation={active}
            onBack={() => setActive(null)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Messages</span>
                {TOTAL_UNREAD > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {TOTAL_UNREAD}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 -mr-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {}}
                >
                  <PenSquare className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={handleClose}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="px-3 pb-2.5 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search messages…"
                  className="h-7 pl-7 text-xs bg-muted/50 border-transparent focus-visible:border-border"
                />
              </div>
            </div>

            <Separator className="shrink-0" />

            {/* Conversation list */}
            <ConversationList query={query} onSelect={setActive} />

            <Separator className="shrink-0" />

            {/* Footer */}
            <div className="px-3 py-2.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1.5"
                onClick={() => {}}
              >
                <PenSquare className="size-3" />
                New conversation
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Trigger button */}
      <button
        onClick={open ? handleClose : handleOpen}
        className={cn(
          'pointer-events-auto relative flex items-center justify-center rounded-xl transition-all duration-150 shadow-2xl border',
          'size-11',
          open
            ? 'bg-primary text-primary-foreground border-primary/50 scale-95'
            : 'bg-black/65 backdrop-blur-md border-white/10 text-white/70 hover:text-white hover:bg-black/75',
        )}
        aria-label={open ? 'Close messages' : 'Open messages'}
      >
        <MessageSquare className="size-5" />
        {!open && TOTAL_UNREAD > 0 && (
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center border border-background">
            {TOTAL_UNREAD}
          </span>
        )}
      </button>
    </div>
  )
}
