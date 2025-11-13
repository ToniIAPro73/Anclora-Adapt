import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, Modality, Chat, LiveServerMessage } from "@google/genai";

const API_KEY = process.env.API_KEY;

// Define la interfaz Blob localmente para el tipo de objeto que createBlob retorna.
interface Blob {
  data: string;
  mimeType: string;
}

// Utility functions for audio encoding/decoding
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Utility for image to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) {
        resolve(base64String);
      } else {
        reject(new Error("Failed to convert file to base64."));
      }
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};


interface GeneratedOutput {
  platform: string;
  content: string;
}

// New interface for OutputDisplay specific props
interface OutputDisplayProps {
  isLoading: boolean;
  error: string | null;
  onCopy: (text: string) => void;
  generatedOutputs?: GeneratedOutput[] | null;
  generatedImageUrl?: string | null;
  audioUrl?: string | null;
}

interface CommonProps {
  isLoading: boolean;
  error: string | null;
  generatedOutputs: GeneratedOutput[] | null;
  generatedImageUrl: string | null; // This state is managed by App and passed down
  onGenerate: (prompt: string, schema: any, model?: string, config?: Record<string, any>) => Promise<void>;
  onCopy: (text: string) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setGeneratedImageUrl: React.Dispatch<React.SetStateAction<string | null>>; // Function to update image URL
}

const languages = [
  { value: 'detect', label: 'Detectar automáticamente' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Chino' },
  { value: 'ja', label: 'Japonés' },
  { value: 'ru', label: 'Ruso' },
];

const tones = [
  { value: 'detect', label: 'Detectar automáticamente' },
  { value: 'Profesional', label: 'Profesional' },
  { value: 'Amistoso', label: 'Amistoso' },
  { value: 'Formal', label: 'Formal' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Motivador', label: 'Motivador' },
  { value: 'Emocional', label: 'Emocional' },
  { value: 'Directo', label: 'Directo' },
  { value: 'Creativo', label: 'Creativo' },
];

const platforms = [
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'X', label: 'X (Twitter)' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Email', label: 'Email' },
  { value: 'Web', label: 'Web (Blog/Artículo)' },
];

const recycleOptions = [
  { value: 'summary', label: 'Resumen conciso' },
  { value: 'x_thread', label: 'Hilo para X (Twitter)' },
  { value: 'instagram_caption', label: 'Caption para Instagram' },
  { value: 'title_hook', label: 'Título y Hook persuasivo' },
  { value: 'key_points', label: 'Puntos clave' },
  { value: 'email_launch', label: 'Email de lanzamiento' },
  { value: 'press_release', label: 'Nota de prensa' },
];

const ttsLanguageVoiceMap = {
  es: [
    { value: 'Kore', label: 'Kore (Femenina) - español neutral' },
    { value: 'Charon', label: 'Charon (Masculina) - español neutral' },
  ],
  en: [
    { value: 'Zephyr', label: 'Zephyr (Female) - English (US)' },
    { value: 'Puck', label: 'Puck (Male) - English (US)' },
  ],
  fr: [
    { value: 'Kore', label: 'Kore (Féminine) - Français' },
    { value: 'Charon', label: 'Charon (Masculin) - Français' },
  ],
  de: [
    { value: 'Zephyr', label: 'Zephyr (Weiblich) - Deutsch' },
    { value: 'Puck', label: 'Puck (Männlich) - Deutsch' },
  ],
  pt: [
    { value: 'Kore', label: 'Kore (Feminina) - Português' },
    { value: 'Charon', label: 'Charon (Masculino) - Português' },
  ],
  it: [
    { value: 'Zephyr', label: 'Zephyr (Femminile) - Italiano' },
    { value: 'Puck', label: 'Puck (Maschile) - Italiano' },
  ],
  zh: [
    { value: 'Kore', label: 'Kore (女性) - 中文' },
    { value: 'Charon', label: 'Charon (男性) - 中文' },
  ],
  ja: [
    { value: 'Zephyr', label: 'Zephyr (女性) - 日本語' },
    { value: 'Puck', label: 'Puck (男性) - 日本語' },
  ],
  ru: [
    { value: 'Kore', label: 'Kore (Женский) - Русский' },
    { value: 'Charon', label: 'Charon (Мужской) - Русский' },
  ],
  ar: [
    { value: 'Zephyr', label: 'Zephyr (أنثى) - العربية' },
    { value: 'Puck', label: 'Puck (ذكر) - العربية' },
  ],
};

const ttsLanguageOptions = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Chino' },
  { value: 'ja', label: 'Japonés' },
  { value: 'ru', label: 'Ruso' },
  { value: 'ar', label: 'Árabe' },
];


const outputSchema = {
  type: Type.OBJECT,
  properties: {
    outputs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          platform: {
            type: Type.STRING,
            description: "The platform for which the content is generated (e.g., LinkedIn, X, Instagram, WhatsApp, Email, Web).",
          },
          content: {
            type: Type.STRING,
            description: "The generated content adapted for the specific platform, tone, and language.",
          },
        },
        required: ["platform", "content"],
        propertyOrdering: ["platform", "content"],
      },
    },
  },
  required: ["outputs"],
  propertyOrdering: ["outputs"],
};

const commonStyles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '30px 20px',
    maxWidth: '1280px',
    margin: '0 auto',
    minHeight: '100vh',
    boxSizing: 'border-box',
    gap: '30px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', // Para posicionar el botón de ayuda
  },
  title: {
    fontFamily: '"Libre Baskerville", serif',
    color: 'var(--azul-profundo)',
    fontSize: '3.2em',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '1.2em',
    color: 'var(--texto)',
    opacity: 0.85,
    margin: 0,
  },
  mainContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    backgroundColor: 'var(--blanco)',
    padding: '30px',
    borderRadius: '18px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.06)',
  },
  tabNavigation: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap', // Allow tabs to wrap on smaller screens
    marginBottom: '30px',
    borderBottom: '2px solid #e0e0e0',
    width: '100%',
  },
  tabButton: {
    backgroundColor: 'transparent',
    border: 'none',
    padding: '15px 15px', // Reduced padding for more tabs
    fontSize: '1em', // Reduced font size for more tabs
    fontWeight: 600,
    color: 'var(--texto)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'color 0.3s ease',
    outline: 'none',
    opacity: 0.7,
    flexShrink: 0, // Prevent buttons from shrinking too much
  },
  tabButtonActive: {
    color: 'var(--azul-claro)',
    opacity: 1,
  },
  tabButtonActiveUnderline: {
    content: '""',
    position: 'absolute',
    bottom: '-2px',
    left: '0',
    width: '100%',
    height: '2px',
    backgroundColor: 'var(--azul-claro)',
  },
  section: {
    marginBottom: '25px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '1.1em',
    fontWeight: 600,
    color: 'var(--azul-profundo)',
  },
  textarea: {
    width: '100%',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '1em',
    color: 'var(--texto)',
    resize: 'vertical',
    boxSizing: 'border-box',
    marginBottom: '15px',
    backgroundColor: 'var(--gris-fondo)',
  },
  voiceButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#bdc3c7',
    color: 'var(--blanco)',
    fontSize: '1em',
    cursor: 'not-allowed',
    opacity: 0.7,
    fontWeight: 500,
  },
  configSection: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '25px',
    marginBottom: '20px',
  },
  configGroup: {
    flex: '1 1 calc(33% - 25px)',
    minWidth: '200px',
  },
  select: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '1em',
    color: 'var(--texto)',
    backgroundColor: 'var(--gris-fondo)',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%237f8c8d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '20px',
  },
  platformCheckboxes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    padding: '8px 15px',
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    color: 'var(--texto)',
  },
  checkboxInput: {
    marginRight: '8px',
    cursor: 'pointer',
  },
  generateButton: {
    width: '100%',
    padding: '15px 25px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(90deg, var(--azul-claro), var(--ambar))',
    color: 'var(--texto)',
    fontSize: '1.2em',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.3s ease',
    boxShadow: '0 4px 10px rgba(46, 175, 196, 0.3)',
  },
  generateButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  errorMessage: {
    color: '#e74c3c',
    backgroundColor: '#fcecec',
    border: '1px solid #e74c3c',
    padding: '15px',
    borderRadius: '8px',
    marginTop: '20px',
    textAlign: 'center',
  },
  loadingMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    marginTop: '20px',
    color: 'var(--texto)',
  },
  spinner: {
    border: '4px solid rgba(0, 0, 0, 0.1)',
    borderTop: '4px solid var(--azul-claro)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
  },
  outputSection: {
    marginTop: '40px',
    borderTop: '1px solid #eee',
    paddingTop: '30px',
  },
  outputSectionTitle: {
    fontSize: '1.8em',
    color: 'var(--azul-profundo)',
    marginBottom: '25px',
    textAlign: 'center',
  },
  outputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '25px',
  },
  outputCard: {
    backgroundColor: 'var(--blanco)',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '25px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  outputCardTitle: {
    fontSize: '1.4em',
    color: 'var(--azul-claro)',
    marginBottom: '15px',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  outputCardContent: {
    fontSize: '1em',
    color: 'var(--texto)',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginBottom: '20px',
    flexGrow: 1,
  },
  copyButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 15px',
    borderRadius: '6px',
    border: '1px solid var(--azul-claro)',
    backgroundColor: 'var(--blanco)',
    color: 'var(--azul-claro)',
    fontSize: '0.9em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
    width: 'fit-content',
    alignSelf: 'flex-end',
  },
  // Chat specific styles
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    height: '500px',
    border: '1px solid #ddd',
    borderRadius: '10px',
    padding: '15px',
    overflowY: 'auto',
    backgroundColor: 'var(--gris-fondo)',
  },
  chatMessage: {
    padding: '10px 15px',
    borderRadius: '15px',
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
    borderBottomRightRadius: '2px',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
    color: 'var(--texto)',
    borderBottomLeftRadius: '2px',
  },
  chatInputContainer: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
  },
  chatInput: {
    flexGrow: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '1em',
    color: 'var(--texto)',
    backgroundColor: 'var(--blanco)',
  },
  chatButton: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--azul-claro)',
    color: 'var(--blanco)',
    fontSize: '1em',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  // Live Chat specific styles
  liveChatControl: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  liveChatButton: {
    padding: '12px 25px',
    borderRadius: '10px',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    fontSize: '1em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  startRecording: {
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
  },
  stopRecording: {
    backgroundColor: '#e74c3c',
    color: 'var(--blanco)',
  },
  liveTranscript: {
    backgroundColor: 'var(--gris-fondo)',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '15px',
    minHeight: '150px',
    maxHeight: '300px',
    overflowY: 'auto',
    marginBottom: '20px',
    color: 'var(--texto)',
    lineHeight: '1.6',
  },
  liveTranscriptUser: {
    fontWeight: 600,
    color: 'var(--azul-profundo)',
  },
  liveTranscriptAI: {
    fontStyle: 'italic',
    color: 'var(--texto)',
  },
  warningMessage: {
    backgroundColor: 'var(--ambar)',
    color: 'var(--texto)',
    padding: '10px',
    borderRadius: '8px',
    textAlign: 'center',
    marginBottom: '15px',
    fontSize: '0.9em',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid #eee',
    marginTop: '15px',
    marginBottom: '15px',
  },
  audioPlayer: {
    width: '100%',
    marginTop: '15px',
    marginBottom: '15px',
  },
  fileInput: {
    display: 'block',
    width: '100%',
    padding: '10px 0',
    marginBottom: '10px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: 'var(--gris-fondo)',
    color: 'var(--texto)',
    cursor: 'pointer',
  },
  helpButton: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '1.2em',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(46, 175, 196, 0.4)',
    transition: 'background-color 0.2s ease',
  },
  // Tutorial Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'var(--blanco)',
    padding: '30px',
    borderRadius: '15px',
    maxWidth: '600px',
    width: '90%',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '1.5em',
    color: 'var(--texto)',
    cursor: 'pointer',
    opacity: 0.7,
  },
  modalTitle: {
    fontFamily: '"Libre Baskerville", serif',
    color: 'var(--azul-profundo)',
    fontSize: '2em',
    marginBottom: '10px',
  },
  modalDescription: {
    fontSize: '1em',
    color: 'var(--texto)',
    lineHeight: '1.6',
  },
  modalNavigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
  },
  modalNavButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
    fontSize: '1em',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  modalNavButtonSecondary: {
    backgroundColor: '#e0e0e0',
    color: 'var(--texto)',
  },
  modalNavButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

// Keyframe for spinner animation and hover styles
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.checkboxLabel:hover {
  background-color: #dfe6e9;
}
.generateButton:hover:not(:disabled) {
  opacity: 0.8;
}
.copyButton:hover {
  background-color: var(--azul-claro);
  color: var(--blanco);
}
.tabButton:hover:not(.active) {
  color: var(--azul-claro);
  opacity: 0.9;
}
.chatButton:hover {
  background-color: #2697a8;
}
.liveChatButton.startRecording:hover {
  background-color: #2697a8;
}
.liveChatButton.stopRecording:hover {
  background-color: #c0392b;
}
input[type="file"]::file-selector-button {
  background-color: var(--azul-claro);
  color: var(--blanco);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-right: 10px;
}
input[type="file"]::file-selector-button:hover {
  background-color: #2697a8;
}
${commonStyles.helpButton}:hover {
  background-color: #2697a8;
}
${commonStyles.modalNavButton}:hover:not(:disabled) {
  background-color: #2697a8;
}
${commonStyles.modalNavButtonSecondary}:hover:not(:disabled) {
  background-color: #c0c0c0;
}
`;
document.head.appendChild(styleSheet);


const OutputDisplay: React.FC<OutputDisplayProps> = ({ generatedOutputs, onCopy, isLoading, error, audioUrl, generatedImageUrl }) => {
  const getImageFileName = (url: string): string => {
    try {
      const mimeMatch = url.match(/^data:(image\/[a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const extension = mimeType.split('/')[1] || 'png';
      return `anclora_image.${extension}`;
    } catch (e) {
      console.error("Error parsing image URL for filename:", e);
      return 'anclora_image.png';
    }
  };

  return (
    <>
      {error && (
        <div style={commonStyles.errorMessage} role="alert">
          {error}
        </div>
      )}

      {isLoading && (
        <div style={commonStyles.loadingMessage} role="status" aria-live="polite">
          <div style={commonStyles.spinner}></div>
          <p>La IA está trabajando en tu contenido. Esto puede tardar unos segundos...</p>
        </div>
      )}

      {audioUrl && (
        <section style={commonStyles.outputSection} aria-label="Audio generado">
          <h2 style={commonStyles.outputSectionTitle}>Audio Generado:</h2>
          <audio controls src={audioUrl} style={commonStyles.audioPlayer} aria-label="Reproducir audio generado"></audio>
          <a href={audioUrl} download="anclora_speech.wav" style={{...commonStyles.copyButton, marginTop: '10px'}} aria-label="Descargar audio generado">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-download">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span style={{ marginLeft: '4px' }}>Descargar Audio</span>
          </a>
        </section>
      )}

      {generatedImageUrl && (
        <section style={commonStyles.outputSection} aria-label="Imagen generada/editada">
          <h2 style={commonStyles.outputSectionTitle}>Imagen Generada/Editada:</h2>
          <img src={generatedImageUrl} alt="Contenido generado por IA" style={commonStyles.imagePreview} />
          <a href={generatedImageUrl} download={getImageFileName(generatedImageUrl)} style={{...commonStyles.copyButton, marginTop: '10px'}} aria-label="Descargar imagen generada/editada">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-download">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span style={{ marginLeft: '4px' }}>Descargar Imagen</span>
          </a>
        </section>
      )}

      {generatedOutputs && generatedOutputs.length > 0 && (
        <section style={commonStyles.outputSection} aria-label="Contenido generado">
          <h2 style={commonStyles.outputSectionTitle}>Resultados Adaptados:</h2>
          <div style={commonStyles.outputGrid}>
            {generatedOutputs.map((output, index) => (
              <div key={index} style={commonStyles.outputCard}>
                <h3 style={commonStyles.outputCardTitle}>{output.platform}</h3>
                <p style={commonStyles.outputCardContent}>{output.content}</p>
                <button
                  onClick={() => onCopy(output.content)}
                  style={commonStyles.copyButton}
                  aria-label={`Copiar contenido para ${output.platform}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-copy">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span style={{ marginLeft: '4px' }}>Copiar</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
};


const BasicMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [selectedTone, setSelectedTone] = useState<string>('detect');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['LinkedIn', 'X', 'Instagram']);
  const [responseSpeed, setResponseSpeed] = useState<string>('flash'); // 'flash' or 'flash-lite'

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
  }, [setGeneratedImageUrl]);

  const handlePlatformChange = (platformValue: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformValue)) {
        return prev.filter(p => p !== platformValue);
      } else {
        return [...prev, platformValue];
      }
    });
  };

  const generateBasicContent = useCallback(async () => {
    if (!userInput.trim()) {
      setError('Por favor, escribe lo que quieres comunicar.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError('Por favor, selecciona al menos una plataforma.');
      return;
    }

    const platformList = selectedPlatforms.map(p => platforms.find(pl => pl.value === p)?.label || p).join(', ');
    const languageDisplay = languages.find(lang => lang.value === selectedLanguage)?.label || selectedLanguage;
    const toneDisplay = tones.find(t => t.value === selectedTone)?.label || selectedTone;

    const prompt = `Eres un experto en comunicación digital. Te daré una idea principal y las plataformas, tonos y idiomas deseados. Genera un contenido único para cada plataforma, adaptado al tono y al idioma especificado. La salida debe ser un objeto JSON con una propiedad 'outputs' que contiene un array de objetos. Cada objeto en el array debe tener las propiedades 'platform' y 'content'.

Idea principal: '${userInput}'
Idioma de salida: ${languageDisplay}
Tono general: ${toneDisplay}
Plataformas requeridas: ${platformList}

Ejemplo de formato de salida:
\`\`\`json
{
  "outputs": [
    { "platform": "LinkedIn", "content": "Contenido profesional para LinkedIn aquí..." },
    { "platform": "X", "content": "Tweet conciso para X aquí..." }
  ]
}
\`\`\`
Ahora, genera el contenido basado en la idea y configuraciones proporcionadas.`;

    const modelToUse = responseSpeed === 'flash-lite' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
    await onGenerate(prompt, outputSchema, modelToUse);
  }, [userInput, selectedLanguage, selectedTone, selectedPlatforms, responseSpeed, onGenerate, setError]);

  return (
    <>
      <section style={commonStyles.section}>
        <label htmlFor="userInputBasic" style={commonStyles.label}>Tu idea principal:</label>
        <textarea
          id="userInputBasic"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Escribe o di lo que quieres comunicar (ej. 'Quiero contar que lanzamos un nuevo ebook gratuito sobre productividad')"
          rows={6}
          style={commonStyles.textarea}
          aria-label="Introduce tu idea principal"
        />
        <button style={commonStyles.voiceButton} disabled aria-label="Entrada de voz (próximamente)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
          <span style={{ marginLeft: '8px' }}>Voz (próximamente)</span>
        </button>
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label htmlFor="languageSelectBasic" style={commonStyles.label}>Idioma de Salida:</label>
          <select
            id="languageSelectBasic"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={commonStyles.select}
            aria-label="Selecciona el idioma de salida"
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div style={commonStyles.configGroup}>
          <label htmlFor="toneSelectBasic" style={commonStyles.label}>Tono:</label>
          <select
            id="toneSelectBasic"
            value={selectedTone}
            onChange={(e) => setSelectedTone(e.target.value)}
            style={commonStyles.select}
            aria-label="Selecciona el tono del mensaje"
          >
            {tones.map(tone => (
              <option key={tone.value} value={tone.value}>{tone.label}</option>
            ))}
          </select>
        </div>

        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Plataformas:</label>
          <div style={commonStyles.platformCheckboxes} role="group" aria-labelledby="platformSelectLabel">
            {platforms.map(platform => (
              <label key={platform.value} className="checkboxLabel">
                <input
                  type="checkbox"
                  value={platform.value}
                  checked={selectedPlatforms.includes(platform.value)}
                  onChange={() => handlePlatformChange(platform.value)}
                  style={commonStyles.checkboxInput}
                  aria-checked={selectedPlatforms.includes(platform.value)}
                />
                {platform.label}
              </label>
            ))}
          </div>
        </div>
        <div style={commonStyles.configGroup}>
          <label htmlFor="responseSpeedSelect" style={commonStyles.label}>Velocidad de Respuesta:</label>
          <select
            id="responseSpeedSelect"
            value={responseSpeed}
            onChange={(e) => setResponseSpeed(e.target.value)}
            style={commonStyles.select}
            aria-label="Selecciona la velocidad de respuesta de la IA"
          >
            <option value="flash">Normal (gemini-2.5-flash)</option>
            <option value="flash-lite">Rápida (gemini-2.5-flash-lite)</option>
          </select>
        </div>
      </section>

      <button
        onClick={generateBasicContent}
        disabled={isLoading}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? 'Generando...' : 'Generar Contenido'}
      </button>

      {/* Fix: Pass explicit props to OutputDisplay */}
      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} generatedImageUrl={generatedImageUrl} />
    </>
  );
};

const IntelligentMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [deepThinking, setDeepThinking] = useState<boolean>(false);
  const [includeImage, setIncludeImage] = useState<boolean>(false);
  const [imageMode, setImageMode] = useState<'generate' | 'edit'>('generate');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
    setImageFile(null);
    setImagePreviewUrl(null);
  }, [setGeneratedImageUrl]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const generateIntelligentContent = useCallback(async () => {
    if (!userInput.trim()) {
      setError('Por favor, escribe lo que quieres comunicar.');
      return;
    }
    if (includeImage && imageMode === 'edit' && !imageFile) {
        setError('Por favor, sube una imagen para editar.');
        return;
    }
    if (includeImage && !imagePrompt.trim()) {
        setError('Por favor, introduce un prompt para la imagen.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null); // Clear previous image output

    try {
      if (!API_KEY) {
        throw new Error("API Key not found. Please ensure process.env.API_KEY is configured.");
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const textGenerationPrompt = `Eres un asistente de comunicación digital altamente inteligente y creativo. Tu tarea es tomar una idea o necesidad expresada por el usuario en lenguaje natural y transformarla en contenido adaptado para diversas plataformas. Debes inferir el idioma, el tono, las plataformas más adecuadas y el formato óptimo (post, mensaje, email, etc.) a partir de la entrada del usuario.

La salida debe ser un objeto JSON con una propiedad 'outputs' que contiene un array de objetos. Cada objeto en el array debe tener las propiedades 'platform' y 'content'. Si no se especifican plataformas, elige las 3-5 más relevantes.

Entrada del usuario: '${userInput}'

Ejemplo de formato de salida:
\`\`\`json
{
  "outputs": [
    { "platform": "LinkedIn", "content": "Contenido profesional inferido aquí..." },
    { "platform": "X", "content": "Tweet conciso inferido aquí..." }
  ]
}
\`\`\`
Ahora, interpreta la entrada del usuario y genera el contenido adaptado.`;

      const modelToUse = deepThinking ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
      const config = deepThinking ? { thinkingConfig: { thinkingBudget: 32768 } } : undefined;

      // First, generate text content
      await onGenerate(textGenerationPrompt, outputSchema, modelToUse, config);

      // Then, if image is included, generate/edit image
      if (includeImage) {
        let imageContents: any[] = [];
        if (imageMode === 'edit' && imageFile) {
          const base64ImageData = await fileToBase64(imageFile);
          imageContents.push({ inlineData: { data: base64ImageData, mimeType: imageFile.type } });
        }
        imageContents.push({ text: imagePrompt });

        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: imageContents },
          config: { responseModalities: [Modality.IMAGE] },
        });

        const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (generatedImagePart?.inlineData) {
          const base64ImageBytes: string = generatedImagePart.inlineData.data;
          const imageUrl = `data:${generatedImagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
          setGeneratedImageUrl(imageUrl);
        } else {
          setError('No se recibió imagen de la IA. Inténtalo de nuevo.');
        }
      }

    } catch (err: any) {
      console.error('Error al generar contenido inteligente o imagen:', err);
      setError(`Error general: ${err.message || 'Error desconocido'}.`);
    } finally {
      setIsLoading(false); // Intelligent mode always sets isLoading to false here
    }
  }, [userInput, deepThinking, includeImage, imageMode, imageFile, imagePrompt, onGenerate, setError, setGeneratedImageUrl, setIsLoading]);


  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">Dime lo que quieres y yo lo adapto</h3>
        <p>Escribe tu idea o necesidad en lenguaje natural, sin preocuparte por el formato o el destino. La IA lo interpretará y generará el contenido más adecuado.</p>
        <label htmlFor="userInputIntelligent" style={commonStyles.label}>Tu mensaje conversacional:</label>
        <textarea
          id="userInputIntelligent"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ej: 'Necesito una forma creativa de anunciar que he vuelto a publicar artículos en Medium, y que la gente se suscriba a mi newsletter. En tono amistoso y motivador. Para X y LinkedIn.'"
          rows={8}
          style={commonStyles.textarea}
          aria-label="Introduce tu mensaje conversacional para que la IA lo adapte"
        />
      </section>
      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={deepThinking}
                    onChange={() => setDeepThinking(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>Pensamiento Profundo (gemini-2.5-pro)</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>(Para consultas complejas, mayor latencia)</span>
            </label>
        </div>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={() => setIncludeImage(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>Incluir/Editar Imagen</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>(Genera o edita una imagen para tu contenido)</span>
            </label>
        </div>
      </section>

      {includeImage && (
        <section style={commonStyles.section}>
            <h4 className="h3" style={{fontSize: '1.2em', marginTop: '0'}}>Configuración de Imagen:</h4>
            <div style={{display: 'flex', gap: '20px', marginBottom: '15px'}}>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeIntelligent"
                        value="generate"
                        checked={imageMode === 'generate'}
                        onChange={() => {setImageMode('generate'); setImageFile(null); setImagePreviewUrl(null);}}
                        style={commonStyles.checkboxInput}
                    />
                    Generar nueva imagen
                </label>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeIntelligent"
                        value="edit"
                        checked={imageMode === 'edit'}
                        onChange={() => setImageMode('edit')}
                        style={commonStyles.checkboxInput}
                    />
                    Editar imagen existente
                </label>
            </div>

            {imageMode === 'edit' && (
                <div style={{marginBottom: '15px'}}>
                    <label htmlFor="imageUploadIntelligent" style={commonStyles.label}>Sube tu imagen:</label>
                    <input
                        id="imageUploadIntelligent"
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        style={commonStyles.fileInput}
                        aria-label="Subir imagen para editar"
                    />
                    {imagePreviewUrl && (
                        <div style={{marginTop: '15px'}}>
                            <h4 style={{fontSize: '1em', color: 'var(--texto)', opacity: 0.8}}>Previsualización:</h4>
                            <img src={imagePreviewUrl} alt="Previsualización" style={commonStyles.imagePreview} />
                        </div>
                    )}
                </div>
            )}

            <label htmlFor="imagePromptIntelligent" style={commonStyles.label}>Prompt de Imagen:</label>
            <textarea
                id="imagePromptIntelligent"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={imageMode === 'generate' ? "Ej: 'Un robot con una patineta roja en un estilo futurista'" : "Ej: 'Añade un filtro retro', 'Quita a la persona del fondo', 'Haz el cielo más azul'"}
                rows={4}
                style={commonStyles.textarea}
                aria-label="Describe la imagen a generar o cómo editarla"
            />
        </section>
      )}

      <button
        onClick={generateIntelligentContent}
        disabled={isLoading || (includeImage && imageMode === 'edit' && !imageFile) || (includeImage && !imagePrompt.trim())}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? 'Interpretando y Generando...' : 'Interpretar y Generar Contenido'}
      </button>

      {/* Fix: Pass explicit props to OutputDisplay */}
      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} generatedImageUrl={generatedImageUrl} />
    </>
  );
};

const CampaignMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl }) => {
  const [userInput, setUserInput] = useState<string>('');
  const campaignPlatforms = ['LinkedIn', 'X', 'Instagram', 'Email', 'WhatsApp']; // Fixed for campaign mode
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [deepThinking, setDeepThinking] = useState<boolean>(false);
  const [includeImage, setIncludeImage] = useState<boolean>(false);
  const [imageMode, setImageMode] = useState<'generate' | 'edit'>('generate');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
    setImageFile(null);
    setImagePreviewUrl(null);
  }, [setGeneratedImageUrl]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };


  const generateCampaignContent = useCallback(async () => {
    if (!userInput.trim()) {
      setError('Por favor, escribe la idea principal de tu campaña.');
      return;
    }
    if (includeImage && imageMode === 'edit' && !imageFile) {
        setError('Por favor, sube una imagen para editar.');
        return;
    }
    if (includeImage && !imagePrompt.trim()) {
        setError('Por favor, introduce un prompt para la imagen.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null); // Clear previous image output

    try {
      if (!API_KEY) {
        throw new Error("API Key not found. Please ensure process.env.API_KEY is configured.");
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const platformList = campaignPlatforms.join(', ');
      const languageDisplay = languages.find(lang => lang.value === selectedLanguage)?.label || selectedLanguage;

      const textGenerationPrompt = `Eres un estratega de marketing digital experto. Genera un conjunto de mensajes coordinados para una campaña de marketing express, basados en la idea principal del usuario. Cada mensaje debe estar adaptado a las características específicas de la plataforma, mantener un tono coherente y persuasivo, e incluir un Call To Action (CTA) relevante para cada canal. El idioma de todas las salidas debe ser '${languageDisplay}'.

La salida debe ser un objeto JSON con una propiedad 'outputs' que contiene un array de objetos. Cada objeto en el array debe tener las propiedades 'platform' y 'content'.

Idea principal de la campaña: '${userInput}'
Plataformas objetivo: ${platformList}

Ejemplo de formato de salida:
\`\`\`json
{
  "outputs": [
    { "platform": "LinkedIn", "content": "Post profesional motivador con CTA para LinkedIn..." },
    { "platform": "Instagram", "content": "Caption emotivo y directo con emojis y CTA para Instagram..." }
  ]
}
\`\`\`
Ahora, genera los contenidos coordinados para la campaña.`;

      const modelToUse = deepThinking ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
      const config = deepThinking ? { thinkingConfig: { thinkingBudget: 32768 } } : undefined;

      // First, generate text content
      await onGenerate(textGenerationPrompt, outputSchema, modelToUse, config);

      // Then, if image is included, generate/edit image
      if (includeImage) {
        let imageContents: any[] = [];
        if (imageMode === 'edit' && imageFile) {
          const base64ImageData = await fileToBase64(imageFile);
          imageContents.push({ inlineData: { data: base64ImageData, mimeType: imageFile.type } });
        }
        imageContents.push({ text: imagePrompt });

        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: imageContents },
          config: { responseModalities: [Modality.IMAGE] },
        });

        const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (generatedImagePart?.inlineData) {
          const base64ImageBytes: string = generatedImagePart.inlineData.data;
          const imageUrl = `data:${generatedImagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
          setGeneratedImageUrl(imageUrl);
        } else {
          setError('No se recibió imagen de la IA. Inténtalo de nuevo.');
        }
      }

    } catch (err: any) {
      console.error('Error al generar campaña o imagen:', err);
      setError(`Error general: ${err.message || 'Error desconocido'}.`);
    } finally {
      setIsLoading(false);
    }
  }, [userInput, selectedLanguage, deepThinking, includeImage, imageMode, imageFile, imagePrompt, onGenerate, setError, setGeneratedImageUrl, setIsLoading]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">Multiplica tu mensaje</h3>
        <p>Una idea, múltiples textos coordinados para una campaña express. La IA generará contenido adaptado a las principales plataformas de comunicación.</p>
        <label htmlFor="userInputCampaign" style={commonStyles.label}>Idea principal de tu campaña:</label>
        <textarea
          id="userInputCampaign"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ej: 'Quiero promocionar mi nuevo curso de IA con un enfoque inspirador, dirigido a marketers digitales'"
          rows={6}
          style={commonStyles.textarea}
          aria-label="Introduce la idea principal de tu campaña"
        />
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
            <label htmlFor="languageSelectCampaign" style={commonStyles.label}>Idioma de Salida:</label>
            <select
              id="languageSelectCampaign"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={commonStyles.select}
              aria-label="Selecciona el idioma de salida para la campaña"
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Plataformas de Campaña:</label>
          <div style={commonStyles.platformCheckboxes}>
            {campaignPlatforms.map(platformValue => (
              <span key={platformValue} className="tag">{platforms.find(p => p.value === platformValue)?.label || platformValue}</span>
            ))}
          </div>
        </div>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={deepThinking}
                    onChange={() => setDeepThinking(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>Pensamiento Profundo (gemini-2.5-pro)</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>(Para estrategias complejas, mayor latencia)</span>
            </label>
        </div>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={() => setIncludeImage(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>Incluir/Editar Imagen</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>(Genera o edita una imagen para tu campaña)</span>
            </label>
        </div>
      </section>

      {includeImage && (
        <section style={commonStyles.section}>
            <h4 className="h3" style={{fontSize: '1.2em', marginTop: '0'}}>Configuración de Imagen:</h4>
            <div style={{display: 'flex', gap: '20px', marginBottom: '15px'}}>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeCampaign"
                        value="generate"
                        checked={imageMode === 'generate'}
                        onChange={() => {setImageMode('generate'); setImageFile(null); setImagePreviewUrl(null);}}
                        style={commonStyles.checkboxInput}
                    />
                    Generar nueva imagen
                </label>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeCampaign"
                        value="edit"
                        checked={imageMode === 'edit'}
                        onChange={() => setImageMode('edit')}
                        style={commonStyles.checkboxInput}
                    />
                    Editar imagen existente
                </label>
            </div>

            {imageMode === 'edit' && (
                <div style={{marginBottom: '15px'}}>
                    <label htmlFor="imageUploadCampaign" style={commonStyles.label}>Sube tu imagen:</label>
                    <input
                        id="imageUploadCampaign"
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        style={commonStyles.fileInput}
                        aria-label="Subir imagen para editar"
                    />
                    {imagePreviewUrl && (
                        <div style={{marginTop: '15px'}}>
                            <h4 style={{fontSize: '1em', color: 'var(--texto)', opacity: 0.8}}>Previsualización:</h4>
                            <img src={imagePreviewUrl} alt="Previsualización" style={commonStyles.imagePreview} />
                        </div>
                    )}
                </div>
            )}

            <label htmlFor="imagePromptCampaign" style={commonStyles.label}>Prompt de Imagen:</label>
            <textarea
                id="imagePromptCampaign"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={imageMode === 'generate' ? "Ej: 'Un logo inspirador para un curso de IA para marketers'" : "Ej: 'Cambia el fondo a un entorno de oficina moderno'"}
                rows={4}
                style={commonStyles.textarea}
                aria-label="Describe la imagen a generar o cómo editarla para tu campaña"
            />
        </section>
      )}

      <button
        onClick={generateCampaignContent}
        disabled={isLoading || (includeImage && imageMode === 'edit' && !imageFile) || (includeImage && !imagePrompt.trim())}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? 'Creando Campaña...' : 'Generar Campaña Coordinada'}
      </button>

      {/* Fix: Pass explicit props to OutputDisplay */}
      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} generatedImageUrl={generatedImageUrl} />
    </>
  );
};

const RecycleMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl }) => {
  const [existingContent, setExistingContent] = useState<string>('');
  const [selectedRecycleOption, setSelectedRecycleOption] = useState<string>('summary');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [selectedTone, setSelectedTone] = useState<string>('detect');

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
  }, [setGeneratedImageUrl]);

  const generateRecycledContent = useCallback(async () => {
    if (!existingContent.trim()) {
      setError('Por favor, pega el contenido que quieres reciclar.');
      return;
    }

    const recycleOptionDisplay = recycleOptions.find(opt => opt.value === selectedRecycleOption)?.label || selectedRecycleOption;
    const languageDisplay = languages.find(lang => lang.value === selectedLanguage)?.label || selectedLanguage;
    const toneDisplay = tones.find(t => t.value === selectedTone)?.label || selectedTone;

    const prompt = `Eres un experto en transformación de contenidos. Tu tarea es tomar un texto existente y transformarlo según la opción de reciclaje, tono e idioma especificados.

La salida debe ser un objeto JSON con una propiedad 'outputs' que contiene un array con un único objeto. Este objeto debe tener las propiedades 'platform' (indicando el tipo de reciclaje/destino) y 'content'.

Contenido existente: '${existingContent}'
Opción de reciclaje: '${recycleOptionDisplay}'
Idioma de salida: ${languageDisplay}
Tono deseado: ${toneDisplay}

Ejemplo de formato de salida para un resumen:
\`\`\`json
{
  "outputs": [
    { "platform": "Resumen", "content": "Aquí va el resumen conciso del contenido existente." }
  ]
}
\`\`\`
Ahora, genera el contenido reciclado.`;

    // Adjust the output schema for RecycleMode to reflect a single output with a 'platform' that describes the transformation.
    const recycleOutputSchema = {
        type: Type.OBJECT,
        properties: {
          outputs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: {
                  type: Type.STRING,
                  description: "Describes the type of recycled content (e.g., Resumen, Hilo X, Caption IG).",
                },
                content: {
                  type: Type.STRING,
                  description: "The transformed content.",
                },
              },
              required: ["platform", "content"],
              propertyOrdering: ["platform", "content"],
            },
            minItems: 1,
            maxItems: 1, // Expect only one item for recycling a single piece of content
          },
        },
        required: ["outputs"],
        propertyOrdering: ["outputs"],
      };

    await onGenerate(prompt, recycleOutputSchema);
  }, [existingContent, selectedRecycleOption, selectedLanguage, selectedTone, onGenerate, setError]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">Sistema de Reciclaje de Contenidos</h3>
        <p>Transforma contenido existente en nuevos formatos, idiomas o tonos para maximizar su alcance y utilidad.</p>
        <label htmlFor="existingContent" style={commonStyles.label}>Pega aquí tu contenido existente:</label>
        <textarea
          id="existingContent"
          value={existingContent}
          onChange={(e) => setExistingContent(e.target.value)}
          placeholder="Pega un artículo, post de blog, email, o cualquier texto que quieras reciclar."
          rows={8}
          style={commonStyles.textarea}
          aria-label="Contenido existente para reciclar"
        />
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label htmlFor="recycleOption" style={commonStyles.label}>Tipo de Reciclaje:</label>
          <select
            id="recycleOption"
            value={selectedRecycleOption}
            onChange={(e) => setSelectedRecycleOption(e.target.value)}
            style={commonStyles.select}
            aria-label="Selecciona el tipo de transformación para el contenido"
          >
            {recycleOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div style={commonStyles.configGroup}>
            <label htmlFor="languageSelectRecycle" style={commonStyles.label}>Idioma de Salida:</label>
            <select
              id="languageSelectRecycle"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={commonStyles.select}
              aria-label="Selecciona el idioma de salida para el contenido reciclado"
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div style={commonStyles.configGroup}>
            <label htmlFor="toneSelectRecycle" style={commonStyles.label}>Tono:</label>
            <select
              id="toneSelectRecycle"
              value={selectedTone}
              onChange={(e) => setSelectedTone(e.target.value)}
              style={commonStyles.select}
              aria-label="Selecciona el tono deseado para el contenido reciclado"
            >
              {tones.map(tone => (
                <option key={tone.value} value={tone.value}>{tone.label}</option>
              ))}
            </select>
          </div>
      </section>

      <button
        onClick={generateRecycledContent}
        disabled={isLoading}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? 'Reciclando Contenido...' : 'Reciclar Contenido'}
      </button>

      {/* Fix: Pass explicit props to OutputDisplay. generatedOutputs and generatedImageUrl come from CommonProps */}
      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} generatedImageUrl={generatedImageUrl} />
    </>
  );
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const ChatMode: React.FC<Pick<CommonProps, 'onCopy' | 'setError' | 'setIsLoading' | 'isLoading' | 'error'>> = ({ onCopy, setError, setIsLoading, isLoading, error }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState<string>('');
  const chatInstanceRef = useRef<Chat | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const initializeChat = useCallback(() => {
    if (chatInstanceRef.current) return; // Only initialize once
    try {
      if (!API_KEY) {
        throw new Error("API Key not found. Please ensure process.env.API_KEY is configured.");
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      chatInstanceRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: 'Eres un asistente de AncloraAdapt, útil y amigable, enfocado en ayudar a los usuarios con la creación y adaptación de contenido. Responde de forma concisa y directa.'
        }
      });
    } catch (err: any) {
      console.error('Error al inicializar el chat:', err);
      setError(`Error al iniciar el chat: ${err.message || 'Error desconocido'}`);
    }
  }, [setError]);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);


  const sendChatMessage = useCallback(async () => {
    if (!currentChatMessage.trim()) return;
    if (!chatInstanceRef.current) {
        setError("El chat no está inicializado. Intenta recargar.");
        return;
    }

    const userMessage: ChatMessage = { role: 'user', text: currentChatMessage };
    setChatHistory(prev => [...prev, userMessage]);
    setCurrentChatMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatInstanceRef.current.sendMessage({ message: userMessage.text });
      const aiResponseText = response.text;
      const aiMessage: ChatMessage = { role: 'model', text: aiResponseText };
      setChatHistory(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Error al enviar mensaje al chat:', err);
      setError(`Error al obtener respuesta de la IA: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatMessage, setError, setIsLoading]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">Chat con AncloraAI</h3>
        <p>Haz preguntas sobre creación de contenido, estrategias, o cualquier cosa que AncloraAdapt pueda ayudarte a lograr.</p>
        <div style={commonStyles.chatContainer} ref={chatContainerRef} aria-live="polite" aria-atomic="true">
          {chatHistory.length === 0 && !isLoading && (
            <p style={{textAlign: 'center', opacity: 0.7}}>Escribe tu primera pregunta para AncloraAI...</p>
          )}
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              style={{
                ...commonStyles.chatMessage,
                ...(msg.role === 'user' ? commonStyles.userMessage : commonStyles.aiMessage)
              }}
              aria-label={`${msg.role} says ${msg.text}`}
            >
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div style={{ ...commonStyles.chatMessage, ...commonStyles.aiMessage }}>
              <span style={{opacity: 0.7}}>Escribiendo...</span>
            </div>
          )}
        </div>
        {error && (
          <div style={commonStyles.errorMessage} role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        <div style={commonStyles.chatInputContainer}>
          <textarea
            value={currentChatMessage}
            onChange={(e) => setCurrentChatMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }}}
            placeholder="Escribe tu mensaje..."
            rows={1}
            style={commonStyles.chatInput}
            aria-label="Escribe tu mensaje al chatbot"
            disabled={isLoading}
          />
          <button
            onClick={sendChatMessage}
            style={commonStyles.chatButton}
            disabled={isLoading || !currentChatMessage.trim()}
            aria-label="Enviar mensaje"
          >
            Enviar
          </button>
        </div>
      </section>
    </>
  );
};


const TTSMode: React.FC<Pick<CommonProps, 'onCopy' | 'setError' | 'setIsLoading' | 'isLoading' | 'error'>> = ({ onCopy, setError, setIsLoading, isLoading, error }) => {
  const [textToSpeak, setTextToSpeak] = useState<string>('');
  const [selectedTTSLanguage, setSelectedTTSLanguage] = useState<string>('es');
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Kore'); // Default voice for selected language
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({sampleRate: 24000});
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    // Update selectedVoiceName when selectedTTSLanguage changes to a default for that language
    const voicesForLang = ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap];
    if (voicesForLang && voicesForLang.length > 0) {
      setSelectedVoiceName(voicesForLang[0].value); // Select first available voice
    } else {
      setSelectedVoiceName(''); // No voices for this language
    }
  }, [selectedTTSLanguage]);

  const generateSpeech = useCallback(async () => {
    if (!textToSpeak.trim()) {
      setError('Por favor, escribe el texto que quieres convertir a voz.');
      return;
    }
    if (!selectedTTSLanguage || !selectedVoiceName) {
      setError('Por favor, selecciona un idioma y una voz.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      if (!API_KEY) {
        throw new Error("API Key not found. Please ensure process.env.API_KEY is configured.");
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      // First, translate the text to the selected TTS language
      const targetLanguageLabel = ttsLanguageOptions.find(lang => lang.value === selectedTTSLanguage)?.label || selectedTTSLanguage;
      const translationPrompt = `Traduce el siguiente texto al ${targetLanguageLabel} y proporciona únicamente el texto traducido, sin comentarios adicionales ni explicaciones: "${textToSpeak}"`;
      const translationResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Using a general model for translation
        contents: translationPrompt,
      });
      const translatedText = translationResponse.text.trim();

      if (!translatedText) {
          setError('La traducción no produjo ningún texto. Inténtalo de nuevo.');
          setIsLoading(false);
          return;
      }

      // Then, generate speech from the translated text using the selected voice
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: translatedText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoiceName },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        const audioBytes = decode(base64Audio);
        const audioContext = getAudioContext();
        
        // Temporarily decode and play for immediate feedback
        const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0); 

        // Create a WAV Blob for the audio element and download
        const wavBlob = createWavFile(audioBytes, 24000, 1, 16); // 16-bit PCM
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);

      } else {
        setError('No se recibió audio de la IA. Inténtalo de nuevo.');
      }

    } catch (err: any) {
      console.error('Error al generar voz:', err);
      setError(`Error al generar voz: ${err.message || 'Error desconocido'}.`);
    } finally {
      setIsLoading(false);
    }
  }, [textToSpeak, selectedTTSLanguage, selectedVoiceName, setError, setIsLoading, getAudioContext]);

  // Helper to create a WAV blob from raw PCM for browser <audio> tag compatibility
  const createWavFile = (pcmData: Uint8Array, sampleRate: number, numChannels: number, bitDepth: number) => {
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.byteLength;
    const fileSize = 44 + dataSize; // Corrected calculation: 44 bytes for WAV header

    const buffer = new ArrayBuffer(fileSize);
    // Fix: Remove duplicate 'new'
    const view = new DataView(buffer);

    // RIFF chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeString(view, 8, 'WAVE');

    // FMT chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunkSize
    view.setUint16(20, 1, true); // audioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // DATA chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++, offset++) {
        view.setUint8(offset, pcmData[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
        view.setUint8(offset + i, s.charCodeAt(i));
    }
  };


  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">Generar Voz (Texto a Voz)</h3>
        <p>Transforma tu texto en audio. Selecciona el idioma y la voz, y la IA traducirá y leerá el texto.</p>
        
        <label htmlFor="textToSpeak" style={commonStyles.label}>Texto para convertir a voz:</label>
        <textarea
          id="textToSpeak"
          value={textToSpeak}
          onChange={(e) => setTextToSpeak(e.target.value)}
          placeholder="Ej: 'Hola, soy AncloraAdapt. ¿En qué puedo ayudarte hoy?'"
          rows={6}
          style={commonStyles.textarea}
          aria-label="Introduce el texto a convertir a voz"
        />
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label htmlFor="ttsLanguageSelect" style={commonStyles.label}>Idioma de la Voz:</label>
          <select
            id="ttsLanguageSelect"
            value={selectedTTSLanguage}
            onChange={(e) => setSelectedTTSLanguage(e.target.value)}
            style={commonStyles.select}
            aria-label="Selecciona el idioma para la generación de voz"
          >
            {ttsLanguageOptions.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label htmlFor="voiceNameSelect" style={commonStyles.label}>Voz:</label>
          <select
            id="voiceNameSelect"
            value={selectedVoiceName}
            onChange={(e) => setSelectedVoiceName(e.target.value)}
            style={commonStyles.select}
            aria-label="Selecciona el nombre de la voz"
            disabled={!ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap]?.length}
          >
            {ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap]?.map(voice => (
              <option key={voice.value} value={voice.value}>{voice.label}</option>
            ))}
            {!ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap]?.length && (
              <option value="" disabled>No hay voces disponibles</option>
            )}
          </select>
        </div>
      </section>

      <button
        onClick={generateSpeech}
        disabled={isLoading || !textToSpeak.trim() || !selectedTTSLanguage || !selectedVoiceName}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? 'Generando Voz...' : 'Generar Voz'}
      </button>

      {/* Fix: Pass explicit props to OutputDisplay */}
      <OutputDisplay isLoading={isLoading} error={error} onCopy={onCopy} audioUrl={audioUrl} />
    </>
  );
};


// For Live API - assuming window.aistudio is available in the environment
// The coding guidelines state to assume window.aistudio is pre-configured and accessible.

const LiveChatMode: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [currentInputTranscription, setCurrentInputTranscription] = useState<string>('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const playingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const checkApiKey = useCallback(async () => {
    try {
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setHasApiKey(true);
        setApiKeyError(null);
      } else {
        setHasApiKey(false);
      }
    } catch (err) {
      console.error("Error checking API key:", err);
      setApiKeyError("Error al verificar la clave API. Por favor, inténtalo de nuevo.");
      setHasApiKey(false);
    }
  }, []);

  useEffect(() => {
    checkApiKey();
    return () => {
      // Cleanup on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
      }
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
      }
      playingSourcesRef.current.forEach(source => source.stop());
    };
  }, [checkApiKey]);

  const requestApiKey = useCallback(async () => {
    try {
      await window.aistudio.openSelectKey();
      // Assume success after opening dialog, will be verified on next API call
      setHasApiKey(true);
      setApiKeyError(null);
    } catch (err) {
      console.error("Error opening API key selection:", err);
      setApiKeyError("Error al abrir el selector de clave API. Inténtalo de nuevo.");
      setHasApiKey(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!hasApiKey) {
        setApiKeyError("Por favor, selecciona tu clave API para usar la conversación en vivo. Puedes necesitar habilitar la facturación para Gemini Live API.");
        return;
    }
    setIsRecording(true);
    setTranscriptHistory([]);
    setCurrentInputTranscription('');
    setCurrentOutputTranscription('');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      inputAudioContextRef.current = new AudioContext({sampleRate: 16000});
      outputAudioContextRef.current = new AudioContext({sampleRate: 24000});
      nextStartTimeRef.current = 0;

      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      inputSourceRef.current = source; // Keep a ref to disconnect later

      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor; // Keep a ref to disconnect later

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        sessionPromiseRef.current?.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current.destination);

      // It's crucial to create a new GoogleGenAI instance here to ensure it picks up the latest API key
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => { console.debug('Live session opened'); },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const audioContext = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
              const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                audioContext,
                24000,
                1,
              );
              const audioSource = audioContext.createBufferSource();
              audioSource.buffer = audioBuffer;
              audioSource.connect(audioContext.destination);
              audioSource.addEventListener('ended', () => {
                playingSourcesRef.current.delete(audioSource);
              });

              audioSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
              playingSourcesRef.current.add(audioSource);
            }

            // Handle transcription
            if (message.serverContent?.inputTranscription) {
              setCurrentInputTranscription(message.serverContent.inputTranscription.text);
            }
            if (message.serverContent?.outputTranscription) {
              setCurrentOutputTranscription(message.serverContent.outputTranscription.text);
            }
            if (message.serverContent?.turnComplete) {
              setTranscriptHistory(prev => [...prev, `Usuario: ${currentInputTranscription}`, `AI: ${currentOutputTranscription}`]);
              setCurrentInputTranscription('');
              setCurrentOutputTranscription('');
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              playingSourcesRef.current.forEach(source => source.stop());
              playingSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live session error:', e);
            setError(`Error en la sesión en vivo: ${e.message || 'Error desconocido'}. Intenta reiniciar.`);
            stopRecording(); // Automatically stop on error
            // Check API key if error is "Requested entity was not found."
            if (e.message && e.message.includes("Requested entity was not found.")) {
                setApiKeyError("Error de clave API o facturación. Por favor, verifica tu clave API y la configuración de facturación.");
                setHasApiKey(false);
            }
          },
          onclose: (e: CloseEvent) => { console.debug('Live session closed:', e); setIsRecording(false); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Zephyr'}}, // Default voice
          },
          systemInstruction: 'Eres un asistente de AncloraAdapt, útil y amigable, enfocado en ayudarte a crear y adaptar contenido en tiempo real. Responde de forma concisa y conversacional.'
        },
      });
    } catch (err: any) {
      console.error('Error al iniciar la grabación:', err);
      setError(`No se pudo iniciar la grabación: ${err.message || 'Error desconocido'}. Asegúrate de que el micrófono esté permitido.`);
      setIsRecording(false);
    }
  }, [hasApiKey, currentInputTranscription, currentOutputTranscription, checkApiKey, stopRecording]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }
    playingSourcesRef.current.forEach(source => source.stop());
    playingSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">Conversación Live (Beta)</h3>
        <p>Ten una conversación en tiempo real con Gemini. Habla con la IA y recibe respuestas de voz al instante.</p>
        <div style={commonStyles.warningMessage}>
            <p><strong>Importante:</strong> La API Live requiere una clave API y puede incurrir en costos de facturación. Asegúrate de tener la facturación habilitada en tu proyecto de Google Cloud. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" style={{color: 'var(--azul-profundo)', textDecoration: 'underline'}}>Más información sobre facturación</a>.</p>
            {!hasApiKey && (
                <button onClick={requestApiKey} style={{...commonStyles.generateButton, width: 'auto', padding: '8px 15px', marginTop: '10px'}} aria-label="Seleccionar Clave API">
                    Seleccionar Clave API
                </button>
            )}
            {apiKeyError && <p style={{color: '#e74c3c', marginTop: '10px'}}>{apiKeyError}</p>}
        </div>

        <div style={commonStyles.liveChatControl}>
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!hasApiKey}
              style={{ ...commonStyles.liveChatButton, ...commonStyles.startRecording }}
              aria-label="Iniciar conversación"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
              Iniciar Conversación
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{ ...commonStyles.liveChatButton, ...commonStyles.stopRecording }}
              aria-label="Detener conversación"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-stop-circle">
                <circle cx="12" cy="12" r="10"></circle>
                <rect x="9" y="9" width="6" height="6"></rect>
              </svg>
              Detener Conversación
            </button>
          )}
        </div>

        {error && (
          <div style={commonStyles.errorMessage} role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div style={commonStyles.liveTranscript} aria-live="polite">
            {transcriptHistory.map((line, index) => (
                <p key={index} style={line.startsWith("Usuario:") ? commonStyles.liveTranscriptUser : commonStyles.liveTranscriptAI}>
                    {line}
                </p>
            ))}
            {isRecording && currentInputTranscription && (
                <p style={commonStyles.liveTranscriptUser}>Usuario: {currentInputTranscription}</p>
            )}
            {isRecording && currentOutputTranscription && (
                <p style={commonStyles.liveTranscriptAI}>AI: {currentOutputTranscription}</p>
            )}
            {!isRecording && transcriptHistory.length === 0 && (
                <p style={{textAlign: 'center', opacity: 0.7}}>Inicia una conversación para ver la transcripción en tiempo real.</p>
            )}
        </div>
      </section>
    </>
  );
};


const ImageEditMode: React.FC<Pick<CommonProps, 'onCopy' | 'setError' | 'setIsLoading' | 'isLoading' | 'error'>> = ({ onCopy, setError, setIsLoading, isLoading, error }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  // isLoading, error, onCopy, setError, setIsLoading are now received as props from App

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEditedImageUrl(null); // Clear previous edited image
      setError(null);
    }
  };

  const editImage = useCallback(async () => {
    // We allow generation without a file, so only check for file if editing.
    if (!imagePrompt.trim()) {
      setError('Por favor, introduce un prompt de edición/generación.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImageUrl(null);

    try {
      if (!API_KEY) {
        throw new Error("API Key not found. Please ensure process.env.API_KEY is configured.");
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      let contentsParts: any[] = [];

      // If a file is selected, include it for editing. Otherwise, it's a generation task.
      if (selectedFile) {
        const base64ImageData = await fileToBase64(selectedFile);
        contentsParts.push({
          inlineData: {
            data: base64ImageData,
            mimeType: selectedFile.type,
          },
        });
      }
      contentsParts.push({ text: imagePrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', // This model supports both generation and editing based on context.
        contents: {
          parts: contentsParts,
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
      });

      const generatedImagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

      if (generatedImagePart?.inlineData) {
        const base64ImageBytes: string = generatedImagePart.inlineData.data;
        const imageUrl = `data:${generatedImagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
        setEditedImageUrl(imageUrl);
      } else {
        setError('No se recibió imagen de la IA. Inténtalo de nuevo.');
      }

    } catch (err: any) {
      console.error('Error al editar/generar imagen:', err);
      setError(`Error al editar/generar imagen: ${err.message || 'Error desconocido'}. Asegúrate de que el prompt sea claro.`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, imagePrompt, setError, setIsLoading]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">Edición y Generación de Imagen con IA</h3>
        <p>Sube una imagen y usa prompts de texto para editarla con Gemini 2.5 Flash Image o, directamente, explica a la IA qué imagen quieres generar.</p>
        <label htmlFor="imageUpload" style={commonStyles.label}>Sube tu imagen (opcional para generación, necesario para edición):</label>
        <input
          id="imageUpload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={commonStyles.fileInput}
          aria-label="Subir imagen para editar o dejar en blanco para generar una nueva"
        />

        {previewUrl && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{fontSize: '1.2em', color: 'var(--azul-profundo)'}}>Previsualización de tu imagen:</h4>
            <img src={previewUrl} alt="Previsualización" style={commonStyles.imagePreview} />
          </div>
        )}

        <label htmlFor="imagePrompt" style={commonStyles.label}>Prompt de Imagen (Generación o Edición):</label>
        <textarea
          id="imagePrompt"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder="Ej: 'Un robot con una patineta roja en un estilo futurista' (para generar) o 'Añade un filtro retro' (para editar)"
          rows={4}
          style={commonStyles.textarea}
          aria-label="Describe cómo quieres editar la imagen o la imagen que quieres generar"
        />
      </section>

      <button
        onClick={editImage}
        disabled={isLoading || !imagePrompt.trim()}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? 'Procesando Imagen...' : 'Editar/Generar Imagen'}
      </button>

      {/* Fix: Pass explicit props to OutputDisplay */}
      <OutputDisplay isLoading={isLoading} error={error} onCopy={onCopy} generatedImageUrl={editedImageUrl} />
    </>
  );
};

interface TutorialStep {
  title: string;
  description: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Bienvenido a AncloraAdapt",
    description: "Esta guía te ayudará a descubrir cómo transformar y potenciar tu contenido con IA. ¡Vamos a explorar sus modos principales!"
  },
  {
    title: "Modo Básico: Generador Multiformato",
    description: "Ideal para generar contenido adaptado a plataformas específicas, tonos e idiomas. Define tu idea, selecciona las opciones y obtén publicaciones listas para usar."
  },
  {
    title: "Modo Inteligente: 'Dime lo que quieres y yo lo adapto'",
    description: "Describe tu necesidad en lenguaje natural y deja que la IA infiera el mejor contenido, tono y plataformas. Incluso puedes optar por generar o editar imágenes para complementar tu mensaje."
  },
  {
    title: "Modo Campaña: 'Multiplica tu mensaje'",
    description: "Crea campañas de marketing coordinadas para múltiples plataformas desde una única idea. La IA adaptará cada mensaje y Call To Action (CTA), y podrás añadir imágenes si lo deseas."
  },
  {
    title: "Modo Reciclar de Contenidos",
    description: "Reutiliza contenido existente transformándolo en nuevos formatos como resúmenes, hilos para X, captions de Instagram o títulos persuasivos. ¡Maximiza la vida útil de tu contenido!"
  },
  {
    title: "Modo Chat con AncloraAI",
    description: "Conversa con AncloraAI para obtener ayuda contextual y sugerencias sobre creación y adaptación de contenido. Un asistente siempre a tu disposición para resolver tus dudas."
  },
  {
    title: "Modo Voz: Texto a Voz",
    description: "Convierte texto en audio con voces de IA. Selecciona el idioma de la voz y la IA traducirá automáticamente el texto original a ese idioma antes de generarlo en audio."
  },
  {
    title: "Modo Live Chat: Conversación en Tiempo Real",
    description: "Experimenta una conversación bidireccional en tiempo real con Gemini. Habla con la IA y recibe respuestas de voz al instante. Requiere una clave API configurada y puede incurrir en costos de facturación."
  },
  {
    title: "Modo Imagen: Edición y Generación Visual",
    description: "Sube una imagen y usa prompts de texto para editarla con Gemini 2.5 Flash Image o, directamente, explica a la IA qué imagen quieres generar."
  },
  {
    title: "¡Estás listo para empezar!",
    description: "Hemos cubierto las funcionalidades principales de AncloraAdapt. ¡Ahora explora cada modo y potencia tu comunicación como nunca!"
  },
];

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  totalSteps: number;
  stepsContent: TutorialStep[];
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, currentStep, onNext, onPrev, totalSteps, stepsContent }) => {
  if (!isOpen) return null;

  const currentStepContent = stepsContent[currentStep];

  return (
    <div style={commonStyles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div style={commonStyles.modalContent}>
        <button onClick={onClose} style={commonStyles.modalCloseButton} aria-label="Cerrar tutorial">×</button>
        <h2 id="tutorial-title" style={commonStyles.modalTitle}>{currentStepContent.title}</h2>
        <p style={commonStyles.modalDescription}>{currentStepContent.description}</p>
        <div style={commonStyles.modalNavigation}>
          <button
            onClick={onPrev}
            disabled={currentStep === 0}
            style={{ ...commonStyles.modalNavButton, ...(currentStep === 0 && commonStyles.modalNavButtonDisabled), ...commonStyles.modalNavButtonSecondary }}
            aria-label="Paso anterior del tutorial"
          >
            Anterior
          </button>
          <span>Paso {currentStep + 1} de {totalSteps}</span>
          <button
            onClick={onNext}
            disabled={currentStep === totalSteps - 1}
            style={{ ...commonStyles.modalNavButton, ...(currentStep === totalSteps - 1 && commonStyles.modalNavButtonDisabled) }}
            aria-label="Siguiente paso del tutorial"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [generatedOutputs, setGeneratedOutputs] = useState<GeneratedOutput[] | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null); // State for image URL
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [tutorialStep, setTutorialStep] = useState<number>(0);


  const generateContentApiCall = useCallback(async (prompt: string, schema: any, model: string = "gemini-2.5-flash", config?: Record<string, any>) => {
    setIsLoading(true);
    setError(null);
    setGeneratedOutputs(null); // Clear previous outputs for text generation
    setGeneratedImageUrl(null); // Clear previous image output before text generation

    try {
      if (!API_KEY) {
        throw new Error("API Key not found. Please ensure process.env.API_KEY is configured.");
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          ...config, // Merge additional config like thinkingConfig
        },
      });

      const rawJsonString = response.text.trim();
      const parsedResponse = JSON.parse(rawJsonString);

      if (parsedResponse && Array.isArray(parsedResponse.outputs)) {
        setGeneratedOutputs(parsedResponse.outputs);
      } else {
        setError('Formato de respuesta inesperado de la IA. Por favor, inténtalo de nuevo.');
      }

    } catch (err: any) {
      console.error('Error al generar contenido:', err);
      setError(`Error al generar contenido: ${err.message || 'Error desconocido'}. Asegúrate de que tu prompt esté claro y cumpla con el formato JSON esperado.`);
      setGeneratedOutputs(null); // Clear outputs on error
    } finally {
      // setIsLoading is managed by the specific mode functions when image generation is involved
      // If only text generation, set to false here
      // For modes that also generate images, their functions will handle final setIsLoading(false)
      // This logic will be handled by individual modes that call `onGenerate` and then potentially image generation.
      // If this is the only call (e.g., Basic Mode), then it can be set to false here.
      // For modes that also do image generation, they will set setIsLoading(false) in their own finally blocks.
      // Here, we specifically check if an image was generated in a *previous* step of the current flow.
      // If generateContentApiCall is called for TEXT generation and there's no image generation, then set false.
      // If image generation is part of the flow, the image generation logic will handle `setIsLoading(false)`.
      // The current check `if (!generatedImageUrl)` is not robust enough.
      // A better way is to let the calling mode handle the final `setIsLoading(false)`.
      // So, removing this block and letting modes like `BasicMode` handle it.
      // BasicMode does not generate images, so it will not call setGeneratedImageUrl, this is safe.
    }
  }, [setGeneratedOutputs, setGeneratedImageUrl, setError, setIsLoading]);


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Implement user feedback for copy success
  };

  const handleOpenTutorial = () => {
    setShowTutorial(true);
    setTutorialStep(0);
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    setTutorialStep(0);
  };

  const handleNextTutorialStep = () => {
    setTutorialStep(prev => Math.min(prev + 1, tutorialSteps.length - 1));
  };

  const handlePrevTutorialStep = () => {
    setTutorialStep(prev => Math.max(prev - 1, 0));
  };


  const commonProps: CommonProps = {
    isLoading,
    error,
    generatedOutputs,
    generatedImageUrl,
    onGenerate: generateContentApiCall,
    onCopy: copyToClipboard,
    setError,
    setIsLoading,
    setGeneratedImageUrl,
  };

  return (
    <div style={commonStyles.container}>
      <header style={commonStyles.header}>
        <h1 style={commonStyles.title}>AncloraAdapt</h1>
        <p style={commonStyles.subtitle}>Traduce, adapta y reescribe con estilo e intención.</p>
        <button onClick={handleOpenTutorial} style={commonStyles.helpButton} aria-label="Abrir tutorial de ayuda">?</button>
      </header>

      <main style={commonStyles.mainContent}>
        <nav style={commonStyles.tabNavigation} aria-label="Modos de la aplicación">
          <button
            onClick={() => { setActiveTab('basic'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'basic' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'basic'}
            role="tab"
            tabIndex={activeTab === 'basic' ? 0 : -1}
          >
            Básico
            {activeTab === 'basic' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('intelligent'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'intelligent' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'intelligent'}
            role="tab"
            tabIndex={activeTab === 'intelligent' ? 0 : -1}
          >
            Inteligente
            {activeTab === 'intelligent' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('campaign'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'campaign' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'campaign'}
            role="tab"
            tabIndex={activeTab === 'campaign' ? 0 : -1}
          >
            Campaña
            {activeTab === 'campaign' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('recycle'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'recycle' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'recycle'}
            role="tab"
            tabIndex={activeTab === 'recycle' ? 0 : -1}
          >
            Reciclar
            {activeTab === 'recycle' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('chat'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'chat' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'chat'}
            role="tab"
            tabIndex={activeTab === 'chat' ? 0 : -1}
          >
            Chat
            {activeTab === 'chat' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('tts'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'tts' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'tts'}
            role="tab"
            tabIndex={activeTab === 'tts' ? 0 : -1}
          >
            Voz
            {activeTab === 'tts' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('live_chat'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'live_chat' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'live_chat'}
            role="tab"
            tabIndex={activeTab === 'live_chat' ? 0 : -1}
          >
            Live Chat
            {activeTab === 'live_chat' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('image_edit'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'image_edit' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'image_edit'}
            role="tab"
            tabIndex={activeTab === 'image_edit' ? 0 : -1}
          >
            Imagen
            {activeTab === 'image_edit' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
        </nav>

        {activeTab === 'basic' && <BasicMode {...commonProps} />}
        {activeTab === 'intelligent' && <IntelligentMode {...commonProps} />}
        {activeTab === 'campaign' && <CampaignMode {...commonProps} />}
        {activeTab === 'recycle' && <RecycleMode {...commonProps} />}
        {activeTab === 'chat' && <ChatMode {...{ isLoading, error, onCopy: commonProps.onCopy, setError, setIsLoading }} />}
        {activeTab === 'tts' && <TTSMode {...{ isLoading, error, onCopy: commonProps.onCopy, setError, setIsLoading }} />}
        {activeTab === 'live_chat' && <LiveChatMode />}
        {activeTab === 'image_edit' && <ImageEditMode {...{ isLoading, error, onCopy: commonProps.onCopy, setError, setIsLoading }} />}
      </main>

      <TutorialModal
        isOpen={showTutorial}
        onClose={handleCloseTutorial}
        currentStep={tutorialStep}
        onNext={handleNextTutorialStep}
        onPrev={handlePrevTutorialStep}
        totalSteps={tutorialSteps.length}
        stepsContent={tutorialSteps}
      />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);