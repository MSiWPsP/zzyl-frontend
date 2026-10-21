<template>
    <div class="popup-result">
        <p class="title">最近5次运行时间</p>
        <ul class="popup-result-scroll">
            <li v-if="loading">计算结果中...</li>
            <li v-else-if="message">{{ message }}</li>
            <template v-else>
                <li v-for="item in resultList" :key="item">{{ item }}</li>
            </template>
        </ul>
    </div>
</template>

<script setup>
import { previewJobCron } from '@/api/monitor/job'

const props = defineProps({
    ex: {
        type: String,
        default: ''
    }
})

const loading = ref(false)
const message = ref('')
const resultList = ref([])
let timer
let requestId = 0

function formatTime(timestamp) {
    const date = new Date(timestamp)
    const pad = value => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

watch(() => props.ex, expression => {
    clearTimeout(timer)
    const currentRequest = ++requestId
    resultList.value = []
    message.value = ''
    if (!expression?.trim()) {
        loading.value = false
        return
    }
    loading.value = true
    timer = setTimeout(async () => {
        try {
            const response = await previewJobCron(expression)
            if (currentRequest !== requestId) return
            const { valid, times } = response.data
            if (!valid) {
                message.value = 'Cron表达式不正确'
            } else if (!times.length) {
                message.value = '没有后续执行时间'
            } else {
                resultList.value = times.map(formatTime)
            }
        } catch (error) {
            if (currentRequest === requestId) {
                message.value = '预览失败，请稍后重试'
            }
        } finally {
            if (currentRequest === requestId) loading.value = false
        }
    }, 300)
}, { immediate: true })

onBeforeUnmount(() => {
    clearTimeout(timer)
    requestId++
})
</script>
