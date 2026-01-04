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

const validateInput = (event) => {
  if (parseInt(event.target.value) >= 1) return;

  event.target.value = 1;
};
</script>

<template>
  <div class="map">
    <button v-if="!hasCurrentConfig" @click="openGenerationModal">Map erstellen</button>

    <template v-else>
      <ul class="settings">
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

  .settings {
    position: absolute;
    top: 0;
    right: 0;
    background-color: variables.$dark;
    color: variables.$light;
    list-style: none;
    display: flex;
    margin: 0;
    padding: 1rem;
    gap: 1rem;
    border-radius: 0 0 0 1rem;
    border: 2px solid variables.$light;
    border-top: none;
    border-right: 0;

    label {
      margin-right: 0;
    }
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
