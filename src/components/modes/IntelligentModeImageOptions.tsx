import React from "react";
import commonStyles from "@/styles/commonStyles";

interface IntelligentModeImageOptionsProps {
  includeImage: boolean;
  onIncludeImageChange: (value: boolean) => void;
  imagePrompt: string;
  onImagePromptChange: (value: string) => void;
  imageFile: File | null;
  imagePreview: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  imagePromptPlaceholder: string;
}

const IntelligentModeImageOptions: React.FC<
  IntelligentModeImageOptionsProps
> = ({
  includeImage,
  onIncludeImageChange,
  imagePrompt,
  onImagePromptChange,
  imagePreview,
  onFileChange,
  imagePromptPlaceholder,
}) => {
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
              style={{
                fontSize: "0.75em",
                width: "100%",
                maxWidth: "100%",
              }}
            />
            {imagePreview && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingBottom: "4px",
                }}
              >
                <img
                  src={imagePreview}
                  alt="selected image preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "120px",
                    objectFit: "contain",
                    borderRadius: "8px",
                    border: "1px solid var(--panel-border, #e0e0e0)",
                  }}
                />
              </div>
            )}
          </div>
          <textarea
            style={{
              ...commonStyles.textarea,
              padding: "6px",
              fontSize: "0.9em",
              width: "100%",
              boxSizing: "border-box",
              height: "100px",
              resize: "none",
            }}
            value={imagePrompt}
            onChange={(e) => onImagePromptChange(e.target.value)}
            placeholder={imagePromptPlaceholder}
          />
        </div>
      )}
    </div>
  );
};

export default IntelligentModeImageOptions;
