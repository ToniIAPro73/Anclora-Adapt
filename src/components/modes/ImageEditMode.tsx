import React, { useEffect, useState } from "react";
import type { InterfaceLanguage } from "../../types";
import commonStyles from "../../styles/commonStyles";
import { formatCounterText } from "../../utils/text";
import { fileToBase64 } from "../../utils/files";

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
  onGenerateImage: (prompt: string, base64Image?: string) => Promise<string>;
};

const ImageEditMode: React.FC<ImageEditModeProps> = ({
  interfaceLanguage,
  copy,
  onGenerateImage,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
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
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const base64 = file ? await fileToBase64(file) : undefined;
      const url = await onGenerateImage(
        prompt || "Nueva composicion",
        base64
      );
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

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
                overflowY: "hidden",
              }
        }
      >
        <h3 style={commonStyles.frameTitle}>{copy.promptLabel}</h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: "12px",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            <textarea
              style={{
                ...commonStyles.textarea,
                height: "100%",
                minHeight: "100px",
                resize: "none",
              }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy.promptPlaceholder}
            />
            <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
              {formatCounterText(prompt, interfaceLanguage)}
            </div>
          </div>

          {preview && (
            <div
              style={{
                flex: 0.5,
                minHeight: "60px",
                display: "flex",
                justifyContent: "center",
                backgroundColor: "#f0f0f0",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <img
                src={preview}
                alt="preview"
                style={{ height: "100%", objectFit: "contain" }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flexShrink: 0,
            paddingTop: "8px",
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ fontSize: "0.9em", width: "100%" }}
          />
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
                Descargar imagen
              </a>
            </>
          )}
          {!imageUrl && !isLoading && (
            <p style={{ opacity: 0.6 }}>
              Ingresa un prompt o sube una imagen para comenzar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditMode;
