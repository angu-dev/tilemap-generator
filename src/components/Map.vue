<script setup>
import { reactive, ref, useTemplateRef } from 'vue';
import Modal from './Modal.vue';
import { useConfigStore } from '@/stores/configs';
import { storeToRefs } from 'pinia';
import Canvas from './Canvas.vue';

const configs = useConfigStore();

const { hasCurrentConfig } = storeToRefs(configs);

const settings = reactive({
  showGrid: true,
  showPixels: true,
  showHitboxes: true,
  scale: 1,
  camera: {
    x: 0,
    y: 0,
  },
});

const showGenerationModal = ref(false);

const formData = reactive({
  name: '',
  x: 16,
  y: 16,
});

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

const handleScale = (up) => {
  let factor = 0.5;

  if (!up) {
    factor *= -1;
  }

  settings.scale += factor;

  if (settings.scale <= 1) {
    settings.scale = 1;
  }
};

const handleCamera = (key) => {
  let factor = 1;

  switch (key) {
    case 'up':
      settings.camera.y -= factor;
      break;
    case 'down':
      settings.camera.y += factor;
      break;
    case 'left':
      settings.camera.x -= factor;
      break;
    case 'right':
      settings.camera.x += factor;
      break;
  }
};

const validateInput = (event) => {
  if (parseInt(event.target.value) >= 1) return;

  event.target.value = 1;
};
</script>

<template>
  <div class="map">
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
          <button @click="handleScale(true)">+</button>
        </li>

        <li>
          <button @click="handleScale(false)">-</button>
        </li>
      </ul>

      <ul class="config camera">
        <li>
          <button @click="handleCamera('up')">U</button>
        </li>

        <li>
          <button @click="handleCamera('down')">D</button>
        </li>

        <li>
          <button @click="handleCamera('left')">L</button>
        </li>

        <li>
          <button @click="handleCamera('right')">R</button>
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
