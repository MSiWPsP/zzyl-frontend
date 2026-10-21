<template>
    <div>
        <child :message="message" @message-sent="handleMessage"></child>
    </div>
</template>

<script setup>
import Child from './child.vue';

const message = 'Hello from Parent Component';

function handleMessage(message) {
  console.log('接收到了子组件的消息:', message);
}

</script>