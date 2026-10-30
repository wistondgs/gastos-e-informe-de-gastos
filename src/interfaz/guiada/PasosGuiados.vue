<script setup>
defineProps({
  pasos: { type: Array, required: true },
  actual: { type: Number, required: true },
  oscuro: { type: Boolean, default: false },
});
</script>

<template>
  <nav
    class="pasos-guiados"
    :class="{ oscuro }"
    aria-label="Pasos del asistente"
  >
    <ol>
      <li
        v-for="(paso, indice) in pasos"
        :key="paso.id"
        :class="{ actual: indice === actual, completo: indice < actual }"
        :aria-current="indice === actual ? 'step' : undefined"
      >
        <span class="numero">{{ indice + 1 }}</span>
        <span class="nombre">{{ paso.nombre }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.pasos-guiados {
  padding: 8px 16px 4px;
}
ol {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 5px;
  border: 1px solid var(--g-line);
  border-radius: 10px;
  background: var(--g-sur);
  color: var(--g-ink2);
  font-size: 12px;
  line-height: 1.2;
}
.numero {
  flex: none;
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: var(--g-sur2);
  color: var(--g-ink);
  font-weight: 800;
}
.nombre {
  overflow-wrap: anywhere;
}
.actual {
  border: 2px solid var(--g-acc);
  color: var(--g-ink);
  font-weight: 800;
  padding: 5px 4px;
}
.actual .numero,
.completo .numero {
  background: var(--g-acc);
  color: var(--g-onAcc);
}
.oscuro li {
  background: #222c27;
  border-color: #87958c;
  color: #fff;
}
.oscuro .numero {
  background: #56645b;
  color: #fff;
}
.oscuro .actual {
  border-color: #fff;
}
.oscuro .actual .numero,
.oscuro .completo .numero {
  background: #fff;
  color: #0b0f0d;
}
@media (max-width: 360px) {
  ol {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
