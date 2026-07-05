import OpenAI from "openai";

let client: OpenAI | null = null;

/**
 * Lazily create the OpenAI client so importing this module does not throw
 * during build / page-data collection when OPENAI_API_KEY is not set.
 * The key is only required at request time.
 */
export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}
