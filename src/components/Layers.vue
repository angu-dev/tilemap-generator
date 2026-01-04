<script setup>
import { useConfigStore } from '@/stores/configs';
import { storeToRefs } from 'pinia';
import Modal from './Modal.vue';
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';

const configs = useConfigStore();

const { currentConfig, selectedTileId } = storeToRefs(configs);

const createFormData = reactive({
  name: '',
});

const renameFormData = reactive({
  name: '',
  oldName: '',
});

const addTileFormData = reactive({
  file: null,
  snapGrid: true,
  width: 16,
  height: 16,
  hitboxes: [],
  rotation: 0,
  mirrored: {
    x: false,
    y: false,
  },
});

const showCreateModal = ref(false);
const showRenameModal = ref(false);
const showAddTileModal = ref(false);
const previewUrl = ref(null);
const selectedLayerName = ref(null);

let draggedLayerName = null;
let draggedIndex = null;
let targetIndex = null;
let prevRotation = 0;
let isPainting = false;
let paintMode = null;

const openCreateModal = () => {
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
};

const handleCreateForm = () => {
  if (currentConfig.value.layers.some((layer) => layer.name === createFormData.name)) {
    alert('Layername bereits vergeben');
    return;
  }

  currentConfig.value.layers.push({
    name: createFormData.name,
    tileIds: [],
    hidden: false,
  });

  configs.update();

  createFormData.name = '';
  showCreateModal.value = false;
};

const toggleHiddenLayer = (layerName) => {
  const currentLayer = currentConfig.value.layers.find((layer) => layer.name === layerName);

  currentLayer.hidden = !currentLayer.hidden;

  configs.update();
};

const deleteLayer = (layerName) => {
  if (!confirm('Layer wirklich löschen?')) {
    return;
  }

  currentConfig.value.layers = currentConfig.value.layers.filter((layer) => layer.name !== layerName);

  configs.update();
};

const openRenameModal = (layerName) => {
  renameFormData.name = layerName;
  renameFormData.oldName = layerName;
  showRenameModal.value = true;
};

const closeRenameModal = () => {
  renameFormData.name = '';
  renameFormData.oldName = '';
  showRenameModal.value = false;
};

const handleRenameForm = () => {
  currentConfig.value.layers.find((layer) => layer.name === renameFormData.oldName).name = renameFormData.name;

  configs.update();

  closeRenameModal();
};

const handleDragStart = (layerName) => {
  draggedLayerName = layerName;
  draggedIndex = currentConfig.value.layers.findIndex((l) => l.name === layerName);
};

const handleDragOver = (event, hoverLayerName) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  targetIndex = currentConfig.value.layers.findIndex((l) => l.name === hoverLayerName);

  if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
    const layers = currentConfig.value.layers;
    const [draggedLayer] = layers.splice(draggedIndex, 1);
    layers.splice(targetIndex, 0, draggedLayer);
    draggedIndex = targetIndex;
  }
};

const handleDragEnd = () => {
  draggedLayerName = null;
  draggedIndex = null;
  targetIndex = null;

  configs.update();
};

const openAddTileModal = (layerName) => {
  selectedLayerName.value = layerName;

  addTileFormData.width = currentConfig.value.x;
  addTileFormData.height = currentConfig.value.y;

  showAddTileModal.value = true;
};

const resetAddTileFormData = () => {
  addTileFormData.file = null;
  addTileFormData.snapGrid = true;
  addTileFormData.width = currentConfig.value.x;
  addTileFormData.height = currentConfig.value.y;
  addTileFormData.hitboxes = [];
  addTileFormData.rotation = 0;
  addTileFormData.mirrored = { x: false, y: false };
};

const closeAddTileModal = () => {
  showAddTileModal.value = false;
  selectedLayerName.value = null;

  resetAddTileFormData();

  if (!previewUrl.value) return;

  URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
};

const rotateHitboxesCCW = (hitboxes) => {
  const old = hitboxes || [];
  const h = old.length;
  const w = h ? old[0].length : 0;
  const rotated = Array.from({ length: w }, () => Array.from({ length: h }, () => false));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rotated[w - 1 - x][y] = old[y][x];
    }
  }

  return rotated;
};

const fileToDataURL = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
};

const handleAddTileForm = async () => {
  if (!addTileFormData.file || !selectedLayerName.value) return;

  const layer = currentConfig.value.layers.find((l) => l.name === selectedLayerName.value);
  if (!layer) return;

  const tileId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tile-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let baseHitboxes = addTileFormData.hitboxes.map((r) => [...r]);
  let baseRotation = normRot(addTileFormData.rotation);
  let baseMirrored = { ...addTileFormData.mirrored };

  const stepsBack = Math.round(baseRotation / 90);
  for (let i = 0; i < stepsBack; i++) {
    baseHitboxes = rotateHitboxesCCW(baseHitboxes);
  }

  if (baseMirrored.x) baseHitboxes = baseHitboxes.map((row) => [...row].reverse());
  if (baseMirrored.y) baseHitboxes = [...baseHitboxes].reverse();

  const dataUrl = await fileToDataURL(addTileFormData.file);

  const tile = {
    id: tileId,
    snapGrid: addTileFormData.snapGrid,
    width: addTileFormData.width,
    height: addTileFormData.height,
    rotation: normRot(addTileFormData.rotation),
    mirrored: { ...addTileFormData.mirrored },
    hitboxes: baseHitboxes,

    fileName: addTileFormData.file.name,
    src: dataUrl,
  };

  if (!currentConfig.value.tiles) currentConfig.value.tiles = [];
  currentConfig.value.tiles.push(tile);
  layer.tileIds.push(tileId);

  configs.update();
  closeAddTileModal();
};

const handleSnapGridChange = () => {
  if (!addTileFormData.snapGrid) return;

  addTileFormData.width = currentConfig.value.x;
  addTileFormData.height = currentConfig.value.y;
};

const handleAddTileFileChange = (e) => {
  addTileFormData.file = e.target.files?.[0] || null;
  addTileFormData.rotation = 0;
  addTileFormData.hitboxes = [];
  addTileFormData.mirrored = { x: false, y: false };
};

const resetHitboxes = (w, h) => {
  const width = Math.max(0, Number(w) || 0);
  const height = Math.max(0, Number(h) || 0);

  addTileFormData.hitboxes = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
};

watch(
  () => addTileFormData.file,
  (file, prev) => {
    if (prev && previewUrl.value) URL.revokeObjectURL(previewUrl.value);

    if (file) {
      previewUrl.value = URL.createObjectURL(file);
      addTileFormData.rotation = 0;
      addTileFormData.mirrored = { x: false, y: false };
      resetHitboxes(addTileFormData.width, addTileFormData.height);
    } else {
      previewUrl.value = null;
    }
  },
);

watch(
  () => [addTileFormData.width, addTileFormData.height],
  () => {
    if (!addTileFormData.file) return;

    resetHitboxes(addTileFormData.width, addTileFormData.height);
  },
);

onUnmounted(() => {
  if (!previewUrl.value) return;

  URL.revokeObjectURL(previewUrl.value);
});

const handleCellToggle = (x, y) => {
  const row = addTileFormData.hitboxes[y];
  if (!row || typeof row[x] === 'undefined') return;

  row[x] = !row[x];
};

const normRot = (deg) => ((deg % 360) + 360) % 360;

const rotateHitboxesCW = () => {
  const old = addTileFormData.hitboxes || [];
  const h = old.length;
  const w = h ? old[0].length : 0;
  const rotated = Array.from({ length: w }, () => Array.from({ length: h }, () => false));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rotated[x][h - 1 - y] = old[y][x];
    }
  }

  addTileFormData.hitboxes = rotated;
  const tmp = addTileFormData.width;
  addTileFormData.width = addTileFormData.height;
  addTileFormData.height = tmp;
};

const flipHitboxesX = () => {
  addTileFormData.hitboxes = addTileFormData.hitboxes.map((row) => [...row].reverse());
};

const flipHitboxesY = () => {
  addTileFormData.hitboxes = [...addTileFormData.hitboxes].reverse();
};

watch(
  () => addTileFormData.rotation,
  (rot) => {
    const oldR = normRot(prevRotation);
    const newR = normRot(rot);

    let steps = Math.round((newR - oldR) / 90);
    steps = ((steps % 4) + 4) % 4; // 0..3

    for (let i = 0; i < steps; i++) rotateHitboxesCW();

    prevRotation = rot;
  },
);

watch(
  () => addTileFormData.mirrored.x,
  () => {
    if (addTileFormData.hitboxes.length) flipHitboxesX();
  },
);

watch(
  () => addTileFormData.mirrored.y,
  () => {
    if (addTileFormData.hitboxes.length) flipHitboxesY();
  },
);

const setCell = (x, y, value) => {
  const row = addTileFormData.hitboxes[y];

  if (!row || typeof row[x] === 'undefined') return;

  row[x] = value;
};

const handleCellDown = (x, y, event) => {
  if (event.button && event.button !== 0) return;

  isPainting = true;
  const row = addTileFormData.hitboxes[y];

  if (row && typeof row[x] !== 'undefined') {
    // Bestimme den Mode basierend auf aktuellem Zustand
    paintMode = row[x] ? 'remove' : 'add';
    row[x] = !row[x];
  }

  event.preventDefault();
};

const handleCellEnter = (x, y) => {
  if (!isPainting || !paintMode) return;

  const row = addTileFormData.hitboxes[y];
  if (row && typeof row[x] !== 'undefined') {
    row[x] = paintMode === 'add';
  }
};

const handlePointerUpGlobal = () => {
  isPainting = false;
  paintMode = null;
};

onMounted(() => {
  window.addEventListener('pointerup', handlePointerUpGlobal);
});

onUnmounted(() => {
  window.removeEventListener('pointerup', handlePointerUpGlobal);
});

const getTileById = (tileId) => {
  return currentConfig.value.tiles?.find((t) => t.id === tileId);
};

const selectTile = (tileId) => {
  selectedTileId.value = selectedTileId.value === tileId ? null : tileId;
};

const deleteTile = (layerName, tileId) => {
  if (!confirm('Tile wirklich löschen?')) {
    return;
  }

  const layer = currentConfig.value.layers.find((l) => l.name === layerName);
  if (layer) {
    layer.tileIds = layer.tileIds.filter((id) => id !== tileId);
  }

  currentConfig.value.tiles = currentConfig.value.tiles.filter((t) => t.id !== tileId);

  if (selectedTileId.value === tileId) {
    selectedTileId.value = null;
  }

  configs.update();
};
</script>

<template>
  <div class="layers">
    <h2>
      Layers

      <button @click="openCreateModal">+</button>
    </h2>

    <ul v-if="currentConfig?.layers" class="layer-list">
      <li v-for="layer in currentConfig.layers" :key="layer.name">
        <div
          draggable="true"
          @dragstart="handleDragStart(layer.name)"
          @dragover="handleDragOver($event, layer.name)"
          @dragenter="handleDragOver($event, layer.name)"
          @dragend="handleDragEnd"
        >
          <span>{{ layer.name }}</span>

          <div>
            <button @click="openAddTileModal(layer.name)">+</button>
            <button @click="openRenameModal(layer.name)">U</button>
            <button @click="toggleHiddenLayer(layer.name)">{{ layer.hidden ? 'S' : 'H' }}</button>
            <button @click="deleteLayer(layer.name)">D</button>
          </div>
        </div>

        <ul v-if="layer.tileIds" class="tiles-list">
          <li v-for="tileId in layer.tileIds" :key="tileId" class="tile-item" :class="{ active: selectedTileId === tileId }" @click="selectTile(tileId)">
            <div v-if="getTileById(tileId)">
              <img v-if="getTileById(tileId).src" :src="getTileById(tileId).src" alt="tile preview" class="tile-preview" />
              {{ getTileById(tileId).fileName }}
            </div>

            <div>
              <button @click="deleteTile(layer.name, tileId)">D</button>
            </div>
          </li>
        </ul>
      </li>
    </ul>
  </div>

  <Modal v-if="showCreateModal">
    <h2>Layer hinzufügen</h2>

    <form @submit.prevent="handleCreateForm">
      <div class="input-wrapper">
        <label for="input-name">Name:</label>
        <input type="text" id="input-name" v-model="createFormData.name" required />
      </div>

      <button type="button" @click="closeCreateModal">Abbrechen</button>
      <button type="submit" :disabled="!createFormData.name">Hinzufügen</button>
    </form>
  </Modal>

  <Modal v-if="showRenameModal">
    <h2>Layer umbenennen</h2>

    <form @submit.prevent="handleRenameForm">
      <div class="input-wrapper">
        <label for="input-name">Neuer Name:</label>
        <input type="text" id="input-name" v-model="renameFormData.name" required />
      </div>

      <button type="button" @click="closeRenameModal">Abbrechen</button>
      <button type="submit" :disabled="!renameFormData.name">Umbenenen</button>
    </form>
  </Modal>

  <Modal v-if="showAddTileModal">
    <h2>Tile hinzufügen</h2>

    <form @submit.prevent="handleAddTileForm">
      <div class="input-wrapper">
        <label for="input-grid-snap">Grid-Snap:</label>
        <input type="checkbox" id="input-grid-snap" v-model="addTileFormData.snapGrid" @change="handleSnapGridChange" />
      </div>

      <div class="input-wrapper">
        <label for="input-width">Breite:</label>
        <input type="number" id="input-width" required v-model="addTileFormData.width" :disabled="addTileFormData.snapGrid" />
      </div>

      <div class="input-wrapper">
        <label for="input-height">Höhe:</label>
        <input type="number" id="input-height" required v-model="addTileFormData.height" :disabled="addTileFormData.snapGrid" />
      </div>

      <div class="input-wrapper">
        <input type="file" accept="image/*" required @change="handleAddTileFileChange" />
      </div>

      <template v-if="addTileFormData.file">
        <div
          class="tile-grid"
          :style="{
            aspectRatio: `${addTileFormData.width} / ${addTileFormData.height}`,
          }"
        >
          <div
            class="background"
            :style="{
              backgroundImage: previewUrl ? `url(${previewUrl})` : undefined,
              transform: `
                scaleX(${addTileFormData.mirrored.x ? -1 : 1})
                scaleY(${addTileFormData.mirrored.y ? -1 : 1})
                rotate(${normRot(addTileFormData.rotation)}deg)
              `,
            }"
          ></div>

          <div
            class="overlay"
            :style="{
              gridTemplateColumns: `repeat(${addTileFormData.width}, 1fr)`,
              gridTemplateRows: `repeat(${addTileFormData.height}, 1fr)`,
            }"
          >
            <template v-for="(row, y) in addTileFormData.hitboxes" :key="`r-${y}`">
              <div
                v-for="(cell, x) in row"
                :key="`c-${y}-${x}`"
                class="cell"
                :class="{ active: cell }"
                @pointerdown="(e) => handleCellDown(x, y, e)"
                @pointerenter="() => handleCellEnter(x, y)"
              />
            </template>
          </div>
        </div>

        <div class="input-wrapper rotation">
          <label>Rotation:</label>

          <label for="input-rotation-0">0</label>
          <input type="radio" id="input-rotation-0" value="0" v-model="addTileFormData.rotation" />

          <label for="input-rotation-90">90</label>
          <input type="radio" id="input-rotation-90" value="90" v-model="addTileFormData.rotation" />

          <label for="input-rotation-180">180</label>
          <input type="radio" id="input-rotation-180" value="180" v-model="addTileFormData.rotation" />

          <label for="input-rotation-270">270</label>
          <input type="radio" id="input-rotation-270" value="270" v-model="addTileFormData.rotation" />
        </div>

        <div class="input-wrapper">
          <label for="input-mirrored-x">Gespiegelt X:</label>
          <input type="checkbox" id="input-mirrored-x" v-model="addTileFormData.mirrored.x" />
        </div>

        <div class="input-wrapper">
          <label for="input-mirrored-y">Gespiegelt Y:</label>
          <input type="checkbox" id="input-mirrored-y" v-model="addTileFormData.mirrored.y" />
        </div>
      </template>

      <button type="button" @click="closeAddTileModal">Abbrechen</button>
      <button type="submit" :disabled="!addTileFormData.file">Hinzufügen</button>
    </form>
  </Modal>
</template>

<style lang="scss" scoped>
@use '@/styles/variables';

ul.layer-list {
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  > li {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;
    flex-direction: column;

    > div {
      display: flex;
      justify-content: space-between;
      width: 100%;
      align-items: center;
      gap: 1rem;
      background-color: variables.$light;
      padding: 0.5rem;
      border-radius: 0.5rem;
      cursor: pointer;
      cursor: move;

      > div {
        display: flex;
        gap: 0.5rem;
      }
    }

    .tiles-list {
      padding: 0;
      list-style: none;
      margin-top: 0.5rem;
      width: 100%;
      gap: 0.5rem;
      display: flex;
      flex-direction: column;

      li {
        background-color: variables.$light;
        border-radius: 0.5rem;
        padding: 0.25rem 0.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;

        &.active {
          background-color: rgba(0, 150, 255, 0.7);
        }

        > div {
          display: flex;
          align-items: center;

          &:first-child {
            gap: 1rem;

            .tile-preview {
              width: 1rem;
              height: 1rem;
              object-fit: contain;
              border-radius: 2px;
              flex-shrink: 0;
            }
          }

          &:nth-child(2) {
            gap: 0.5rem;
          }
        }
      }
    }

    button {
      background-color: variables.$dark;
      color: variables.$light;
      padding: 0;
      height: 1.5rem;
      width: 1.5rem;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      font-size: 1rem;
    }
  }
}

:deep(.rotation) {
  label {
    &:not(:has(+ label)) {
      margin-right: 0.25rem;
    }
  }
}

:deep(.tile-grid) {
  position: relative;
  max-width: 50%;
  max-height: 300px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin: 1rem 0;
  overflow: hidden;

  .background {
    position: absolute;
    inset: 0;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    transform-origin: center center;
    image-rendering: pixelated;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
  }

  .cell {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.05);
    cursor: pointer;
    transition: background 120ms ease;

    &.active {
      background: rgba(0, 200, 255, 0.35);
      border-color: rgba(0, 200, 255, 0.6);
    }
  }
}
</style>
