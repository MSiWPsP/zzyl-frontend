<template>
  <el-dialog title="选择老人" :model-value="dialogVisible" class="oldSelectDialog" append-to-body @close="handleClose">
    <div class="dialogCenter">
      <!-- 搜索 -->
      <el-form ref="ruleForm" :model="pagination" :label-width="116" @submit.prevent>
        <el-row>
          <el-col :span="24">
            <el-row>
              <el-col :span="9">
                <el-form-item label="老人姓名：" prop="name">
                  <el-input v-model="pagination.name" class="form-item-content" clearable type="search"
                    placeholder="请输入" />
                </el-form-item>
              </el-col>
              <el-col :span="9">
                <el-form-item label="老人身份证号：" prop="idCardNo" class="label-wt">
                  <el-input v-model="pagination.idCardNo" class="form-item-content" clearable type="search"
                    placeholder="请输入" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <!-- 按钮区域 -->
                <div class="searchBtn">
                  <el-button @click="handleReset">重 置</el-button>
                  <el-button type="primary" @click="handleSearch">搜 索</el-button>
                </div>
              </el-col>
            </el-row>
          </el-col>
        </el-row>
      </el-form>
      <!-- end -->
      <el-table v-loading="dataLoading" :data="dialogData" row-key="id" style="width: 100%" @row-click="chooseone">
        <el-table-column width="55">
          <template #default="scope">
            <el-radio :model-value="selected?.id" :label="scope.row.id" @change="chooseone(scope.row)">
              <span class="el-radio__label"></span>
            </el-radio>
          </template>
        </el-table-column>
        <el-table-column label="序号" type="index" width="50" />
        <el-table-column prop="name" label="老人姓名" width="180" />
        <el-table-column prop="idCardNo" label="老人身份证号" />
        <el-table-column prop="bedNumber" label="床位号" width="180" />
      </el-table>
      <Pagination v-show="pagination.total > 0" :total="pagination.total" v-model:page="pagination.pageNum"
        v-model:limit="pagination.pageSize" @pagination="getList" />
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :disabled="!selected || dataLoading" @click="handleSub">确定</el-button>
      </div>
    </div>
  </el-dialog>
</template>
<script setup>
import { ref, watch } from 'vue';
// 获取父组件值、方法
const props = defineProps({
  // 获取列表数据
  dialogData: {
    type: Array,
    default: () => [],
  },
  // 弹层隐藏显示
  dialogVisible: {
    type: Boolean,
    default: false,
  },
  // 分页
  pagination: {
    type: Object,
    default: () => ({}),
  },
  // 加载状态
  dataLoading: {
    type: Boolean,
    default: false,
  },
  // 基本信息
  formData: {
    type: Object,
    default: () => ({}),
  },
});
// ------定义变量------
const emit = defineEmits([
  'handleCloseDialog',
  'getCurrent',
  'getOldList',
  'handleSelectOld',
  'handleSearch',
  'handleReset',
]); // 子组件获取父组件事件传值
const ruleForm = ref(null); // 定义表单ref
const selected = ref(null);
// 每次打开只恢复已确认的绑定，取消过的临时选择不会带到下次。
watch(() => props.dialogVisible, (visible) => {
  selected.value = visible && props.formData.bindingLocation != null
    ? { id: props.formData.bindingLocation, name: props.formData.remark }
    : null;
});
// ------定义方法------
// 确认提交
const handleSub = () => {
  if (!selected.value || props.dataLoading) return;
  emit('handleSelectOld', { ...selected.value });
  handleClose();
};
// 关闭弹层
const handleClose = () => {
  selected.value = null;
  emit('handleCloseDialog');
};
// 搜索
const handleSearch = () => {
  selected.value = null;
  emit('handleSearch');
};
// 清空搜索数据
const handleReset = () => {
  selected.value = null;
  ruleForm.value?.resetFields();
  emit('handleReset');
};
const getList = (val) => {
  selected.value = null;
  emit('getOldList', val);
};
const chooseone = (row) => {
  if (row?.id == null || props.dataLoading) return;
  selected.value = { id: row.id, name: row.name };
};
</script>
