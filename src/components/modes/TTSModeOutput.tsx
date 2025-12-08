import React from "react";
import type { OutputCopy } from "@/components/common/OutputDisplay";
import commonStyles from "@/styles/commonStyles";

interface TTSModeOutputProps {
  audioUrl: string | null;
  isLoading: boolean;
  error: string | null;
  buttonLoading: string;
  outputCopy: OutputCopy;
  isMobile: boolean;
}

const TTSModeOutput: React.FC<TTSModeOutputProps> = ({
  audioUrl,
  isLoading,
  error,
  buttonLoading,
  outputCopy,
  isMobile,
}) => {
  return (
    <div
      style={
        isMobile ? commonStyles.outputFrameMobile : commonStyles.outputFrame
      }
    >
      <h3 style={commonStyles.frameTitle}>Audio Resultante</h3>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {error && <div style={commonStyles.errorMessage}>{error}</div>}
        {isLoading && (
          <div style={commonStyles.loadingMessage}>
            <div style={commonStyles.spinner}></div>
            <span>{buttonLoading}</span>
          </div>
        )}
        {audioUrl && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <audio controls style={{ width: "100%" }} src={audioUrl}></audio>
            <a
              href={audioUrl}
              download="anclora_tts.wav"
              style={{
                ...commonStyles.copyButton,
                alignSelf: "center",
                textDecoration: "none",
              }}
            >
              {outputCopy.downloadAudio}
            </a>
          </div>
        )}
        {!isLoading && !audioUrl && !error && (
          <p style={{ opacity: 0.5 }}>Aquí aparecerá el audio generado</p>
        )}
      </div>
    </div>
  );
};

export default TTSModeOutput;
