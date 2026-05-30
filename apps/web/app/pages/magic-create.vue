<script setup lang="ts">
import { ref } from "vue";

definePageMeta({
  middleware: ["auth"],
  layout: "dashboard",
});

const topicInput = ref("");
const isPending = ref(false);
const visibleModules = ref<any[]>([]);
const fullRoadmap = ref<any[]>([]);

async function handleMagicCreate() {
  if (!topicInput.value.trim()) return;
  isPending.value = true;
  visibleModules.value = [];
  fullRoadmap.value = [];

  try {
    const config = useRuntimeConfig();
    const serverUrl = config.public.serverUrl || "http://localhost:3000";
    
    // Request 5 learning modules based on topic or YouTube link
    const messages = [
      {
        id: "sys-" + Date.now(),
        role: "system",
        content: `You are an elite, high-performance curriculum generator. Generate a gorgeous, structured learning path of exactly 5 modules for the user's topic. Your response MUST be a valid JSON array and NOTHING else. No markdown wrapper (like \`\`\`json), no trailing text.
        Schema:
        [
          { "title": "Module 1: Title", "description": "Short, highly descriptive summary." }
        ]`
      },
      {
        id: "user-" + Date.now(),
        role: "user",
        content: `Topic or Link: ${topicInput.value}`
      }
    ];

    const res = await fetch(`${serverUrl}/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) throw new Error("API call failed");

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let text = "";
    
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
    } else {
      text = await res.text();
    }

    // Clean up response text from stream formatting
    const cleanedText = text
      .replace(/0:"/g, "")
      .replace(/\\n/g, "")
      .replace(/\\"/g, '"')
      .replace(/\\/g, "")
      .replace(/`/g, "")
      .replace(/json/gi, "")
      .trim();

    const startIdx = cleanedText.indexOf("[");
    const endIdx = cleanedText.lastIndexOf("]");
    if (startIdx === -1 || endIdx === -1) throw new Error("Invalid JSON structure");
    const jsonString = cleanedText.substring(startIdx, endIdx + 1);

    const modules = JSON.parse(jsonString);
    fullRoadmap.value = modules;

    // Trigger staggered card reveal interval
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullRoadmap.value.length) {
        visibleModules.value.push(fullRoadmap.value[i]);
        i++;
      } else {
        clearInterval(interval);
        isPending.value = false;
      }
    }, 600);
  } catch (error) {
    console.error("Failed to generate magic roadmap:", error);
    isPending.value = false;
    alert("Generation failed, please try again with a simpler topic or plain text description!");
  }
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-8 text-left">
    <!-- Header -->
    <div class="space-y-2 border-b border-stone-200 dark:border-stone-800 pb-5">
      <span class="text-xs font-bold text-amber-500 uppercase tracking-widest">Generative Pipeline</span>
      <h1 class="text-3xl font-black text-stone-950 dark:text-stone-50 tracking-tight">
        Magic Create
      </h1>
      <p class="text-stone-500 dark:text-stone-400 text-sm max-w-2xl leading-relaxed">
        Paste a YouTube tutorial URL, textbook chapter, or high-level concept description, and let our compiler assemble a real-time faked streaming syllabus card-by-card.
      </p>
    </div>

    <!-- Main Creation Input Bar -->
    <div class="p-6 bg-white dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm space-y-4">
      <form @submit.prevent="handleMagicCreate" class="flex flex-col sm:flex-row gap-3">
        <UInput
          v-model="topicInput"
          placeholder="e.g. Paste a YouTube link or type 'Next.js App Router Architecture'..."
          class="flex-1 rounded-xl py-3"
          size="lg"
          :disabled="isPending"
          autocomplete="off"
        />
        <UButton
          type="submit"
          color="primary"
          icon="i-lucide-sparkles"
          class="rounded-xl px-6 py-3 font-semibold text-stone-950 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-amber-500/15"
          :loading="isPending && visibleModules.length === 0"
          :disabled="!topicInput.trim()"
        >
          Generate
        </UButton>
      </form>
      <div class="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
        Supports any domain: software, pastry, music theory, mechanics, or business plans.
      </div>
    </div>

    <!-- Generating Loader state -->
    <div
      v-if="isPending && visibleModules.length === 0"
      class="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in"
    >
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-amber-500" />
      <span class="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">
        Analyzing context & formulating modules...
      </span>
    </div>

    <!-- Output Streaming Grid (Transition Group) -->
    <div v-if="visibleModules.length > 0" class="space-y-6">
      <h2 class="text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
        <UIcon name="i-lucide-layers" class="text-amber-500" />
        Formulating Learning Track:
      </h2>

      <!-- TransitionGroup list revealing -->
      <TransitionGroup
        name="stagger-list"
        tag="div"
        class="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div
          v-for="(mod, idx) in visibleModules"
          :key="mod.title"
          class="p-6 bg-white dark:bg-stone-900/50 border border-stone-200/50 dark:border-stone-800/50 rounded-2xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 relative group overflow-hidden"
        >
          <!-- Corner indicator index -->
          <div class="absolute -top-3 -right-3 h-12 w-12 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-extrabold flex items-center justify-center text-stone-400 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
            #0{{ idx + 1 }}
          </div>
          
          <div class="space-y-2 pr-6">
            <h3 class="text-base font-bold text-stone-900 dark:text-white leading-snug">
              {{ mod.title }}
            </h3>
            <p class="text-stone-500 dark:text-stone-400 text-xs leading-relaxed line-clamp-3">
              {{ mod.description }}
            </p>
          </div>

          <!-- Progress slider indicator at bottom -->
          <div class="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between">
            <span class="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider flex items-center gap-1">
              <UIcon name="i-lucide-activity" /> Active Stream
            </span>
            <span class="text-[10px] text-stone-400 dark:text-stone-500 font-medium">Unlocked</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
/* Stagger list animation */
.stagger-list-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.stagger-list-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
}
</style>
