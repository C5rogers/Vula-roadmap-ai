<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { Chat } from "@ai-sdk/vue";
import { getTextFromMessage } from "@nuxt/ui/utils/ai";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const { $authClient, $orpc } = useNuxtApp();
const route = useRoute();
const router = useRouter();

definePageMeta({
  middleware: ["auth"],
});

const session = $authClient.useSession();
const roadmapId = route.params.id as string;

// --- 1. Queries ---
const roadmapQuery = useQuery({
  ...$orpc.onboarding.getRoadmap.queryOptions({ input: { id: roadmapId } }),
  enabled: computed(() => !!session.value?.data?.user && !!roadmapId),
});

// --- 2. Active Lesson State ---
const activeLesson = ref<any>(null);

// Watch roadmap load to set default active lesson
watch(
  () => roadmapQuery.data.value,
  (roadmap) => {
    if (roadmap?.chapters?.[0]?.lessons?.[0] && !activeLesson.value) {
      activeLesson.value = roadmap.chapters[0].lessons[0];
    }
  },
  { immediate: true },
);

// --- 3. Contextual AI Chat ---
const chatInput = ref("");
const chatMessages = ref<UIMessage[]>([]);
const aiApiUrl = `${useRuntimeConfig().public.serverUrl}/ai`;

let chatInstance = ref<Chat<any> | null>(null);

// Watch active lesson or active roadmap change to reinitialize chat with context
watch(
  [() => roadmapQuery.data.value?.id, () => activeLesson.value?.id],
  ([id, lessonId]) => {
    const roadmap = roadmapQuery.data.value;
    if (!roadmap) {
      chatInstance.value = null;
      return;
    }

    // Prepare system instructions context
    const contextPrompt = `You are a world-class AI Learning Coach assisting the user on their learning journey.
Context details:
- Learning Roadmap: ${roadmap.title}
- Target Goal: ${roadmap.targetGoal}
${activeLesson.value ? `- Active Lesson: ${activeLesson.value.title}\n- Lesson Overview: ${activeLesson.value.overview}` : ""}

Please help the user understand the active lesson, explain difficult concepts in detail, provide practical code examples, or design exercises. Respond concisely, tailing your replies to their background.`;

    // Reset messages and inject the initial system message secretly or starting prompt using parts
    chatMessages.value = [
      {
        id: "system-init",
        role: "system" as any,
        parts: [{ type: "text", text: contextPrompt }],
        createdAt: new Date(),
      },
      {
        id: "welcome-init",
        role: "assistant" as any,
        parts: [
          {
            type: "text",
            text:
              roadmap.learningStrategy ||
              `Welcome to your learning journey for "${roadmap.title}"! How can I help you tackle this lesson today?`,
          },
        ],
        createdAt: new Date(),
      },
    ] as any;

    chatInstance.value = new Chat({
      messages: chatMessages.value as any,
      transport: new DefaultChatTransport({
        api: aiApiUrl,
      }),
      onError(err) {
        console.error("Coach error:", err);
      },
    });
  },
  { immediate: true },
);

function handleChatSubmit(e: Event) {
  e.preventDefault();
  if (!chatInput.value.trim() || !chatInstance.value) return;

  const userInput = chatInput.value;
  chatInput.value = "";

  chatInstance.value.sendMessage({ text: userInput });
}

const filteredMessages = computed(() => {
  return chatMessages.value.filter((m: any) => m.role !== "system");
});

const hasChatMessages = computed(() => filteredMessages.value.length > 0);
const isChatLoading = computed(() => {
  if (!chatInstance.value) return false;
  return (
    chatInstance.value.status === "submitted" ||
    chatInstance.value.status === "streaming"
  );
});
</script>

<template>
  <UContainer
    class="py-6 max-w-7xl min-h-[calc(100vh-var(--ui-header-height)-3rem)]"
  >
    <!-- --- Loading State --- -->
    <div
      v-if="roadmapQuery.status.value === 'pending'"
      class="flex h-[60vh] flex-col items-center justify-center gap-4"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="h-10 w-10 animate-spin text-primary"
      />
      <div class="text-muted text-sm">Loading your roadmap...</div>
    </div>

    <!-- --- Error State --- -->
    <UAlert
      v-else-if="roadmapQuery.status.value === 'error'"
      color="error"
      icon="i-lucide-alert-circle"
      title="Failed to load roadmap"
      :description="roadmapQuery.error.value?.message"
    />

    <!-- --- Detail Active Roadmap and Syllabus View --- -->
    <div
      v-else-if="roadmapQuery.data.value"
      class="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-var(--ui-header-height)-4rem)]"
    >
      <!-- Left Panel: Syllabus & Lesson Content (8 cols) -->
      <div class="lg:col-span-8 flex flex-col gap-5 min-w-0">
        <!-- Back and title header -->
        <div
          class="flex items-center justify-between border-b border-default pb-4"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            @click="router.push('/dashboard')"
            class="rounded-xl"
          >
            Dashboard
          </UButton>
          <div class="text-xs text-muted font-medium">Active Path</div>
        </div>

        <div class="space-y-2">
          <h1
            class="text-2xl sm:text-3xl font-extrabold text-highlighted tracking-tight leading-tight"
          >
            {{ roadmapQuery.data.value.title }}
          </h1>
          <p class="text-muted text-sm leading-relaxed max-w-3xl">
            {{ roadmapQuery.data.value.description }}
          </p>
        </div>

        <!-- Layout: Double Column inside the detail page (Syllabus vs Lesson view) -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
          <!-- Syllabus Chapter/Lesson List accordion (4 cols) -->
          <div class="md:col-span-4 space-y-4">
            <div
              class="font-bold text-sm text-highlighted px-1 uppercase tracking-wider flex items-center gap-1.5"
            >
              <UIcon name="i-lucide-book" />
              Syllabus Outline
            </div>

            <div
              class="space-y-3 max-h-[50vh] md:max-h-[65vh] overflow-y-auto pr-1"
            >
              <div
                v-for="(chapter, cIdx) in roadmapQuery.data.value.chapters"
                :key="chapter.id"
                class="border border-default rounded-xl overflow-hidden bg-elevated/20"
              >
                <!-- Chapter Header -->
                <div
                  class="bg-elevated/40 px-3 py-2.5 border-b border-default flex flex-col"
                >
                  <span
                    class="text-[10px] font-bold text-primary uppercase tracking-wider"
                    >Chapter {{ chapter.order }}</span
                  >
                  <span
                    class="text-xs font-semibold text-highlighted line-clamp-1 mt-0.5"
                    >{{ chapter.title }}</span
                  >
                </div>

                <!-- Lessons inside chapter -->
                <div class="divide-y divide-default">
                  <button
                    v-for="lesson in chapter.lessons"
                    :key="lesson.id"
                    @click="activeLesson = lesson"
                    class="w-full text-left px-3 py-2.5 text-xs hover:bg-primary/5 transition-colors flex items-center justify-between gap-2"
                    :class="
                      activeLesson?.id === lesson.id
                        ? 'bg-primary/10 border-l-2 border-primary font-bold text-primary'
                        : 'text-neutral-600'
                    "
                  >
                    <span class="line-clamp-2"
                      >{{ lesson.order }}. {{ lesson.title }}</span
                    >
                    <UIcon
                      v-if="activeLesson?.id === lesson.id"
                      name="i-lucide-book-open"
                      class="h-3.5 w-3.5 text-primary shrink-0"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Lesson Content area (8 cols) -->
          <div class="md:col-span-8">
            <div
              v-if="activeLesson"
              class="border border-default rounded-2xl p-5 bg-elevated/10 space-y-5 shadow-sm min-h-[40vh]"
            >
              <div>
                <span
                  class="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1"
                >
                  <UIcon name="i-lucide-layers" />
                  Active Study Lesson
                </span>
                <h2
                  class="text-xl font-bold text-highlighted tracking-tight mt-1"
                >
                  {{ activeLesson.title }}
                </h2>
              </div>

              <!-- Lesson Overview Brief box -->
              <div
                v-if="activeLesson.overview"
                class="bg-elevated/40 border border-default rounded-xl p-3 text-xs leading-relaxed text-muted"
              >
                <span class="font-bold text-highlighted block mb-1"
                  >Objectives:</span
                >
                {{ activeLesson.overview }}
              </div>

              <!-- Lesson Detailed study notes (in markdown / text) -->
              <div class="space-y-3">
                <span
                  class="font-bold text-sm text-highlighted block pb-1 border-b border-default"
                  >Study Content</span
                >
                <div
                  class="prose dark:prose-invert text-xs leading-6 whitespace-pre-wrap max-w-none text-neutral-700 bg-default/40 p-4 rounded-xl border border-default/60"
                >
                  {{ activeLesson.content }}
                </div>
              </div>
            </div>

            <!-- Fallback if no lesson selected -->
            <div
              v-else
              class="flex flex-col items-center justify-center text-center p-10 border border-default border-dashed rounded-2xl min-h-[40vh]"
            >
              <UIcon
                name="i-lucide-book-open-check"
                class="h-10 w-10 text-muted mb-2"
              />
              <div class="font-semibold text-highlighted text-sm">
                No Active Lesson
              </div>
              <p class="text-xs text-muted mt-1">
                Select a lesson from the syllabus outline to begin study notes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: AI Coach Chat Sidebar (4 cols) -->
      <div
        class="lg:col-span-4 flex flex-col border border-default bg-elevated/30 rounded-2xl overflow-hidden h-[calc(100vh-var(--ui-header-height)-4rem)]"
      >
        <!-- AI Coach Header -->
        <div
          class="bg-elevated/50 px-4 py-3 border-b border-default flex items-center gap-2.5"
        >
          <div class="rounded-full p-2 bg-primary/10 text-primary">
            <UIcon name="i-lucide-sparkles" class="h-4 w-4" />
          </div>
          <div>
            <div class="text-sm font-bold text-highlighted">
              AI Learning Coach
            </div>
            <div class="text-[10px] text-muted flex items-center gap-1 mt-0.5">
              <span class="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Tuned to current lesson context
            </div>
          </div>
        </div>

        <!-- Chat messages view -->
        <div class="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
          <div
            v-if="!chatInstance"
            class="flex h-full items-center justify-center text-center text-muted text-xs"
          >
            Initializing coach session...
          </div>
          <div
            v-else-if="!hasChatMessages"
            class="flex h-full items-center justify-center text-center px-4 space-y-2 flex-col"
          >
            <UIcon
              name="i-lucide-bot"
              class="h-10 w-10 text-primary animate-pulse"
            />
            <div class="font-semibold text-xs text-highlighted">
              Your Coach is Ready!
            </div>
            <p class="text-[11px] leading-relaxed text-muted max-w-[200px]">
              Ask me details about "{{
                activeLesson?.title || roadmapQuery.data.value.title
              }}". I can write code, explain details or test your knowledge!
            </p>
          </div>

          <!-- Chat logs list -->
          <div v-else class="space-y-4">
            <div
              v-for="msg in filteredMessages"
              :key="msg.id"
              class="flex flex-col space-y-1.5"
              :class="msg.role === 'user' ? 'items-end' : 'items-start'"
            >
              <span class="text-[10px] text-muted capitalize px-1">
                {{ msg.role === "user" ? "You" : "Coach" }}
              </span>
              <div
                class="px-3.5 py-2.5 rounded-2xl text-xs max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm"
                :class="
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-default border border-default rounded-tl-none text-neutral-800'
                "
              >
                {{ getTextFromMessage(msg) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Chat message input prompt -->
        <div class="p-4 border-t border-default bg-elevated/50 sticky bottom-0">
          <form
            @submit.prevent="handleChatSubmit"
            class="flex gap-2 items-center"
          >
            <UInput
              v-model="chatInput"
              :placeholder="
                isChatLoading
                  ? 'Coach is typing...'
                  : 'Ask about this lesson...'
              "
              :disabled="isChatLoading || !chatInstance"
              autocomplete="off"
              class="flex-1 rounded-xl"
            />
            <UButton
              type="submit"
              color="primary"
              square
              icon="i-lucide-send"
              :loading="isChatLoading"
              :disabled="!chatInput.trim() || !chatInstance"
              class="rounded-xl shrink-0"
            />
          </form>
        </div>
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
.prose {
  font-family: inherit;
}
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
