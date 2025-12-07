import psutil
import torch
from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class RecommendedModel:
  id: str
  name: str
  reason: str
  min_ram_gb: float = 0.0
  min_vram_gb: float = 0.0

  def to_dict(self) -> Dict[str, Any]:
    payload = asdict(self)
    return payload


def _detect_gpu():
  if torch.cuda.is_available():
    props = torch.cuda.get_device_properties(0)
    return {
      "model": torch.cuda.get_device_name(0),
      "vram_gb": props.total_memory / (1024**3),
      "device": "cuda",
    }
  return {"model": "CPU Only", "vram_gb": 0.0, "device": "cpu"}


def _recommend_text_models(ram_gb: float, vram_gb: float) -> List[Dict[str, Any]]:
  recs: List[RecommendedModel] = []

  if vram_gb >= 16 or ram_gb >= 32:
    recs.append(
      RecommendedModel(
        id="mixtral-8x7b",
        name="Mixtral 8x7B",
        reason="VRAM ≥ 16 GB o RAM ≥ 32 GB disponible.",
        min_ram_gb=24,
        min_vram_gb=16,
      )
    )

  if vram_gb >= 8 or ram_gb >= 16:
    recs.extend(
      [
        RecommendedModel(
          id="mistral-7b",
          name="Mistral 7B",
          reason="Equilibrio calidad/velocidad para ≥8 GB VRAM.",
          min_ram_gb=16,
          min_vram_gb=8,
        ),
        RecommendedModel(
          id="qwen2.5-7b",
          name="Qwen2.5 7B",
          reason="Multilingüe con buen soporte para CJK si hay ≥8 GB VRAM.",
          min_ram_gb=16,
          min_vram_gb=8,
        ),
        RecommendedModel(
          id="llama3.2",
          name="Llama 3.2",
          reason="Latencia contenido general cuando hay VRAM media.",
          min_ram_gb=16,
          min_vram_gb=8,
        ),
      ]
    )

  if vram_gb >= 4 or ram_gb >= 12:
    recs.extend(
      [
        RecommendedModel(
          id="llama2",
          name="Llama 2",
          reason="Hardware ligero (≥4 GB VRAM o ≥12 GB RAM).",
          min_ram_gb=12,
          min_vram_gb=4,
        ),
        RecommendedModel(
          id="orca-mini",
          name="Orca Mini 7B",
          reason="Respuesta rápida en GPUs pequeñas.",
          min_ram_gb=10,
          min_vram_gb=4,
        ),
        RecommendedModel(
          id="phi",
          name="Phi-3 Mini",
          reason="Inferencia rápida sólo con CPU/RAM.",
          min_ram_gb=8,
          min_vram_gb=0,
        ),
      ]
    )

  if not recs:
    recs.append(
      RecommendedModel(
        id="phi",
        name="Phi-3 Mini",
        reason="Modo seguro cuando sólo hay CPU.",
        min_ram_gb=8,
      )
    )

  return [rec.to_dict() for rec in recs]


def _recommend_modes(ram_gb: float, vram_gb: float, has_cuda: bool) -> List[Dict[str, Any]]:
  base_modes = {
    "basic": True,
    "intelligent": True,
    "campaign": True,
    "recycle": True,
    "chat": True,
  }

  mode_rules = {
    "tts": {
      "enabled": ram_gb >= 8,
      "reason": "Se requieren al menos 8 GB de RAM para generar voz.",
    },
    "live": {
      "enabled": has_cuda or ram_gb >= 12,
      "reason": "Live chat necesita GPU o ≥12 GB de RAM para STT.",
    },
    "image": {
      "enabled": vram_gb >= 6,
      "reason": "Generar imágenes requiere GPU con ≥6 GB VRAM.",
    },
  }

  support: List[Dict[str, Any]] = []
  for mode_id, enabled in base_modes.items():
    support.append({"id": mode_id, "enabled": enabled})

  for mode_id, config in mode_rules.items():
    support.append(
      {
        "id": mode_id,
        "enabled": config["enabled"],
        "reason": None if config["enabled"] else config["reason"],
      }
    )

  return support


def detect_hardware_profile() -> Dict[str, Any]:
  cpu_cores = psutil.cpu_count(logical=False) or 1
  cpu_threads = psutil.cpu_count(logical=True) or cpu_cores
  ram_gb = psutil.virtual_memory().total / (1024**3)
  storage_gb = psutil.disk_usage("/").total / (1024**3)

  gpu = _detect_gpu()
  has_cuda = gpu["device"] == "cuda"

  recommendations = {
    "text": _recommend_text_models(ram_gb, gpu["vram_gb"]),
    "image": [],
    "tts": [],
    "stt": [],
  }

  return {
    "hardware": {
      "cpu_cores": cpu_cores,
      "cpu_threads": cpu_threads,
      "ram_gb": round(ram_gb, 1),
      "gpu_model": gpu["model"],
      "gpu_vram_gb": round(gpu["vram_gb"], 1),
      "storage_gb": round(storage_gb, 1),
      "has_cuda": has_cuda,
    },
    "recommendations": recommendations,
    "mode_support": _recommend_modes(ram_gb, gpu["vram_gb"], has_cuda),
  }
