import http from "http";

// CAMBIO AQUÍ: Usar 127.0.0.1 en lugar de localhost para evitar errores de resolución
const target =
  process.env.SD_API_URL || "http://127.0.0.1:7860/sdapi/v1/txt2img";
const port = Number(process.env.IMAGE_BRIDGE_PORT || 9090);
const host = process.env.IMAGE_BRIDGE_HOST || "0.0.0.0";

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const respondJson = (res, status, payload) => {
  setCorsHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  // Manejar preflight requests (CORS)
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/image") {
    respondJson(res, 404, { error: "Ruta no encontrada" });
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      const prompt = body.prompt || body.inputs || "";
      const negative_prompt = body.negative_prompt || "";

      if (!prompt) {
        respondJson(res, 400, { error: "Falta prompt" });
        return;
      }

      console.log(`🎨 Generando: "${prompt.slice(0, 50)}..."`);

      const sdResponse = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt,
          steps: body.steps || 15,
          width: body.width || 512,
          height: body.height || 512,
        }),
      });

      if (!sdResponse.ok) {
        const detail = await sdResponse.text();
        console.error("❌ Error SD:", detail);
        respondJson(res, 502, {
          error: `Backend SD devolvió ${sdResponse.status}: ${detail}`,
        });
        return;
      }

      const payload = await sdResponse.json();
      const base64Image = payload?.images?.[0];

      if (!base64Image) {
        respondJson(res, 502, { error: "Respuesta sin imagen" });
        return;
      }

      const buffer = Buffer.from(base64Image, "base64");
      setCorsHeaders(res);
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(buffer);
      console.log("✅ Imagen enviada al cliente");
    } catch (error) {
      console.error("❌ Error Puente:", error);
      respondJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

server.listen(port, host, () => {
  console.log(
    `🖼️  Image bridge listo en http://${host}:${port}/image (CORS activado) → ${target}`
  );
});
