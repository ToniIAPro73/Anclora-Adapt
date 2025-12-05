import React, { useEffect, useRef, useState } from "react";
import type {
  InterfaceLanguage,
  AutoModelContext,
  STTResponse,
} from "@/types";
import commonStyles from "@/styles/commonStyles";
import type { OutputCopy } from "@/components/common/OutputDisplay";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  language?: string;
}

interface LiveCopy {
  intro: string;
  buttonStart: string;
  buttonStop: string;
  transcriptLabel: string;
  errors: { microphone: string; sttUnavailable: string; noSpeech: string };
}

type LiveChatModeProps = {
  interfaceLanguage: InterfaceLanguage;
  copy: LiveCopy;
  outputCopy: OutputCopy;
  resolveTextModelId: (context?: AutoModelContext) => string;
  callSpeechToText: (audioBlob: Blob) => Promise<STTResponse>;
  callTextModel: (prompt: string, modelId?: string) => Promise<string>;
  callTextToSpeech: (
    text: string,
    voicePreset: string,
    language?: string
  ) => Promise<string>;
  hasSttEndpoint: boolean;
  defaultVoicePreset: string;
};

const LiveChatMode: React.FC<LiveChatModeProps> = ({
  interfaceLanguage,
  copy,
  outputCopy,
  resolveTextModelId,
  callSpeechToText,
  callTextModel,
  callTextToSpeech,
  hasSttEndpoint,
  defaultVoicePreset,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (!hasSttEndpoint) {
      setError(copy.errors.sttUnavailable);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (evt) => chunksRef.current.push(evt.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleConversation(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError(copy.errors.microphone);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleConversation = async (audioBlob: Blob) => {
    if (!hasSttEndpoint) {
      setError(copy.errors.sttUnavailable);
      return;
    }
    try {
      const sttResult = await callSpeechToText(audioBlob);
      const userText = sttResult.text;

      if (!userText) {
        setError(copy.errors.noSpeech);
        return;
      }

      const userMessage: ChatMessage = {
        role: "user",
        text: userText,
        language: sttResult.language,
      };
      setTranscript((prev) => [...prev, userMessage]);
      const prompt = `Convierte el siguiente texto del usuario en una respuesta breve y accionable enfocada en marketing: "${userText}". Idioma: ${interfaceLanguage.toUpperCase()}.`;
      const modelIdToUse = resolveTextModelId({
        mode: "live",
        preferChat: true,
        preferSpeed: true,
      });
      const reply = (await callTextModel(prompt, modelIdToUse)).trim();
      const detectedLanguage =
        sttResult.language?.slice(0, 2) || interfaceLanguage;
      const assistantMessage: ChatMessage = {
        role: "assistant",
        text: reply,
        language: detectedLanguage,
      };
      setTranscript((prev) => [...prev, assistantMessage]);
      setAudioUrl(null);
      const audioResponse = await callTextToSpeech(
        reply,
        defaultVoicePreset,
        detectedLanguage
      );
      setAudioUrl(audioResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <section style={commonStyles.section}>
      <p>{copy.intro}</p>
      <button
        type="button"
        style={commonStyles.generateButton}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={!hasSttEndpoint}
      >
        {isRecording ? copy.buttonStop : copy.buttonStart}
      </button>
      {!hasSttEndpoint && (
        <p style={{ marginTop: "8px", opacity: 0.8 }}>
          {copy.errors.sttUnavailable}
        </p>
      )}
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      <div style={commonStyles.liveTranscript}>
        {transcript.map((msg, index) => {
          const speakerLabel =
            msg.role === "user"
              ? interfaceLanguage === "es"
                ? "Tú"
                : "You"
              : "AncloraAI";
          const languageSuffix = msg.language
            ? ` (${msg.language.toUpperCase()})`
            : "";
          return (
            <p key={index}>
              <strong>
                {speakerLabel}
                {languageSuffix}:
              </strong>{" "}
              {msg.text}
            </p>
          );
        })}
        {transcript.length === 0 && <p>{copy.transcriptLabel}</p>}
      </div>
      {audioUrl && (
        <div>
          <audio src={audioUrl} controls style={commonStyles.audioPlayer}></audio>
          <a
            href={audioUrl}
            download="anclora_live.wav"
            style={commonStyles.copyButton}
          >
            {outputCopy.downloadAudio}
          </a>
        </div>
      )}
    </section>
  );
};

export default LiveChatMode;
