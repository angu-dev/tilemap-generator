<script setup></script>

<template>
  <div class="modal">
    <div>
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables';

.modal {
  position: fixed;
  background-color: rgba(variables.$dark, 0.7);
  height: 100vh;
  width: 100vw;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;

  > div {
    background-color: variables.$dark;
    min-width: 500px;
    border: 2px solid variables.$light;
    border-radius: 1rem;
    padding: 1rem;
    color: variables.$light;

    :deep(form) {
      margin-bottom: 0;
    }

    :deep(button) {
      + button {
        margin-left: 1rem;
      }
    }
  }
}
</style>
