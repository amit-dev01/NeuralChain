import { useState, useRef, useEffect } from "react"
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Zap,
} from "lucide-react"
import { askAICopilot } from "@/api/client"
import { Badge } from "@/components/ui/badge"

const SAMPLE_PROMPTS = [
  "Explain peel chain layering heuristics and cash-out patterns.",
  "What mathematical indicators distinguish tumbler mixing from organic wallet spends?",
  "Draft a formal evidence attribution section under Section 63 BSA / Section 94 BNSS.",
  "How should investigators prioritize multi-hop clusters with >0.85 risk scores?",
]

export default function AICopilotDrawer({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Greetings, Investigator. I am the **NeuralChain AI Forensic Copilot**, powered by **Gemma 4** (`gemma-4-26b-a4b-it`). I can analyze transaction flows, interpret SHAP feature attributions, decode peel chains, and draft court-admissible forensic dossiers. How can I assist your investigation?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, isOpen])

  const handleSend = async (textToSend) => {
    const promptText = textToSend || input
    if (!promptText.trim() || isLoading) return

    const userMsg = {
      role: "user",
      content: promptText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    try {
      const res = await askAICopilot(promptText.trim())
      const assistantMsg = {
        role: "assistant",
        content: res.response || "No response received.",
        modelUsed: res.model_used || "gemma-4-26b-a4b-it",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errMsg = {
        role: "assistant",
        content: `⚠️ Error contacting Gemma 4: ${err.message}. Please verify backend status.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col relative overflow-hidden">
        {/* Subtle Ambient Background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-medium text-white tracking-wide">
                  Forensic Co-Pilot
                </h2>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30 font-mono">
                  Gemma 4 MoE
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                Autonomous Blockchain Intelligence & Typology Reasoning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-10 scrollbar-thin scrollbar-thumb-zinc-800">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-xs leading-relaxed ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 border shadow-sm ${
                  m.role === "user"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-100 rounded-br-none"
                    : m.isError
                    ? "bg-red-950/40 border-red-500/40 text-red-200 rounded-bl-none"
                    : "bg-slate-900/80 border-white/10 text-zinc-200 rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap select-text">{m.content}</div>
                <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{m.timestamp}</span>
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-2">
                      {m.modelUsed && <span>{m.modelUsed}</span>}
                      <button
                        onClick={() => handleCopy(m.content, idx)}
                        className="hover:text-zinc-300 transition-colors"
                        title="Copy text"
                      >
                        {copiedIdx === idx ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {m.role === "user" && (
                <div className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 text-xs leading-relaxed">
              <div className="h-7 w-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-slate-900/80 border border-white/10 text-zinc-400 rounded-2xl px-4 py-3 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
                <span className="font-mono text-[11px]">Gemma 4 is synthesizing forensic telemetry...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Sample Prompts */}
        <div className="px-6 py-2 border-t border-white/5 bg-slate-950/90 overflow-x-auto flex gap-2 no-scrollbar relative z-10">
          {SAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={isLoading}
              className="text-[11px] whitespace-nowrap bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-200 border border-white/5 rounded-full px-3 py-1 transition-all shrink-0"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-md relative z-10">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Gemma 4 about wallet traces, peel chains, or legal briefs..."
              disabled={isLoading}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Query</span>
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Official SIH26146 Forensic Intelligence Model</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Inference
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
