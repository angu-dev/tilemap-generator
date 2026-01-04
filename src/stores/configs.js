import { defineStore } from 'pinia';
import { computed, reactive, ref, unref } from 'vue';

const KEY_CONFIGS = 'CONFIGS';

export const useConfigStore = defineStore('config', () => {
  const configs = reactive([]);

  const currentConfigName = ref(null);
  const changedCurrentConfig = ref(false);
  const selectedTileId = ref(null);

  const init = () => {
    const storage = localStorage.getItem(KEY_CONFIGS);
    if (!storage) return;

    configs.length = 0;
    configs.push(...JSON.parse(storage));

    // DEVELOP AUTOLOAD
    load('test');
  };

  const load = (name) => {
    currentConfigName.value = name;
    changedCurrentConfig.value = false;
  };

  const add = (name, x, y) => {
    configs.push({ name, x, y, tiles: [], layers: [], areas: [] });
    currentConfigName.value = name;
    changedCurrentConfig.value = true;
  };

  const remove = () => {
    const currentConfigs = [...configs];

    configs.length = 0;
    configs.push(...currentConfigs.filter((config) => config.name != currentConfigName.value));

    currentConfigName.value = null;

    localStorage.setItem(KEY_CONFIGS, JSON.stringify(configs));
  };

  const update = () => {
    changedCurrentConfig.value = true;
  };

  const save = () => {
    localStorage.setItem(KEY_CONFIGS, JSON.stringify(configs));

    changedCurrentConfig.value = false;
  };

  const configsNameListWithoutCurrentUnsaved = computed(() => {
    let list = configs.map((config) => config.name);

    if (changedCurrentConfig.value) {
      list = list.filter((name) => name != currentConfigName.value);
    }

    return list;
  });

  const hasConfigs = computed(() => {
    return configs.length > 0;
  });

  const hasCurrentConfig = computed(() => {
    return currentConfigName.value != null;
  });

  const hasCurrentConfigChanges = computed(() => {
    return changedCurrentConfig.value;
  });

  const currentConfig = computed(() => {
    if (!hasCurrentConfig) return null;

    return configs.filter((config) => config.name === currentConfigName.value)[0];
  });

  const isKeyAvailable = (name) => {
    return !configs.some((config) => config.name === name);
  };

  const exportConfig = () => {
    const jsonData = currentConfig.value;

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const link = document.createElement('a');
    link.href = url;
    link.download = `tilemap-generator-config_${timestamp}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const importConfig = (name, config) => {
    add(name, config.x, config.y);
  };

  return {
    init,
    load,
    add,
    remove,
    save,
    update,
    isKeyAvailable,
    exportConfig,
    importConfig,
    configsNameListWithoutCurrentUnsaved,
    hasConfigs,
    hasCurrentConfig,
    hasCurrentConfigChanges,
    currentConfig,
    selectedTileId,
  };
});
