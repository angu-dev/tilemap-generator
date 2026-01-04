<script setup>
import { onMounted } from 'vue';
import Areas from './components/Areas.vue';
import Layers from './components/Layers.vue';
import Management from './components/Management.vue';
import Map from './components/Map.vue';
import { useConfigStore } from './stores/configs';

const configs = useConfigStore();

onMounted(() => {
  configs.init();
});
</script>

<template>
  <div class="application">
    <Map />

    <div class="area">
      <Layers />

      <Areas />

      <Management />
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/fonts';
@use '@/styles/general';
</style>

<style lang="scss" scoped>
@use '@/styles/variables';

.application {
  background: #222;
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 1rem;
  padding: 1rem;
  height: calc(#{100vh} - #{2rem});

  .area {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    justify-content: space-between;

    :deep(> div) {
      height: 100%;
    }
  }

  :deep(.map),
  :deep(.area > div:not(.modal)) {
    border: 2px solid variables.$light;
    border-radius: 1rem;
    padding: 1rem;
  }
}
</style>
