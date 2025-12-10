import React, { useEffect, useState } from "react";
import type {
  InterfaceLanguage,
  ImageGenerationOptions,
  SystemCapabilities,
} from "@/types";
import commonStyles from "@/styles/commonStyles";
import { formatCounterText } from "@/utils/text";
import { fileToBase64 } from "@/utils/files";
import { validateImageGeneration } from "@/utils/hardwareValidator";

interface ImageCopy {
  promptLabel: string;
  promptPlaceholder: string;
  buttonIdle: string;
  buttonLoading: string;
  errors: { prompt: string };
}

type ImageEditModeProps = {
  interfaceLanguage: InterfaceLanguage;
  copy: ImageCopy;
  onGenerateImage: (options: ImageGenerationOptions) => Promise<string>;
  hardwareProfile?: SystemCapabilities;
};

const dimensionPresets = [
  { id: "square512", label: "512 × 512 (rápido)", width: 512, height: 512 },
  { id: "square768", label: "768 × 768", width: 768, height: 768 },
  { id: "square1024", label: "1024 × 1024 (detallado)", width: 1024, height: 1024 },
  { id: "portrait", label: "832 × 1216 (retrato)", width: 832, height: 1216 },
  { id: "landscape", label: "1216 × 832 (apaisado)", width: 1216, height: 832 },
];

const stepOptions = [4, 6, 8];

const ImageEditMode: React.FC<ImageEditModeProps> = ({
  interfaceLanguage,
  copy,
  onGenerateImage,
  hardwareProfile,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [dimension, setDimension] = useState(dimensionPresets[2].id);
  const [steps, setSteps] = useState(stepOptions[0]);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0] || null;
    setFile(image);
    setPreview(image ? URL.createObjectURL(image) : null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !file) {
      setError(copy.errors.prompt);
      return;
    }

    // Validar que el hardware soporta generación de imágenes
    const validation = validateImageGeneration(hardwareProfile);
    if (!validation.isSupported) {
      setError(validation.message);
      return;
    }

    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const base64 = file ? await fileToBase64(file) : undefined;
      const preset =
        dimensionPresets.find((item) => item.id === dimension) ||
        dimensionPresets[2];

      const imageUrl = await onGenerateImage({
        prompt: prompt || "Nueva composición",
        negativePrompt: negativePrompt || undefined,
        base64Image: base64,
        width: preset.width,
        height: preset.height,
        steps,
      });

      setImageUrl(imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  const dimensionLabel =
    interfaceLanguage === "es" ? "Dimensiones" : "Dimensions";
  const stepsLabel = interfaceLanguage === "es" ? "Pasos" : "Steps";
  const negativeLabel =
    interfaceLanguage === "es" ? "Negative prompt" : "Negative prompt";

  return (
    <div
      style={
        isMobile
          ? commonStyles.twoFrameContainerMobile
          : commonStyles.twoFrameContainer
      }
    >
      <div
        style={
          isMobile
            ? commonStyles.inputFrameMobile
            : {
                ...commonStyles.inputFrame,
                padding: "4px 12px 4px 4px",
                overflowY: "auto",
              }
        }
      >
        <h3 style={commonStyles.frameTitle}>{copy.promptLabel}</h3>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "12px",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <textarea
              style={{
                ...commonStyles.textarea,
                height: "120px",
                resize: "vertical",
              }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy.promptPlaceholder}
            />
            <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
              {formatCounterText(prompt, interfaceLanguage)}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={commonStyles.label}>{negativeLabel}</label>
              <textarea
                style={{
                  ...commonStyles.textarea,
                  height: "80px",
                  resize: "vertical",
                }}
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={
                  interfaceLanguage === "es"
                    ? "Elementos a evitar (ej: manos extra, texto borroso)"
                    : "Things to avoid (e.g. extra hands, blurry text)"
                }
              />
            </div>
          </div>

          {preview && (
            <div
              style={{
                flex: 0.8,
                minHeight: "140px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#f0f0f0",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <img
                src={preview}
                alt="preview"
                style={{ width: "100%", objectFit: "cover" }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: "12px",
            paddingTop: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={commonStyles.label}>{dimensionLabel}</label>
            <select
              style={commonStyles.select}
              value={dimension}
              onChange={(e) => setDimension(e.target.value)}
            >
              {dimensionPresets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={commonStyles.label}>{stepsLabel}</label>
            <select
              style={commonStyles.select}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
            >
              {stepOptions.map((value) => (
                <option key={value} value={value}>
                  {value} {interfaceLanguage === "es" ? "pasos" : "steps"}
                </option>
              ))}
            </select>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              {interfaceLanguage === "es"
                ? "Lightning funciona mejor con 4-8 pasos"
                : "Lightning works best with 4-8 steps"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={commonStyles.label}>
              {interfaceLanguage === "es" ? "Imagen base" : "Reference image"}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ fontSize: "0.9em" }}
            />
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              {interfaceLanguage === "es"
                ? "Opcional: sube una imagen para editarla"
                : "Optional: upload an image to edit"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            style={{ ...commonStyles.generateButton, padding: "12px" }}
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? copy.buttonLoading : copy.buttonIdle}
          </button>
          {error && <div style={commonStyles.errorMessage}>{error}</div>}
        </div>
      </div>

      <div
        style={
          isMobile ? commonStyles.outputFrameMobile : commonStyles.outputFrame
        }
      >
        <h3 style={commonStyles.frameTitle}>Imagen generada</h3>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          {isLoading && (
            <div style={commonStyles.loadingMessage}>
              <div style={commonStyles.spinner}></div>
              <span>{copy.buttonLoading}</span>
            </div>
          )}
          {imageUrl && (
            <>
              <img
                src={imageUrl}
                alt="Resultado"
                style={{
                  width: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: "12px",
                }}
              />
              <a
                href={imageUrl}
                download="anclora_image.png"
                style={commonStyles.copyButton}
              >
                {interfaceLanguage === "es"
                  ? "Descargar imagen"
                  : "Download image"}
              </a>
            </>
          )}
          {!imageUrl && !isLoading && (
            <p style={{ opacity: 0.6 }}>
              {interfaceLanguage === "es"
                ? "Ingresa un prompt o sube una imagen para comenzar."
                : "Enter a prompt or upload an image to get started."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditMode;
