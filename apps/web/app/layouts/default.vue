<script setup lang="ts">
const route = useRoute();
const isAuthPage = computed(() => route.path === "/login");
</script>

<template>
  <div
    class="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-50 antialiased font-sans transition-colors duration-200"
  >
    <Header
      v-if="!isAuthPage"
      class="sticky top-0 z-50 backdrop-blur-md bg-stone-50/80 dark:bg-stone-950/80 border-b border-stone-200/50 dark:border-stone-800/50"
    />

    <main class="flex-grow">
      <slot />
    </main>

    <footer
      v-if="!isAuthPage"
      class="border-t border-stone-200/50 dark:border-stone-800/50 bg-white/50 dark:bg-stone-900/20 backdrop-blur-sm"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div class="md:col-span-2">
            <NuxtLink
              to="/"
              class="flex items-center gap-2 text-xl font-extrabold tracking-tight text-stone-900 dark:text-white"
            >
              <span
                class="bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent font-black"
                >RD</span
              >
              <span>AI</span>
            </NuxtLink>
            <p class="mt-4 text-sm text-stone-500 dark:text-stone-400 max-w-sm">
              Unlock your next skill with hyper-personalized AI-generated
              curriculums, interactive lessons, and an adaptive AI mentor. Open
              source, human, and conversational.
            </p>
          </div>
          <div>
            <h3
              class="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider"
            >
              Explore
            </h3>
            <ul class="mt-4 space-y-2">
              <li>
                <NuxtLink
                  to="/"
                  class="text-sm text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-500 transition-colors"
                  >Home</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/roadmaps"
                  class="text-sm text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-500 transition-colors"
                  >Dashboard</NuxtLink
                >
              </li>
            </ul>
          </div>
          <div>
            <h3
              class="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider"
            >
              Legal
            </h3>
            <ul class="mt-4 space-y-2">
              <li>
                <span class="text-sm text-stone-500 dark:text-stone-400"
                  >Terms of Service</span
                >
              </li>
              <li>
                <span class="text-sm text-stone-500 dark:text-stone-400"
                  >Privacy Policy</span
                >
              </li>
            </ul>
          </div>
        </div>

        <div
          class="mt-12 pt-8 border-t border-stone-200/50 dark:border-stone-800/50 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <p class="text-xs text-stone-400 dark:text-stone-500">
            &copy; {{ new Date().getFullYear() }} Roadie. All rights reserved.
          </p>
          <div
            class="flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500"
          >
            <span>Unlock your potential.</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
