"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface PuzzleItem {
  id: string;
  title: string;
  answer: string;
  difficulty: number;
  status: string;
  published_date: string | null;
  clues: string[];
}

export default function AdminDashboard() {
  const [puzzles, setPuzzles] = useState<PuzzleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    // Initialize theme from storage
    const savedTheme = localStorage.getItem("threadly_theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    fetchPuzzles();
  }, []);

  const fetchPuzzles = () => {
    fetch("/api/admin/puzzles")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setPuzzles(data.puzzles || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-ai", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        fetchPuzzles();
      } else {
        alert("Generation failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      alert("Network error generating puzzle");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzle_id: id,
          publish_date: today
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchPuzzles();
      } else {
        alert("Publish failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      alert("Network error publishing puzzle");
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("threadly_theme", newTheme);
  };

  const drafts = puzzles.filter(p => p.status === "draft");
  const published = puzzles.filter(p => p.status === "published");

  return (
    <div className="flex flex-col min-h-screen items-center justify-between p-4 bg-background text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="flex w-full max-w-4xl items-center justify-between py-4 border-b border-border-subtle mb-6">
        <Link href="/" className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="filter drop-shadow-[0_0_6px_rgba(255,69,0,0.6)]">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm font-bold tracking-wider text-[#FF4500] uppercase">Dashboard Home</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-sm transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 w-full max-w-4xl flex flex-col justify-start gap-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-subtle pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-extrabold tracking-wide uppercase">Threadly Moderation Console</h2>
            <p className="text-xs text-foreground/40 font-semibold uppercase">Schedule, audit, and orchestrate daily connections</p>
          </div>
          
          <button
            onClick={handleGenerateAI}
            disabled={generating}
            className="px-5 py-3 flex items-center gap-3 bg-[#FF4500] hover:bg-[#ff5714] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(255,69,0,0.3)] hover:shadow-[0_0_20px_rgba(255,69,0,0.5)] active:scale-95 disabled:opacity-50 transition-all text-xs uppercase tracking-wider cursor-pointer"
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-transparent border-t-white animate-spin rounded-full" />
            ) : "🤖"}
            <span>Generate connection with Gemini AI</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-background shadow-neumorphic-outset border border-border-subtle text-center">
            <div className="text-xs text-foreground/45 uppercase font-bold">Total Puzzles</div>
            <div className="text-xl font-black text-[#FF4500] mt-1">{puzzles.length}</div>
          </div>
          <div className="p-4 rounded-xl bg-background shadow-neumorphic-outset border border-border-subtle text-center">
            <div className="text-xs text-foreground/45 uppercase font-bold">Draft Queue</div>
            <div className="text-xl font-black text-[#FF4500] mt-1">{drafts.length}</div>
          </div>
          <div className="p-4 rounded-xl bg-background shadow-neumorphic-outset border border-border-subtle text-center">
            <div className="text-xs text-foreground/45 uppercase font-bold">Active Scheduled</div>
            <div className="text-xl font-black text-[#FF4500] mt-1">{published.length}</div>
          </div>
          <div className="p-4 rounded-xl bg-background shadow-neumorphic-outset border border-border-subtle text-center">
            <div className="text-xs text-foreground/45 uppercase font-bold">Difficulty Avg</div>
            <div className="text-xl font-black text-[#FF4500] mt-1">
              {puzzles.length > 0 
                ? (puzzles.reduce((acc, curr) => acc + curr.difficulty, 0) / puzzles.length).toFixed(1)
                : "0"}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-20 gap-5">
            <div className="w-12 h-12 rounded-full bg-background shadow-neumorphic-inset border border-border-subtle flex items-center justify-center relative">
              <div className="w-8 h-8 rounded-full border-3 border-transparent border-t-[#FF4500] border-r-[#FF4500]/30 animate-spin absolute" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF4500] animate-pulse">Accessing Console...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            {/* Moderation Queue Section */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black tracking-widest text-[#FF4500] uppercase border-b border-border-subtle pb-2">Draft Queue ({drafts.length})</h3>
              {drafts.length === 0 ? (
                <p className="text-xs text-foreground/40 italic py-10 text-center rounded-xl bg-background shadow-neumorphic-inset border border-border-subtle">
                  Draft queue is empty. Click AI Generator above!
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {drafts.map(p => (
                    <div key={p.id} className="p-5 rounded-2xl bg-background shadow-neumorphic-outset border border-border-subtle flex flex-col gap-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-foreground/30 uppercase">
                        <span>Draft Connection</span>
                        <span>Diff: {p.difficulty}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-foreground/40 font-bold uppercase">Clues</span>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {p.clues.map((c, i) => (
                            <span key={i} className="px-2.5 py-1 text-[10px] rounded-lg bg-background shadow-neumorphic-inset border border-border-subtle text-foreground/75 font-semibold">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-3 border-t border-border-subtle">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-foreground/40 font-bold uppercase">Answer Connection</span>
                          <span className="text-xs font-black text-[#FF4500] uppercase">{p.answer}</span>
                        </div>
                        <button
                          onClick={() => handlePublish(p.id)}
                          className="px-3 py-2 bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-[10px] font-bold rounded-lg text-foreground hover:text-[#46D160] uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Approve Today
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Published / Scheduled Section */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black tracking-widest text-[#FF4500] uppercase border-b border-border-subtle pb-2">Active Deck ({published.length})</h3>
              {published.length === 0 ? (
                <p className="text-xs text-foreground/40 italic py-10 text-center rounded-xl bg-background shadow-neumorphic-inset border border-border-subtle">
                  No active/published puzzles in deck database.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {published.map(p => (
                    <div key={p.id} className="p-5 rounded-2xl bg-background shadow-neumorphic-outset border border-border-subtle flex flex-col gap-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-foreground/30 uppercase">
                        <span>Published</span>
                        <span>{p.published_date ? new Date(p.published_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : "Unscheduled"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-foreground/40 font-bold uppercase">Puzzle Connection</span>
                        <span className="text-xs font-bold text-foreground/80 uppercase">{p.title}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-3 border-t border-border-subtle text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-foreground/40 font-bold uppercase">Solution</span>
                          <span className="text-xs font-black text-[#FF4500] uppercase">{p.answer}</span>
                        </div>
                        <span className="text-[10px] px-2 py-1 bg-[#46D160]/10 text-[#46D160] rounded-lg font-bold uppercase">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-4 border-t border-border-subtle text-xs text-foreground/20 mt-6">
        Threadly — Think Like The Internet • Daily Puzzle Game
      </footer>
    </div>
  );
}
