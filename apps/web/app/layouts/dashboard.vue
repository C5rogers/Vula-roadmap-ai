<script setup lang="ts">
const route = useRoute();
const { $authClient } = useNuxtApp();
const session = $authClient.useSession();
const toast = useToast();

const isMobileMenuOpen = ref(false);

const navLinks = [
  {
    label: "Analytics",
    to: "/analytics",
    icon: "i-lucide-bar-chart-2",
  },
  {
    label: "Roadmaps",
    to: "/roadmaps",
    icon: "i-lucide-map",
  },
  {
    label: "Settings",
    to: "/settings",
    icon: "i-lucide-settings",
  },
];

const isLinkActive = (path: string) => {
  if (path === "/roadmaps") {
    return route.path.startsWith("/roadmaps");
  }
  return route.path === path;
};

const activePageLabel = computed(() => {
  const matchingLink = navLinks.find(link => isLinkActive(link.to));
  return matchingLink ? matchingLink.label : "Roadie App";
});

const handleSignOut = async () => {
  try {
    await $authClient.signOut({
      fetchOptions: {
        onSuccess: async () => {
          toast.add({ title: "Signed out successfully" });
          await navigateTo("/", { replace: true, external: true });
        },
        onError: (error) => {
          toast.add({
            title: "Sign out failed",
            description: error?.error?.message || "Unknown error",
          });
        },
      },
    });
  } catch (error: any) {
    toast.add({
      title: "An unexpected error occurred during sign out",
      description: error.message || "Please try again.",
    });
  }
};
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-50 antialiased font-sans transition-colors duration-200">
    
    <!-- DESKTOP SIDEBAR -->
    <aside class="hidden lg:flex flex-col w-64 shrink-0 h-full bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 z-30">
      <!-- Sidebar Header (Logo) -->
      <div class="h-16 flex items-center px-6 border-b border-stone-200 dark:border-stone-800">
        <NuxtLink to="/analytics" class="flex items-center gap-2 font-extrabold text-xl tracking-tight text-stone-900 dark:text-white group">
          <span class="bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent font-black">RD</span>
          <span class="text-stone-800 dark:text-stone-100">AI</span>
        </NuxtLink>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-grow px-4 py-6 space-y-1.5 overflow-y-auto">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative"
          :class="[
            isLinkActive(link.to)
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-l-2 border-amber-500 pl-2.5 font-semibold'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
          ]"
        >
          <UIcon :name="link.icon" class="w-5 h-5 shrink-0" />
          <span>{{ link.label }}</span>
        </NuxtLink>
      </nav>

      <!-- User Profile at bottom -->
      <div class="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
        <ClientOnly>
          <div v-if="session?.data" class="flex items-center justify-between group">
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar
                :src="session.data.user.image || undefined"
                :alt="session.data.user.name || undefined"
                size="md"
                class="ring-1 ring-stone-200 dark:ring-stone-800"
              />
              <div class="flex flex-col min-w-0 text-left">
                <span class="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
                  {{ session.data.user.name }}
                </span>
                <span class="text-[10px] text-stone-400 dark:text-stone-500 truncate">
                  {{ session.data.user.email }}
                </span>
              </div>
            </div>
            
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-log-out"
              class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800"
              @click="handleSignOut"
            />
          </div>
          <template #fallback>
            <div class="flex items-center gap-3">
              <USkeleton class="h-9 w-9 rounded-full" />
              <div class="flex flex-col gap-1.5 flex-grow">
                <USkeleton class="h-3 w-20" />
                <USkeleton class="h-2 w-28" />
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </aside>

    <!-- MAIN RIGHT CONTENT CONTAINER -->
    <div class="flex flex-col flex-grow min-w-0 overflow-hidden">
      
      <!-- TOP BAR (Mobile/Desktop color toggle & mobile menu trigger) -->
      <header class="h-16 flex items-center justify-between px-6 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 z-20">
        <div class="flex items-center gap-4">
          <!-- Mobile Menu Toggle Button -->
          <UButton
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            class="lg:hidden rounded-xl"
            @click="isMobileMenuOpen = true"
          />
          <h2 class="text-sm font-semibold tracking-tight text-stone-500 dark:text-stone-400 uppercase">
            {{ activePageLabel }}
          </h2>
        </div>

        <div class="flex items-center gap-4">
          <UColorModeButton />
          
          <!-- Compact profile logout only on mobile -->
          <div class="lg:hidden">
            <ClientOnly>
              <UButton
                v-if="session?.data"
                variant="ghost"
                color="neutral"
                icon="i-lucide-log-out"
                class="rounded-xl"
                @click="handleSignOut"
              />
            </ClientOnly>
          </div>
        </div>
      </header>

      <!-- CONTENT SLOTS -->
      <main class="flex-grow overflow-y-auto bg-stone-50 dark:bg-stone-950">
        <slot />
      </main>
    </div>

    <!-- MOBILE DRAWER SLIDEOVER -->
    <Transition name="fade">
      <div v-if="isMobileMenuOpen" class="lg:hidden fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex justify-start" @click.self="isMobileMenuOpen = false">
        <Transition name="slide-right" @after-leave="isMobileMenuOpen = false" appear>
          <div v-if="isMobileMenuOpen" class="w-64 bg-white dark:bg-stone-900 h-full shadow-2xl border-r border-stone-200 dark:border-stone-800 flex flex-col justify-between">
            <div>
              <div class="h-16 flex items-center justify-between px-6 border-b border-stone-200 dark:border-stone-800">
                <NuxtLink to="/analytics" class="flex items-center gap-2 font-extrabold text-xl tracking-tight text-stone-900 dark:text-white" @click="isMobileMenuOpen = false">
                  <span class="bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent font-black">RD</span>
                  <span class="text-stone-800 dark:text-stone-100">AI</span>
                </NuxtLink>
                <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="isMobileMenuOpen = false" class="rounded-xl" />
              </div>

              <nav class="px-4 py-6 space-y-1.5">
                <NuxtLink
                  v-for="link in navLinks"
                  :key="link.to"
                  :to="link.to"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  :class="[
                    isLinkActive(link.to)
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-l-2 border-amber-500 pl-2.5 font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                  ]"
                  @click="isMobileMenuOpen = false"
                >
                  <UIcon :name="link.icon" class="w-5 h-5 shrink-0" />
                  <span>{{ link.label }}</span>
                </NuxtLink>
              </nav>
            </div>

            <!-- User profile bottom bar for mobile drawer -->
            <div class="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
              <ClientOnly>
                <div v-if="session?.data" class="flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0">
                    <UAvatar
                      :src="session.data.user.image || undefined"
                      :alt="session.data.user.name || undefined"
                      size="sm"
                      class="ring-1 ring-stone-200 dark:ring-stone-800"
                    />
                    <div class="flex flex-col min-w-0 text-left">
                      <span class="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
                        {{ session.data.user.name }}
                      </span>
                      <span class="text-[10px] text-stone-400 dark:text-stone-500 truncate">
                        {{ session.data.user.email }}
                      </span>
                    </div>
                  </div>
                  
                  <UButton
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-log-out"
                    class="rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800"
                    @click="handleSignOut"
                  />
                </div>
              </ClientOnly>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Mobile transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(-100%);
}
</style>
