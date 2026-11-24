<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { assetFileName, resolveImagePath } from '../core/images'
import { joinPath, parentDir } from '../core/paths'
import { CONTACT_LABELS, CONTACT_ORDER } from '../core/types'
import {
  assetUrl,
  ensureDir,
  pickImageFile,
  readBinaryFile,
  writeBinaryFile,
} from '../tauri'
import { askConfirm, docState, showToast } from '../stores/document'
import { draft, structuralEdit, touchDraft } from '../stores/editor'

const identity = computed(() => draft.value?.identity ?? null)
const avatarSrc = ref('')
const avatarError = ref(false)

watch(
  () => draft.value?.identity.avatar,
  (avatar) => {
    avatarError.value = false
    if (!avatar) {
      avatarSrc.value = ''
      return
    }
    if (/^(https?:|data:|blob:)/i.test(avatar)) {
      avatarSrc.value = avatar
      return
    }
    const absolute = resolveImagePath(docState.path, avatar)
    avatarSrc.value = absolute ? assetUrl(absolute) : ''
  },
  { immediate: true },
)

const initials = computed(() => Array.from(identity.value?.name.trim() || '简')[0] ?? '简')

const placeholders: Record<string, string> = {
  phone: '138-0000-0000',
  email: 'you@example.com',
  location: '城市',
  website: 'https://...',
  github: 'github.com/...',
  linkedin: 'linkedin.com/in/...',
  blog: 'blog.example.com',
  wechat: '微信号',
}

function contactValue(key: string): string {
  return draft.value?.identity.contacts.find((contact) => contact.key === key)?.value ?? ''
}

function setContact(key: string, value: string): void {
  if (!draft.value) return
  const existing = draft.value.identity.contacts.find((contact) => contact.key === key)
  if (existing) existing.value = value
  else draft.value.identity.contacts.push({ key, label: CONTACT_LABELS[key] ?? key, value })
  touchDraft(`contact:${key}`)
}

function setName(value: string): void {
  if (!draft.value) return
  draft.value.identity.name = value
  touchDraft('identity:name')
}

function setTitle(value: string): void {
  if (!draft.value) return
  draft.value.identity.title = value
  touchDraft('identity:title')
}

async function pickAvatar(): Promise<void> {
  if (!draft.value) return
  if (!docState.path) {
    showToast('请先保存文档，再设置头像', 'error')
    return
  }
  let selected: string | null = null
  try {
    selected = await pickImageFile()
  } catch (error) {
    showToast(`无法打开图片对话框：${messageOf(error)}`, 'error')
    return
  }
  if (!selected) return
  const rawExt = selected.split('.').pop()?.toLowerCase() ?? ''
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt
  if (!['png', 'jpg', 'webp', 'gif'].includes(ext)) {
    showToast('仅支持 PNG/JPG/WebP/GIF 图片', 'error')
    return
  }
  try {
    const bytes = await readBinaryFile(selected)
    if (
      bytes.length > 5 * 1024 * 1024 &&
      !(await askConfirm('图片大于 5MB，仍要使用吗？', { title: '图片过大', confirmLabel: '仍然使用' }))
    ) {
      return
    }
    const assetsDir = joinPath(parentDir(docState.path), 'assets')
    await ensureDir(assetsDir)
    const name = assetFileName('avatar', ext)
    await writeBinaryFile(joinPath(assetsDir, name), bytes)
    draft.value.identity.avatar = `assets/${name}`
    structuralEdit('set-avatar')
    showToast('头像已更新')
  } catch (error) {
    showToast(`头像设置失败：${messageOf(error)}`, 'error')
  }
}

function removeAvatar(): void {
  if (!draft.value) return
  draft.value.identity.avatar = ''
  structuralEdit('remove-avatar')
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <div class="basic-form">
    <div class="avatar-card">
      <div class="avatar-preview">
        <img
          v-if="avatarSrc && !avatarError"
          :src="avatarSrc"
          alt="头像"
          @error="avatarError = true"
        />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="avatar-info">
        <strong>头像</strong>
        <p>建议使用 1:1 证件照；图片会写入简历同目录的 assets/。</p>
        <div class="avatar-actions">
          <button class="soft-btn" @click="pickAvatar">选择图片</button>
          <button v-if="identity?.avatar" class="ghost-btn" @click="removeAvatar">移除</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="field-grid two">
        <label class="field">
          <span>姓名</span>
          <input
            :value="identity?.name ?? ''"
            placeholder="你的姓名"
            @input="setName(($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="field">
          <span>职位</span>
          <input
            :value="identity?.title ?? ''"
            placeholder="如 高级前端工程师"
            @input="setTitle(($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <div class="block-title">联系方式</div>
      <div class="field-grid two">
        <label v-for="key in CONTACT_ORDER" :key="key" class="field">
          <span>{{ CONTACT_LABELS[key] }}</span>
          <input
            :value="contactValue(key)"
            :placeholder="placeholders[key] ?? ''"
            @input="setContact(key, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.basic-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.avatar-card,
.card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel);
}

.avatar-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-preview {
  display: flex;
  flex: none;
  width: 78px;
  height: 78px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 27px;
  font-weight: 700;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-info {
  min-width: 0;
}

.avatar-info strong {
  color: var(--text);
  font-size: 13px;
}

.avatar-info p {
  margin: 4px 0 10px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.avatar-actions {
  display: flex;
  gap: 8px;
}

.soft-btn,
.ghost-btn {
  height: 30px;
  padding: 0 11px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}

.soft-btn {
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.ghost-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
}

.field-grid {
  display: grid;
  gap: 12px;
}

.field-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.field span {
  color: var(--muted);
  font-size: 11px;
}

.field input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: var(--panel-soft);
  color: var(--text);
  font-size: 12px;
}

.field input:focus {
  border-color: var(--accent);
  background: var(--panel);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.block-title {
  margin: 18px 0 10px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}
</style>