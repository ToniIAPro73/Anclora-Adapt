import React, { useEffect, useRef } from "react";
import commonStyles from "@/styles/commonStyles";
import { useImageAnalyzer } from "@/hooks/useImageAnalyzer";

interface IntelligentModeImageOptionsProps {
  includeImage: boolean;
  onIncludeImageChange: (value: boolean) => void;
  imagePrompt: string;
  onImagePromptChange: (value: string) => void;
  imageFile: File | null;
  imagePreview: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  imagePromptPlaceholder: string;
  language?: string;
}

const IntelligentModeImageOptions: React.FC<
  IntelligentModeImageOptionsProps
> = ({
  includeImage,
  onIncludeImageChange,
  imagePrompt,
  onImagePromptChange,
  imageFile,
  imagePreview,
  onFileChange,
  imagePromptPlaceholder,
  language,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { analyzeImage, isAnalyzing, error: analysisError } = useImageAnalyzer();

  // Load image from data URL
  useEffect(() => {
    if (imgRef.current && imagePreview) {
      imgRef.current.src = imagePreview;
    }
  }, [imagePreview]);

  // Auto-analyze image when file is selected
  useEffect(() => {
    if (imageFile && !imagePrompt) {
      const analyzeImageFile = async () => {
        try {
          const result = await analyzeImage(imageFile, undefined, undefined, language);
          if (result.success && result.generatedPrompt) {
            onImagePromptChange(result.generatedPrompt);
          }
        } catch (err) {
          // Image analysis failed, user can manually enter prompt
          console.error("Image analysis error:", err);
        }
      };
      analyzeImageFile();
    }
  }, [imageFile, imagePrompt, language, analyzeImage, onImagePromptChange]);

  return (
    <div
      style={{
        borderTop: "1px solid var(--panel-border)",
        paddingTop: "8px",
        width: "100%",
      }}
    >
      <label
        style={{
          ...commonStyles.checkboxLabel,
          fontSize: "0.85em",
          marginBottom: includeImage ? "6px" : "0",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={includeImage}
          onChange={(e) => onIncludeImageChange(e.target.checked)}
        />{" "}
        Incluir Imagen
      </label>

      {includeImage && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            paddingBottom: "4px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              width: "100%",
            }}
          >
            <input
              type="file"
              onChange={onFileChange}
              accept="image/*"
              ref={fileInputRef}
              style={{
                display: "none",
              }}
              id="file-input"
            />
            <label
              htmlFor="file-input"
              style={{
                display: "inline-block",
                padding: "8px 16px",
                backgroundColor: "#ffffff",
                border: "none",
                borderRadius: "20px",
                cursor: "pointer",
                fontSize: "0.85em",
                fontWeight: "bold",
                width: "fit-content",
                color: "#000000",
              }}
            >
              Seleccionar archivo
            </label>
            {imagePreview && imageFile && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  paddingBottom: "6px",
                  padding: "6px 8px",
                  backgroundColor: "var(--panel-border, #333)",
                  borderRadius: "6px",
                  width: "fit-content",
                }}
              >
                <img
                  ref={imgRef}
                  alt="preview"
                  style={{
                    width: "40px",
                    height: "40px",
                    objectFit: "cover",
                    borderRadius: "4px",
                  }}
                />
                <div style={{ fontSize: "0.85em", flex: 1, minWidth: "100px" }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {imageFile.name}
                  </div>
                  <div style={{ fontSize: "0.75em", opacity: 0.7 }}>
                    {(imageFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: "1.2em",
                    padding: "0",
                    opacity: 0.7,
                  }}
                  onClick={() => {
                    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                    if (input) input.value = "";
                  }}
                  title="Eliminar imagen"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <div style={{ position: "relative", width: "100%" }}>
            <textarea
              style={{
                ...commonStyles.textarea,
                padding: "6px",
                fontSize: "0.9em",
                width: "100%",
                boxSizing: "border-box",
                height: "100px",
                resize: "none",
                opacity: isAnalyzing ? 0.6 : 1,
                transition: "opacity 0.2s",
              }}
              value={imagePrompt}
              onChange={(e) => onImagePromptChange(e.target.value)}
              placeholder={isAnalyzing ? "Analizando imagen..." : imagePromptPlaceholder}
              disabled={isAnalyzing}
            />
            {analysisError && (
              <div
                style={{
                  marginTop: "4px",
                  padding: "6px",
                  backgroundColor: "rgba(220, 53, 69, 0.1)",
                  color: "#dc3545",
                  fontSize: "0.8em",
                  borderRadius: "4px",
                  border: "1px solid #dc3545",
                }}
              >
                No se pudo analizar la imagen. Por favor, ingresa el prompt manualmente.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentModeImageOptions;
