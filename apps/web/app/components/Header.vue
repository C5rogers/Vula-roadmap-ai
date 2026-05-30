<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import UserMenu from "./UserMenu.vue";

const route = useRoute();
const { $authClient } = useNuxtApp();
const session = $authClient.useSession();

// Base nav items — only show Dashboard if user is authenticated
const items = computed<NavigationMenuItem[]>(() => {
  const links: NavigationMenuItem[] = [
    { 
      label: "Home", 
      to: "/", 
      active: route.path === "/" && !route.hash,
      icon: "i-lucide-home"
    },
    {
      label: "About",
      to: route.path === "/" ? "#about" : "/#about",
      active: route.hash === "#about",
      icon: "i-lucide-info"
    },
    {
      label: "Contact",
      to: route.path === "/" ? "#contact" : "/#contact",
      active: route.hash === "#contact",
      icon: "i-lucide-mail"
    }
  ];

  if (session.value?.data) {
    links.push({ 
      label: "Dashboard", 
      to: "/analytics", 
      active: route.path.startsWith("/analytics") || route.path.startsWith("/roadmaps") || route.path.startsWith("/settings"),
      icon: "i-lucide-layout-dashboard"
    });
  }

  return links;
});
</script>

<template>
  <UHeader>
    <template #left>
      <div class="flex items-center gap-8">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-extrabold text-xl tracking-tight text-stone-900 dark:text-white group"
        >
          <span
            class="bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent font-black"
            >RD</span
          >
          <span>AI</span>
        </NuxtLink>
        <ClientOnly>
          <UNavigationMenu :items="items" variant="pill" class="hidden lg:flex" />
        </ClientOnly>
      </div>
    </template>

    <template #right>
      <UColorModeButton />
      <ClientOnly>
        <UserMenu />
        <template #fallback>
          <div class="h-9 w-24 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
        </template>
      </ClientOnly>
    </template>

    <template #body>
      <ClientOnly>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </ClientOnly>
    </template>
  </UHeader>
</template>
