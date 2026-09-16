export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  if (to.path === '/login') return

  const token = window.localStorage.getItem('home-store-token')
  if (!token) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})