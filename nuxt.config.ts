// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/template.sass'],

  modules: ['@nuxtjs/google-fonts'],

  googleFonts: {
    families: {
      'Ubuntu Condensed': true,
    },
  },

  app: {
    head: {
      title: 'HomeStore v1',
    },
  },

  devServer: {
    host: '0.0.0.0',  // слушать все сетевые интерфейсы (доступ в локальной сети)
    port: 3000,
  },

  runtimeConfig: {
    // Адрес бэкенда для dev-сервера. Раньше здесь было жёстко зашито
    // 'http://localhost', и сменить его без правки кода было нельзя.
    // Переменная окружения оставлена как ручной переключатель на другое
    // окружение, но по умолчанию — тот же локальный бэкенд, что и раньше.
    devApiBaseUrl: process.env.DEV_API_BASE_URL || 'http://localhost',

    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost',
    },
  },
})
