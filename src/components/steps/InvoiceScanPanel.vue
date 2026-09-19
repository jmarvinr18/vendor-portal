<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInvoiceScanStore, type ScanRow } from '@/stores/invoiceScan'
import { useReferenceDataStore } from '@/stores/referenceData'
import type { ExtractableField } from '@/schema'
import { parseForField, type FieldValue } from '@/utils/extraction'
import { formatFileSize } from '@/utils/format'
import FileTypeIcon from '@/components/FileTypeIcon.vue'

const emit = defineEmits<{
  apply: [values: Partial<Record<ExtractableField, FieldValue>>]
  manual: []
}>()

const scan = useInvoiceScanStore()
const { phase, file, rows, error, extraction } = storeToRefs(scan)
const referenceData = useReferenceDataStore()

const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)
const fileError = ref<string | null>(null)
const showText = ref(false)
const showAll = ref(false)
const result = ref<{ filled: string[]; problems: string[] } | null>(null)

const VISIBLE_UNTAGGED = 8

const fields = computed(() => referenceData.extractableFields)
const labelOf = (field: ExtractableField | null) =>
  fields.value.find((f) => f.key === field)?.label ?? null
const accept = computed(() =>
  referenceData.uploadRules.acceptedExtensions.map((ext) => `.${ext}`).join(','),
)
const taggedCount = computed(() => rows.value.filter((r) => r.field).length)

// Tagged rows stay first (in form order); long lists of untagged values are collapsed.
const visibleRows = computed(() => {
  const order = fields.value.map((f) => f.key)
  const tagged = rows.value
    .filter((r) => r.field)
    .sort((a, b) => order.indexOf(a.field!) - order.indexOf(b.field!))
  const untagged = rows.value.filter((r) => !r.field)
  return showAll.value
    ? [...tagged, ...untagged]
    : [...tagged, ...untagged.slice(0, VISIBLE_UNTAGGED)]
})
const hiddenCount = computed(() => rows.value.length - visibleRows.value.length)

function sourceText(row: ScanRow) {
  if (row.entityType) {
    const confidence = row.score != null ? ` · ${Math.round(row.score * 100)}% confidence` : ''
    return `Detected as ${row.entityType.toLowerCase()}${confidence}`
  }
  return `Found near “${row.source}”`
}

function takenBy(field: ExtractableField, rowId: string) {
  return rows.value.some((r) => r.field === field && r.id !== rowId)
}

function pick(files: FileList | null | undefined) {
  const picked = files?.[0]
  if (!picked) return
  const ext = picked.name.split('.').pop()?.toLowerCase() ?? ''
  const rules = referenceData.uploadRules
  fileError.value = null
  if (!rules.acceptedExtensions.includes(ext)) {
    fileError.value = `${picked.name}: unsupported format. Use PDF, JPG or PNG.`
  } else if (picked.size > rules.maxFileSize) {
    fileError.value = `${picked.name}: exceeds the ${rules.maxFileSize / (1024 * 1024)}MB limit.`
  } else if (picked.size === 0) {
    fileError.value = `${picked.name}: file is empty.`
  } else {
    result.value = null
    scan.scan(picked)
  }
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  pick(input.files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  pick(event.dataTransfer?.files)
}

function apply() {
  const values: Partial<Record<ExtractableField, FieldValue>> = {}
  const filled: string[] = []
  const problems: string[] = []
  const options = {
    invoiceTypes: referenceData.invoiceTypeOptions,
    creditTerms: referenceData.creditTermOptions,
  }
  const order = fields.value.map((f) => f.key)
  const tagged = rows.value
    .filter((r) => r.field)
    .sort((a, b) => order.indexOf(a.field!) - order.indexOf(b.field!))
  for (const row of tagged) {
    if (!row.field) continue
    const parsed = parseForField(row.field, row.value, options)
    if (parsed.value === null) {
      problems.push(`${labelOf(row.field)}: ${parsed.problem}.`)
    } else {
      values[row.field] = parsed.value
      filled.push(labelOf(row.field)!)
    }
  }
  scan.appliedFields = Object.keys(values) as ExtractableField[]
  result.value = { filled, problems }
  emit('apply', values)
}
</script>

<template>
  <section class="vp-card mb-4" aria-labelledby="scanTitle">
    <h2 id="scanTitle" class="section-title">Scan Invoice</h2>
    <p class="section-subtitle mb-4">
      Upload a scanned copy of your invoice. We'll read it and suggest a value for each invoice
      detail for you to check.
    </p>

    <!-- 1. Pick a file -->
    <template v-if="phase === 'idle'">
      <div
        class="dropzone"
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <i class="bi bi-upc-scan dropzone-icon"></i>
        <div class="dropzone-title">Drag and drop your scanned invoice here</div>
        <div class="dropzone-or">or</div>
        <button type="button" class="btn btn-outline-vp px-4" @click="fileInput?.click()">
          Browse Files
        </button>
        <input ref="fileInput" type="file" class="d-none" :accept @change="onChange" />
        <div class="dropzone-hint">One file · PDF, JPG or PNG · up to 10MB</div>
      </div>
      <div v-if="fileError" class="text-danger small mt-2">{{ fileError }}</div>
    </template>

    <!-- 2. Uploading / reading -->
    <div
      v-else-if="phase === 'uploading' || phase === 'processing'"
      class="scan-status"
      role="status"
    >
      <FileTypeIcon :extension="file?.name.split('.').pop() ?? 'pdf'" />
      <div class="flex-grow-1 min-w-0">
        <div class="fw-semibold text-truncate">{{ file?.name }}</div>
        <div class="small text-body-secondary">
          <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          {{
            phase === 'uploading'
              ? 'Uploading your scanned invoice…'
              : 'Reading the invoice… this usually takes under a minute.'
          }}
        </div>
      </div>
      <button type="button" class="btn btn-sm btn-outline-vp" @click="scan.discard()">
        Cancel
      </button>
    </div>

    <!-- 3a. Could not read -->
    <div v-else-if="phase === 'failed'" class="alert alert-danger mb-0" role="alert">
      <div class="fw-semibold mb-1">We couldn't read this invoice.</div>
      <div class="small mb-3">{{ error }}</div>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm btn-outline-vp" @click="scan.discard()">
          Try Another File
        </button>
        <button type="button" class="btn btn-sm btn-outline-vp" @click="emit('manual')">
          Enter Details Manually
        </button>
      </div>
    </div>

    <!-- 3b. Taking too long -->
    <div v-else-if="phase === 'timeout'" class="alert alert-warning mb-0" role="alert">
      <div class="fw-semibold mb-1">This is taking longer than usual.</div>
      <div class="small mb-3">You can keep waiting or enter the details yourself.</div>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm btn-outline-vp" @click="scan.keepWaiting()">
          Keep Waiting
        </button>
        <button type="button" class="btn btn-sm btn-outline-vp" @click="emit('manual')">
          Enter Details Manually
        </button>
      </div>
    </div>

    <!-- 4. Tag the extracted values -->
    <template v-else-if="phase === 'completed'">
      <div class="scan-status mb-3">
        <FileTypeIcon :extension="extraction?.extension ?? 'pdf'" />
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold text-truncate">{{ extraction?.fileName }}</div>
          <div class="small text-body-secondary">
            {{ formatFileSize(extraction?.size ?? 0) }} · {{ rows.length }} values found
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-link" @click="showText = !showText">
          {{ showText ? 'Hide' : 'View' }} extracted text
        </button>
        <button type="button" class="btn btn-sm btn-outline-vp" @click="scan.discard()">
          Remove Scan
        </button>
      </div>

      <pre v-if="showText" class="extracted-text">{{ extraction?.text || '(no text found)' }}</pre>

      <template v-if="rows.length">
        <p class="small text-body-secondary mb-3">
          Choose which invoice detail each value belongs to, and correct any value that was read
          incorrectly. Values tagged <em>Don't use</em> are ignored.
        </p>

        <ul class="list-unstyled scan-rows mb-2">
          <li v-for="(row, index) in visibleRows" :key="row.id" class="scan-row">
            <div class="input-group">
              <input
                :id="`scan-${row.id}`"
                v-model="row.value"
                type="text"
                class="form-control"
                :aria-label="`Extracted value ${index + 1}`"
                :aria-describedby="`scan-${row.id}-source`"
              />
              <button
                type="button"
                class="btn dropdown-toggle tag-button"
                :class="row.field ? 'tag-button-set' : 'btn-outline-vp'"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                :aria-label="`Invoice field for value ${index + 1}: ${labelOf(row.field) ?? 'not used'}`"
              >
                {{ labelOf(row.field) ?? 'Tag as…' }}
              </button>
              <ul class="dropdown-menu dropdown-menu-end tag-menu">
                <li>
                  <button
                    type="button"
                    class="dropdown-item"
                    :class="{ active: !row.field }"
                    @click="scan.tag(row.id, null)"
                  >
                    Don't use
                  </button>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li v-for="field in fields" :key="field.key">
                  <button
                    type="button"
                    class="dropdown-item d-flex justify-content-between gap-3"
                    :class="{ active: row.field === field.key }"
                    @click="scan.tag(row.id, field.key)"
                  >
                    {{ field.label }}
                    <small v-if="takenBy(field.key, row.id)" class="opacity-75">in use</small>
                  </button>
                </li>
              </ul>
            </div>
            <div :id="`scan-${row.id}-source`" class="form-text">{{ sourceText(row) }}</div>
          </li>
        </ul>

        <button
          v-if="hiddenCount > 0 || showAll"
          type="button"
          class="btn btn-sm btn-link px-0 mb-3"
          @click="showAll = !showAll"
        >
          {{ showAll ? 'Show fewer values' : `Show ${hiddenCount} more values` }}
        </button>

        <div
          class="d-flex flex-wrap justify-content-between align-items-center gap-3 pt-3 border-top"
        >
          <span class="small text-body-secondary">
            {{ taggedCount }} of {{ fields.length }} invoice details tagged
          </span>
          <button type="button" class="btn btn-gold" :disabled="!taggedCount" @click="apply">
            <i class="bi bi-magic me-2"></i>Fill Invoice Details
          </button>
        </div>
      </template>

      <div v-else class="alert alert-secondary mb-0">
        No values could be picked out of this document. Please enter the details below.
      </div>

      <div v-if="result" class="mt-3" aria-live="polite">
        <div v-if="result.filled.length" class="alert alert-success py-2 small mb-2">
          <i class="bi bi-check-circle me-1"></i>
          Filled {{ result.filled.length }} invoice
          {{ result.filled.length === 1 ? 'detail' : 'details' }} ({{ result.filled.join(', ') }}).
          Please review them below before continuing.
        </div>
        <div v-if="result.problems.length" class="alert alert-warning py-2 small mb-0">
          <div class="fw-semibold">Not filled — please correct the value or its tag:</div>
          <ul class="mb-0 ps-3">
            <li v-for="problem in result.problems" :key="problem">{{ problem }}</li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.dropzone {
  border: 2px dashed #c9ced6;
  border-radius: 0.5rem;
  padding: 2rem 1.5rem;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.dropzone.dragging {
  border-color: var(--vp-gold);
  background: var(--vp-gold-soft);
}

.dropzone-icon {
  font-size: 3rem;
  line-height: 1;
}

.dropzone-title {
  font-size: 1.0625rem;
  font-weight: 600;
  margin-top: 0.5rem;
}

.dropzone-or {
  margin: 0.25rem 0 0.75rem;
  color: var(--vp-muted);
}

.dropzone-hint {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: var(--vp-muted);
}

.scan-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--vp-border);
  border-radius: 0.5rem;
  background: #fafbfc;
}

.min-w-0 {
  min-width: 0;
}

.extracted-text {
  max-height: 240px;
  overflow: auto;
  background: #f6f7f9;
  border: 1px solid var(--vp-border);
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  white-space: pre-wrap;
  margin-bottom: 1rem;
}

.scan-rows {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.875rem 1.25rem;
}

.tag-button {
  min-width: 150px;
  font-weight: 600;
  font-size: 0.8125rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tag-button-set {
  --bs-btn-bg: var(--vp-gold-soft);
  --bs-btn-border-color: #e9c77e;
  --bs-btn-color: var(--vp-text);
  --bs-btn-hover-bg: #fbe6b8;
  --bs-btn-hover-border-color: var(--vp-gold);
  --bs-btn-active-bg: #fbe6b8;
  --bs-btn-active-border-color: var(--vp-gold);
}

.tag-menu {
  max-height: 320px;
  overflow-y: auto;
  font-size: 0.875rem;
  --bs-dropdown-link-active-bg: var(--vp-gold);
  --bs-dropdown-link-active-color: var(--vp-text);
}

@media (max-width: 575.98px) {
  .scan-rows {
    grid-template-columns: 1fr;
  }

  .tag-button {
    min-width: 120px;
  }
}
</style>
