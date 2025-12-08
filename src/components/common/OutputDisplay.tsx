import React, { useEffect, useRef, useState } from "react";
import type { GeneratedOutput } from "../../types";
import commonStyles from "../../styles/commonStyles";

export interface OutputCopy {
  loading: string;
  downloadAudio: string;
  downloadImage: string;
  copy: string;
  copied?: string;
}

interface OutputDisplayProps {
  generatedOutputs: GeneratedOutput[] | null;
  error: string | null;
  isLoading: boolean;
  onCopy: (text: string) => void;
  audioUrl?: string | null;
  imageUrl?: string | null;
  copy: OutputCopy;
  generatedJSON?: object | null;
  onDownloadJSON?: () => void;
}

const GeneratedOutputCard: React.FC<{
  output: GeneratedOutput;
  copy: OutputCopy;
  onCopy: (text: string) => void;
}> = ({ output, copy, onCopy }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [content, setContent] = useState(output.content);
  const [copied, setCopied] = useState(false);

  useEffect(() => setContent(output.content), [output.content]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopyClick = () => {
    onCopy(content);
    setCopied(true);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={commonStyles.outputCard}>
      <strong>{output.platform}</strong>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        style={commonStyles.outputTextarea}
      />
      <div style={commonStyles.copyButtonRow}>
        <button type="button" style={commonStyles.copyButton} onClick={handleCopyClick}>
          {copy.copy}
        </button>
        {copied && (
          <span style={commonStyles.copyHint}>
            {copy.copied || "Copiado"}
          </span>
        )}
      </div>
    </div>
  );
};

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
          {generatedOutputs.map((output, index) => (
            <GeneratedOutputCard
              key={`${output.platform}-${index}`}
              output={output}
              copy={copy}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
      {generatedJSON && onDownloadJSON && (
        <button
          onClick={onDownloadJSON}
          style={{
            ...commonStyles.copyButton,
            marginTop: "12px",
            width: "100%",
          }}
        >
          📥 Descargar inteligente.json
        </button>
      )}
    </section>
  );
};

export default OutputDisplay;
