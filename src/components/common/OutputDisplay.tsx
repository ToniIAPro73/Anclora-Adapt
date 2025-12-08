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
  ideaPrompt?: string | null;
  imagePrompt?: string | null;
  onDownloadIdeaPrompt?: () => void;
  onDownloadIdeaPromptJSON?: () => void;
  onDownloadImagePrompt?: () => void;
  onDownloadImagePromptJSON?: () => void;
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

const PromptDisplay: React.FC<{
  title: string;
  prompt: string;
  onDownloadMarkdown?: () => void;
  onDownloadJSON?: () => void;
}> = ({ title, prompt, onDownloadMarkdown, onDownloadJSON }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  return (
    <div style={commonStyles.outputCard}>
      <strong>{title}</strong>
      <textarea
        ref={textareaRef}
        value={prompt}
        readOnly
        spellCheck={false}
        style={{
          ...commonStyles.outputTextarea,
          backgroundColor: "var(--input-bg)",
          marginTop: "8px",
          minHeight: "120px",
          maxHeight: "none",
          overflow: "visible",
        }}
      />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        {onDownloadMarkdown && (
          <button
            type="button"
            style={{
              ...commonStyles.copyButton,
              flex: 1,
            }}
            onClick={onDownloadMarkdown}
          >
            📥 .md
          </button>
        )}
        {onDownloadJSON && (
          <button
            type="button"
            style={{
              ...commonStyles.copyButton,
              flex: 1,
            }}
            onClick={onDownloadJSON}
          >
            📥 .json
          </button>
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
  generatedJSON,
  onDownloadJSON,
  ideaPrompt,
  imagePrompt,
  onDownloadIdeaPrompt,
  onDownloadIdeaPromptJSON,
  onDownloadImagePrompt,
  onDownloadImagePromptJSON,
  executedPrompt,
  onDownloadPrompt,
  onDownloadPromptJSON,
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
      {ideaPrompt && (
        <div style={{ marginTop: "12px" }}>
          <PromptDisplay
            title="Prompt para Idea/Contexto"
            prompt={ideaPrompt}
            onDownloadMarkdown={onDownloadIdeaPrompt}
            onDownloadJSON={onDownloadIdeaPromptJSON}
          />
        </div>
      )}
      {imagePrompt && (
        <div style={{ marginTop: "12px" }}>
          <PromptDisplay
            title="Prompt para Imagen"
            prompt={imagePrompt}
            onDownloadMarkdown={onDownloadImagePrompt}
            onDownloadJSON={onDownloadImagePromptJSON}
          />
        </div>
      )}
    </section>
  );
};

export default OutputDisplay;
