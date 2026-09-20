import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Check your .env file.`,
    );
  }
  return value;
}

const OLLAMA_API_URL = requireEnv("OLLAMA_API_URL");
export const EMBED_MODEL = requireEnv("EMBED_MODEL");
export const CHAT_MODEL = requireEnv("CHAT_MODEL");

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_API_URL}/api/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      prompt: text,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Ollama embeddings call failed (${res.status}): ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}

export async function chat(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch(`${OLLAMA_API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: true,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(
      `Ollama chat call failed (${res.status}): ${await res.text()}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const parsed = JSON.parse(line) as {
        message: { content: string };
        done: boolean;
      };

      const token = parsed.message?.content ?? "";
      process.stdout.write(token);
      full += token;
    }
  }

  process.stdout.write("\n");
  return full;
}
