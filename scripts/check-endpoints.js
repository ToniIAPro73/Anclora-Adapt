import fs from "fs";
import path from "path";

const normalizeBase = (url) => url.replace(/\/$/, "");

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return acc;
    }
    const [key, ...rest] = trimmed.split("=");
    acc[key] = rest.join("=");
    return acc;
  }, {});
};

const envFromFile = readEnvFile(path.resolve(process.cwd(), ".env.local"));
const env = { ...envFromFile, ...process.env };

const ollamaBase = normalizeBase(
  env.VITE_OLLAMA_BASE_URL || "http://localhost:11434"
);
const textModelId = env.VITE_TEXT_MODEL_ID || "llama2";
const imageEndpoint = env.VITE_IMAGE_MODEL_ENDPOINT || "";
const ttsEndpoint = env.VITE_TTS_ENDPOINT || "";
const sttEndpoint = env.VITE_STT_ENDPOINT || "";
const apiKey = env.VITE_MODEL_API_KEY || env.HF_API_KEY || env.API_KEY || "";

const safeHeaders = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

const checks = [
  {
    name: "ollama /api/tags",
    url: `${ollamaBase}/api/tags`,
    method: "GET",
    description: `Detecta modelos disponibles (actual: ${textModelId})`,
  },
  {
    name: "imagen (local backend)",
    url: imageEndpoint,
    method: "GET",
    optional: true,
  },
  {
    name: "TTS (local backend)",
    url: ttsEndpoint,
    method: "GET",
    optional: true,
  },
  {
    name: "STT (local backend)",
    url: sttEndpoint,
    method: "GET",
    optional: true,
  },
];

const interpretOk = (status) => status < 500 && status !== 404;

const ping = async ({ name, url, method = "GET", optional }) => {
  if (!url) {
    console.log(`⚠️  ${name}: endpoint no configurado (saltado)`);
    return { name, status: optional ? "skipped" : "missing" };
  }
  try {
    const response = await fetch(url, { method, headers: safeHeaders });
    const ok = interpretOk(response.status);
    const label = ok ? "✅" : "❌";
    console.log(
      `${label} ${name}: ${response.status} ${response.statusText || ""} (${url})`
    );
    return { name, status: ok ? "ok" : "fail" };
  } catch (error) {
    console.error(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
    return { name, status: "fail" };
  }
};

const run = async () => {
  console.log("🔍 Comprobando endpoints configurados...");
  const results = [];
  for (const check of checks) {
    results.push(await ping(check));
  }
  const failures = results.filter((item) => item.status === "fail");
  if (failures.length > 0) {
    process.exitCode = 1;
  }
};

run();
