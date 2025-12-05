import React, { useEffect, useRef, useState } from "react";
import type { InterfaceLanguage, AutoModelContext } from "../../types";
import commonStyles from "../../styles/commonStyles";
import type { OutputCopy } from "../common/OutputDisplay";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface LiveCopy {
  intro: string;
  buttonStart: string;
  buttonStop: string;
  transcriptLabel: string;
  errors: { microphone: string; sttUnavailable: string };
}

type LiveChatModeProps = {
  interfaceLanguage: InterfaceLanguage;
  copy: LiveCopy;
  outputCopy: OutputCopy;
  resolveTextModelId: (context?: AutoModelContext) => string;
  callSpeechToText: (audioBlob: Blob) => Promise<string>;
  callTextModel: (prompt: string, modelId?: string) => Promise<string>;
  callTextToSpeech: (text: string, voicePreset: string) => Promise<string>;
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
      const userText = await callSpeechToText(audioBlob);
      const userMessage: ChatMessage = { role: "user", text: userText };
      setTranscript((prev) => [...prev, userMessage]);
      const prompt = `Convierte el siguiente texto del usuario en una respuesta breve y accionable enfocada en marketing: "${userText}". Idioma: ${interfaceLanguage.toUpperCase()}.`;
      const modelIdToUse = resolveTextModelId({
        mode: "live",
        preferChat: true,
        preferSpeed: true,
      });
      const reply = (await callTextModel(prompt, modelIdToUse)).trim();
      const assistantMessage: ChatMessage = { role: "assistant", text: reply };
      setTranscript((prev) => [...prev, assistantMessage]);
      const audioResponse = await callTextToSpeech(
        reply,
        defaultVoicePreset
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
        {transcript.map((msg, index) => (
          <p key={index}>
            <strong>{msg.role === "user" ? "Tú" : "AncloraAI"}:</strong>{" "}
            {msg.text}
          </p>
        ))}
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
