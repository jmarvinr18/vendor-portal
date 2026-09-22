<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BrandLogo from './BrandLogo.vue'
import { brand } from '@/config/brand'
import { useReferenceDataStore } from '@/stores/referenceData'

const referenceData = useReferenceDataStore()
</script>

<template>
  <header class="app-header">
    <button
      class="btn btn-link text-body px-2 d-lg-none"
      type="button"
      data-bs-toggle="offcanvas"
      data-bs-target="#appSidebar"
      aria-controls="appSidebar"
      aria-label="Open navigation"
    >
      <i class="bi bi-list fs-3"></i>
    </button>

    <RouterLink to="/dashboard" class="header-brand text-decoration-none">
      <BrandLogo />
    </RouterLink>

    <div class="header-title d-none d-sm-block">
      <div class="portal-name">{{ brand.portalName }}</div>
      <div class="portal-tagline">{{ brand.portalTagline }}</div>
    </div>

    <div class="header-actions">
      <RouterLink
        :to="{ name: 'ai-assistant' }"
        class="btn ai-button"
        active-class="active"
        aria-label="AI Assistant"
        title="AI Assistant"
      >
        <i class="bi bi-stars"></i>
        <span class="d-none d-md-inline">AI Assistant</span>
      </RouterLink>

      <RouterLink to="/notifications" class="notif-btn" aria-label="Notifications (3 unread)">
        <i class="bi bi-bell"></i>
        <span class="notif-badge">3</span>
      </RouterLink>

      <div class="vr d-none d-md-block"></div>

      <div class="dropdown">
        <button
          class="btn btn-link user-btn dropdown-toggle"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <i class="bi bi-person"></i>
          <span class="d-none d-md-inline">{{ referenceData.vendorName }}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
          <li><RouterLink class="dropdown-item" to="/profile">My Profile</RouterLink></li>
          <li><RouterLink class="dropdown-item" to="/help">Help &amp; Support</RouterLink></li>
          <li><hr class="dropdown-divider" /></li>
          <li><RouterLink class="dropdown-item" to="/logout">Logout</RouterLink></li>
        </ul>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 1030;
  display: flex;
  align-items: center;
  height: var(--vp-header-height);
  background: var(--vp-surface);
  border-bottom: 3px solid var(--vp-gold);
  padding-right: 1.5rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.header-brand {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 1.5rem;
}

.header-title {
  padding-left: 1.75rem;
  border-left: 1px solid var(--vp-border);
  height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.portal-name {
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.2;
}

.portal-tagline {
  font-size: 0.875rem;
  color: var(--vp-muted);
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.header-actions .vr {
  height: 32px;
  align-self: center;
  opacity: 0.15;
}

.ai-button {
  --bs-btn-padding-x: 0.875rem;
  --bs-btn-padding-y: 0.375rem;
  --bs-btn-font-weight: 600;
  --bs-btn-font-size: 0.875rem;
  --bs-btn-color: var(--vp-text);
  --bs-btn-bg: var(--vp-gold-soft);
  --bs-btn-border-color: #ecd49c;
  --bs-btn-hover-color: var(--vp-text);
  --bs-btn-hover-bg: #fbe6b8;
  --bs-btn-hover-border-color: var(--vp-gold);
  --bs-btn-active-bg: var(--vp-gold);
  --bs-btn-active-border-color: var(--vp-gold);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
}

.ai-button.active {
  background: var(--vp-gold);
  border-color: var(--vp-gold);
}

.ai-button .bi {
  font-size: 1rem;
}

.notif-btn {
  position: relative;
  color: var(--vp-text);
  font-size: 1.5rem;
  line-height: 1;
}

.notif-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: var(--vp-gold);
  color: var(--vp-text);
  font-size: 0.6875rem;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-text);
  text-decoration: none;
  font-weight: 500;
  padding: 0.25rem;
}

.user-btn .bi-person {
  font-size: 1.5rem;
}

@media (min-width: 992px) {
  .header-brand {
    width: var(--vp-sidebar-width);
  }
}

@media (max-width: 991.98px) {
  .header-brand {
    padding: 0 0.75rem 0 0.25rem;
  }

  .header-title {
    padding-left: 1rem;
  }

  .app-header {
    padding-right: 1rem;
  }
}

@media (max-width: 575.98px) {
  .header-brand :deep(.brand-name) {
    font-size: 1.25rem;
  }
}
</style>
