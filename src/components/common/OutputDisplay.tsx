import React from "react";
import type { GeneratedOutput } from "../../types";
import commonStyles from "../../styles/commonStyles";

export interface OutputCopy {
  loading: string;
  downloadAudio: string;
  downloadImage: string;
  copy: string;
}

interface OutputDisplayProps {
  generatedOutputs: GeneratedOutput[] | null;
  error: string | null;
  isLoading: boolean;
  onCopy: (text: string) => void;
  audioUrl?: string | null;
  imageUrl?: string | null;
  copy: OutputCopy;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({
  generatedOutputs,
  error,
  isLoading,
  onCopy,
  audioUrl,
  imageUrl,
  copy,
}) => {
  return (
    <section style={commonStyles.outputSection}>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      {isLoading && (
        <div style={commonStyles.loadingMessage}>
          <div style={commonStyles.spinner}></div>
          <span>{copy.loading}</span>
        </div>
      )}
      {audioUrl && (
        <div>
          <audio
            controls
            style={commonStyles.audioPlayer}
            src={audioUrl}
          ></audio>
          <a
            href={audioUrl}
            download="anclora_audio.wav"
            style={commonStyles.copyButton}
          >
            {copy.downloadAudio}
          </a>
        </div>
      )}
      {imageUrl && (
        <div>
          <img
            src={imageUrl}
            alt="Imagen generada"
            style={{ width: "100%", borderRadius: "12px" }}
          />
          <a
            href={imageUrl}
            download="anclora_image.png"
            style={commonStyles.copyButton}
          >
            {copy.downloadImage}
          </a>
        </div>
      )}
      {generatedOutputs && generatedOutputs.length > 0 && (
        <div style={commonStyles.outputGrid}>
          {generatedOutputs.map((output, index) => {
            const textareaRef = React.useRef<HTMLTextAreaElement>(null);
            React.useEffect(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              }
            }, [output.content]);
            return (
              <div key={index} style={commonStyles.outputCard}>
                <strong>{output.platform}</strong>
                <textarea
                  ref={textareaRef}
                  readOnly
                  value={output.content}
                  style={{
                    flex: 1,
                    borderRadius: "8px",
                    border: "1px solid var(--panel-border, #e0e0e0)",
                    padding: "10px",
                    backgroundColor: "var(--input-bg, #FFFFFF)",
                    color: "var(--texto, #162032)",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "1.5",
                    resize: "none",
                    overflow: "hidden",
                  }}
                />
                <button
                  type="button"
                  style={commonStyles.copyButton}
                  onClick={() => onCopy(output.content)}
                >
                  {copy.copy}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default OutputDisplay;
