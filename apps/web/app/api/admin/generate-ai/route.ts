import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GoogleGenAI } from "@google/genai";

// Predefined catalog of premium mock puzzles in case GEMINI_API_KEY is not set
const MOCK_CATALOG = [
  {
    title: "Famous Web Browsers",
    answer: "web browsers",
    difficulty: 2,
    clues: ["Chrome", "Firefox", "Safari", "Edge", "Opera"]
  },
  {
    title: "Planets in the Solar System",
    answer: "planets",
    difficulty: 1,
    clues: ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]
  },
  {
    title: "Popular Programming Paradigms",
    answer: "programming paradigms",
    difficulty: 3,
    clues: ["Object-Oriented", "Functional", "Imperative", "Logical", "Declarative"]
  },
  {
    title: "Marvel Avengers Heroes",
    answer: "avengers",
    difficulty: 2,
    clues: ["Iron Man", "Captain America", "Thor", "Hulk", "Black Widow"]
  },
  {
    title: "Ancient Seven Wonders",
    answer: "seven wonders of the ancient world",
    difficulty: 4,
    clues: ["Giza Pyramid", "Hanging Gardens", "Statue of Zeus", "Temple of Artemis", "Mausoleum at Halicarnassus"]
  }
];

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    let puzzleData;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: "Generate a new connection puzzle. The connection answer must be a single category concept (e.g. 'countries in Europe', 'types of pasta'). Provide exactly 5 progressive clues, starting with the least obvious clue and ending with the most obvious clue. Respond strictly in JSON format matching this schema: { \"title\": \"Brief descriptive title\", \"answer\": \"the category connection phrase\", \"difficulty\": 3, \"clues\": [\"clue 1\", \"clue 2\", \"clue 3\", \"clue 4\", \"clue 5\"] }",
          config: {
            responseMimeType: "application/json"
          }
        });

        const text = response.text || "";
        const parsed = JSON.parse(text);
        
        if (parsed.title && parsed.answer && Array.isArray(parsed.clues) && parsed.clues.length === 5) {
          puzzleData = {
            title: parsed.title,
            answer: parsed.answer.toLowerCase(),
            difficulty: typeof parsed.difficulty === "number" ? parsed.difficulty : 3,
            clues: parsed.clues
          };
        }
      } catch (aiError) {
        console.error("Gemini API call failed, falling back to mock catalog:", aiError);
      }
    }

    // Fallback if no API key or AI call failed
    if (!puzzleData) {
      const randomIndex = Math.floor(Math.random() * MOCK_CATALOG.length);
      puzzleData = MOCK_CATALOG[randomIndex];
    }

    // Insert as a draft puzzle in the database
    const createdPuzzle = await db.puzzle.create({
      data: {
        title: puzzleData.title,
        answer: puzzleData.answer,
        difficulty: puzzleData.difficulty,
        status: "draft",
        clues: {
          create: puzzleData.clues.map((clueText: string, index: number) => ({
            clueOrder: index + 1,
            clueText: clueText
          }))
        }
      },
      include: {
        clues: true
      }
    });

    return NextResponse.json({
      success: true,
      puzzle: {
        id: createdPuzzle.id,
        title: createdPuzzle.title,
        answer: createdPuzzle.answer,
        difficulty: createdPuzzle.difficulty,
        status: createdPuzzle.status,
        clues: createdPuzzle.clues.map(c => c.clueText)
      }
    });
  } catch (error: any) {
    console.error("AI Generation pipeline failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
