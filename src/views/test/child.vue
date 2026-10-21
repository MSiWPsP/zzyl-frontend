<template>
  <div>{{ message }}</div>
  <div>
    <button @click="sendMessage">给父组件发消息</button>
  </div>
</template>

<script setup>
import { defineEmits } from 'vue';

const emit = defineEmits(['message-sent']);

function sendMessage() {
  emit('message-sent', '来自子组件的消息');
}

defineProps({
  message: String
});
</script>