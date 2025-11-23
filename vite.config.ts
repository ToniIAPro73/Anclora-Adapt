import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiKey = env.HF_API_KEY || env.API_KEY || env.GEMINI_API_KEY || "";
  const hfBaseUrl = (
    env.VITE_HF_BASE_URL || "https://router.huggingface.co/hf-inference"
  ).trim();
  const normalizedHfBaseUrl = hfBaseUrl.replace(/\/+$/, "");
  const textModelId =
    env.VITE_TEXT_MODEL_ID || "mistralai/Mistral-7B-Instruct-v0.1";
  const imageModelId =
    env.VITE_IMAGE_MODEL_ID || "stabilityai/stable-diffusion-3-medium";
  const ttsModelId = env.VITE_TTS_MODEL_ID || "espnet/kan-bayashi_libritts_xvector_vits";
  const sttModelId = env.VITE_STT_MODEL_ID || "openai/whisper-small";
  const createModelProxy = (modelId: string) => ({
    target: `${normalizedHfBaseUrl}/models/${modelId}`,
    changeOrigin: true,
    secure: true,
    rewrite: () => "",
  });
  const proxyConfig = {
    "/api/hf-text": createModelProxy(textModelId),
    "/api/hf-image": createModelProxy(imageModelId),
    "/api/hf-tts": createModelProxy(ttsModelId),
    "/api/hf-stt": createModelProxy(sttModelId),
  };
  return {
    server: {
      port: 4173,
      host: "0.0.0.0",
      proxy: { ...proxyConfig },
    },
    preview: {
      proxy: { ...proxyConfig },
    },
    plugins: [react()],
    define: {
      "process.env.HF_API_KEY": JSON.stringify(apiKey),
      "process.env.API_KEY": JSON.stringify(apiKey),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
