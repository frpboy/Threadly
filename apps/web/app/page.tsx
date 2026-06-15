"use client";

import React, { useState, useEffect } from "react";

interface Clue {
  order: number;
  text: string;
}

export default function Home() {
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

  // Load daily puzzle from database API
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

    fetch("/api/daily")
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
        setPuzzleTitle("Failed to load puzzle. Check .env database credentials.");
        setLoading(false);
      });

    // Load streak from localStorage if client-side
    const savedStreak = localStorage.getItem("threadly_streak");
    if (savedStreak) {
      setStreak(parseInt(savedStreak, 10));
    }
  }, []);

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
        const newStreak = streak + 1;
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

    const shareText = `Threadly Daily Puzzle\nClues used: ${cluesRevealed}/5\n${grid}\nScore: ${score} pts\nPlay at threadly.vercel.app`;
    
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
    <div className="flex flex-col min-h-screen items-center justify-between p-4 bg-[#0E1113]">
      {/* Header */}
      <header className="flex w-full max-w-md items-center justify-between py-4 border-b border-white/[0.03] mb-6">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF4500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="filter drop-shadow-[0_0_8px_rgba(255,69,0,0.6)]">
            <circle cx="12" cy="5" r="2.5" fill="#FF4500" />
            <circle cx="5" cy="18" r="2.5" fill="#FF4500" />
            <circle cx="19" cy="18" r="2.5" fill="#FF4500" />
            <line x1="12" y1="7.5" x2="6.5" y2="15.5" />
            <line x1="12" y1="7.5" x2="17.5" y2="15.5" />
            <line x1="7.5" y1="18" x2="16.5" y2="18" />
          </svg>
          <h1 className="text-2xl font-bold tracking-wider text-[#FF4500]">THREADLY</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHowTo(!showHowTo)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0E1113] shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-white/[0.02] text-sm font-bold text-white/60 hover:text-white transition-all cursor-pointer"
            title="How to Play"
          >
            ?
          </button>
          
          {/* Neumorphic Streak Counter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0E1113] shadow-neumorphic-button border border-white/[0.02]">
            <span className="animate-pulse">🔥</span>
            <span className="font-semibold text-sm">{streak} Day Streak</span>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-md flex flex-col justify-center gap-6">
        {/* How To Play Card */}
        {showHowTo && (
          <div className="p-6 rounded-2xl bg-[#0E1113] shadow-neumorphic-outset border border-white/[0.02] flex flex-col gap-4 animate-[fadeIn_0.2s_ease-out]">
            <h3 className="text-lg font-bold text-[#FF4500]">How to Play</h3>
            <ul className="text-xs text-white/70 space-y-2.5 list-disc pl-4">
              <li>Find the hidden connection linking the clues.</li>
              <li>A new clue is revealed sequentially on every wrong guess.</li>
              <li>Points are awarded based on how many clues you needed: <strong>1 Clue = 100pts</strong> down to <strong>5 Clues = 20pts</strong>.</li>
              <li>Streak increments every day you solve the daily puzzle.</li>
            </ul>
            <button 
              onClick={() => setShowHowTo(false)}
              className="mt-2 py-2.5 bg-[#0E1113] shadow-neumorphic-button active:shadow-neumorphic-button-pressed text-white/60 hover:text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Got it!
            </button>
          </div>
        )}
        {loading ? (
          <div className="text-center py-10 font-bold text-white/50 animate-pulse">
            Connecting to Neon database...
          </div>
        ) : (
          /* Game Info Card (Neumorphic Outset) */
          <div className="p-6 rounded-2xl bg-[#0E1113] shadow-neumorphic-outset border border-white/[0.02] flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold tracking-wider text-white/40 uppercase">
                {puzzleTitle}
              </span>
              {/* LED Status light */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">Status:</span>
                <div 
                  className={`w-3.5 h-3.5 rounded-full border border-black/50 transition-all duration-300 ${
                    isGameOver 
                      ? isCorrect 
                        ? "bg-[#46D160] shadow-led-success" 
                        : "bg-[#FF5C5C] shadow-led-error"
                      : "bg-white/20"
                  }`}
                />
              </div>
            </div>

            {/* Progressive Clues List */}
            <div className="flex flex-col gap-3">
              {systemClues.slice(0, cluesRevealed).map((clue) => (
                <div 
                  key={clue.order}
                  className="flex items-center gap-4 p-4 rounded-xl bg-[#0E1113] shadow-neumorphic-inset border border-white/[0.01] animate-[fadeIn_0.2s_ease-out]"
                >
                  <span className="text-xs font-bold text-[#FF4500]">CLUE {clue.order}</span>
                  <span className="font-medium text-sm text-[#D7DADC]">{clue.text}</span>
                </div>
              ))}
            </div>

            {/* Clues Remaining Counter */}
            {!isGameOver && systemClues.length > 0 && (
              <div className="text-center text-xs text-white/40 font-medium">
                {systemClues.length - cluesRevealed} Clues Remaining
              </div>
            )}

            {/* Game Over Screen */}
            {isGameOver && (
              <div className="flex flex-col items-center gap-4 py-4 border-t border-white/[0.03] animate-[fadeIn_0.3s_ease-out]">
                <h3 className="text-lg font-bold">
                  {isCorrect ? "🎉 Correct Answer!" : "💀 Game Over!"}
                </h3>
                {correctAnswer && (
                  <p className="text-sm text-white/60">
                    Connection: <strong className="text-[#FF4500] uppercase tracking-wide">{correctAnswer}</strong>
                  </p>
                )}
                {isCorrect && (
                  <div className="px-4 py-2 rounded-xl bg-[#0E1113] shadow-neumorphic-inset text-[#46D160] font-bold text-sm">
                    +{score} Points Awarded
                  </div>
                )}
                
                <div className="flex gap-4 w-full mt-2">
                  <button
                    onClick={handleShare}
                    className="flex-1 py-3 px-4 bg-[#FF4500] hover:bg-[#ff5714] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(255,69,0,0.3)] hover:shadow-[0_0_20px_rgba(255,69,0,0.5)] active:scale-95 transition-all text-sm"
                  >
                    Share Score
                  </button>
                  <button
                    onClick={resetGame}
                    className="flex-1 py-3 px-4 bg-[#0E1113] shadow-neumorphic-button active:shadow-neumorphic-button-pressed text-white/80 font-bold rounded-xl hover:text-white transition-all text-sm"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Guess Input Form */}
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
                className="w-full py-4 px-5 bg-[#0E1113] shadow-neumorphic-inset border border-white/[0.01] focus:border-[#FF4500]/30 outline-none text-sm text-[#D7DADC] rounded-xl transition-all"
              />
            </div>
            <button
              type="submit"
              className="py-4 bg-[#0E1113] shadow-neumorphic-button active:shadow-neumorphic-button-pressed border border-white/[0.02] text-white font-bold rounded-xl hover:text-[#FF4500] transition-all text-sm uppercase tracking-wider"
            >
              Submit Guess
            </button>
          </form>
        )}

        {/* Guesses Log */}
        {guesses.length > 0 && !isGameOver && !loading && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/30">Previous Guesses</h4>
            <div className="flex flex-wrap gap-2">
              {guesses.map((guess, idx) => (
                <span 
                  key={idx} 
                  className="px-3 py-1.5 rounded-lg bg-[#0E1113] shadow-neumorphic-inset border border-white/[0.01] text-xs text-white/50 line-through decoration-[#FF5C5C]/60"
                >
                  {guess}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Share Toast Notification */}
      {showShareNotification && (
        <div className="fixed bottom-10 px-5 py-3 bg-[#46D160] text-black font-bold text-xs rounded-xl shadow-lg animate-bounce">
          📋 Score copied to clipboard!
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-4 border-t border-white/[0.02] text-xs text-white/20 mt-6">
        Threadly — Think Like The Internet • Daily Puzzle Game
      </footer>
    </div>
  );
}

