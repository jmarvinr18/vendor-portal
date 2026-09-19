import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.min.css'
import 'bootstrap'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import ApiService from './services/ApiService'

const app = createApp(App)

app.use(createPinia())
app.use(router)
ApiService.init(app)

app.mount('#app')
