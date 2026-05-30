<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  progress: number;
  href: string;
  createdAt?: string;
  chapterCount?: number;
}>();
</script>

<template>
  <NuxtLink
    :to="href"
    class="flex flex-col justify-between p-6 bg-white dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 dark:border-stone-800/50 shadow-sm hover:shadow-md dark:shadow-none transition-all duration-300 hover:scale-[1.01] hover:border-stone-300 dark:hover:border-stone-700 group cursor-pointer"
  >
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-4">
        <!-- Badge for Chapters -->
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
          <UIcon name="i-lucide-folder" class="w-3.5 h-3.5" />
          {{ chapterCount || 0 }} Chapters
        </span>
        <!-- Optional created date -->
        <span v-if="createdAt" class="text-[10px] text-stone-400 dark:text-stone-500 flex items-center gap-1 font-medium">
          <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
          {{ new Date(createdAt).toLocaleDateString() }}
        </span>
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-bold text-stone-900 dark:text-white tracking-tight group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
          {{ title }}
        </h3>
        <p class="text-stone-500 dark:text-stone-400 text-sm leading-relaxed line-clamp-2">
          {{ description }}
        </p>
      </div>
    </div>

    <div class="mt-6 pt-4 border-t border-stone-100 dark:border-stone-900 space-y-3">
      <!-- Progress Bar Info -->
      <div class="flex items-center justify-between text-[11px] font-semibold tracking-wide text-stone-500 dark:text-stone-400 uppercase">
        <span>Curriculum Progress</span>
        <div class="flex items-center gap-1.5 text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
          <span>{{ Math.round(progress) }}%</span>
          <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" />
        </div>
      </div>
      
      <!-- Razor-thin progress track -->
      <div class="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
        <div
          class="bg-amber-500 h-full rounded-full transition-all duration-500 ease-out"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>
  </NuxtLink>
</template>
