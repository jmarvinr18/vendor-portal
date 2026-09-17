<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Offcanvas } from 'bootstrap'
import { brand } from '@/config/brand'

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bi-house', to: '/dashboard' },
  {
    key: 'submit-invoice',
    label: 'Submit Invoice',
    icon: 'bi-file-earmark-plus',
    to: '/submit-invoice',
  },
  { key: 'my-invoices', label: 'My Invoices', icon: 'bi-file-earmark-text', to: '/my-invoices' },
  { key: 'invoice-status', label: 'Invoice Status', icon: 'bi-bar-chart', to: '/invoice-status' },
  { key: 'payments', label: 'Payments', icon: 'bi-credit-card-2-front', to: '/payments' },
  { key: 'profile', label: 'My Profile', icon: 'bi-person', to: '/profile' },
  {
    key: 'vendor-performance',
    label: 'Vendor Performance',
    icon: 'bi-award',
    to: '/vendor-performance',
  },
  { key: 'notifications', label: 'Notifications', icon: 'bi-bell', to: '/notifications', badge: 3 },
  { key: 'help', label: 'Help & Support', icon: 'bi-question-circle', to: '/help' },
  { key: 'logout', label: 'Logout', icon: 'bi-box-arrow-right', to: '/logout' },
]

const route = useRoute()
const sidebarEl = ref<HTMLElement>()

function isActive(key: string) {
  return (route.meta.navKey ?? route.name) === key
}

// Close the mobile offcanvas after navigating.
onMounted(() => {
  watch(
    () => route.fullPath,
    () => {
      if (sidebarEl.value) Offcanvas.getInstance(sidebarEl.value)?.hide()
    },
  )
})
</script>

<template>
  <aside
    id="appSidebar"
    ref="sidebarEl"
    class="app-sidebar offcanvas-lg offcanvas-start"
    tabindex="-1"
    aria-label="Main navigation"
  >
    <div class="offcanvas-header d-lg-none">
      <span class="text-white fw-semibold">Menu</span>
      <button
        type="button"
        class="btn-close btn-close-white"
        data-bs-dismiss="offcanvas"
        data-bs-target="#appSidebar"
        aria-label="Close"
      ></button>
    </div>

    <div class="sidebar-inner">
      <nav class="nav flex-column gap-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="sidebar-link"
          :class="{ active: isActive(item.key) }"
          :aria-current="isActive(item.key) ? 'page' : undefined"
        >
          <i class="bi" :class="item.icon"></i>
          <span>{{ item.label }}</span>
          <span v-if="item.badge" class="sidebar-badge">{{ item.badge }}</span>
        </RouterLink>
      </nav>

      <div class="assist-card">
        <div class="assist-title">
          <i class="bi bi-headset"></i>
          Need Assistance?
        </div>
        <p class="assist-text">
          For invoice submission, payment status and Accounts Payable inquiries, please contact:
        </p>
        <a :href="`mailto:${brand.supportEmail}`" class="assist-contact">
          <i class="bi bi-envelope"></i>{{ brand.supportEmail }}
        </a>
        <div class="assist-contact"><i class="bi bi-telephone"></i>{{ brand.supportPhone }}</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  background: var(--vp-navy);
  color: #fff;
  --bs-offcanvas-width: 270px;
  --bs-offcanvas-bg: var(--vp-navy);
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem 0.75rem;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  background: var(--vp-navy);
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.6875rem 0.875rem;
  border-radius: 0.375rem;
  color: #fff;
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.sidebar-link .bi {
  font-size: 1.375rem;
  width: 1.5rem;
  text-align: center;
}

.sidebar-link:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.sidebar-link.active {
  background: var(--vp-gold);
  color: var(--vp-text);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.sidebar-badge {
  margin-left: 0.5rem;
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  background: var(--vp-gold);
  color: var(--vp-text);
  font-size: 0.75rem;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.assist-card {
  margin-top: auto;
  border: 1px solid var(--vp-navy-border);
  border-radius: 0.5rem;
  padding: 0.875rem;
  font-size: 0.8125rem;
}

.assist-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.assist-title .bi {
  font-size: 1.25rem;
}

.assist-text {
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 0.625rem;
}

.assist-contact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  margin-top: 0.375rem;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

a.assist-contact:hover {
  color: var(--vp-gold);
}

@media (min-width: 992px) {
  .app-sidebar {
    width: var(--vp-sidebar-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: var(--vp-header-height);
    height: calc(100vh - var(--vp-header-height));
  }
}
</style>
