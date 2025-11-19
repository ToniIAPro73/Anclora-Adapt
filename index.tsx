import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';

const API_KEY = process.env.HF_API_KEY || process.env.API_KEY;
const HF_BASE_URL = 'https://api-inference.huggingface.co/models';
const TEXT_MODEL_ID = 'meta-llama/Meta-Llama-3-8B-Instruct';
const IMAGE_MODEL_ID = 'black-forest-labs/FLUX.1-schnell';
const TTS_MODEL_ID = 'suno/bark-small';
const STT_MODEL_ID = 'openai/whisper-large-v3-turbo';

type ThemeMode = 'light' | 'dark' | 'system';
type InterfaceLanguage = 'es' | 'en';

interface BlobLike {
  data: string;
  mimeType: string;
}

const ensureApiKey = () => {
  if (!API_KEY) {
    throw new Error('Define HF_API_KEY en tu .env.local');
  }
};

const callTextModel = async (prompt: string): Promise<string> => {
  ensureApiKey();
  const response = await fetch(`${HF_BASE_URL}/${TEXT_MODEL_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 800,
        temperature: 0.4,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload[0]?.generated_text ?? '';
  }
  if (typeof payload?.generated_text === 'string') {
    return payload.generated_text;
  }
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
};

const callImageModel = async (prompt: string, base64Image?: string): Promise<string> => {
  ensureApiKey();
  const response = await fetch(`${HF_BASE_URL}/${IMAGE_MODEL_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      image: base64Image,
      parameters: {
        guidance_scale: 3.5,
        num_inference_steps: 28,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
};

const callTextToSpeech = async (text: string, voicePreset: string): Promise<string> => {
  ensureApiKey();
  const response = await fetch(`${HF_BASE_URL}/${TTS_MODEL_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text, parameters: { voice_preset: voicePreset } }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

const callSpeechToText = async (audioBlob: Blob): Promise<string> => {
  ensureApiKey();
  const response = await fetch(`${HF_BASE_URL}/${STT_MODEL_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': audioBlob.type || 'audio/wav',
    },
    body: audioBlob,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const payload = await response.json();
  return payload?.text?.trim?.() ?? '';
};

const extractJsonPayload = (raw: string) => {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return raw;
};

const structuredOutputExample = `{
  "outputs": [
    { "platform": "LinkedIn", "content": "Version profesional" },
    { "platform": "Instagram", "content": "Copys breves y visuales" }
  ]
}`;

interface GeneratedOutput {
  platform: string;
  content: string;
}

interface CommonProps {
  isLoading: boolean;
  error: string | null;
  generatedOutputs: GeneratedOutput[] | null;
  generatedImageUrl: string | null;
  onGenerate: (prompt: string) => Promise<void>;
  onCopy: (text: string) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setGeneratedImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  interfaceLanguage: InterfaceLanguage;
}

const languages = [
  { value: 'detect', label: 'Detectar automatico' },
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Francais' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Portugues' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Chino' },
  { value: 'ja', label: 'Japones' },
  { value: 'ru', label: 'Ruso' },
];

const tones = [
  { value: 'detect', label: 'Detectar automatico' },
  { value: 'Profesional', label: 'Profesional' },
  { value: 'Amistoso', label: 'Amistoso' },
  { value: 'Formal', label: 'Formal' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Motivador', label: 'Motivador' },
  { value: 'Emocional', label: 'Emocional' },
  { value: 'Directo', label: 'Directo' },
  { value: 'Creativo', label: 'Creativo' },
];

const recycleOptions = [
  { value: 'summary', label: 'Resumen conciso' },
  { value: 'x_thread', label: 'Hilo para X' },
  { value: 'instagram_caption', label: 'Caption para Instagram' },
  { value: 'title_hook', label: 'Titulo y gancho' },
  { value: 'key_points', label: 'Lista de puntos clave' },
  { value: 'email_launch', label: 'Email de lanzamiento' },
  { value: 'press_release', label: 'Nota de prensa' },
];

const ttsLanguageVoiceMap: Record<string, { value: string; label: string }[]> = {
  es: [
    { value: 'es_male_0', label: 'Mateo (ES)' },
    { value: 'es_female_0', label: 'Clara (ES)' },
  ],
  en: [
    { value: 'en_male_0', label: 'Noah (EN)' },
    { value: 'en_female_0', label: 'Ava (EN)' },
  ],
  fr: [
    { value: 'fr_male_0', label: 'Louis (FR)' },
    { value: 'fr_female_0', label: 'Chloe (FR)' },
  ],
  de: [
    { value: 'de_male_0', label: 'Felix (DE)' },
    { value: 'de_female_0', label: 'Lena (DE)' },
  ],
  pt: [
    { value: 'pt_male_0', label: 'Caio (PT)' },
    { value: 'pt_female_0', label: 'Marina (PT)' },
  ],
  it: [
    { value: 'it_male_0', label: 'Marco (IT)' },
    { value: 'it_female_0', label: 'Giulia (IT)' },
  ],
  zh: [
    { value: 'zh_male_0', label: 'Wei (ZH)' },
    { value: 'zh_female_0', label: 'Lan (ZH)' },
  ],
  ja: [
    { value: 'ja_male_0', label: 'Ren (JA)' },
    { value: 'ja_female_0', label: 'Yui (JA)' },
  ],
  ru: [
    { value: 'ru_male_0', label: 'Ivan (RU)' },
    { value: 'ru_female_0', label: 'Eva (RU)' },
  ],
  ar: [
    { value: 'ar_male_0', label: 'Omar (AR)' },
    { value: 'ar_female_0', label: 'Sara (AR)' },
  ],
};

const ttsLanguageOptions = [
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Francais' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Portugues' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Chino' },
  { value: 'ja', label: 'Japones' },
  { value: 'ru', label: 'Ruso' },
  { value: 'ar', label: 'Arabe' },
];

const commonStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '30px 20px',
    maxWidth: '1200px',
    margin: '0 auto',
    gap: '30px',
  },
  header: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  headerTop: {
    textAlign: 'center',
  },
  headerControls: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toggleGroup: {
    display: 'flex',
    gap: '8px',
    padding: '6px',
    borderRadius:
    '999px',
    backgroundColor: 'var(--gris-fondo, #f6f7f9)',
  },
  toggleButton: {
    border: 'none',
    background: 'transparent',
    padding: '8px 14px',
    borderRadius: '999px',
    fontWeight: 600,
    color: 'var(--texto, #162032)',
    cursor: 'pointer',
  },
  toggleButtonActive: {
    backgroundColor: '#fff',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  },
  title: {
    fontFamily: 'Libre Baskerville, serif',
    fontSize: '3em',
    margin: 0,
    color: 'var(--azul-profundo, #23436B)',
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '1.1em',
    margin: 0,
    color: 'var(--texto, #162032)',
    opacity: 0.8,
  },
  mainContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: '18px',
    padding: '30px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  tabNavigation: {
    display: 'flex',
    flexWrap: 'wrap',
    borderBottom: '1px solid #e0e0e0',
    gap: '10px',
    justifyContent: 'center',
  },
  tabButton: {
    background: 'transparent',
    border: 'none',
    padding: '12px 18px',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--texto, #162032)',
    opacity: 0.7,
  },
  tabButtonActive: {
    color: 'var(--azul-claro, #2EAFC4)',
    opacity: 1,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontWeight: 600,
    color: 'var(--azul-profundo, #23436B)',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    borderRadius: '10px',
    border: '1px solid #e0e0e0',
    padding: '14px',
    fontSize: '1em',
    resize: 'vertical',
  },
  select: {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid #e0e0e0',
    padding: '10px',
  },
  configSection: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
  },
  configGroup: {
    flex: '1 1 240px',
  },
  checkboxRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  checkboxChip: {
    padding: '6px 12px',
    borderRadius: '16px',
    backgroundColor: '#ecf0f1',
    cursor: 'pointer',
  },
  generateButton: {
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(90deg, #2EAFC4, #FFC979)',
    fontWeight: 700,
    color: '#162032',
    cursor: 'pointer',
  },
  errorMessage: {
    backgroundColor: '#fdecea',
    color: '#c0392b',
    padding: '12px',
    borderRadius: '10px',
  },
  loadingMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '4px solid rgba(0,0,0,0.1)',
    borderTop: '4px solid #2EAFC4',
    animation: 'spin 1s linear infinite',
  },
  outputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  outputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },
  outputCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '18px',
    minHeight: '180px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  copyButton: {
    alignSelf: 'flex-end',
    border: '1px solid #2EAFC4',
    borderRadius: '8px',
    padding: '8px 12px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  chatContainer: {
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '12px',
    height: '360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  chatMessage: {
    borderRadius: '12px',
    padding: '10px',
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2EAFC4',
    color: '#fff',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecf0f1',
    color: '#162032',
  },
  chatInputRow: {
    display: 'flex',
    gap: '10px',
  },
  chatTextInput: {
    flex: 1,
    borderRadius: '10px',
    border: '1px solid #e0e0e0',
    padding: '10px',
    minHeight: '60px',
  },
  helpButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1px solid #2EAFC4',
    backgroundColor: '#fff',
    color: '#2EAFC4',
    fontWeight: 700,
    cursor: 'pointer',
  },
  liveTranscript: {
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '12px',
    minHeight: '120px',
    backgroundColor: '#f7f9fb',
  },
  audioPlayer: {
    width: '100%',
    marginTop: '10px',
  },
};

const ensureGlobalStyles = () => {
  const existing = document.getElementById('anclora-global-styles');
  if (existing) return;
  const sheet = document.createElement('style');
  sheet.id = 'anclora-global-styles';
  sheet.innerHTML = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(sheet);
};
const OutputDisplay: React.FC<{ generatedOutputs: GeneratedOutput[] | null; error: string | null; isLoading: boolean; onCopy: (text: string) => void; audioUrl?: string | null; imageUrl?: string | null; }> = ({ generatedOutputs, error, isLoading, onCopy, audioUrl, imageUrl }) => {
  return (
    <section style={commonStyles.outputSection}>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      {isLoading && (
        <div style={commonStyles.loadingMessage}>
          <div style={commonStyles.spinner}></div>
          <span>La IA esta trabajando...</span>
        </div>
      )}
      {audioUrl && (
        <div>
          <audio controls style={commonStyles.audioPlayer} src={audioUrl}></audio>
          <a href={audioUrl} download="anclora_audio.wav" style={commonStyles.copyButton}>Descargar audio</a>
        </div>
      )}
      {imageUrl && (
        <div>
          <img src={imageUrl} alt="Imagen generada" style={{ width: '100%', borderRadius: '12px' }} />
          <a href={imageUrl} download="anclora_image.png" style={commonStyles.copyButton}>Descargar imagen</a>
        </div>
      )}
      {generatedOutputs && generatedOutputs.length > 0 && (
        <div style={commonStyles.outputGrid}>
          {generatedOutputs.map((output, index) => (
            <div key={index} style={commonStyles.outputCard}>
              <strong>{output.platform}</strong>
              <p>{output.content}</p>
              <button type="button" style={commonStyles.copyButton} onClick={() => onCopy(output.content)}>Copiar</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
const BasicMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl, interfaceLanguage }) => {
  const [idea, setIdea] = useState('');
  const [language, setLanguage] = useState('es');
  const [tone, setTone] = useState('detect');
  const [platforms, setPlatforms] = useState<string[]>(['LinkedIn', 'Instagram']);
  const [speed, setSpeed] = useState<'detallado' | 'flash'>('detallado');

  useEffect(() => {
    setGeneratedImageUrl(null);
  }, [setGeneratedImageUrl]);

  useEffect(() => {
    setLanguage(interfaceLanguage);
  }, [interfaceLanguage]);

  const togglePlatform = (value: string) => {
    setPlatforms(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]);
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('Describe tu idea principal.');
      return;
    }
    if (platforms.length === 0) {
      setError('Selecciona al menos una plataforma.');
      return;
    }
    const languageDisplay = languages.find(l => l.value === language)?.label || language;
    const toneDisplay = tones.find(t => t.value === tone)?.label || tone;
    const prompt = `Eres un estratega de contenidos. Genera una lista JSON bajo la clave "outputs" siguiendo ${structuredOutputExample}. Idea: "${idea}". Idioma solicitado: ${languageDisplay}. Tono: ${toneDisplay}. Plataformas: ${platforms.join(', ')}. Nivel de detalle: ${speed}.`;
    await onGenerate(prompt);
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label} htmlFor="basic-idea">Tu idea principal</label>
        <textarea id="basic-idea" style={commonStyles.textarea} value={idea} onChange={e => setIdea(e.target.value)} placeholder="Quiero anunciar..." />
      </section>
      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Idioma</label>
          <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
            {languages.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Tono</label>
          <select style={commonStyles.select} value={tone} onChange={e => setTone(e.target.value)}>
            {tones.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Velocidad</label>
          <select style={commonStyles.select} value={speed} onChange={e => setSpeed(e.target.value as 'detallado' | 'flash')}>
            <option value="detallado">Detallado</option>
            <option value="flash">Flash</option>
          </select>
        </div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Plataformas</label>
        <div style={commonStyles.checkboxRow}>
          {['LinkedIn', 'X', 'Instagram', 'WhatsApp', 'Email'].map(option => (
            <label key={option} style={commonStyles.checkboxChip}>
              <input type="checkbox" checked={platforms.includes(option)} onChange={() => togglePlatform(option)} /> {option}
            </label>
          ))}
        </div>
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generando...' : 'Generar contenido'}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} audioUrl={null} imageUrl={generatedImageUrl} />
    </>
  );
};
const IntelligentMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl, interfaceLanguage }) => {
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [deepThinking, setDeepThinking] = useState(false);
  const [includeImage, setIncludeImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => setGeneratedImageUrl(null), [setGeneratedImageUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageFile(file || null);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('Describe lo que necesitas.');
      return;
    }
    setIsLoading(true);
    setGeneratedImageUrl(null);
    try {
      const thinking = deepThinking ? 'Analiza paso a paso antes de responder.' : 'Responde de forma directa.';
      const prompt = `Eres un estratega creativo. Necesidad: "${idea}". Contexto/destino: "${context || 'No especificado'}". Idioma del usuario: ${interfaceLanguage.toUpperCase()}. ${thinking} Sigue el formato ${structuredOutputExample}.`;
      await onGenerate(prompt);
      if (includeImage && imagePrompt.trim()) {
        const base64 = imageFile ? await fileToBase64(imageFile) : undefined;
        const imageUrl = await callImageModel(`${imagePrompt}\nContexto: ${context || idea}`, base64);
        setGeneratedImageUrl(imageUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Describe tu necesidad</label>
        <textarea style={commonStyles.textarea} value={idea} onChange={e => setIdea(e.target.value)} placeholder="Necesito adaptar..." />
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Contexto / Destino</label>
        <textarea style={commonStyles.textarea} value={context} onChange={e => setContext(e.target.value)} placeholder="Equipo de ventas, campana de reciclaje, landing page..." />
      </section>
      <section style={commonStyles.section}>
        <label><input type="checkbox" checked={deepThinking} onChange={e => setDeepThinking(e.target.checked)} /> Activar razonamiento profundo</label>
      </section>
      <section style={commonStyles.section}>
        <label><input type="checkbox" checked={includeImage} onChange={e => setIncludeImage(e.target.checked)} /> Incluir imagen generada</label>
        {includeImage && (
          <>
            <input type="file" onChange={handleFileChange} accept="image/*" />
            <textarea style={commonStyles.textarea} value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Prompt de imagen" />
            {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px' }} />}
          </>
        )}
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generando...' : 'Generar adaptaciones'}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} imageUrl={generatedImageUrl} audioUrl={null} />
    </>
  );
};
const CampaignMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl, interfaceLanguage }) => {
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState('es');
  const campaignPlatforms = ['LinkedIn', 'X', 'Instagram', 'Email'];

  useEffect(() => setGeneratedImageUrl(null), [setGeneratedImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('Describe la idea base de tu campana.');
      return;
    }
    setIsLoading(true);
    setGeneratedImageUrl(null);
    try {
      const languageDisplay = languages.find(l => l.value === language)?.label || language;
      const prompt = `Eres un planificador de campanas express. Idea: "${idea}". Contexto/destino: "${context || 'No especificado'}". Idioma: ${languageDisplay}. Plataformas: ${campaignPlatforms.join(', ')}. Sigue el esquema ${structuredOutputExample}.`;
      await onGenerate(prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Idea central</label>
        <textarea style={commonStyles.textarea} value={idea} onChange={e => setIdea(e.target.value)} />
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Contexto / Destino</label>
        <textarea style={commonStyles.textarea} value={context} onChange={e => setContext(e.target.value)} />
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Idioma de salida</label>
        <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
          {languages.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
        </select>
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generando...' : 'Generar campana'}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} imageUrl={generatedImageUrl} audioUrl={null} />
    </>
  );
};
const RecycleMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl }) => {
  const [inputText, setInputText] = useState('');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState('es');
  const [tone, setTone] = useState('detect');
  const [format, setFormat] = useState('summary');

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError('Pega el contenido original.');
      return;
    }
    setIsLoading(true);
    try {
      const prompt = `Actua como editor de contenidos. Formato solicitado: ${format}. Idioma: ${language}. Tono: ${tone}. Contexto/destino: ${context || 'No especificado'}. Transforma el siguiente texto manteniendo la coherencia y responde usando ${structuredOutputExample}. Texto: "${inputText}".`;
      await onGenerate(prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Contenido original</label>
        <textarea style={commonStyles.textarea} value={inputText} onChange={e => setInputText(e.target.value)} />
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>Contexto / Destino</label>
        <textarea style={commonStyles.textarea} value={context} onChange={e => setContext(e.target.value)} />
      </section>
      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Formato</label>
          <select style={commonStyles.select} value={format} onChange={e => setFormat(e.target.value)}>
            {recycleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Idioma</label>
          <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
            {languages.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Tono</label>
          <select style={commonStyles.select} value={tone} onChange={e => setTone(e.target.value)}>
            {tones.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Reciclando...' : 'Reciclar contenido'}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} imageUrl={generatedImageUrl} audioUrl={null} />
    </>
  );
};
interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const ChatMode: React.FC<{ interfaceLanguage: InterfaceLanguage; onCopy: (text: string) => void; }> = ({ interfaceLanguage, onCopy }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [current, setCurrent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!current.trim()) return;
    const updated = [...messages, { role: 'user', text: current }];
    setMessages(updated);
    setCurrent('');
    setIsLoading(true);
    try {
      const history = updated.map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.text}`).join('\n');
      const prompt = `Eres AncloraAI, especialista en adaptacion de contenidos. Idioma preferido: ${interfaceLanguage.toUpperCase()}. Conversacion: ${history}. Responde de forma breve.`;
      const raw = await callTextModel(prompt);
      const reply = raw.trim();
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Hubo un error al consultar el modelo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={commonStyles.section}>
      <div style={commonStyles.chatContainer}>
        {messages.map((msg, index) => (
          <div key={index} style={{ ...commonStyles.chatMessage, ...(msg.role === 'user' ? commonStyles.userMessage : commonStyles.aiMessage) }}>
            {msg.text}
            {msg.role === 'assistant' && (
              <button style={commonStyles.copyButton} onClick={() => onCopy(msg.text)}>Copiar</button>
            )}
          </div>
        ))}
        {isLoading && <div style={commonStyles.aiMessage}>Pensando...</div>}
      </div>
      <div style={commonStyles.chatInputRow}>
        <textarea style={commonStyles.chatTextInput} value={current} onChange={e => setCurrent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
        <button type="button" style={commonStyles.generateButton} onClick={sendMessage} disabled={isLoading}>Enviar</button>
      </div>
    </section>
  );
};
const TTSMode: React.FC = () => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('es');
  const [voice, setVoice] = useState('es_male_0');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const voices = ttsLanguageVoiceMap[language];
    if (voices) {
      setVoice(voices[0].value);
    }
  }, [language]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Escribe el texto a convertir.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const translationPrompt = `Traduce el siguiente texto al idioma de la voz (${language}) y responde solo con el texto traducido: "${text}".`;
      const translated = (await callTextModel(translationPrompt)).trim();
      const audio = await callTextToSpeech(translated || text, voice);
      setAudioUrl(audio);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={commonStyles.section}>
      <label style={commonStyles.label}>Texto a convertir</label>
      <textarea style={commonStyles.textarea} value={text} onChange={e => setText(e.target.value)} />
      <div style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Idioma</label>
          <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
            {ttsLanguageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>Voz</label>
          <select style={commonStyles.select} value={voice} onChange={e => setVoice(e.target.value)}>
            {(ttsLanguageVoiceMap[language] || []).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generando audio...' : 'Generar voz'}
      </button>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      {audioUrl && (
        <div>
          <audio controls style={commonStyles.audioPlayer} src={audioUrl}></audio>
          <a href={audioUrl} download="anclora_tts.wav" style={commonStyles.copyButton}>Descargar</a>
        </div>
      )}
    </section>
  );
};
const LiveChatMode: React.FC<{ onCopy: (text: string) => void; }> = ({ onCopy }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = evt => chunksRef.current.push(evt.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleConversation(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError('No se pudo acceder al microfono.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleConversation = async (audioBlob: Blob) => {
    try {
      const userText = await callSpeechToText(audioBlob);
      setTranscript(prev => [...prev, { role: 'user', text: userText }]);
      const prompt = `Convierte el siguiente texto del usuario en una respuesta breve y accionable enfocada en marketing: "${userText}".`;
      const reply = (await callTextModel(prompt)).trim();
      setTranscript(prev => [...prev, { role: 'assistant', text: reply }]);
      const audioResponse = await callTextToSpeech(reply, 'es_male_0');
      setAudioUrl(audioResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  return (
    <section style={commonStyles.section}>
      <p>Graba un fragmento de 10 segundos para recibir respuesta inmediata.</p>
      <button type="button" style={commonStyles.generateButton} onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Detener' : 'Hablar'}
      </button>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      <div style={commonStyles.liveTranscript}>
        {transcript.map((msg, index) => (
          <p key={index}><strong>{msg.role === 'user' ? 'Tu' : 'AncloraAI'}:</strong> {msg.text}</p>
        ))}
      </div>
      {audioUrl && (
        <div>
          <audio src={audioUrl} controls style={commonStyles.audioPlayer}></audio>
          <a href={audioUrl} download="anclora_live.wav" style={commonStyles.copyButton}>Descargar respuesta</a>
        </div>
      )}
    </section>
  );
};
const ImageEditMode: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0] || null;
    setFile(image);
    setPreview(image ? URL.createObjectURL(image) : null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !file) {
      setError('Escribe un prompt o sube una imagen.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const base64 = file ? await fileToBase64(file) : undefined;
      const url = await callImageModel(prompt || 'Nueva composicion', base64);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={commonStyles.section}>
      <label style={commonStyles.label}>Prompt de imagen</label>
      <textarea style={commonStyles.textarea} value={prompt} onChange={e => setPrompt(e.target.value)} />
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && <img src={preview} alt="preview" style={{ width: '100%', borderRadius: '12px' }} />}
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Procesando...' : 'Generar/Editar'}
      </button>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      {imageUrl && (
        <div>
          <img src={imageUrl} alt="Resultado" style={{ width: '100%', borderRadius: '12px' }} />
          <a href={imageUrl} download="anclora_image.png" style={commonStyles.copyButton}>Descargar</a>
        </div>
      )}
    </section>
  );
};
const App: React.FC = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('anclora.theme') as ThemeMode) || 'system');
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(() => (localStorage.getItem('anclora.lang') as InterfaceLanguage) || 'es');
  const [activeTab, setActiveTab] = useState('basic');
  const [generatedOutputs, setGeneratedOutputs] = useState<GeneratedOutput[] | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureGlobalStyles();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', themeMode);
    }
    localStorage.setItem('anclora.theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = interfaceLanguage;
    localStorage.setItem('anclora.lang', interfaceLanguage);
  }, [interfaceLanguage]);

  const generateContentApiCall = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    setGeneratedOutputs(null);
    try {
      const enforcedPrompt = `${prompt}\nRecuerda responder unicamente con JSON y seguir este ejemplo: ${structuredOutputExample}`;
      const raw = await callTextModel(enforcedPrompt);
      const jsonString = extractJsonPayload(raw);
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.outputs)) {
        setGeneratedOutputs(parsed.outputs);
      } else {
        setError('El modelo no devolvio el formato esperado.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const handleHelp = () => {
    alert('Explora cada modo para adaptar, planear o reciclar contenido. Usa los toggles para definir tema y lenguaje.');
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
    interfaceLanguage,
  };

  return (
    <div style={commonStyles.container}>
      <header style={commonStyles.header}>
        <div style={commonStyles.headerTop}>
          <h1 style={commonStyles.title}>AncloraAdapt</h1>
          <p style={commonStyles.subtitle}>Adapta, planifica y recicla contenido con modelos open source.</p>
        </div>
        <div style={commonStyles.headerControls}>
          <div style={commonStyles.toggleGroup}>
            {[
              { value: 'light' as ThemeMode, icon: '☀️' },
              { value: 'dark' as ThemeMode, icon: '🌙' },
              { value: 'system' as ThemeMode, icon: '💻' },
            ].map(option => (
              <button key={option.value} style={{ ...commonStyles.toggleButton, ...(themeMode === option.value ? commonStyles.toggleButtonActive : {}) }} onClick={() => setThemeMode(option.value)}>
                {option.icon}
              </button>
            ))}
          </div>
          <div style={commonStyles.toggleGroup}>
            {(['es', 'en'] as InterfaceLanguage[]).map(lang => (
              <button key={lang} style={{ ...commonStyles.toggleButton, ...(interfaceLanguage === lang ? commonStyles.toggleButtonActive : {}) }} onClick={() => setInterfaceLanguage(lang)}>
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button style={commonStyles.helpButton} onClick={handleHelp}>?</button>
        </div>
      </header>

      <main style={commonStyles.mainContent}>
        <nav style={commonStyles.tabNavigation}>
          {[
            { id: 'basic', label: 'Basico' },
            { id: 'intelligent', label: 'Inteligente' },
            { id: 'campaign', label: 'Campana' },
            { id: 'recycle', label: 'Reciclar' },
            { id: 'chat', label: 'Chat' },
            { id: 'tts', label: 'Voz' },
            { id: 'live', label: 'Live chat' },
            { id: 'image', label: 'Imagen' },
          ].map(tab => (
            <button key={tab.id} style={{ ...commonStyles.tabButton, ...(activeTab === tab.id ? commonStyles.tabButtonActive : {}) }} onClick={() => { setActiveTab(tab.id); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); }}>
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'basic' && <BasicMode {...commonProps} />}
        {activeTab === 'intelligent' && <IntelligentMode {...commonProps} />}
        {activeTab === 'campaign' && <CampaignMode {...commonProps} />}
        {activeTab === 'recycle' && <RecycleMode {...commonProps} />}
        {activeTab === 'chat' && <ChatMode interfaceLanguage={interfaceLanguage} onCopy={copyToClipboard} />}
        {activeTab === 'tts' && <TTSMode />}
        {activeTab === 'live' && <LiveChatMode onCopy={copyToClipboard} />}
        {activeTab === 'image' && <ImageEditMode />}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
