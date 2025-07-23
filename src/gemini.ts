import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to remove Markdown code block fencing
function stripMarkdownCodeBlock(text: string) {
  if (text.startsWith('```json') && text.endsWith('```')) {
    // Remove '```json\n' from the beginning and '\n```' from the end
    return text
      .substring('```json\n'.length, text.length - '\n```'.length)
      .trim();
  }
  // If it's not a markdown code block, return as is (or throw an error if strict)
  return text.trim();
}

export async function CallGemini(topic: string, difficulty: string | number) {

  const newPrompt = `Your mission is to craft exactly 5 electrifying multiple-choice questions about the most magnificent and mind-bending topic: ${topic}. The difficulty level is set to a thrilling ${difficulty}, where 1 is for total newbies and 5 is for cosmic intellects.

Each question needs 4 wildly distinct options – no sneaky repeats, no half-truths, just pure, unadulterated choice! Only one of those options can be the undeniable, absolute, 100% correct answer. Make sure that correct answer is perfectly matched to one of your options – no typos, no close calls, just a bullseye hit!

For increased difficulties (especially 3-5), make the incorrect options subtly similar or deceptively plausible to truly test the knowledge! Infuse these questions with personality! Think unexpected angles, witty wordplay, pop culture nods (if appropriate and not too obscure), and a dash of playful challenge. We're aiming for "OMG, I totally know this!" moments mixed with "Wait, what just happened?!" giggles.

Your output MUST be a JSON array of objects. Each object is a question, with these keys:

    "id": (string) A unique identifier for the question (e.g., "q1", "q2", "q3").

    "prompt": (string) The dazzling, personality-packed text of the question.

    "options": (array of strings) An array of exactly 4  possible answers.

    "correct": (string) The exact text of the correct answer, plucked straight from your options list.

IMPORTANT: Respond with ONLY the JSON array. Do NOT wrap it in markdown code blocks or any other text.`


  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: newPrompt,
  });

  if (!response.text) {
    throw new Error('Gemini API error: No text content in response.');
  }

  // Strip the markdown fencing before parsing
  const jsonString = stripMarkdownCodeBlock(response.text);

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse JSON from Gemini response:', e);
    console.error('Raw response text:', response.text);
    console.error('Stripped JSON string attempted to parse:', jsonString);
    throw new Error(
      'Error parsing Gemini response: Invalid JSON format after stripping markdown.',
    );
  }
}
