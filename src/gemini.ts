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
  const prompt = `Topic is ${topic}. Difficulty is ${difficulty}. Difficulty ranges from 1-5. 1 being easiest and 5 being Impossible. Generate a multiple-choice quiz about the mentioned topic. The quiz should consist of exactly 5 questions. Each question must have 4 distinct options, with only one correct answer. The output must be a JSON array of objects. Each object should represent a question and have the following keys:
        - "id": (string) A unique identifier for the question (e.g., "q1", "q2", "q3").
        - "prompt": (string) The text of the question.
        - "options": (array of strings) An array containing exactly 4 possible answers.
        - "correct": (string) The exact text of the correct answer, which must be one of the options.
        IMPORTANT: Respond with ONLY the JSON array, do NOT wrap it in markdown code blocks or any other text.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
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
