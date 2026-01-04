<script setup>
import { onMounted, onUnmounted, reactive, ref, useTemplateRef } from 'vue';
import Modal from './Modal.vue';
import { useConfigStore } from '@/stores/configs';
import { storeToRefs } from 'pinia';
import Canvas from './Canvas.vue';

const configs = useConfigStore();

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
  const scaleFactor = 0.01;

  if (keys.up) settings.camera.y -= movementFactor;
  if (keys.down) settings.camera.y += movementFactor;
  if (keys.left) settings.camera.x -= movementFactor;
  if (keys.right) settings.camera.x += movementFactor;

  if (keys.plus || keys.minus) {
    const rect = mapElem.value?.getBoundingClientRect() ?? { width: 0, height: 0 };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const oldScale = settings.camera.scale;
    const factor = keys.plus ? 1 + scaleFactor : 1 - scaleFactor;
    const newScale = Math.max(1, oldScale * factor);
    const f = newScale / oldScale;

    settings.camera.x = settings.camera.x * f + centerX * (f - 1);
    settings.camera.y = settings.camera.y * f + centerY * (f - 1);
    settings.camera.scale = newScale;
  }

  if (settings.camera.scale <= 1) {
    settings.camera.scale = 1;
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
      keys.up = true;
      event.preventDefault();
      break;
    case 'ArrowDown':
      keys.down = true;
      event.preventDefault();
      break;
    case 'ArrowLeft':
      keys.left = true;
      event.preventDefault();
      break;
    case 'ArrowRight':
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
      keys.up = false;
      break;
    case 'ArrowDown':
      keys.down = false;
      break;
    case 'ArrowLeft':
      keys.left = false;
      break;
    case 'ArrowRight':
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
  const newScale = Math.max(1, oldScale * factor);
  const f = newScale / oldScale;

  settings.camera.x = settings.camera.x * f + mouseX * (f - 1);
  settings.camera.y = settings.camera.y * f + mouseY * (f - 1);

  settings.camera.scale = newScale;
};

const gameLoop = () => {
  updateCamera();
  animationFrameId = requestAnimationFrame(gameLoop);
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  mapElem.value?.addEventListener('wheel', handleWheel, { passive: false });

  gameLoop();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  mapElem.value?.removeEventListener('wheel', handleWheel);

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

      <Canvas :settings />
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
