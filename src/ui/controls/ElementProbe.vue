<!--
  临时验证页（TC-002 B 段）：仅用于证明 Element Plus 已按需接入主工程，
  由 TC-008 用真实业务界面替换。不要在此文件里加任何业务逻辑或品牌色值。
-->
<script setup lang="ts">
import { ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

interface ProbeForm {
  name: string
  email: string
  position: string
}

const formRef = ref<FormInstance>()
const form = ref<ProbeForm>({ name: '', email: '', position: '' })
const dialogVisible = ref(false)
const savedLine = ref('')

const rules: FormRules<ProbeForm> = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { min: 2, message: '姓名至少 2 个字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
  ],
  position: [{ required: true, message: '请输入意向岗位', trigger: 'change' }],
}

async function openDialog() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    // 校验失败时 Element Plus 已在表单项下渲染错误文案，这里静默返回即可
    return
  }
  dialogVisible.value = true
}

function confirmSave() {
  savedLine.value = `已保存：${form.value.name}｜${form.value.email}｜${form.value.position}`
  dialogVisible.value = false
}

function resetForm() {
  formRef.value?.resetFields()
  savedLine.value = ''
}
</script>

<template>
  <section class="element-probe" data-testid="element-probe">
    <h2>Element Plus 接入验证</h2>
    <p class="element-probe__hint">临时验证页（TC-002 B 段），TC-008 替换。仅使用 Element Plus 默认主题。</p>

    <el-card shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" data-testid="probe-name" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="name@example.com" data-testid="probe-email" />
        </el-form-item>
        <el-form-item label="意向岗位" prop="position">
          <el-input v-model="form.position" placeholder="如：前端工程师" data-testid="probe-position" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" data-testid="probe-submit" @click="openDialog">
            保存基本信息
          </el-button>
          <el-button data-testid="probe-reset" @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <p v-if="savedLine" class="element-probe__result" data-testid="probe-result">
      {{ savedLine }}
    </p>

    <el-dialog v-model="dialogVisible" title="确认保存" width="420px">
      <p>确认将以下信息写入当前简历？</p>
      <ul class="element-probe__summary">
        <li>姓名：{{ form.name }}</li>
        <li>邮箱：{{ form.email }}</li>
        <li>意向岗位：{{ form.position }}</li>
      </ul>
      <template #footer>
        <el-button data-testid="probe-cancel" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" data-testid="probe-confirm" @click="confirmSave">确认保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.element-probe {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 0;
}

.element-probe__hint {
  font-size: 13px;
}

.element-probe__summary {
  margin: 8px 0 0;
  padding-left: 20px;
}

.element-probe__result {
  margin-top: 16px;
}
</style>
