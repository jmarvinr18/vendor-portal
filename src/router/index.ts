import { createRouter, createWebHistory } from 'vue-router'
import SubmitInvoiceView from '../views/SubmitInvoiceView.vue'

const placeholder = () => import('../views/PlaceholderView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/submit-invoice' },
    { path: '/dashboard', name: 'dashboard', component: placeholder, meta: { title: 'Dashboard' } },
    { path: '/submit-invoice', name: 'submit-invoice', component: SubmitInvoiceView },
    {
      path: '/submit-invoice/success',
      name: 'submit-invoice-success',
      component: () => import('../views/SubmissionSuccessView.vue'),
      meta: { navKey: 'submit-invoice' },
    },
    {
      path: '/my-invoices',
      name: 'my-invoices',
      component: placeholder,
      meta: { title: 'My Invoices' },
    },
    {
      path: '/invoice-status',
      name: 'invoice-status',
      component: placeholder,
      meta: { title: 'Invoice Status' },
    },
    { path: '/payments', name: 'payments', component: placeholder, meta: { title: 'Payments' } },
    { path: '/profile', name: 'profile', component: placeholder, meta: { title: 'My Profile' } },
    {
      path: '/vendor-performance',
      name: 'vendor-performance',
      component: placeholder,
      meta: { title: 'Vendor Performance' },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: placeholder,
      meta: { title: 'Notifications' },
    },
    { path: '/help', name: 'help', component: placeholder, meta: { title: 'Help & Support' } },
    { path: '/logout', name: 'logout', component: placeholder, meta: { title: 'Logout' } },
    { path: '/:pathMatch(.*)*', redirect: '/submit-invoice' },
  ],
})

export default router
