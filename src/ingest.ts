import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { PDFParse } from "pdf-parse";
import { embed, EMBED_MODEL } from "./lib/ollama.js";
import { saveStore, type StoreChunk } from "./lib/store.js";
import { chunkText } from "./lib/chunk.js";
import { fileURLToPath } from "node:url";

const DOCS_DIR = fileURLToPath(new URL("../docs", import.meta.url));

async function readDocText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const buffer = await readFile(filePath);
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    const result = await parser.getText();
    return result.text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, " ");
  }
  return readFile(filePath, "utf-8");
}

async function main() {
  const files = await readdir(DOCS_DIR);

  const docFiles = files.filter((f) =>
    [".pdf", ".md", ".txt"].includes(extname(f).toLowerCase()),
  );

  if (docFiles.length === 0) {
    console.log(
      `No documents found in ${DOCS_DIR}. Add a .pdf, .md, or .txt file and re-run.`,
    );
    return;
  }

  console.log(
    `Found ${docFiles.length} document(s). Using embedding model: ${EMBED_MODEL}\n`,
  );

  const allChunks: StoreChunk[] = [];

  for (const file of docFiles) {
    const filePath = join(DOCS_DIR, file);
    console.log(`Reading ${file} ... `);
    const text = await readDocText(filePath);
    const pieces = chunkText(text);
    console.log(`   -> split into ${pieces.length} chunk(s), embedding...`);

    for (let i = 0; i < pieces.length; i++) {
      const embedding = await embed(`search_document: ${pieces[i]}`);

      allChunks.push({
        id: `${file}-${i}`,
        source: file,
        text: pieces[i],
        embedding,
      });

      process.stdout.write(`\r  -> embedded ${i + 1}/${pieces.length}`);
    }
    console.log("\n");
  }

  await saveStore(allChunks);
  console.log(
    `Done. Saved ${allChunks.length} chunk(s) to vector-store.json. Run "npm run query" to ask questions.`,
  );
}

main().catch((err) => {
  console.error("Ingest failed:", err.message);
  console.error(
    "Is Ollama running? Try: ollama serve (and make sure you've pulled the embedding model)",
  );
  process.exit(1);
});
