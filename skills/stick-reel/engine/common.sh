# sourced by the src/*.sh helpers: project root, pinned HyperFrames CLI, python with numpy/soundfile/scipy
P="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="$(basename "$P")"
HF="npx -y hyperframes@0.8.162"
PY="${STICK_PY:-python3}"   # needs numpy, soundfile, scipy (pip install -r <skill>/requirements.txt)
cd "$P"
