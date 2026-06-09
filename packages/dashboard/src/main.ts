import { createPinia } from 'pinia';
import { createApp } from 'vue';

import './app.css';
import DashboardApp from './components/dashboardApp.vue';

createApp(DashboardApp).use(createPinia()).mount('#dashboardApp');
