<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInvoiceStore } from '@/stores/invoice'
import { upload } from '@/config/brand'
import { formatFileSize } from '@/utils/format'
import FileTypeIcon from '@/components/FileTypeIcon.vue'

const emit = defineEmits<{ next: []; back: [] }>()

const store = useInvoiceStore()
const { documents } = storeToRefs(store)

const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)
const uploadErrors = ref<string[]>([])
const showRequiredError = ref(false)

const accept = upload.acceptedExtensions.map((ext) => `.${ext}`).join(',')
const maxSizeLabel = `${upload.maxFileSize / (1024 * 1024)}MB`

function addFiles(files: FileList | null) {
  if (!files) return
  const problems: string[] = []
  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!upload.acceptedExtensions.includes(ext)) {
      problems.push(`${file.name}: unsupported format. Use PDF, JPG or PNG.`)
    } else if (file.size > upload.maxFileSize) {
      problems.push(`${file.name}: exceeds the ${maxSizeLabel} limit.`)
    } else if (documents.value.some((doc) => doc.name === file.name && doc.size === file.size)) {
      problems.push(`${file.name}: already uploaded.`)
    } else if (documents.value.length >= upload.maxFiles) {
      problems.push(`${file.name}: you can upload up to ${upload.maxFiles} files.`)
    } else {
      store.addDocument(file)
    }
  }
  uploadErrors.value = problems
  if (documents.value.length) showRequiredError.value = false
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(input.files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  addFiles(event.dataTransfer?.files ?? null)
}

function next() {
  if (documents.value.length === 0) {
    showRequiredError.value = true
    return
  }
  emit('next')
}
</script>

<template>
  <div class="vp-card">
    <h2 class="section-title">Supporting Documents</h2>
    <p class="section-subtitle mb-4">Attach required documents to support your invoice.</p>

    <div class="row g-4">
      <div class="col-lg-6">
        <h3 class="fs-6 fw-bold mb-3">Uploaded Documents</h3>

        <p v-if="documents.length === 0" class="text-body-secondary small py-4">
          No documents uploaded yet.
        </p>

        <ul v-else class="list-unstyled doc-list mb-0">
          <li v-for="doc in documents" :key="doc.id" class="doc-item">
            <FileTypeIcon :extension="doc.extension" />
            <div class="flex-grow-1 min-w-0">
              <div class="doc-name text-truncate" :title="doc.name">{{ doc.name }}</div>
              <div class="doc-meta">
                {{ doc.extension.toUpperCase() }} <span class="mx-1">&bull;</span>
                {{ formatFileSize(doc.size) }}
              </div>
            </div>
            <i class="bi bi-check-circle doc-check" title="Uploaded"></i>
            <button
              type="button"
              class="btn btn-sm btn-link text-body-secondary doc-remove"
              :aria-label="`Remove ${doc.name}`"
              @click="store.removeDocument(doc.id)"
            >
              <i class="bi bi-x-lg"></i>
            </button>
          </li>
        </ul>
      </div>

      <div class="col-lg-6">
        <div
          class="dropzone"
          :class="{ dragging, 'is-invalid': showRequiredError }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <i class="bi bi-cloud-arrow-up dropzone-icon"></i>
          <div class="dropzone-title">Drag and drop files here</div>
          <div class="dropzone-or">or</div>
          <button type="button" class="btn btn-outline-vp px-4" @click="fileInput?.click()">
            Browse Files
          </button>
          <input ref="fileInput" type="file" class="d-none" multiple :accept @change="onChange" />
          <div class="dropzone-hint">
            Accepted formats: PDF, JPG, PNG<br />
            Maximum file size: {{ maxSizeLabel }} per file
          </div>
        </div>

        <div v-if="showRequiredError" class="text-danger small mt-2">
          Please upload at least one supporting document.
        </div>
        <ul v-if="uploadErrors.length" class="text-danger small mt-2 mb-0 ps-3">
          <li v-for="message in uploadErrors" :key="message">{{ message }}</li>
        </ul>
      </div>
    </div>

    <hr class="my-4" />

    <div class="d-flex justify-content-between">
      <button type="button" class="btn btn-outline-vp" @click="emit('back')">
        <i class="bi bi-arrow-left me-2"></i>Back
      </button>
      <button type="button" class="btn btn-gold px-4" @click="next">
        Next <i class="bi bi-arrow-right ms-2"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.doc-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0.25rem;
  border-bottom: 1px solid var(--vp-border);
}

.doc-item:last-child {
  border-bottom: 0;
}

.min-w-0 {
  min-width: 0;
}

.doc-name {
  font-weight: 500;
}

.doc-meta {
  font-size: 0.8125rem;
  color: var(--vp-muted);
}

.doc-check {
  font-size: 1.5rem;
  color: var(--vp-green);
}

.doc-remove {
  --bs-btn-padding-x: 0.375rem;
}

.dropzone {
  border: 2px dashed #c9ced6;
  border-radius: 0.5rem;
  padding: 2.25rem 1.5rem;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.dropzone.dragging {
  border-color: var(--vp-gold);
  background: var(--vp-gold-soft);
}

.dropzone.is-invalid {
  border-color: var(--bs-danger);
}

.dropzone-icon {
  font-size: 3.5rem;
  line-height: 1;
  color: var(--vp-text);
}

.dropzone-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-top: 0.5rem;
}

.dropzone-or {
  margin: 0.25rem 0 0.75rem;
  color: var(--vp-muted);
}

.dropzone-hint {
  margin-top: 1.25rem;
  font-size: 0.875rem;
  color: var(--vp-text);
  line-height: 1.7;
}
</style>
