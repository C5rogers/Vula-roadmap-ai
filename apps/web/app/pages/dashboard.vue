<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

// Instant Welcome Redirect to /analytics
onMounted(() => {
  navigateTo("/analytics", { replace: true });
});
</script>

<template>
  <div class="flex h-[80vh] items-center justify-center">
    <div class="flex flex-col items-center gap-3">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-amber-500" />
      <span class="text-stone-500 dark:text-stone-400 text-xs font-semibold uppercase tracking-wider">Redirecting to learning center...</span>
    </div>
  </div>
</template>
