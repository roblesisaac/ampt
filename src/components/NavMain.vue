<template>
  <nav class="grid topNav bgF1 shadow">
    <div class="cell-1-3 text-left bold">
      <img id="logo" src="../assets/icon.svg" height="30" />
    </div>
    <div class="cell-2-3 text-right">
      <router-link 
      v-for="link in state.userViews" 
      :to="link.path || link"
      class="proper">
      {{ link.name || link }}
    </router-link>
    <a class="proper" href="/logout">logout</a>
  </div>
</nav>
</template>

<script setup>
import { onMounted, reactive } from 'vue';

import { useAppStore } from '../stores/app';
const { sticky } = useAppStore();

const state = reactive({
  userViews: ['settings']
});

const app = function() {
  async function delay(s) {
    return new Promise(resolve => setTimeout(resolve, s*1000));
  }

  function getRoleViews() {
    state.userViews = state.userViews.concat([
      { name: 'Home', path: '/'}
    ]);
  }

  function getUserViews() {
    state.userViews = state.userViews.concat([
      'swiper',
      'login',
    ]);
  }

  return {
    async getViews() {
      getRoleViews();
      await delay(2);
      getUserViews();
    },
    init() {
      onMounted(async () => {
        sticky.stickify('.topNav');
        await app.getViews();
      });
    }
  };
}();

app.init();

</script>

<style>
.topNav {
  padding: 20px 10px;
  transition: all .3s;
}

.topNav.is-sticky {
  padding: 10px 10px;
}
</style>