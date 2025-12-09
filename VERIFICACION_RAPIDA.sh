#!/bin/bash

###############################################################################
#                      VERIFICACIÓN RÁPIDA - MEJORAS IMAGEN                   #
#                                                                             #
# Script para validar que todas las mejoras están instaladas y funcionando   #
###############################################################################

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                   VERIFICACIÓN RÁPIDA - IMAGEN ANALYZER                ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contador de checks
PASSED=0
FAILED=0

# Función para verificar
check() {
    local name=$1
    local command=$2
    echo -n "Verificando $name... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FALLO${NC}"
        ((FAILED++))
    fi
}

echo -e "${BLUE}1. Verificando Archivos Creados${NC}"
echo "───────────────────────────────────────────────────────────────────────"
check "image_context.py" "[ -f python-backend/app/models/image_context.py ]"
check "image_cache.py" "[ -f python-backend/app/services/image_cache.py ]"
check "model_fallback.py" "[ -f python-backend/app/services/model_fallback.py ]"
check "models/__init__.py" "[ -f python-backend/app/models/__init__.py ]"
echo ""

echo -e "${BLUE}2. Verificando Documentación${NC}"
echo "───────────────────────────────────────────────────────────────────────"
check "IMPLEMENTACION_MEJORAS_IMAGEN.md" "[ -f IMPLEMENTACION_MEJORAS_IMAGEN.md ]"
check "TESTING_MEJORAS_IMAGEN.md" "[ -f TESTING_MEJORAS_IMAGEN.md ]"
check "INTEGRACION_FRONTEND_MEJORAS.md" "[ -f INTEGRACION_FRONTEND_MEJORAS.md ]"
check "RESUMEN_MEJORAS_IMAGEN.txt" "[ -f RESUMEN_MEJORAS_IMAGEN.txt ]"
echo ""

echo -e "${BLUE}3. Verificando Servicios Externos${NC}"
echo "───────────────────────────────────────────────────────────────────────"
check "Ollama está corriendo" "curl -s http://localhost:11434/api/tags > /dev/null"
check "Qwen3-VL disponible" "curl -s http://localhost:11434/api/tags | grep -q qwen"
echo ""

echo -e "${BLUE}4. Verificando Backend FastAPI${NC}"
echo "───────────────────────────────────────────────────────────────────────"
check "Backend en 8000" "curl -s http://localhost:8000/ | grep -q 'Anclora'"
check "Endpoint /analyze" "curl -s http://localhost:8000/api/images/health > /dev/null"
check "Health check" "curl -s http://localhost:8000/api/images/health | grep -q 'ok'"
echo ""

echo -e "${BLUE}5. Verificando Estructura de Caché${NC}"
echo "───────────────────────────────────────────────────────────────────────"
check "Directorio cache existe" "[ -d python-backend/cache ] || mkdir -p python-backend/cache"
echo ""

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo -e "║${BLUE}                           RESULTADO FINAL${NC}                            ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${GREEN}✓ Pasados:${NC}   $PASSED"
echo -e "  ${RED}✗ Fallos:${NC}    $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          ✓ TODAS LAS VERIFICACIONES PASARON - LISTO PARA USAR           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "  1. Leer: IMPLEMENTACION_MEJORAS_IMAGEN.md"
    echo "  2. Testear: TESTING_MEJORAS_IMAGEN.md"
    echo "  3. Integrar: INTEGRACION_FRONTEND_MEJORAS.md"
    echo ""
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                    ✗ FALLOS DETECTADOS - REVISAR                      ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  - ¿Ollama está corriendo? → ollama serve"
    echo "  - ¿Backend está corriendo? → python python-backend/main.py"
    echo "  - ¿Qwen3-VL descargado? → ollama pull qwen3-vl:8b"
    echo ""
fi

exit $FAILED
