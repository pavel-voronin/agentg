import { createPinia } from 'pinia';
import { createApp } from 'vue';

import './app.css';
import ControlPlaneApp from './components/ControlPlaneApp.vue';

createApp(ControlPlaneApp).use(createPinia()).mount('#controlPlaneApp');
