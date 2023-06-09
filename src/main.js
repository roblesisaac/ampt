import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import App from './App.vue';

const views = import.meta.glob('./views/*.vue');

const routerPromise = new Promise((resolve) => {
  const routes = [];

  for (const path in views) {
    let name = path.slice(8, -4);

    views[path]().then(module => {
        name = name.toLowerCase();
        name = name.replace('vue', '');

        if(name === 'index') name = '';

        const path = `/${name}`;
        const component = module.default;
    
        routes.push({ path, component });

        if (Object.keys(views).length === routes.length) {
          resolve(routes);
        }
    });
  }
});

let router;

routerPromise.then(routes => {
  router = createRouter({
    history: createWebHistory(),
    routes
  });

  const pinia = createPinia();

  createApp(App)
    .use(router)
    .use(pinia)
    .mount('#app');
});


export { router };