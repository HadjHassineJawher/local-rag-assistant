import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface StoreChunk {
  id: string;
  source: string;
  text: string;
  embedding: number[];
}

const STORE_PATH = new URL("../../vector-store.json", import.meta.url);

export async function loadStore(): Promise<StoreChunk[]> {
  if (!existsSync(STORE_PATH)) return [];
  const raw = await readFile(STORE_PATH, "utf-8");
  return JSON.parse(raw) as StoreChunk[];
}

export async function saveStore(chunks: StoreChunk[]): Promise<void> {
  await writeFile(STORE_PATH, JSON.stringify(chunks, null, 2), "utf-8");
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / Math.sqrt(normA) / Math.sqrt(normB);
}

export function topK(chunks: StoreChunk[], queryEmbedding: number[], k = 4) {
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(chunk.embedding, queryEmbedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
