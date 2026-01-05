<script setup>
import { onMounted, onUnmounted, reactive, ref, useTemplateRef } from 'vue';
import Modal from './Modal.vue';
import { useConfigStore } from '@/stores/configs';
import { storeToRefs } from 'pinia';
import Canvas from './Canvas.vue';

const configs = useConfigStore();

const { selectedTileId } = storeToRefs(configs);

const mapElem = useTemplateRef('map-el');

const { hasCurrentConfig } = storeToRefs(configs);

const settings = reactive({
  showGrid: true,
  showPixels: true,
  showHitboxes: true,
  camera: {
    x: 0,
    y: 0,
    scale: 1,
  },
});

const keys = reactive({
  up: false,
  down: false,
  left: false,
  right: false,
  plus: false,
  minus: false,
});

const showGenerationModal = ref(false);

const formData = reactive({
  name: '',
  x: 16,
  y: 16,
});

let animationFrameId = null;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };

const openGenerationModal = () => {
  showGenerationModal.value = true;
};

const closeGenerationModal = () => {
  showGenerationModal.value = false;
};

const handleForm = () => {
  if (!configs.isKeyAvailable(formData.name)) {
    alert('Name bereits besetzt');
    return;
  }

  configs.add(formData.name, formData.x, formData.y);

  showGenerationModal.value = false;
};

const validateInput = (event) => {
  if (parseInt(event.target.value) >= 1) return;

  event.target.value = 1;
};

const updateCamera = () => {
  const movementFactor = 3;

  if (keys.up) settings.camera.y -= movementFactor;
  if (keys.down) settings.camera.y += movementFactor;
  if (keys.left) settings.camera.x -= movementFactor;
  if (keys.right) settings.camera.x += movementFactor;

  if (keys.plus || keys.minus) {
    const rect = mapElem.value?.getBoundingClientRect() ?? { width: 0, height: 0 };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const oldScale = settings.camera.scale;
    const factor = keys.plus ? 1.01 : 0.99;
    const newScale = Math.min(10, Math.max(1, oldScale * factor));

    if (Math.abs(newScale - oldScale) > 1e-9) {
      const worldCx = settings.camera.x + centerX / oldScale;
      const worldCy = settings.camera.y + centerY / oldScale;

      settings.camera.scale = newScale;
      settings.camera.x = worldCx - centerX / newScale;
      settings.camera.y = worldCy - centerY / newScale;
    }
  }
};

const handleMouseDown = (direction) => {
  keys[direction] = true;
  updateCamera();
};

const handleMouseUp = (direction) => {
  keys[direction] = false;
  updateCamera();
};

const handleKeyDown = (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      keys.up = true;
      event.preventDefault();
      break;
    case 'ArrowDown':
    case 'KeyS':
      keys.down = true;
      event.preventDefault();
      break;
    case 'ArrowLeft':
    case 'KeyA':
      keys.left = true;
      event.preventDefault();
      break;
    case 'ArrowRight':
    case 'KeyD':
      keys.right = true;
      event.preventDefault();
      break;
    case 'BracketRight':
      keys.plus = true;
      event.preventDefault();
      break;
    case 'Slash':
      keys.minus = true;
      event.preventDefault();
      break;
  }
};

const handleKeyUp = (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      keys.up = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      keys.down = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      keys.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      keys.right = false;
      break;
    case 'BracketRight':
      keys.plus = false;
      break;
    case 'Slash':
      keys.minus = false;
      break;
  }
};

const handleWheel = (event) => {
  event.preventDefault();

  const rect = mapElem.value.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const zoomSpeed = 0.0015;
  const delta = -event.deltaY;
  const factor = 1 + delta * zoomSpeed;

  const oldScale = settings.camera.scale;
  let newScale = oldScale * factor;
  newScale = Math.min(10, Math.max(1, newScale));

  if (Math.abs(newScale - oldScale) > 1e-9) {
    // Maus-Position in World-Koordinaten
    const worldMouseX = mouseX / oldScale + settings.camera.x;
    const worldMouseY = mouseY / oldScale + settings.camera.y;

    // Neue Scale setzen
    settings.camera.scale = newScale;

    // Camera so anpassen, dass die World-Position unter der Maus gleich bleibt
    settings.camera.x = worldMouseX - mouseX / newScale;
    settings.camera.y = worldMouseY - mouseY / newScale;
  }
};

const handlePointerDown = (event) => {
  if (!event.metaKey) return;

  if (event.button && event.button !== 0 && event.pointerType === 'mouse') return;

  isDragging = true;

  lastPointer.x = event.clientX;
  lastPointer.y = event.clientY;

  try {
    mapElem.value?.setPointerCapture?.(event.pointerId);
  } catch (e) {}

  event.preventDefault();
};

const handlePointerMove = (event) => {
  if (!isDragging) return;

  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;

  const scale = settings.camera.scale || 1;
  settings.camera.x -= dx / scale;
  settings.camera.y -= dy / scale;

  lastPointer.x = event.clientX;
  lastPointer.y = event.clientY;
};

const handlePointerUp = (event) => {
  if (!isDragging) return;

  isDragging = false;

  try {
    mapElem.value?.releasePointerCapture?.(event.pointerId);
  } catch (e) {}
};

const gameLoop = () => {
  updateCamera();
  animationFrameId = requestAnimationFrame(gameLoop);
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  mapElem.value?.addEventListener('wheel', handleWheel, { passive: false });

  mapElem.value?.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);

  gameLoop();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  mapElem.value?.removeEventListener('wheel', handleWheel);

  mapElem.value?.removeEventListener('pointerdown', handlePointerDown);
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);

  cancelAnimationFrame(animationFrameId);
});
</script>

<template>
  <div class="map" ref="map-el">
    <button v-if="!hasCurrentConfig" @click="openGenerationModal">Map erstellen</button>

    <template v-else>
      <ul class="config settings">
        <li>
          <input type="checkbox" v-model="settings.showGrid" id="input-show-grid" />
          <label for="input-show-grid">Grid</label>
        </li>

        <li>
          <input type="checkbox" v-model="settings.showPixels" id="input-show-pixels" />
          <label for="input-show-pixels">Pixel</label>
        </li>

        <li>
          <input type="checkbox" v-model="settings.showHitboxes" id="input-show-hitboxes" />
          <label for="input-show-hitboxes">Hitboxes</label>
        </li>
      </ul>

      <ul class="config scale">
        <li>
          <button @mousedown="handleMouseDown('plus')" @mouseup="handleMouseUp('plus')" @mouseleave="handleMouseUp('plus')">+</button>
        </li>

        <li>
          <button @mousedown="handleMouseDown('minus')" @mouseup="handleMouseUp('minus')" @mouseleave="handleMouseUp('minus')">-</button>
        </li>
      </ul>

      <ul class="config camera">
        <li>
          <button @mousedown="handleMouseDown('up')" @mouseup="handleMouseUp('up')" @mouseleave="handleMouseUp('up')">U</button>
        </li>

        <li>
          <button @mousedown="handleMouseDown('down')" @mouseup="handleMouseUp('down')" @mouseleave="handleMouseUp('down')">D</button>
        </li>

        <li>
          <button @mousedown="handleMouseDown('left')" @mouseup="handleMouseUp('left')" @mouseleave="handleMouseUp('left')">L</button>
        </li>

        <li>
          <button @mousedown="handleMouseDown('right')" @mouseup="handleMouseUp('right')" @mouseleave="handleMouseUp('right')">R</button>
        </li>
      </ul>

      <Canvas :settings :selectedTileId />
    </template>
  </div>

  <Modal v-if="showGenerationModal">
    <h2>Map definieren</h2>

    <form @submit.prevent="handleForm">
      <div class="input-wrapper">
        <label for="input-name">Name:</label>
        <input type="text" id="input-name" required v-model="formData.name" />
      </div>

      <div class="input-wrapper">
        <label for="input-x">Px (X-Achse):</label>
        <input type="number" id="input-x" min="1" required v-model="formData.x" @input="validateInput" />
      </div>

      <div class="input-wrapper">
        <label for="input-y">Px (Y-Achse):</label>
        <input type="number" id="input-y" min="1" required v-model="formData.y" @input="validateInput" />
      </div>

      <button type="button" @click="closeGenerationModal">Abbrechen</button>
      <button type="submit">Erstellen</button>
    </form>
  </Modal>
</template>

<style scoepd lang="scss">
@use '@/styles/variables';

.map {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 !important;
  overflow: hidden;
  position: relative;

  .config {
    position: absolute;
    background-color: variables.$dark;
    border: 2px solid variables.$light;
    list-style: none;
    display: flex;
    margin: 0;
    padding: 1rem;
    gap: 1rem;

    button {
      height: 2rem;
      width: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 2rem;
      padding: 0;
      padding-left: 2px;
      padding-top: 1px;
    }
  }

  .settings {
    top: 0;
    right: 0;
    border-radius: 0 0 0 1rem;
    border-top: none;
    border-right: none;
    color: variables.$light;

    label {
      margin-right: 0;
    }
  }

  .scale {
    border-radius: 1rem 0 0 0;
    border-bottom: none;
    border-right: none;
    bottom: 0;
    right: 0;
  }

  .camera {
    border-radius: 0 1rem 0 0;
    border-bottom: none;
    border-left: none;
    bottom: 0;
    left: 0;
  }
}

.modal {
  input {
    &[type='number'] {
      width: 6.5rem;
    }
  }
}
</style>
