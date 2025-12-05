import React, { useState } from "react";
import type { InterfaceLanguage, AutoModelContext } from "../../types";
import commonStyles from "../../styles/commonStyles";
import { formatCounterText } from "../../utils/text";
import type { OutputCopy } from "../common/OutputDisplay";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface ChatCopy {
  intro: string;
  placeholder: string;
  button: string;
  typing: string;
}

type ChatModeProps = {
  interfaceLanguage: InterfaceLanguage;
  copy: ChatCopy;
  outputCopy: OutputCopy;
  onCopy: (text: string) => void;
  resolveTextModelId: (context?: AutoModelContext) => string;
  callTextModel: (prompt: string, modelId?: string) => Promise<string>;
};

const ChatMode: React.FC<ChatModeProps> = ({
  interfaceLanguage,
  copy,
  outputCopy,
  onCopy,
  resolveTextModelId,
  callTextModel,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [current, setCurrent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!current.trim()) return;
    const newMessage: ChatMessage = { role: "user", text: current };
    const updated = [...messages, newMessage];
    setMessages(updated);
    setCurrent("");
    setIsLoading(true);
    try {
      const history = updated
        .map(
          (msg) =>
            `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.text}`
        )
        .join("\n");
      const prompt = `Eres AncloraAI, enfocado en adaptacion de contenido. Idioma preferido: ${interfaceLanguage.toUpperCase()}. Conversacion: ${history}. Responde de forma breve.`;
      const modelIdToUse = resolveTextModelId({
        mode: "chat",
        preferChat: true,
        preferSpeed: true,
      });
      const raw = await callTextModel(prompt, modelIdToUse);
      const reply = raw.trim();
      const assistantMessage: ChatMessage = { role: "assistant", text: reply };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        text: "Hubo un error al consultar el modelo.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={commonStyles.section}>
      <p>{copy.intro}</p>
      <div style={commonStyles.chatContainer}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...commonStyles.chatMessage,
              ...(msg.role === "user"
                ? commonStyles.userMessage
                : commonStyles.aiMessage),
            }}
          >
            {msg.text}
            {msg.role === "assistant" && (
              <button
                style={commonStyles.copyButton}
                onClick={() => onCopy(msg.text)}
              >
                {outputCopy.copy}
              </button>
            )}
          </div>
        ))}
        {isLoading && (
          <div
            style={{ ...commonStyles.chatMessage, ...commonStyles.aiMessage }}
          >
            {copy.typing}
          </div>
        )}
      </div>
      <div style={commonStyles.chatInputRow}>
        <textarea
          style={commonStyles.chatTextInput}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={copy.placeholder}
        />
        <button
          type="button"
          style={commonStyles.generateButton}
          onClick={sendMessage}
          disabled={isLoading}
        >
          {copy.button}
        </button>
      </div>
      <div style={commonStyles.chatCounters}>
        <span>{formatCounterText(current, interfaceLanguage)}</span>
      </div>
    </section>
  );
};

export default ChatMode;
