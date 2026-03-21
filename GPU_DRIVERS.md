# Drivers para GPU con Ollama

Para que el modelo de visión (moondream) use la GPU en lugar de la CPU, necesitas los drivers y herramientas correspondientes según tu tarjeta gráfica.

---

## AMD (local: RX 580, etc.)

### 1. Instalar ROCm

**Ubuntu 22.04 / 24.04:**

```bash
# Añadir repositorio
wget https://repo.radeon.com/rocm/rocm.gpg.key -O - | gpg --dearmor | sudo tee /usr/share/keyrings/rocm.gpg > /dev/null
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/rocm.gpg] https://repo.radeon.com/rocm/apt/6.2 ubuntu main" | sudo tee /etc/apt/sources.list.d/rocm.list

# Instalar
sudo apt-get update
sudo apt-get install -y rocm

# Añadir usuario al grupo (reemplaza TU_USUARIO)
sudo usermod -a -G render,video TU_USUARIO

# Reiniciar para aplicar
sudo reboot
```

**Si ROCm 6.2 falla por dependencias (libcholmod3, mesa-amdgpu-va-drivers, libpython3.8):**

```bash
# Quitar repo ROCm 6.2
sudo rm /etc/apt/sources.list.d/rocm.list 2>/dev/null

# Probar ROCm 5.7 (mejor compatibilidad con RX 580)
wget https://repo.radeon.com/amdgpu-install/5.7/ubuntu/jammy/amdgpu-install_5.7.50700-1_all.deb
sudo dpkg -i amdgpu-install_5.7.50700-1_all.deb
sudo amdgpu-install -y --usecase=graphics,rocm --no-dkms
```

**Fallback: Ollama en CPU** — Por defecto `docker-compose.yml` usa CPU. Si ROCm/Docker no pasan la GPU, no hace falta override.

### 2. Verificar

```bash
# Debe listar tu GPU (ej. gfx803 para RX 580)
rocminfo

# Monitorear uso
rocm-smi
```

### 3. Ollama nativo (GPU cuando Docker no pasa /dev/kfd)

Si Docker no puede acceder a `/dev/kfd`, ejecuta Ollama directamente en el host para usar la GPU:

```bash
# Instalar Ollama con soporte ROCm
curl -fsSL https://ollama.com/download/ollama-linux-amd64-rocm.tar.zst | sudo tar x -C /usr

# O versión estándar (detecta GPU si ROCm está instalado)
curl -fsSL https://ollama.com/install.sh | sh

# Iniciar y descargar modelo
ollama serve &
ollama pull moondream:1.8b
```

O como servicio systemd (arranca al boot):

```bash
sudo systemctl enable ollama
sudo systemctl start ollama
ollama pull moondream:1.8b
```

Luego levanta la API conectándose al Ollama del host:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

### 4. Docker (alternativa, si /dev/kfd es visible)

El `docker-compose.override.gpu.example.yml` usa `mnccouk/ollama-gpu-rx580` con dispositivos `/dev/kfd` y `/dev/dri`. Solo funciona si el daemon de Docker puede acceder a esos dispositivos.

---

## NVIDIA (producción)

### 1. Instalar driver NVIDIA

**Ubuntu/Debian:**

```bash
# Detectar e instalar driver recomendado
ubuntu-drivers devices
sudo ubuntu-drivers autoinstall

# O instalar versión específica (ej. 535)
sudo apt-get update
sudo apt-get install -y nvidia-driver-535

# Reiniciar
sudo reboot
```

### 2. Instalar NVIDIA Container Toolkit

```bash
# Añadir repositorio
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Instalar
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Configurar Docker para usar NVIDIA runtime
sudo nvidia-ctk runtime configure --runtime=docker

# Reiniciar Docker
sudo systemctl restart docker
```

### 3. Verificar

```bash
# Debe listar tu GPU
nvidia-smi

# Probar contenedor con GPU
docker run --rm --gpus=all nvidia/cuda:12.0-base nvidia-smi
```

### 4. Docker Compose

El `docker-compose.prod.yml` incluye la configuración `deploy.resources.reservations.devices` para NVIDIA. Si el toolkit está instalado, Ollama usará la GPU automáticamente.

---

## Resumen

| Entorno | GPU | Opción | Configuración |
|---------|-----|--------|---------------|
| **Local** | AMD RX 580 | **Ollama nativo** (recomendado) | `ollama serve` en host + `docker compose -f docker-compose.yml -f docker-compose.gpu.yml` |
| **Local** | AMD RX 580 | Docker (si /dev/kfd visible) | `docker-compose.override.gpu.example.yml` |
| **Producción** | NVIDIA | Docker | `deploy.resources.reservations.devices: nvidia` |

## Timeout

El timeout por defecto para la inferencia de banco por logo es **90 segundos** (`OLLAMA_OCR_TIMEOUT_MS`). Si usas CPU, puede tardar más; en GPU suele ser < 10 segundos.
