import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const SEO_EXTENSIONS = new Set([".html", ".htm", ".tsx", ".jsx", ".astro", ".svelte", ".vue"]);
const SEO_FILENAMES = new Set(["robots.txt", "sitemap.xml", "robots.ts", "sitemap.ts"]);
const MAX_FILE_SIZE = 50_000; // 50KB per file

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, files);
    } else if (
      SEO_EXTENSIONS.has(extname(entry)) ||
      SEO_FILENAMES.has(entry)
    ) {
      if (stat.size <= MAX_FILE_SIZE) {
        files.push(full);
      }
    }
  }
  return files;
}

function filterPages(files, pages) {
  if (pages === "all") return files;
  const targets = pages.split(",").map((p) => p.trim());
  return files.filter((f) => targets.some((t) => f.includes(t)));
}

async function main() {
  const pagesArg = process.argv.includes("--pages")
    ? process.argv[process.argv.indexOf("--pages") + 1]
    : "all";

  const repoRoot = process.cwd();
  const allFiles = collectFiles(repoRoot);
  const files = filterPages(allFiles, pagesArg);

  if (files.length === 0) {
    console.log("No SEO-relevant files found.");
    process.exit(0);
  }

  console.log(`Found ${files.length} file(s) to scan:\n`);
  files.forEach((f) => console.log(`  - ${f.replace(repoRoot + "/", "")}`));
  console.log();

  const fileContents = files
    .map((f) => {
      const relative = f.replace(repoRoot + "/", "");
      const content = readFileSync(f, "utf-8");
      return `### ${relative}\n\`\`\`\n${content}\n\`\`\``;
    })
    .join("\n\n");

  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an SEO auditor. Analyze the following website source files and return a JSON array of SEO improvement proposals.

Each proposal must have this shape:
{
  "file": "relative/path.html",
  "type": "on-page" | "technical" | "internal-linking" | "schema" | "content",
  "severity": "critical" | "high" | "medium" | "low",
  "title": "Short title",
  "description": "What's wrong and how to fix it",
  "confidence": 0-100
}

Only return the JSON array, no other text.

--- FILES ---

${fileContents}`,
      },
    ],
  });

  const text = response.content[0].text;

  try {
    const proposals = JSON.parse(text);
    console.log(`\n--- SEO SCAN RESULTS (${proposals.length} findings) ---\n`);
    for (const p of proposals) {
      console.log(`[${p.severity.toUpperCase()}] ${p.title}`);
      console.log(`  File: ${p.file}`);
      console.log(`  Type: ${p.type}`);
      console.log(`  Confidence: ${p.confidence}%`);
      console.log(`  ${p.description}\n`);
    }
  } catch {
    console.log("\n--- RAW AI RESPONSE ---\n");
    console.log(text);
  }
}

main().catch((err) => {
  console.error("Scan failed:", err.message);
  process.exit(1);
});
