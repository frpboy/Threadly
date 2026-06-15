"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface ArchivedPuzzle {
  id: string;
  title: string;
  difficulty: number;
  published_date: string;
  total_clues: number;
  first_clue: string;
}

export default function Archive() {
  const [puzzles, setPuzzles] = useState<ArchivedPuzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem("threadly_theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    fetch("/api/archive")
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
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("threadly_theme", newTheme);
  };

  const getDifficultyStars = (difficulty: number) => {
    return Array.from({ length: Math.min(difficulty, 5) }, (_, i) => "★").join("");
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-between p-4 bg-background text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="flex w-full max-w-2xl items-center justify-between py-4 border-b border-border-subtle mb-6">
        <Link href="/" className="flex items-center gap-3 group">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="filter drop-shadow-[0_0_6px_rgba(255,69,0,0.6)]">
            <circle cx="12" cy="5" r="2.5" fill="#FF4500" />
            <circle cx="5" cy="18" r="2.5" fill="#FF4500" />
            <circle cx="19" cy="18" r="2.5" fill="#FF4500" />
            <line x1="12" y1="7.5" x2="6.5" y2="15.5" />
            <line x1="12" y1="7.5" x2="17.5" y2="15.5" />
            <line x1="7.5" y1="18" x2="16.5" y2="18" />
          </svg>
          <span className="text-xl font-bold tracking-wider text-[#FF4500] uppercase">THREADLY</span>
        </Link>
        
        <div className="flex items-center gap-2">
          {/* Theme Switcher Button */}
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-sm transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          
          <Link 
            href="/"
            className="px-4 py-2 flex items-center justify-center rounded-xl bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-xs font-bold text-[#FF4500] hover:text-foreground transition-all cursor-pointer uppercase tracking-wider"
          >
            Daily Play
          </Link>
        </div>
      </header>

      {/* Main Grid Area */}
      <main className="flex-1 w-full max-w-2xl flex flex-col justify-start gap-6 py-4">
        <div className="flex flex-col gap-1 mb-2">
          <h2 className="text-xl font-extrabold tracking-wide">PUZZLE ARCHIVE</h2>
          <p className="text-xs text-foreground/40 uppercase font-semibold">Play past daily connections you might have missed</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="w-12 h-12 rounded-full bg-background shadow-neumorphic-inset border border-border-subtle flex items-center justify-center relative">
              <div className="w-8 h-8 rounded-full border-3 border-transparent border-t-[#FF4500] border-r-[#FF4500]/30 animate-spin absolute filter drop-shadow-[0_0_6px_rgba(255,69,0,0.6)]" />
            </div>
            <span className="text-xs font-bold tracking-widest text-[#FF4500] uppercase animate-pulse">Unraveling Archive...</span>
          </div>
        ) : puzzles.length === 0 ? (
          <div className="text-center py-20 rounded-2xl bg-background shadow-neumorphic-outset border border-border-subtle text-foreground/40 font-bold text-sm">
            No past puzzles found in the archive deck.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {puzzles.map((puzzle) => (
              <div 
                key={puzzle.id}
                className="p-5 rounded-2xl bg-background shadow-neumorphic-outset border border-border-subtle flex flex-col justify-between gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold tracking-wider text-foreground/30 uppercase">
                    <span>{new Date(puzzle.published_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                    <span className="text-yellow-500">{getDifficultyStars(puzzle.difficulty)}</span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground/80 uppercase truncate">{puzzle.title}</h3>
                  <div className="p-3 mt-1 rounded-xl bg-background shadow-neumorphic-inset border border-border-subtle flex gap-3 items-center">
                    <span className="text-[10px] font-extrabold text-[#FF4500] uppercase">First clue</span>
                    <span className="text-xs font-medium truncate text-foreground/75">"{puzzle.first_clue}"</span>
                  </div>
                </div>

                <Link 
                  href={`/archive/${puzzle.id}`}
                  className="w-full py-2.5 text-center bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-xs font-bold rounded-xl text-foreground/80 hover:text-[#FF4500] uppercase tracking-wider transition-all"
                >
                  Play Puzzle
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-2xl text-center py-4 border-t border-border-subtle text-xs text-foreground/20 mt-6">
        Threadly — Think Like The Internet • Daily Puzzle Game
      </footer>
    </div>
  );
}
