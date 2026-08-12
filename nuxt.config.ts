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

  devServer: {
    host: '0.0.0.0',  // слушать все сетевые интерфейсы (доступ в локальной сети)
    port: 3000,
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost',
    },
  },
})
