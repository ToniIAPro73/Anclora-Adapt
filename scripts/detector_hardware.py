# detector_hardware.py
import psutil
import torch
import subprocess
from dataclasses import dataclass
from typing import Dict, List

@dataclass
class HardwareCapabilities:
    cpu_cores: int
    cpu_threads: int
    ram_gb: float
    gpu_model: str
    gpu_vram_gb: float
    storage_gb: float
    has_cuda: bool
    has_tensorrt: bool
    
    def get_recommended_models(self):
        """Retorna modelos recomendados basados en el hardware"""
        return {
            "text": self._recommend_text_models(),
            "image": self._recommend_image_models(),
            "tts": self._recommend_tts_models(),
            "stt": self._recommend_stt_models()
        }
    
    def _recommend_text_models(self) -> List[Dict]:
        """Selecciona modelos de texto óptimos"""
        models = []
        
        if self.gpu_vram_gb >= 24:
            models.append({
                "id": "mixtral-8x7b",
                "name": "Mixtral 8x7B",
                "params": "56B (MoE)",
                "ram_required_gb": 20,
                "speed": "medium",
                "quality": "excellent",
                "quantization": "fp16"
            })
        
        if self.gpu_vram_gb >= 12 or self.ram_gb >= 24:
            models.extend([
                {
                    "id": "mistral-7b",
                    "name": "Mistral 7B",
                    "params": "7B",
                    "ram_required_gb": 14,
                    "speed": "fast",
                    "quality": "very-good",
                    "quantization": "fp16"
                },
                {
                    "id": "neural-chat",
                    "name": "Neural Chat 7B",
                    "params": "7B",
                    "ram_required_gb": 14,
                    "speed": "fast",
                    "quality": "good",
                    "quantization": "q4_k_m"
                }
            ])
        
        if self.gpu_vram_gb >= 6:
            models.append({
                "id": "orca-mini-7b",
                "name": "Orca Mini 7B",
                "params": "7B",
                "ram_required_gb": 10,
                "speed": "very-fast",
                "quality": "good",
                "quantization": "q4"
            })
        
        return models
    
    def _recommend_image_models(self) -> List[Dict]:
        """Selecciona modelos de imagen óptimos"""
        models = []
        
        if self.gpu_vram_gb >= 10:
            models.append({
                "id": "sd3-medium",
                "name": "Stable Diffusion 3 Medium",
                "vram_required_gb": 8,
                "speed": "medium",
                "quality": "excellent",
                "features": "text-in-image, composition-control"
            })
        
        if self.gpu_vram_gb >= 8:
            models.extend([
                {
                    "id": "sdxl",
                    "name": "Stable Diffusion XL",
                    "vram_required_gb": 8,
                    "speed": "medium",
                    "quality": "very-good",
                    "features": "high-resolution, diverse-styles"
                },
                {
                    "id": "flux-schnell",
                    "name": "FLUX.1 [schnell]",
                    "vram_required_gb": 12,  # Con optimizaciones
                    "speed": "fast",
                    "quality": "excellent",
                    "features": "ultra-fast, high-quality"
                }
            ])
        
        if self.gpu_vram_gb >= 4:
            models.append({
                "id": "sd-turbo",
                "name": "SD Turbo",
                "vram_required_gb": 4,
                "speed": "very-fast",
                "quality": "good",
                "features": "real-time-generation"
            })
        
        return models
    
    def _recommend_tts_models(self) -> List[Dict]:
        """Selecciona modelos de texto a voz multiidioma"""
        models = [
            {
                "id": "kokoro-82m",
                "name": "Kokoro 82M",
                "languages": ["Spanish", "English", "Japanese", "Chinese", "French", 
                             "German", "Italian", "Korean", "Portuguese", "Russian", 
                             "Polish", "Dutch"],
                "ram_required_mb": 300,
                "speed": "real-time+",
                "quality": "excellent",
                "naturalness": 9.2
            },
            {
                "id": "xtts-v2",
                "name": "XTTS v2 (Coqui)",
                "languages": ["Spanish", "English", "French", "German", "Italian", 
                             "Portuguese", "Polish", "Turkish", "Russian", "Dutch",
                             "Czech", "Arabic", "Chinese", "Japanese", "Hungarian",
                             "Korean", "Hindi"],
                "ram_required_mb": 500,
                "speed": "real-time",
                "quality": "very-good",
                "naturalness": 8.5
            }
        ]
        return models
    
    def _recommend_stt_models(self) -> List[Dict]:
        """Selecciona modelos de voz a texto"""
        models = [
            {
                "id": "whisper-small",
                "name": "Whisper Small",
                "languages": "99 idiomas",
                "ram_required_mb": 500,
                "accuracy": "good",
                "speed": "fast"
            },
            {
                "id": "whisper-medium",
                "name": "Whisper Medium",
                "languages": "99 idiomas",
                "ram_required_mb": 1200,
                "accuracy": "very-good",
                "speed": "medium"
            }
        ]
        return models

class HardwareDetector:
    @staticmethod
    def detect() -> HardwareCapabilities:
        """Detecta las capacidades del hardware actual"""
        
        # CPU
        cpu_count = psutil.cpu_count(logical=False)
        cpu_threads = psutil.cpu_count(logical=True)
        
        # RAM
        ram_gb = psutil.virtual_memory().total / (1024**3)
        
        # GPU
        gpu_info = HardwareDetector._detect_gpu()
        
        # Storage
        storage_gb = psutil.disk_usage("/").total / (1024**3)
        
        # CUDA/TensorRT
        has_cuda = torch.cuda.is_available()
        has_tensorrt = HardwareDetector._check_tensorrt()
        
        return HardwareCapabilities(
            cpu_cores=cpu_count,
            cpu_threads=cpu_threads,
            ram_gb=ram_gb,
            gpu_model=gpu_info["model"],
            gpu_vram_gb=gpu_info["vram"],
            storage_gb=storage_gb,
            has_cuda=has_cuda,
            has_tensorrt=has_tensorrt
        )
    
    @staticmethod
    def _detect_gpu():
        """Detecta GPU NVIDIA disponible"""
        try:
            if torch.cuda.is_available():
                device_name = torch.cuda.get_device_name(0)
                device_props = torch.cuda.get_device_properties(0)
                vram_gb = device_props.total_memory / (1024**3)
                return {
                    "model": device_name,
                    "vram": vram_gb,
                    "compute_capability": device_props.major + device_props.minor / 10
                }
        except Exception as e:
            print(f"Error detectando GPU: {e}")
        
        return {"model": "CPU Only", "vram": 0, "compute_capability": 0}
    
    @staticmethod
    def _check_tensorrt():
        """Verifica si TensorRT está disponible"""
        try:
            import tensorrt
            return True
        except ImportError:
            return False

# Uso en tu aplicación
if __name__ == "__main__":
    detector = HardwareDetector()
    capabilities = detector.detect()
    
    print("=== CAPACIDADES DEL HARDWARE ===")
    print(f"CPU: {capabilities.cpu_cores} núcleos, {capabilities.cpu_threads} threads")
    print(f"RAM: {capabilities.ram_gb:.1f} GB")
    print(f"GPU: {capabilities.gpu_model} ({capabilities.gpu_vram_gb:.1f} GB VRAM)")
    print(f"Storage: {capabilities.storage_gb:.1f} GB")
    print(f"CUDA: {capabilities.has_cuda}")
    print(f"TensorRT: {capabilities.has_tensorrt}")
    
    print("\n=== MODELOS RECOMENDADOS ===")
    recommendations = capabilities.get_recommended_models()
    for category, models in recommendations.items():
        print(f"\n{category.upper()}:")
        for model in models:
            print(f"  - {model}")
