<template>
  <el-dialog title="选择已评估老人" :model-value="visible" width="900px" append-to-body @close="emit('close')">
    <el-form ref="queryRef" :model="query" :inline="true" label-width="68px" @submit.prevent>
      <el-form-item label="老人姓名" prop="elderName">
        <el-input v-model="query.elderName" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="身份证号" prop="idCard">
        <el-input v-model="query.idCard" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="selectRow">
      <el-table-column width="55">
        <template #default="{ row }">
          <el-radio :model-value="selected?.id" :label="row.id" @change="selectRow(row)">
            <span class="sr-only">选择{{ row.elderName }}</span>
          </el-radio>
        </template>
      </el-table-column>
      <el-table-column label="老人姓名" prop="elderName" />
      <el-table-column label="身份证号" prop="idCard" width="190" />
      <el-table-column label="健康评分" prop="healthScore" />
      <el-table-column label="推荐护理等级" prop="nursingLevelName" />
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="query.pageNum"
      v-model:limit="query.pageSize" @pagination="loadList" />
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="!selected || loading" @click="confirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { healthPageQuery } from '@/api/nursing/checkIn'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close', 'select'])
const queryRef = ref()
const query = reactive({ pageNum: 1, pageSize: 5, admissionStatus: 1, elderName: '', idCard: '' })
const rows = ref([])
const total = ref(0)
const selected = ref(null)
const loading = ref(false)
let requestId = 0

async function loadList() {
  const currentRequest = ++requestId
  selected.value = null
  loading.value = true
  try {
    const response = await healthPageQuery({ ...query })
    if (currentRequest !== requestId) return
    rows.value = response.rows ?? []
    total.value = Number(response.total ?? 0)
  } catch {
    if (currentRequest === requestId) {
      rows.value = []
      total.value = 0
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function search() {
  query.pageNum = 1
  loadList()
}

function resetQuery() {
  queryRef.value?.resetFields()
  search()
}

function selectRow(row) {
  selected.value = row
}

function confirm() {
  if (!selected.value || loading.value) return
  emit('select', selected.value)
  emit('close')
}

watch(() => props.visible, visible => {
  if (visible) {
    Object.assign(query, { pageNum: 1, pageSize: 5, elderName: '', idCard: '' })
    rows.value = []
    loadList()
  } else {
    requestId++
    selected.value = null
  }
})
</script>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
