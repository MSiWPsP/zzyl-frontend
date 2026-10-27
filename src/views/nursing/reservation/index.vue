<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="预约人姓名" prop="name" style="width: 300px;">
        <el-input v-model="queryParams.name" placeholder="请输入" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="预约人手机号" prop="mobile" label-width="110px">
        <el-input v-model="queryParams.mobile" placeholder="请输入预约人手机号" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="预约状态" prop="status">
        <el-select v-model="queryParams.status" clearable placeholder="请选择预约状态">
          <el-option v-for="item in reservationStatuses" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="预约时间">
        <el-date-picker clearable v-model="dateRange" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ss"
          start-placeholder="开始时间" end-placeholder="结束时间" @change="handleDateRangeChange" />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="全部" name="all" />
      <el-tab-pane label="参观预约" name="0" />
      <el-tab-pane label="探访预约" name="1" />
    </el-tabs>
    <el-row :gutter="10" class="mb8">
      <el-col :span="24">
        <el-button type="success" plain icon="Upload" @click="handleImport">导入</el-button>
        <el-button type="warning" plain icon="Download" @click="handleExport">导出</el-button>
      </el-col>
    </el-row>
    <el-table v-loading="loading" :data="reservationList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="主键ID" align="center" prop="id" />
      <el-table-column label="预约人姓名" align="center" prop="name" />
      <el-table-column label="预约人手机号" align="center" prop="mobile" />
      <el-table-column label="预约时间" align="center" prop="time" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.time, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="探访人" align="center" prop="visitor" />
      <el-table-column label="预约类型" align="center" prop="type">
        <template #default="{ row }">{{ Number(row.type) === 0 ? '参观预约' : '探访预约' }}</template>
      </el-table-column>
      <el-table-column label="预约状态" align="center" prop="status">
        <template #default="{ row }">
          <el-tag :type="reservationStatuses[Number(row.status)]?.type">
            {{ reservationStatuses[Number(row.status)]?.label ?? row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width" width="300">
        <template #default="scope">
          <el-button link type="primary" :disabled="Number(scope.row.status) !== 0" @click="handleArrival(scope.row)">到院</el-button>
          <el-button link type="warning" :disabled="Number(scope.row.status) !== 0" @click="handleCancel(scope.row)">取消预约</el-button>
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog title="确认到院时间" v-model="arrivalDialogVisible" width="500px" append-to-body>
      <el-form ref="arrivalRef" :model="arrivalForm" label-width="90px">
        <el-form-item label="到院时间" prop="time" :rules="[{ required: true, message: '请选择到院时间', trigger: 'change' }]">
          <el-date-picker v-model="arrivalForm.time" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="arrivalDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="arrivalSubmitting" @click="submitArrival">确定</el-button>
      </template>
    </el-dialog>
    <el-dialog title="导入预约数据" v-model="importDialogVisible" width="500px" append-to-body
      :close-on-click-modal="!importing" :close-on-press-escape="!importing" :show-close="!importing">
      <el-upload ref="uploadRef" v-model:file-list="fileList" :action="uploadAction" :headers="uploadHeaders"
        accept=".xlsx,.xls" :limit="1" :auto-upload="false" :disabled="importing"
        :before-upload="beforeImport" :on-success="importSuccess" :on-error="importError">
        <el-button type="primary">选择文件</el-button>
        <template #tip><div class="el-upload__tip">请上传 Excel 文件（.xlsx、.xls）</div></template>
      </el-upload>
      <template #footer>
        <el-button :disabled="importing" @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" :disabled="!fileList.length" @click="uploadRef.submit()">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加或修改预约信息对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="reservationRef" :model="form" :rules="rules" label-width="80px">
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Reservation">
import { listReservation, getReservation, delReservation, addReservation, updateReservation } from "@/api/nursing/reservation";
import { getToken } from '@/utils/auth';

const { proxy } = getCurrentInstance();

const reservationList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const dateRange = ref([]);
const activeTab = ref('all');
const reservationStatuses = [
  { value: 0, label: '待报到', type: 'warning' },
  { value: 1, label: '已完成', type: 'success' },
  { value: 2, label: '已取消', type: 'danger' },
  { value: 3, label: '已过期', type: 'info' },
];
const arrivalDialogVisible = ref(false);
const arrivalRef = ref();
const arrivalForm = ref({});
const arrivalSubmitting = ref(false);
const importDialogVisible = ref(false);
const importing = ref(false);
const uploadRef = ref();
const fileList = ref([]);
const uploadAction = import.meta.env.VITE_APP_BASE_API + '/nursing/reservation/import';
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + getToken() }));

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: null,
    mobile: null,
    time: null,
    startTime: null,
    endTime: null,
    visitor: null,
    type: null,
    status: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询预约信息列表 */
function getList() {
  loading.value = true;
  listReservation(queryParams.value).then(response => {
    reservationList.value = response.rows;
    total.value = response.total;
  }).finally(() => { loading.value = false; });
}

// 取消按钮
function cancel() {
  open.value = false;
  reset();
}

// 表单重置
function reset() {
  form.value = {
    id: null,
    name: null,
    mobile: null,
    time: null,
    visitor: null,
    type: null,
    status: null,
    createTime: null,
    updateTime: null,
    createBy: null,
    updateBy: null,
    remark: null
  };
  proxy.resetForm("reservationRef");
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = [];
  queryParams.value.startTime = null;
  queryParams.value.endTime = null;
  queryParams.value.type = null;
  activeTab.value = 'all';
  proxy.resetForm("queryRef");
  handleQuery();
}

// 多选框选中数据
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = "添加预约信息";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getReservation(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改预约信息";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["reservationRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateReservation(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addReservation(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认删除预约信息编号为"' + _ids + '"的数据项？').then(function () {
    return delReservation(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => { });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('nursing/reservation/export', {
    ...queryParams.value
  }, `reservation_${new Date().getTime()}.xlsx`)
}

function handleDateRangeChange(range) {
  queryParams.value.startTime = range?.[0] ?? null;
  queryParams.value.endTime = range?.[1] ?? null;
}

function handleTabChange(tab) {
  queryParams.value.type = tab === 'all' ? null : Number(tab);
  handleQuery();
}

function handleArrival(row) {
  if (Number(row.status) !== 0) return;
  arrivalForm.value = { id: row.id, time: null };
  arrivalDialogVisible.value = true;
  nextTick(() => arrivalRef.value?.clearValidate());
}

async function submitArrival() {
  if (arrivalSubmitting.value || !await arrivalRef.value.validate().catch(() => false)) return;
  arrivalSubmitting.value = true;
  try {
    await proxy.$modal.confirm('是否确认到院？');
    await updateReservation({ ...arrivalForm.value, status: 1 });
    arrivalDialogVisible.value = false;
    proxy.$modal.msgSuccess('操作成功');
    getList();
  } catch { /* 取消或请求失败时保持当前记录。 */ }
  finally { arrivalSubmitting.value = false; }
}

function handleCancel(row) {
  if (Number(row.status) !== 0) return;
  proxy.$modal.confirm('是否确认取消预约？')
    .then(() => updateReservation({ id: row.id, status: 2 }))
    .then(() => { proxy.$modal.msgSuccess('操作成功'); getList(); })
    .catch(() => {});
}

function handleImport() {
  fileList.value = [];
  importDialogVisible.value = true;
}

function beforeImport(file) {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    proxy.$modal.msgError('只能上传 Excel 文件');
    return false;
  }
  importing.value = true;
  return true;
}

function importSuccess(response) {
  importing.value = false;
  uploadRef.value?.clearFiles();
  if (response.code !== 200) {
    proxy.$modal.msgError(response.msg || '导入失败');
    return;
  }
  importDialogVisible.value = false;
  proxy.$modal.msgSuccess('导入成功');
  getList();
}

function importError() {
  importing.value = false;
  uploadRef.value?.clearFiles();
  proxy.$modal.msgError('导入失败');
}

getList();
</script>
