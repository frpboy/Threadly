"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Clue {
  order: number;
  text: string;
}

export default function PlayArchiveItem() {
  const { id } = useParams();
  const [puzzleId, setPuzzleId] = useState("");
  const [puzzleTitle, setPuzzleTitle] = useState("Loading Puzzle...");
  const [systemClues, setSystemClues] = useState<Clue[]>([]);
  const [cluesRevealed, setCluesRevealed] = useState(1);
  const [totalClues, setTotalClues] = useState(5);
  const [guessText, setGuessText] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [shake, setShake] = useState(false);
  const [streak, setStreak] = useState(12);
  const [score, setScore] = useState(0);
  const [showShareNotification, setShowShareNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [showHowTo, setShowHowTo] = useState(false);
  const [guestId, setGuestId] = useState("");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    // Generate or fetch guest ID
    let gId = localStorage.getItem("threadly_guest_id");
    if (!gId) {
      gId = typeof crypto.randomUUID === "function" 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("threadly_guest_id", gId);
    }
    setGuestId(gId);

    // Initialize theme from storage
    const savedTheme = localStorage.getItem("threadly_theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    if (id) {
      fetch(`/api/archive/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data) => {
          setPuzzleId(data.puzzle_id);
          setPuzzleTitle(data.title);
          setSystemClues(data.clues || []);
          setTotalClues(data.total_clues || 5);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setPuzzleTitle("Failed to load puzzle. Check connection parameters.");
          setLoading(false);
        });
    }

    // Load streak from localStorage if client-side
    const savedStreak = localStorage.getItem("threadly_streak");
    if (savedStreak) {
      setStreak(parseInt(savedStreak, 10));
    }
  }, [id]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("threadly_theme", newTheme);
  };

  const handleGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessText.trim() || isGameOver || !puzzleId) return;

    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzle_id: puzzleId,
          guess: guessText,
          clues_revealed: cluesRevealed,
          guest_id: guestId,
        }),
      });

      const result = await res.json();

      if (result.answer) {
        setCorrectAnswer(result.answer);
      }

      if (result.correct) {
        setIsCorrect(true);
        setIsGameOver(true);
        setScore(result.score_awarded);
        const newStreak = typeof result.streak === "number" ? result.streak : streak + 1;
        setStreak(newStreak);
        localStorage.setItem("threadly_streak", newStreak.toString());
      } else {
        const currentGuesses = [...guesses, guessText.trim()];
        setGuesses(currentGuesses);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setGuessText("");

        if (cluesRevealed < totalClues) {
          const nextOrder = cluesRevealed + 1;
          const clueRes = await fetch("/api/clue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              puzzle_id: puzzleId,
              requested_clue_order: nextOrder,
              guest_id: guestId,
            }),
          });
          
          if (clueRes.ok) {
            const clueData = await clueRes.json();
            setSystemClues([...systemClues, clueData]);
            setCluesRevealed(nextOrder);
          } else {
            console.error("Failed to load next clue securely");
          }
        } else {
          setIsGameOver(true);
        }
      }
    } catch (error) {
      console.error("Error submitting guess:", error);
    }
  };

  const handleShare = () => {
    const grid = Array.from({ length: 5 }, (_, i) => 
      i < cluesRevealed ? (isCorrect && i === cluesRevealed - 1 ? "🟩" : "⬛") : "⬜"
    ).join("");

    const shareText = `Threadly Archive Puzzle Play\nClues used: ${cluesRevealed}/5\n${grid}\nScore: ${score} pts\nPlay at threadly.vercel.app`;
    
    navigator.clipboard.writeText(shareText);
    setShowShareNotification(true);
    setTimeout(() => setShowShareNotification(false), 2000);
  };

  const resetGame = () => {
    setCluesRevealed(1);
    if (systemClues.length > 0) {
      setSystemClues([systemClues[0]]);
    }
    setGuesses([]);
    setIsCorrect(false);
    setIsGameOver(false);
    setGuessText("");
    setScore(0);
    setCorrectAnswer("");
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-between p-4 bg-background text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="flex w-full max-w-md items-center justify-between py-4 border-b border-border-subtle mb-6">
        <Link href="/archive" className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="filter drop-shadow-[0_0_6px_rgba(255,69,0,0.6)]">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm font-bold tracking-wider text-[#FF4500] uppercase">Back</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-sm transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <button 
            onClick={() => setShowHowTo(!showHowTo)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-sm font-bold text-foreground/60 hover:text-foreground transition-all cursor-pointer"
            title="How to Play"
          >
            ?
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-md flex flex-col justify-center gap-6">
        {showHowTo && (
          <div className="p-6 rounded-2xl bg-background shadow-neumorphic-outset border border-border-subtle flex flex-col gap-4 animate-[fadeIn_0.2s_ease-out]">
            <h3 className="text-lg font-bold text-[#FF4500]">How to Play</h3>
            <ul className="text-xs text-foreground/70 space-y-2.5 list-disc pl-4">
              <li>Find the connection linking the clues.</li>
              <li>A new clue is revealed on wrong guesses.</li>
            </ul>
            <button 
              onClick={() => setShowHowTo(false)}
              className="mt-2 py-2.5 bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed text-foreground/60 hover:text-foreground font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Got it!
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-5 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-background shadow-neumorphic-inset border border-border-subtle flex items-center justify-center relative">
              <div className="w-10 h-10 rounded-full border-3 border-transparent border-t-[#FF4500] border-r-[#FF4500]/30 animate-spin absolute filter drop-shadow-[0_0_6px_rgba(255,69,0,0.6)]" />
              <div className="w-4 h-4 rounded-full bg-background shadow-neumorphic-button" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-sm font-bold tracking-widest text-[#FF4500] uppercase animate-pulse">
                Unraveling Thread...
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-background shadow-neumorphic-outset border border-border-subtle flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold tracking-wider text-foreground/40 uppercase">
                {puzzleTitle} (Archive)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground/50">Status:</span>
                <div 
                  className={`w-3.5 h-3.5 rounded-full border border-black/50 transition-all duration-300 ${
                    isGameOver 
                      ? isCorrect 
                        ? "bg-[#46D160] shadow-led-success" 
                        : "bg-[#FF5C5C] shadow-led-error"
                      : "bg-foreground/10"
                  }`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {systemClues.slice(0, cluesRevealed).map((clue) => (
                <div 
                  key={clue.order}
                  className="flex items-center gap-4 p-4 rounded-xl bg-background shadow-neumorphic-inset border border-border-subtle animate-[fadeIn_0.2s_ease-out]"
                >
                  <span className="text-xs font-bold text-[#FF4500]">CLUE {clue.order}</span>
                  <span className="font-medium text-sm text-foreground/80">{clue.text}</span>
                </div>
              ))}
            </div>

            {!isGameOver && (
              <div className="text-center text-xs text-foreground/40 font-medium">
                {totalClues - cluesRevealed} Clues Remaining
              </div>
            )}

            {isGameOver && (
              <div className="flex flex-col items-center gap-4 py-4 border-t border-border-subtle animate-[fadeIn_0.3s_ease-out]">
                <h3 className="text-lg font-bold">
                  {isCorrect ? "🎉 Correct!" : "💀 Solved!"}
                </h3>
                {correctAnswer && (
                  <p className="text-sm text-foreground/60">
                    Connection: <strong className="text-[#FF4500] uppercase tracking-wide">{correctAnswer}</strong>
                  </p>
                )}
                
                <div className="flex gap-4 w-full mt-2">
                  <button
                    onClick={handleShare}
                    className="flex-1 py-3 px-4 bg-[#FF4500] hover:bg-[#ff5714] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(255,69,0,0.3)] hover:shadow-[0_0_20px_rgba(255,69,0,0.5)] active:scale-95 transition-all text-sm cursor-pointer"
                  >
                    Share
                  </button>
                  <button
                    onClick={resetGame}
                    className="flex-1 py-3 px-4 bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed text-foreground/80 font-bold rounded-xl hover:text-foreground transition-all text-sm cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!isGameOver && !loading && (
          <form 
            onSubmit={handleGuessSubmit} 
            className={`flex flex-col gap-4 transition-transform duration-300 ${shake ? "animate-bounce" : ""}`}
          >
            <div className="relative">
              <input
                type="text"
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                placeholder="What is the connection?"
                className="w-full py-4 px-5 bg-background shadow-neumorphic-inset border border-border-subtle focus:border-[#FF4500]/30 outline-none text-sm text-foreground/80 rounded-xl transition-all"
              />
            </div>
            <button
              type="submit"
              className="py-4 bg-background shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-border-subtle text-foreground font-bold rounded-xl hover:text-[#FF4500] transition-all text-sm uppercase tracking-wider cursor-pointer"
            >
              Submit Guess
            </button>
          </form>
        )}
      </main>

      <footer className="w-full max-w-md text-center py-4 border-t border-border-subtle text-xs text-foreground/20 mt-6">
        Threadly — Think Like The Internet • Daily Puzzle Game
      </footer>
    </div>
  );
}
