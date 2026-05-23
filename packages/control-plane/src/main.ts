import { createPinia } from 'pinia';
import { createApp } from 'vue';

import './app.css';
import ControlPlaneApp from './components/controlPlaneApp.vue';

createApp(ControlPlaneApp).use(createPinia()).mount('#controlPlaneApp');
