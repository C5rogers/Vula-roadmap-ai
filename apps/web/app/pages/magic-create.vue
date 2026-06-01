<script setup lang="ts">
import { ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

definePageMeta({
  middleware: ["auth"],
  layout: "dashboard",
});

const topicInput = ref("");
const isPending = ref(false);
const visibleChapters = ref<any[]>([]);
const fullRoadmap = ref<any[]>([]);

const { $authClient, $orpc } = useNuxtApp();
const session = $authClient.useSession();
const queryClient = useQueryClient();
const router = useRouter();

// Mutation to construct a full roadmap based on the custom input
const onboardingMutation = useMutation(
  $orpc.onboarding.submit.mutationOptions({
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      router.push("/roadmaps");
    },
  }),
);

const isOnboardingPending = computed(() => onboardingMutation.isPending.value);

function handleConstructPath() {
  onboardingMutation.mutate({
    learningGoals: topicInput.value,
    experienceLevel: "intermediate",
    learningStyle: "mixed",
    weeklyCommitment: 5,
    preferredDuration: "4 weeks",
  });
}

// Normalizer to guarantee robust Chapter-Lesson syllabus parsing under any AI output variations
function normalizeSyllabus(rawInput: any): any[] {
  let list: any[] = [];
  if (Array.isArray(rawInput)) {
    list = rawInput;
  } else if (rawInput && typeof rawInput === "object") {
    // If the JSON is wrapped in an object like { "chapters": [...] } or { "roadmap": [...] }
    for (const key of Object.keys(rawInput)) {
      if (Array.isArray(rawInput[key])) {
        list = rawInput[key];
        break;
      }
    }
    if (list.length === 0) {
      list = [rawInput];
    }
  }

  return list.map((item: any, idx: number) => {
    const chapterTitle = item?.chapterTitle || item?.title || item?.name || `Chapter ${idx + 1}: Core Syllabus Track`;
    let rawLessons = item?.lessons || item?.modules || item?.topics || [];
    if (!Array.isArray(rawLessons)) {
      rawLessons = [rawLessons];
    }
    
    const lessons = rawLessons.map((lesson: any, lIdx: number) => {
      const title = lesson?.title || lesson?.name || `Lesson ${idx + 1}.${lIdx + 1}: Overview`;
      const overview = lesson?.overview || lesson?.description || lesson?.desc || "No overview provided.";
      const type = lesson?.type || "VIDEO";
      const url = lesson?.url || lesson?.link || "https://www.google.com";
      return { title, overview, type, url };
    });

    return { chapterTitle, lessons };
  });
}

// Media Icon helper for timeline visual richness
function getMediaIcon(type: string): string {
  switch (type?.toUpperCase()) {
    case "VIDEO":
      return "i-lucide-video";
    case "AUDIO":
      return "i-lucide-headphones";
    case "PDF":
      return "i-lucide-file-text";
    default:
      return "i-lucide-book-open";
  }
}

// Badge color helper
function getBadgeColor(type: string): "primary" | "secondary" | "success" | "neutral" {
  switch (type?.toUpperCase()) {
    case "VIDEO":
      return "primary";
    case "AUDIO":
      return "success";
    case "PDF":
      return "secondary";
    default:
      return "neutral";
  }
}

async function handleMagicCreate() {
  if (!topicInput.value.trim()) return;
  isPending.value = true;
  visibleChapters.value = [];
  fullRoadmap.value = [];

  try {
    const config = useRuntimeConfig();
    const serverUrl = config.public.serverUrl || "http://localhost:3000";
    const uId = session.value?.data?.user?.id || "";
    
    // Request full Chapter/Lesson roadmap syllabus structure
    const messages = [
      {
        id: "sys-" + Date.now(),
        role: "system",
        content: `You are an elite, high-performance curriculum generator.
        Generate a gorgeous, deeply detailed learning syllabus of exactly 3 Chapters for the user's topic.
        Each Chapter must contain exactly 2 highly relevant Lessons.
        For each Lesson, you must select an appropriate media type ('VIDEO', 'AUDIO', 'PDF', or 'TEXT') and provide a highly descriptive title, an overview, and a valid curated URL representing that lesson's study material.
        
        CRITICAL YOUTUBE INTEGRATION: If the user provides a YouTube link (e.g. watch?v=... or youtu.be), you MUST use that exact YouTube link as the 'url' for the first lesson or the main chapter's video resource, and summarize its contents in the lesson overview/title!
        
        Your response MUST be a valid JSON array of Chapters and NOTHING else. No markdown wrappers, no trailing text.
        Schema:
        [
          {
            "chapterTitle": "Chapter 1: Title",
            "lessons": [
              {
                "title": "Lesson 1.1: Title",
                "overview": "Clear learning objectives and summary of this lesson.",
                "type": "VIDEO",
                "url": "https://www.youtube.com/watch?v=..."
              }
            ]
          }
        ]`
      },
      {
        id: "user-" + Date.now(),
        role: "user",
        content: `Topic or Link: ${topicInput.value}`
      }
    ];

    const res = await fetch(`${serverUrl}/ai?userId=${uId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
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

    let jsonString = text.trim();
    // Strip markdown code block wrapper if present
    if (jsonString.startsWith("```")) {
      const firstLineEnd = jsonString.indexOf("\n");
      const lastLineStart = jsonString.lastIndexOf("```");
      if (firstLineEnd !== -1 && lastLineStart !== -1) {
        jsonString = jsonString.substring(firstLineEnd + 1, lastLineStart).trim();
      }
    }

    const startIdx = jsonString.indexOf("[");
    const endIdx = jsonString.lastIndexOf("]");
    if (startIdx === -1 || endIdx === -1) throw new Error("Invalid JSON structure");
    const cleanJson = jsonString.substring(startIdx, endIdx + 1);

    const rawSyllabus = JSON.parse(cleanJson);
    fullRoadmap.value = normalizeSyllabus(rawSyllabus);

    // Trigger staggered chapter reveal interval
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullRoadmap.value.length) {
        visibleChapters.value.push(fullRoadmap.value[i]);
        i++;
      } else {
        clearInterval(interval);
        isPending.value = false;
      }
    }, 800);
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
      <h1 class="text-3xl font-black text-stone-950 dark:text-stone-50 tracking-tight animate-fade-in">
        Magic Create
      </h1>
      <p class="text-stone-500 dark:text-stone-400 text-sm max-w-2xl leading-relaxed">
        Paste a YouTube tutorial URL, textbook chapter, or high-level concept description, and let our compiler assemble a complete, beautiful interactive roadmap timeline.
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
          class="rounded-xl px-6 py-3 font-semibold text-stone-950 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-amber-500/15 cursor-pointer"
          :loading="isPending && visibleChapters.length === 0"
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
      v-if="isPending && visibleChapters.length === 0"
      class="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in"
    >
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-amber-500" />
      <span class="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">
        Analyzing context & compiling interactive syllabus...
      </span>
    </div>

    <!-- Output Streaming Syllabus Timeline (Spectacular Visual Learning Pathway) -->
    <div v-if="visibleChapters.length > 0" class="space-y-8 relative">
      <h2 class="text-xl font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-4">
        <UIcon name="i-lucide-map" class="text-amber-500" />
        Compiled Learning Pathway
      </h2>

      <!-- Connected Visual Timeline Line with Pulsing gradient node -->
      <div class="absolute left-6 top-16 bottom-6 w-1 border-l-2 border-dashed border-stone-200 dark:border-stone-800 hidden md:block"></div>

      <!-- TransitionGroup list revealing -->
      <TransitionGroup
        name="stagger-list"
        tag="div"
        class="space-y-12"
      >
        <div
          v-for="(chap, idx) in visibleChapters"
          :key="chap.chapterTitle"
          class="relative space-y-6 md:pl-16 animate-fade-in"
        >
          <!-- Timeline Bullet Node with beautiful pulsing indicators -->
          <div class="absolute left-[24px] top-4 -translate-x-1/2 h-8 w-8 rounded-full border-4 border-stone-50 dark:border-stone-950 bg-stone-900 dark:bg-stone-100 flex items-center justify-center shadow-lg shadow-amber-500/25 z-10 hidden md:block">
            <UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5 text-amber-500" />
          </div>

          <!-- Chapter Header Card -->
          <div class="space-y-1 text-left">
            <span class="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest block">
              Chapter #0{{ idx + 1 }}
            </span>
            <h3 class="text-lg font-black text-stone-900 dark:text-white tracking-tight leading-snug">
              {{ chap.chapterTitle }}
            </h3>
          </div>

          <!-- Lessons Grid within this Chapter -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="(lesson, lIdx) in chap.lessons"
              :key="lesson.title"
              class="p-6 bg-white dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800/80 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 dark:shadow-none transition-all duration-300 hover:border-amber-500/30 dark:hover:border-amber-500/30 relative flex flex-col justify-between group overflow-hidden"
            >
              <!-- Media Format Badge -->
              <div class="absolute top-4 right-4">
                <UBadge
                  :label="lesson.type"
                  :color="getBadgeColor(lesson.type)"
                  size="sm"
                  variant="subtle"
                  class="font-extrabold tracking-wider text-[9px]"
                />
              </div>

              <div class="space-y-4">
                <!-- Icon and Title -->
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700/50 flex items-center justify-center text-stone-500 dark:text-stone-300 group-hover:text-amber-500 transition-colors">
                    <UIcon :name="getMediaIcon(lesson.type)" class="w-5 h-5 shrink-0" />
                  </div>
                  <div class="min-w-0 text-left">
                    <span class="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Lesson 0{{ Number(idx) + 1 }}.0{{ Number(lIdx) + 1 }}</span>
                    <h4 class="text-sm font-bold text-stone-900 dark:text-white leading-tight truncate group-hover:text-amber-500 transition-colors">
                      {{ lesson.title }}
                    </h4>
                  </div>
                </div>

                <!-- Overview -->
                <p class="text-stone-500 dark:text-stone-400 text-xs leading-relaxed line-clamp-3 text-left whitespace-pre-line">
                  {{ lesson.overview }}
                </p>
              </div>

              <!-- Action Link Footer -->
              <div class="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between">
                <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Ready to study</span>
                <a
                  :href="lesson.url"
                  target="_blank"
                  class="inline-flex items-center gap-1.5 text-xs font-bold text-stone-850 dark:text-stone-200 hover:text-amber-500 dark:hover:text-amber-400 cursor-pointer transition-colors"
                >
                  <span>Go to Resource</span>
                  <UIcon name="i-lucide-arrow-right" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Active Conversion Call To Action -->
      <div v-if="!isPending && visibleChapters.length > 0" class="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in mt-8 text-left">
        <div class="space-y-1">
          <h3 class="text-base font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
            <UIcon name="i-lucide-award" /> Unlock Full Interactive Track
          </h3>
          <p class="text-xs text-stone-500 dark:text-stone-400 max-w-xl leading-relaxed">
            Convert this quick syllabus overview into a fully featured interactive Roadie curriculum, packed with deep study notes, active recall flashcards, and an AI Learning Coach!
          </p>
        </div>
        <UButton
          color="primary"
          icon="i-lucide-sparkles"
          label="Construct Full Path"
          class="rounded-xl font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all text-stone-950 shrink-0 self-start sm:self-auto shadow-md shadow-amber-500/10"
          :loading="isOnboardingPending"
          @click="handleConstructPath"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Stagger list animation */
.stagger-list-enter-active {
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.stagger-list-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
}
</style>
