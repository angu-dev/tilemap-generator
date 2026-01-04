<script setup>
import { useConfigStore } from '@/stores/configs';
import { computed, ref, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import Modal from './Modal.vue';
import { storeToRefs } from 'pinia';

const configs = useConfigStore();

const fileElem = useTemplateRef('input-file');

const { hasCurrentConfig, hasCurrentConfigChanges, configsNameListWithoutCurrentUnsaved, hasConfigs } = storeToRefs(configs);

const showImportConfigModal = ref(false);
const showLoadConfigs = ref(false);
const pickedLoadConfigName = ref(null);
const fileName = ref(null);

const file = ref(null);

const saveDisabled = computed(() => {
  return !hasCurrentConfig.value || !hasCurrentConfigChanges.value;
});

const openLoadConfigsModal = () => {
  showLoadConfigs.value = true;
};

const closeLoadConfigsModal = () => {
  showLoadConfigs.value = false;
};

const openImportConfigModal = () => {
  showImportConfigModal.value = true;
};

const closeImportConfigModal = () => {
  showImportConfigModal.value = false;
};

const handleSaveMapConfig = () => {
  configs.save();
};

const handleDeleteCurrentConfig = () => {
  const result = confirm('Derzeitige Konfiguration unwiederruflich löschen?');
  if (!result) return;

  configs.remove();
};

const handleLoadConfigForm = () => {
  if (hasCurrentConfigChanges.value) {
    const result = confirm('Derzeitige Configänderungen verwerfen');

    if (!result) {
      configs.remove();
      return;
    }
  }

  configs.load(pickedLoadConfigName.value);

  showLoadConfigs.value = false;
  pickedLoadConfigName.value = null;
};

const handleImportConfigForm = () => {
  if (!configs.isKeyAvailable(fileName.value)) {
    alert('Name bereits besetzt');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);

      const REQUIRED_CONFIG_KEYS = ['name', 'x', 'y'];
      const hasAllKeys = REQUIRED_CONFIG_KEYS.every((key) => key in jsonData);
      const hasCorrectTypes = typeof jsonData.name === 'string' && typeof jsonData.x === 'number' && typeof jsonData.y === 'number';

      if (!hasAllKeys || !hasCorrectTypes) {
        throw Error();
      }

      if (hasCurrentConfigChanges.value) {
        const result = confirm('Derzeitige Änderungen vor Import speichern?');

        if (result) {
          configs.save();
        }

        return;
      }

      configs.importConfig(fileName.value, jsonData);
      closeImportConfigModal();
      file.value = null;
    } catch (error) {
      alert('Konfigurationsdatei inkompatibel');
      file.value = null;
      fileElem.value.value = '';
    }
  };

  reader.readAsText(file.value);
};

const handleExportConfig = () => {
  if (hasCurrentConfigChanges.value) {
    const result = confirm('Derzeitige Änderungen vor Export speichern?');

    if (result) {
      configs.save();
    }
  }

  configs.exportConfig();
};
</script>

<template>
  <div class="manage">
    <h2>Verwaltung</h2>

    <button @click="handleSaveMapConfig" :disabled="saveDisabled">Speichern</button>
    <button :disabled="!hasCurrentConfig" @click="handleDeleteCurrentConfig">Löschen</button>
    <button :disabled="!hasConfigs" @click="openLoadConfigsModal">Laden</button>

    <hr />

    <button @click="openImportConfigModal">Importieren (Config)</button>
    <button :disabled="!hasCurrentConfig" @click="handleExportConfig">Exportieren (Config)</button>

    <!-- 
    <hr />

    <button id="btn-export-game">Exportieren (Gamefile)</button>
    -->
  </div>

  <Modal v-if="showLoadConfigs">
    <h2>Konfiguration laden</h2>

    <ul>
      <li v-for="config in configsNameListWithoutCurrentUnsaved" :key="config">
        <input type="radio" v-model="pickedLoadConfigName" :id="`radio-${config}`" :value="config" />
        <label :for="`radio-${config}`">{{ config }}</label>
      </li>
    </ul>

    <form @submit.prevent="handleLoadConfigForm">
      <button type="button" @click="closeLoadConfigsModal">Abbrechen</button>
      <button type="submit" :disabled="!pickedLoadConfigName">Laden</button>
    </form>
  </Modal>

  <Modal v-if="showImportConfigModal">
    <h2>Konfiguration importieren</h2>

    <div class="input-wrapper">
      <label for="input-file-name">Name:</label>
      <input type="text" v-model="fileName" required id="input-file-name" />
    </div>

    <div class="input-wrapper">
      <input type="file" accept=".json" @change="(e) => (file = e.target.files[0])" ref="input-file" />
    </div>

    <form @submit.prevent="handleImportConfigForm">
      <button type="button" @click="closeImportConfigModal">Abbrechen</button>
      <button type="submit" :disabled="!file || !fileName">Importieren</button>
    </form>
  </Modal>
</template>

<style scoped lang="scss">
.manage {
  hr {
    position: relative;
    left: -1rem;
    width: calc(#{100%} + #{2rem});
  }

  > button {
    display: block;
    width: 100%;

    &:not(:last-child) {
      margin-bottom: 1rem;
    }
  }
}
.modal {
  ul {
    padding-left: 0;
    list-style-type: none;
  }
}
</style>
