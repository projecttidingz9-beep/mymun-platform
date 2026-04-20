"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";

interface Resolution {
  id: string;
  title: string;
  content: string;
  committee: string;
  country: string;
  updatedAt: string;
}

const AI_PROMPTS = [
  {
    id: "preambulatory",
    label: "Suggest Preambulatory Clauses",
    emoji: "📜",
    color: "#2563eb",
    generate: (content: string, country: string) =>
      `Based on your resolution on "${content.slice(0, 50)}...", here are suggested preambulatory clauses for ${country || "your country"}:\n\n` +
      `• **Recalling** resolution 2758 (XXVI) of the General Assembly...\n` +
      `• **Recognizing** the inherent rights of all member states under international law...\n` +
      `• **Deeply concerned** by the humanitarian implications of the current situation...\n` +
      `• **Acknowledging** the efforts of regional organizations to address this crisis...\n` +
      `• **Affirming** the principles of sovereignty and non-interference...\n\n` +
      `These clauses establish legal precedent and signal your country's stance. Customize each to fit your specific topic.`,
  },
  {
    id: "operative",
    label: "Draft Operative Clauses",
    emoji: "⚙️",
    color: "#7c3aed",
    generate: () =>
      `Here are operative clauses to strengthen your resolution:\n\n` +
      `1. **Calls upon** all member states to cooperate fully with the established framework...\n` +
      `2. **Urges** the Secretary-General to appoint a Special Envoy to facilitate dialogue...\n` +
      `3. **Requests** the relevant UN bodies to submit quarterly progress reports...\n` +
      `4. **Encourages** voluntary contributions from member states to the designated trust fund...\n` +
      `5. **Decides** to remain seized of the matter and convene a review session within 6 months...\n\n` +
      `Note: Use strong verbs like "Demands" and "Decides" for binding clauses if in UNSC. Use "Urges" and "Encourages" for General Assembly resolutions.`,
  },
  {
    id: "strengthen",
    label: "Strengthen My Arguments",
    emoji: "💪",
    color: "#059669",
    generate: (content: string, country: string) =>
      `Analysis of your current draft for ${country || "your delegation"}:\n\n` +
      `**Strengths:**\n• Clear identification of the problem statement\n• Reference to existing international frameworks\n\n` +
      `**Suggested Improvements:**\n\n` +
      `1. **Add a perambulatory clause** citing a specific UNGA resolution or treaty to establish precedent.\n\n` +
      `2. **Quantify your goals** — instead of "improve access," use "increase access by 30% within 5 years."\n\n` +
      `3. **Include a funding mechanism** — resolutions without budget proposals are less likely to pass. Suggest a trust fund or voluntary contributions.\n\n` +
      `4. **Reference country-specific data** — citing UN reports, World Bank statistics, or WHO data adds credibility.\n\n` +
      `5. **Add an accountability clause** — regular reporting deadlines demonstrate enforceability.`,
  },
  {
    id: "policy",
    label: "Country Policy Check",
    emoji: "🏳️",
    color: "#d97706",
    generate: (content: string, country: string) => {
      const c = country || "Your Country";
      return `**Policy Alignment Report for ${c}:**\n\n` +
        `📊 **Voting History on Similar Issues:**\n` +
        `${c} has historically voted in favor of multilateral solutions and international cooperation frameworks. Based on UN voting records, your country typically supports resolutions with strong monitoring mechanisms.\n\n` +
        `⚠️ **Potential Conflicts:**\n` +
        `• Clause 2 may conflict with ${c}'s position on national sovereignty — consider softening "mandates" to "encourages"\n` +
        `• Funding ask of $500M may exceed typical contribution commitments — propose a tiered system\n\n` +
        `✅ **Aligned With National Policy:**\n` +
        `• Support for multilateral institutions ✓\n• Climate-related provisions align with national NDCs ✓\n• Human rights language consistent with treaty commitments ✓\n\n` +
        `💡 **Recommendation:** Adjust operative clause 3 to "invites" instead of "demands" to better reflect ${c}'s diplomatic tradition.`;
    }
  },
];

const DEFAULT_CONTENT = `FORUM: United Nations General Assembly (UNGA)
QUESTION OF: Universal Access to Clean Water
SUBMITTED BY: [Your Country]
CO-SUBMITTED BY: [List allies here]

The General Assembly,

[Add your preambulatory clauses here — click "Suggest Preambulatory Clauses" for AI help]

[Preambulatory verbs: Recalling, Recognizing, Noting, Affirming, Concerned by...]

[Add your operative clauses here — click "Draft Operative Clauses" for AI help]

[Operative verbs: Calls upon, Urges, Encourages, Requests, Decides, Demands...]

`;

export default function ResolutionCopilotPage() {
  const { user, isLoggedIn } = useAuth();
  const [resolutions, setResolutions] = useState<Resolution[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("tidingz_resolutions") || "[]"); } catch { return []; }
    }
    return [];
  });
  const [activeId, setActiveId] = useState<string | null>(resolutions[0]?.id ?? null);
  const [content, setContent] = useState(resolutions[0]?.content ?? DEFAULT_CONTENT);
  const [title, setTitle] = useState(resolutions[0]?.title ?? "Untitled Resolution");
  const [committee, setCommittee] = useState(resolutions[0]?.committee ?? "");
  const [country, setCountry] = useState(resolutions[0]?.country ?? (user?.country ?? ""));
  const [aiOutput, setAiOutput] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiOutputRef = useRef<HTMLDivElement>(null);

  const saveResolutions = (resos: Resolution[]) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tidingz_resolutions", JSON.stringify(resos));
    }
  };

  const newResolution = () => {
    const id = "res-" + Date.now();
    const r: Resolution = {
      id,
      title: "Untitled Resolution",
      content: DEFAULT_CONTENT,
      committee: "",
      country: user?.country ?? "",
      updatedAt: new Date().toLocaleString(),
    };
    const updated = [r, ...resolutions];
    setResolutions(updated);
    saveResolutions(updated);
    setActiveId(id);
    setContent(r.content);
    setTitle(r.title);
    setCommittee(r.committee);
    setCountry(r.country);
    setAiOutput("");
  };

  const saveCurrentResolution = () => {
    if (!activeId) {
      // Create if none exist
      const id = "res-" + Date.now();
      const r: Resolution = { id, title, content, committee, country, updatedAt: new Date().toLocaleString() };
      const updated = [r, ...resolutions];
      setResolutions(updated);
      saveResolutions(updated);
      setActiveId(id);
    } else {
      const updated = resolutions.map(r =>
        r.id === activeId ? { ...r, title, content, committee, country, updatedAt: new Date().toLocaleString() } : r
      );
      setResolutions(updated);
      saveResolutions(updated);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const deleteResolution = (id: string) => {
    const updated = resolutions.filter(r => r.id !== id);
    setResolutions(updated);
    saveResolutions(updated);
    if (activeId === id) {
      if (updated.length > 0) {
        setActiveId(updated[0].id);
        setContent(updated[0].content);
        setTitle(updated[0].title);
        setCommittee(updated[0].committee);
        setCountry(updated[0].country);
      } else {
        setActiveId(null);
        setContent(DEFAULT_CONTENT);
        setTitle("Untitled Resolution");
      }
    }
  };

  const loadResolution = (r: Resolution) => {
    setActiveId(r.id);
    setContent(r.content);
    setTitle(r.title);
    setCommittee(r.committee);
    setCountry(r.country);
    setAiOutput("");
  };

  const runAiPrompt = async (prompt: typeof AI_PROMPTS[0]) => {
    setAiLoading(true);
    setActivePrompt(prompt.id);
    setAiOutput("");
    await new Promise(r => setTimeout(r, 600));
    const result = prompt.generate(content, country);
    // Typewriter effect
    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setAiOutput(result.slice(0, i));
      if (i >= result.length) {
        clearInterval(interval);
        setAiLoading(false);
        aiOutputRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 8);
  };

  const downloadResolution = () => {
    const blob = new Blob([`${title}\n${"=".repeat(title.length)}\n\n${content}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format selected text bold
  const insertFormat = (format: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    let newText = content;
    if (format === "**") {
      newText = content.slice(0, start) + `**${selected}**` + content.slice(end);
    } else if (format === "underline") {
      newText = content.slice(0, start) + `_${selected}_` + content.slice(end);
    } else if (format === "clause") {
      newText = content.slice(0, start) + `\n${selected || "Calls upon all member states to..."}\n` + content.slice(end);
    }
    setContent(newText);
  };

  // Render AI output with markdown-like bold
  const renderAIOutput = (text: string) => {
    return text.split("\n").map((line, i) => {
      const rendered = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rendered || "&nbsp;" }} />;
    });
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-[72px] flex" style={{ background: "var(--bg)" }}>
        {/* Sidebar */}
        <aside
          className="w-64 flex-shrink-0 flex flex-col border-r h-[calc(100vh-72px)] sticky top-[72px] overflow-y-auto hidden lg:flex"
          style={{ background: "var(--bg-subtle)", borderColor: "var(--border)" }}
        >
          <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
            <button onClick={newResolution} className="btn btn-primary w-full text-sm" style={{ padding: "10px", borderRadius: "10px" }}>
              + New Resolution
            </button>
          </div>
          <div className="flex-1 p-3 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest px-2 py-2" style={{ color: "var(--fg-muted)" }}>
              Saved Resolutions
            </p>
            {resolutions.length === 0 && (
              <p className="text-xs px-2" style={{ color: "var(--fg-muted)" }}>No resolutions yet. Create one!</p>
            )}
            {resolutions.map((r) => (
              <div key={r.id} className="group relative">
                <button
                  onClick={() => loadResolution(r)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={{
                    background: activeId === r.id ? "var(--blue-subtle)" : "transparent",
                    color: activeId === r.id ? "var(--blue)" : "var(--fg-muted)",
                    fontWeight: activeId === r.id ? 700 : 500,
                  }}
                >
                  <p className="truncate">{r.title}</p>
                  <p className="text-[10px] mt-0.5 opacity-60">{r.updatedAt}</p>
                </button>
                <button
                  onClick={() => deleteResolution(r.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {!isLoggedIn && (
            <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs text-center mb-2" style={{ color: "var(--fg-muted)" }}>
                Sign in to sync resolutions
              </p>
              <Link href="/" className="btn btn-outline-blue w-full text-xs" style={{ padding: "8px", borderRadius: "8px" }}>
                Sign In →
              </Link>
            </div>
          )}
        </aside>

        {/* Main editor */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Editor area */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div
              className="px-6 py-3 border-b flex items-center gap-3 flex-wrap"
              style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            >
              {/* Title */}
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="font-bold text-base bg-transparent outline-none flex-1 min-w-0"
                style={{ color: "var(--fg)" }}
                placeholder="Resolution Title"
              />
              <div className="flex items-center gap-2">
                {/* Format buttons */}
                <button onClick={() => insertFormat("**")} className="btn btn-ghost text-xs px-3 py-1.5 font-bold" style={{ borderRadius: "8px" }}>B</button>
                <button onClick={() => insertFormat("underline")} className="btn btn-ghost text-xs px-3 py-1.5 italic" style={{ borderRadius: "8px" }}>I</button>
                <div style={{ background: "var(--border)", width: "1px", height: "20px" }} />
                <input
                  value={committee}
                  onChange={e => setCommittee(e.target.value)}
                  className="input-base text-xs"
                  style={{ padding: "6px 10px", borderRadius: "8px", width: "130px" }}
                  placeholder="Committee (e.g. UNSC)"
                />
                <input
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="input-base text-xs"
                  style={{ padding: "6px 10px", borderRadius: "8px", width: "120px" }}
                  placeholder="Country"
                />
                <div style={{ background: "var(--border)", width: "1px", height: "20px" }} />
                <button onClick={saveCurrentResolution} className="btn btn-primary text-xs" style={{ padding: "7px 14px", borderRadius: "8px" }}>
                  {saved ? "✓ Saved" : "Save"}
                </button>
                <button onClick={downloadResolution} className="btn btn-ghost text-xs" style={{ padding: "7px 10px", borderRadius: "8px" }}>⬇️</button>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 p-6 resize-none outline-none font-mono text-sm leading-relaxed"
              style={{
                background: "var(--bg)",
                color: "var(--fg)",
                minHeight: "300px",
                maxHeight: "calc(100vh - 180px)",
              }}
              placeholder="Start typing your resolution..."
              spellCheck
            />
          </div>

          {/* AI Panel */}
          <div
            className="w-full lg:w-[380px] flex-shrink-0 flex flex-col border-l overflow-y-auto"
            style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", maxHeight: "calc(100vh - 72px)" }}
          >
            <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                >
                  ✨
                </div>
                <h3 className="font-bold text-sm" style={{ color: "var(--fg)" }}>AI Resolution Copilot</h3>
              </div>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                Select a prompt to get AI assistance
              </p>
            </div>

            <div className="p-4 space-y-2.5">
              {AI_PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => runAiPrompt(prompt)}
                  disabled={aiLoading}
                  className="w-full text-left p-4 rounded-xl border transition-all"
                  style={{
                    background: activePrompt === prompt.id ? prompt.color + "10" : "var(--bg)",
                    borderColor: activePrompt === prompt.id ? prompt.color : "var(--border)",
                    opacity: aiLoading && activePrompt !== prompt.id ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{prompt.emoji}</span>
                    <span className="text-sm font-semibold" style={{ color: activePrompt === prompt.id ? prompt.color : "var(--fg)" }}>
                      {prompt.label}
                    </span>
                    {aiLoading && activePrompt === prompt.id && (
                      <span className="ml-auto w-4 h-4 border-2 border-current border-t-transparent rounded-full inline-block" style={{ animation: "spin 0.8s linear infinite", color: prompt.color }} />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* AI Output */}
            {aiOutput && (
              <div
                ref={aiOutputRef}
                className="mx-4 mb-4 p-5 rounded-xl text-xs space-y-1 leading-relaxed"
                style={{
                  background: "var(--bg)",
                  border: "1.5px solid var(--border)",
                  color: "var(--fg)",
                }}
              >
                <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px]"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                  >✨</span>
                  <span className="font-bold text-xs" style={{ color: "var(--fg)" }}>AI Suggestion</span>
                </div>
                {renderAIOutput(aiOutput)}
                <button
                  onClick={() => {
                    const clean = aiOutput.replace(/\*\*(.*?)\*\*/g, "$1");
                    setContent(prev => prev + "\n\n" + clean);
                  }}
                  className="btn btn-outline-blue w-full mt-3 text-xs"
                  style={{ padding: "8px", borderRadius: "8px" }}
                >
                  Insert into Resolution ↑
                </button>
              </div>
            )}

            <div className="px-4 pb-4">
              <div
                className="p-4 rounded-xl text-xs"
                style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}
              >
                <p className="font-bold mb-1" style={{ color: "#7c3aed" }}>💡 Pro Tips</p>
                <ul className="space-y-1" style={{ color: "var(--fg-muted)" }}>
                  <li>• Select text before clicking AI to get targeted suggestions</li>
                  <li>• Fill in Country for policy-aligned responses</li>
                  <li>• Download your resolution as .txt for offline editing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
