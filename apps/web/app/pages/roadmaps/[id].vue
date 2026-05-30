<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { Chat } from "@ai-sdk/vue";
import { getTextFromMessage } from "@nuxt/ui/utils/ai";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { ref, shallowRef, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { marked } from "marked";

const { $authClient, $orpc } = useNuxtApp();
const route = useRoute();
const router = useRouter();

definePageMeta({
  middleware: ["auth"],
  layout: "dashboard",
});

const session = $authClient.useSession();
const roadmapId = route.params.id as string;

// --- 1. Queries ---
const roadmapQuery = useQuery({
  ...$orpc.onboarding.getRoadmap.queryOptions({ input: { id: roadmapId } }),
  enabled: computed(() => !!session.value?.data?.user && !!roadmapId),
});

// --- 2. Active Lesson State & Tabs ---
const activeLesson = ref<any>(null);
const activeTab = ref<
  "notes" | "flashcards" | "glossary" | "resources" | "quiz"
>("notes");

const openChapters = ref<Record<string, boolean>>({});

function toggleChapter(chapterId: string) {
  openChapters.value[chapterId] = !openChapters.value[chapterId];
}

// Watch roadmap load to set default active lesson
watch(
  () => roadmapQuery.data.value,
  (roadmap) => {
    if (roadmap?.chapters?.[0]?.lessons?.[0] && !activeLesson.value) {
      activeLesson.value = roadmap.chapters[0].lessons[0];
    }
    // Open the first chapter by default
    if (roadmap?.chapters?.[0]) {
      openChapters.value[roadmap.chapters[0].id] = true;
    }
  },
  { immediate: true },
);

// Reset tab-specific states when switching lessons
watch(activeLesson, () => {
  activeTab.value = "notes";
  currentCardIdx.value = 0;
  isCardFlipped.value = false;
  selectedAnswers.value = {};
  submittedQuizzes.value = {};
});

// YouTube Embed helper
const youtubeEmbedUrl = computed(() => {
  if (!activeLesson.value?.content || activeLesson.value.type !== "VIDEO")
    return null;
  const url = activeLesson.value.content.trim();

  // Try to parse a valid 11-char YouTube ID first
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (
    match &&
    match[2] &&
    match[2].length === 11 &&
    !url.includes("example.com")
  ) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }

  // Search Fallback: If it's a placeholder or invalid link, embed a search-based player!
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(activeLesson.value.title + " tutorial")}`;
});

// Video External Watch URL
const videoWatchUrl = computed(() => {
  if (!activeLesson.value?.content) return "#";
  const url = activeLesson.value.content.trim();
  if (url.startsWith("http") && !url.includes("example.com")) {
    return url;
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(activeLesson.value.title + " tutorial")}`;
});

// Audio HTML5 stream helper (lo-fi ambient backdrop stream fallback)
const audioStreamUrl = computed(() => {
  if (!activeLesson.value?.content || activeLesson.value.type !== "AUDIO")
    return null;
  const url = activeLesson.value.content.trim();
  if (
    url.startsWith("http") &&
    url.endsWith(".mp3") &&
    !url.includes("example.com")
  ) {
    return url;
  }
  // Highly reliable lofi ambient background track fallback
  return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
});

// Audio External Podcast Link
const audioWatchUrl = computed(() => {
  if (!activeLesson.value?.content) return "#";
  const url = activeLesson.value.content.trim();
  if (url.startsWith("http") && !url.includes("example.com")) {
    return url;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(activeLesson.value.title + " podcast audio")}`;
});

// PDF Presentation Document URL
const pdfDocumentUrl = computed(() => {
  if (!activeLesson.value?.content) return "#";
  const url = activeLesson.value.content.trim();
  if (
    url.startsWith("http") &&
    url.endsWith(".pdf") &&
    !url.includes("example.com")
  ) {
    return url;
  }
  return `https://www.google.com/search?q=filetype:pdf+${encodeURIComponent(activeLesson.value.title)}`;
});

// Curated Resource fallback resolver
function resolveResourceUrl(r: any): string {
  if (!r?.url) return "#";
  const url = r.url.trim();
  if (url.startsWith("http") && !url.includes("example.com")) {
    return url;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(r.title)}`;
}

// --- 3. Interactive Lesson Features States ---
// Flashcards state
const currentCardIdx = ref(0);
const isCardFlipped = ref(false);
const displayCardNum = computed(() => currentCardIdx.value + 1);

function nextCard() {
  if (!activeLesson.value?.flashcards) return;
  if (currentCardIdx.value < activeLesson.value.flashcards.length - 1) {
    currentCardIdx.value++;
    isCardFlipped.value = false;
  }
}
function prevCard() {
  if (currentCardIdx.value > 0) {
    currentCardIdx.value--;
    isCardFlipped.value = false;
  }
}

// Quiz interactive states
const selectedAnswers = ref<Record<string, string>>({});
const submittedQuizzes = ref<Record<string, boolean>>({});

function handleSelectAnswer(questionId: string, option: string) {
  if (submittedQuizzes.value[questionId]) return; // locked after submit
  selectedAnswers.value[questionId] = option;
}

function handleSubmitQuestion(questionId: string) {
  if (!selectedAnswers.value[questionId]) return;
  submittedQuizzes.value[questionId] = true;
}

// --- 4. Contextual AI Chat ---
const chatInput = ref("");
const chatMessages = ref<UIMessage[]>([]);
const aiApiUrl = computed(() => {
  const uId = session.value?.data?.user?.id || "";
  return `${useRuntimeConfig().public.serverUrl}/ai?roadmapId=${roadmapId}&userId=${uId}`;
});

const chatInstance = shallowRef<Chat<any> | null>(null);

// Query for saved chat history
const chatHistoryQuery = useQuery({
  ...$orpc.onboarding.getChatHistory.queryOptions({ input: { roadmapId } }),
  enabled: computed(() => !!session.value?.data?.user && !!roadmapId),
});

// Autocomplete lesson dropdown logic
const showLessonDropdown = ref(false);

const filteredLessonsForDropdown = computed(() => {
  const roadmap = roadmapQuery.data.value;
  if (!roadmap?.chapters) return [];
  const list: any[] = [];
  for (const chapter of roadmap.chapters) {
    for (const lesson of chapter.lessons) {
      list.push(lesson);
    }
  }
  return list;
});

function insertLessonMention(lesson: any) {
  const currentText = chatInput.value;
  const lastChar = currentText.slice(-1);
  if (lastChar === "@" || lastChar === "#") {
    chatInput.value = currentText.slice(0, -1) + `@${lesson.title} `;
  } else {
    chatInput.value = currentText + `@${lesson.title} `;
  }
  showLessonDropdown.value = false;
}

// Watch chatInput to trigger the dropdown
watch(chatInput, (val) => {
  if (val.endsWith("@") || val.endsWith("#")) {
    showLessonDropdown.value = true;
  } else if (!val.includes("@") && !val.includes("#")) {
    showLessonDropdown.value = false;
  }
});

// Watch active lesson, active roadmap, or loaded chat history to reinitialize chat with context
watch(
  [
    () => roadmapQuery.data.value?.id,
    () => activeLesson.value?.id,
    () => chatHistoryQuery.data.value,
  ],
  ([id, lessonId, dbMsgs]) => {
    const roadmap = roadmapQuery.data.value;
    if (!roadmap) {
      chatInstance.value = null;
      return;
    }

    // Format saved messages from db if any
    const formattedSaved = (dbMsgs || []).map((m: any) => ({
      id: m.id,
      role: m.role.toLowerCase() as any,
      parts: [{ type: "text", text: m.content }],
      createdAt: new Date(m.createdAt),
    }));

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
      ...(formattedSaved.length > 0
        ? formattedSaved
        : [
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
          ]),
    ] as any;

    chatInstance.value = new Chat({
      messages: chatMessages.value as any,
      transport: new DefaultChatTransport({
        api: aiApiUrl.value,
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

  // Check if there is a referenced lesson name in the input
  let referencedLesson = null;
  const roadmap = roadmapQuery.data.value;
  if (roadmap?.chapters) {
    for (const chapter of roadmap.chapters) {
      for (const lesson of chapter.lessons) {
        if (
          userInput.toLowerCase().includes(lesson.title.toLowerCase()) ||
          userInput.toLowerCase().includes(`@${lesson.title.toLowerCase()}`) ||
          userInput.toLowerCase().includes(`#${lesson.title.toLowerCase()}`)
        ) {
          referencedLesson = lesson;
          break;
        }
      }
      if (referencedLesson) break;
    }
  }

  if (referencedLesson) {
    const additionalContext = `\n[User referenced a specific lesson: "${referencedLesson.title}". Here is the lesson context to answer their question:
Lesson Overview: ${referencedLesson.overview || ""}
Lesson Content Reference: ${referencedLesson.content || ""}]`;
    chatInstance.value.sendMessage({
      text: `${userInput}${additionalContext}`,
    });
  } else {
    chatInstance.value.sendMessage({ text: userInput });
  }
}

function cleanMessageContent(content: string): string {
  if (!content) return "";
  const index = content.indexOf("\n[User referenced a specific lesson:");
  if (index !== -1) {
    return content.substring(0, index);
  }
  return content;
}

const filteredMessages = computed(() => {
  if (!chatInstance.value || !chatInstance.value.messages) return [];
  return chatInstance.value.messages.filter((m: any) => m.role !== "system");
});

const hasChatMessages = computed(() => filteredMessages.value.length > 0);
const isChatLoading = computed(() => {
  if (!chatInstance.value) return false;
  return (
    chatInstance.value.status === "submitted" ||
    chatInstance.value.status === "streaming"
  );
});

function parseMarkdown(md: string): string {
  if (!md) return "";
  return marked.parse(md) as string;
}

const showMobileChat = ref(false);
const isMobileSyllabusOpen = ref(false);

function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
}

function getYouTubeEmbedUrl(url: string): string {
  if (!url) return "";
  let videoId = "";
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    videoId = match[2];
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
</script>

<template>
  <UContainer
    class="py-6 max-w-[1600px] min-h-[calc(100vh-var(--ui-header-height)-3rem)]"
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
      :description="
        roadmapQuery.error.value?.message ||
        'An error occurred while loading the roadmap.'
      "
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
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          <!-- Mobile Syllabus Accordion (Hidden on Desktop) -->
          <div
            class="lg:hidden border border-default rounded-xl bg-elevated/20 overflow-hidden"
          >
            <button
              @click="isMobileSyllabusOpen = !isMobileSyllabusOpen"
              class="w-full px-4 py-3 text-sm font-bold text-highlighted flex items-center justify-between bg-elevated/40 hover:bg-elevated/60 transition-colors"
            >
              <span class="flex items-center gap-2">
                <UIcon name="i-lucide-book" class="text-primary" />
                <span
                  >Syllabus Outline ({{
                    activeLesson ? activeLesson.title : "Select a Lesson"
                  }})</span
                >
              </span>
              <UIcon
                :name="
                  isMobileSyllabusOpen
                    ? 'i-lucide-chevron-up'
                    : 'i-lucide-chevron-down'
                "
              />
            </button>

            <div
              v-if="isMobileSyllabusOpen"
              class="border-t border-default max-h-[50vh] overflow-y-auto p-2 space-y-2 animate-fade-in"
            >
              <div
                v-for="chapter in roadmapQuery.data.value.chapters"
                :key="chapter.id"
                class="border border-default rounded-lg overflow-hidden bg-elevated/10"
              >
                <!-- Mobile Chapter Header Button -->
                <button
                  @click="toggleChapter(chapter.id)"
                  class="w-full text-left bg-elevated/20 hover:bg-elevated/40 cursor-pointer transition-colors px-3 py-2 flex items-center justify-between gap-2 border-b border-default"
                >
                  <div class="flex flex-col min-w-0">
                    <span
                      class="text-[10px] font-bold text-primary uppercase tracking-wider"
                      >Chapter {{ chapter.order }}</span
                    >
                    <span
                      class="text-xs font-semibold text-highlighted line-clamp-1 mt-0.5"
                      >{{ chapter.title }}</span
                    >
                  </div>
                  <UIcon
                    :name="
                      openChapters[chapter.id]
                        ? 'i-lucide-chevron-up'
                        : 'i-lucide-chevron-down'
                    "
                    class="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0"
                  />
                </button>

                <!-- Lessons inside chapter (Collapsible) -->
                <div
                  v-if="openChapters[chapter.id]"
                  class="divide-y divide-default animate-fade-in"
                >
                  <button
                    v-for="lesson in chapter.lessons"
                    :key="lesson.id"
                    @click="
                      activeLesson = lesson;
                      isMobileSyllabusOpen = false;
                    "
                    class="w-full text-left px-3 py-2.5 text-xs hover:bg-primary/5 cursor-pointer transition-colors flex items-center justify-between gap-2"
                    :class="
                      activeLesson?.id === lesson.id
                        ? 'bg-primary/10 border-l-2 border-primary font-bold text-primary'
                        : 'text-stone-500 dark:text-stone-300'
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

          <!-- Syllabus Chapter/Lesson List accordion (4 cols) -->
          <div class="hidden lg:block lg:col-span-4 space-y-4">
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
                <!-- Chapter Header Button -->
                <button
                  @click="toggleChapter(chapter.id)"
                  class="w-full text-left bg-elevated/40 hover:bg-elevated/60 cursor-pointer transition-colors px-3 py-2.5 border-b border-default flex items-center justify-between gap-2"
                >
                  <div class="flex flex-col min-w-0">
                    <span
                      class="text-[10px] font-bold text-primary uppercase tracking-wider"
                      >Chapter {{ chapter.order }}</span
                    >
                    <span
                      class="text-xs font-semibold text-highlighted line-clamp-1 mt-0.5"
                      >{{ chapter.title }}</span
                    >
                  </div>
                  <UIcon
                    :name="
                      openChapters[chapter.id]
                        ? 'i-lucide-chevron-up'
                        : 'i-lucide-chevron-down'
                    "
                    class="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0"
                  />
                </button>

                <!-- Lessons inside chapter (Collapsible) -->
                <div
                  v-if="openChapters[chapter.id]"
                  class="divide-y divide-default animate-fade-in"
                >
                  <button
                    v-for="lesson in chapter.lessons"
                    :key="lesson.id"
                    @click="activeLesson = lesson"
                    class="w-full text-left px-3 py-2.5 text-xs hover:bg-primary/5 cursor-pointer transition-colors flex items-center justify-between gap-2"
                    :class="
                      activeLesson?.id === lesson.id
                        ? 'bg-primary/10 border-l-2 border-primary font-bold text-primary'
                        : 'text-neutral-600'
                    "
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <UIcon
                        :name="
                          lesson.type === 'VIDEO'
                            ? 'i-lucide-video'
                            : lesson.type === 'AUDIO'
                              ? 'i-lucide-headphones'
                              : lesson.type === 'PDF'
                                ? 'i-lucide-file'
                                : 'i-lucide-file-text'
                        "
                        class="h-3.5 w-3.5 shrink-0"
                        :class="
                          activeLesson?.id === lesson.id
                            ? 'text-primary'
                            : 'text-neutral-400'
                        "
                      />
                      <span class="line-clamp-2"
                        >{{ lesson.order }}. {{ lesson.title }}</span
                      >
                    </div>
                    <UIcon
                      v-if="activeLesson?.id === lesson.id"
                      name="i-lucide-chevron-right"
                      class="h-3 w-3 text-primary shrink-0 animate-pulse"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Lesson Content & Interactive area (8 cols) -->
          <div class="col-span-1 lg:col-span-8">
            <div
              v-if="activeLesson"
              class="border border-default rounded-2xl p-5 bg-elevated/10 space-y-5 shadow-sm min-h-[50vh]"
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
                class="bg-elevated/40 border border-default rounded-xl p-3 text-xs leading-relaxed text-muted animate-fade-in"
              >
                <span class="font-bold text-highlighted block mb-1"
                  >Objectives:</span
                >
                {{ activeLesson.overview }}
              </div>

              <!-- Interactive Navigation Tabs -->
              <div
                class="border-b border-default flex gap-4 text-xs font-semibold overflow-x-auto"
              >
                <button
                  v-for="tab in [
                    'notes',
                    'flashcards',
                    'glossary',
                    'resources',
                    'quiz',
                  ]"
                  :key="tab"
                  @click="activeTab = tab as any"
                  class="pb-2.5 px-1 uppercase tracking-wider border-b-2 transition-all capitalize"
                  :class="
                    activeTab === tab
                      ? 'border-primary text-primary font-bold'
                      : 'border-transparent text-muted hover:text-highlighted'
                  "
                >
                  {{ tab }}
                </button>
              </div>

              <!-- Tab 1: Lesson Notes -->
              <div
                v-if="activeTab === 'notes'"
                class="space-y-4 animate-fade-in"
              >
                <span
                  class="font-bold text-sm text-highlighted block pb-1 border-b border-default"
                  >Study Content</span
                >

                <!-- Case A: Text Lesson -->
                <div
                  v-if="activeLesson.type === 'TEXT' || !activeLesson.type"
                  class="prose dark:prose-invert text-xs leading-6 max-w-none text-stone-700 dark:text-stone-200 bg-default/40 p-4 rounded-xl border border-default/60"
                  v-html="parseMarkdown(activeLesson.content)"
                />

                <!-- Case B: Video Lesson -->
                <div
                  v-else-if="activeLesson.type === 'VIDEO'"
                  class="space-y-4"
                >
                  <div
                    v-if="youtubeEmbedUrl"
                    class="aspect-video w-full rounded-2xl overflow-hidden border border-default shadow-sm bg-black"
                  >
                    <iframe
                      :src="youtubeEmbedUrl"
                      class="w-full h-full border-0"
                      allow="
                        accelerometer;
                        autoplay;
                        clipboard-write;
                        encrypted-media;
                        gyroscope;
                        picture-in-picture;
                      "
                      allowfullscreen
                    ></iframe>
                  </div>

                  <div
                    class="p-6 rounded-2xl border border-default bg-elevated/20 flex flex-col items-center justify-center text-center space-y-4 shadow-sm"
                  >
                    <div class="rounded-full p-4 bg-primary/10 text-primary">
                      <UIcon
                        name="i-lucide-play-circle"
                        class="h-10 w-10 animate-pulse"
                      />
                    </div>
                    <div class="space-y-1.5 w-full">
                      <h3 class="text-sm font-bold text-highlighted">
                        Video Lecture Resource
                      </h3>
                      <p
                        class="text-xs text-muted max-w-md mx-auto leading-relaxed"
                      >
                        This lesson includes a curated video lecture. You can
                        watch it in the embedded player above or view it
                        directly on the host platform.
                      </p>
                      <div
                        class="text-[11px] font-mono text-muted select-all max-w-md truncate bg-default/50 px-2.5 py-1 rounded-md border border-default/60 mx-auto mt-1"
                      >
                        {{ activeLesson.content }}
                      </div>
                    </div>
                    <UButton
                      :href="videoWatchUrl"
                      target="_blank"
                      color="primary"
                      icon="i-lucide-external-link"
                      class="rounded-xl px-5"
                    >
                      Watch Video on Host Platform
                    </UButton>
                  </div>
                </div>

                <!-- Case C: Audio Lesson -->
                <div
                  v-else-if="activeLesson.type === 'AUDIO'"
                  class="p-6 rounded-2xl border border-default bg-elevated/20 flex flex-col items-center justify-center text-center space-y-4 shadow-sm"
                >
                  <div class="rounded-full p-4 bg-primary/10 text-primary">
                    <UIcon
                      name="i-lucide-headphones"
                      class="h-10 w-10 animate-pulse"
                    />
                  </div>
                  <div class="space-y-1.5 w-full">
                    <h3 class="text-sm font-bold text-highlighted">
                      Audio Lecture & Podcast Discussion
                    </h3>
                    <p
                      class="text-xs text-muted max-w-md mx-auto leading-relaxed"
                    >
                      Listen to the audio podcast-style narrative transcript
                      discussing the core concepts of this lesson.
                    </p>
                    <div
                      class="text-[11px] font-mono text-muted select-all max-w-md truncate bg-default/50 px-2.5 py-1 rounded-md border border-default/60 mx-auto mt-1 mb-2"
                    >
                      {{ activeLesson.content }}
                    </div>
                  </div>

                  <!-- HTML5 Audio Player -->
                  <audio
                    :src="audioStreamUrl"
                    controls
                    class="w-full max-w-md border border-default rounded-xl p-1 bg-default/50 shadow-inner"
                  ></audio>

                  <UButton
                    :href="audioWatchUrl"
                    target="_blank"
                    variant="subtle"
                    color="neutral"
                    icon="i-lucide-external-link"
                    class="rounded-xl"
                  >
                    Open Audio Source URL
                  </UButton>
                </div>

                <!-- Case D: PDF / Slides Lesson -->
                <div
                  v-else-if="activeLesson.type === 'PDF'"
                  class="p-6 rounded-2xl border border-default bg-elevated/20 flex flex-col items-center justify-center text-center space-y-4 shadow-sm"
                >
                  <div class="rounded-full p-4 bg-primary/10 text-primary">
                    <UIcon name="i-lucide-file-text" class="h-10 w-10" />
                  </div>
                  <div class="space-y-1.5 w-full">
                    <h3 class="text-sm font-bold text-highlighted">
                      PDF Slide Guide & Document Presentation
                    </h3>
                    <p
                      class="text-xs text-muted max-w-md mx-auto leading-relaxed"
                    >
                      A downloadable, comprehensive presentation slide document
                      is available for this lesson. Click below to view the
                      slide deck.
                    </p>
                    <div
                      class="text-[11px] font-mono text-muted select-all max-w-md truncate bg-default/50 px-2.5 py-1 rounded-md border border-default/60 mx-auto mt-1 mb-2"
                    >
                      {{ activeLesson.content }}
                    </div>
                  </div>
                  <UButton
                    :href="pdfDocumentUrl"
                    target="_blank"
                    color="primary"
                    icon="i-lucide-external-link"
                    class="rounded-xl px-5"
                  >
                    Open PDF Document
                  </UButton>
                </div>
              </div>

              <!-- Tab 2: Flashcards (Flip cards) -->
              <div
                v-else-if="activeTab === 'flashcards'"
                class="space-y-4 animate-fade-in"
              >
                <span
                  class="font-bold text-sm text-highlighted block pb-1 border-b border-default"
                  >Interactive Flashcards</span
                >
                <div
                  v-if="activeLesson.flashcards?.length"
                  class="flex flex-col items-center justify-center space-y-4 py-4"
                >
                  <!-- Flashcard layout -->
                  <div
                    @click="isCardFlipped = !isCardFlipped"
                    class="w-full max-w-md h-48 rounded-2xl border cursor-pointer flex flex-col items-center justify-center p-6 text-center shadow-md transition-all duration-300 relative select-none"
                    :class="
                      isCardFlipped
                        ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
                        : 'bg-elevated/40 border-default hover:border-neutral-400'
                    "
                  >
                    <div
                      class="text-[10px] text-muted uppercase tracking-widest font-semibold absolute top-4"
                    >
                      {{
                        isCardFlipped
                          ? "Answer (Click to flip)"
                          : "Question (Click to flip)"
                      }}
                    </div>
                    <div class="text-sm font-medium text-highlighted px-4">
                      {{
                        isCardFlipped
                          ? activeLesson.flashcards[currentCardIdx].back
                          : activeLesson.flashcards[currentCardIdx].front
                      }}
                    </div>
                    <div
                      class="text-[10px] text-primary font-semibold absolute bottom-4"
                    >
                      Card {{ displayCardNum }} of
                      {{ activeLesson.flashcards.length }}
                    </div>
                  </div>

                  <!-- Pagination Controls -->
                  <div class="flex items-center gap-3">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-chevron-left"
                      :disabled="currentCardIdx === 0"
                      @click="prevCard"
                    />
                    <span class="text-xs text-muted font-medium"
                      >{{ displayCardNum }} /
                      {{ activeLesson.flashcards.length }}</span
                    >
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-chevron-right"
                      :disabled="
                        currentCardIdx === activeLesson.flashcards.length - 1
                      "
                      @click="nextCard"
                    />
                  </div>
                </div>
                <div v-else class="text-center py-10 text-muted text-xs">
                  No flashcards generated for this lesson.
                </div>
              </div>

              <!-- Tab 3: Glossary (Definitions list) -->
              <div
                v-else-if="activeTab === 'glossary'"
                class="space-y-4 animate-fade-in"
              >
                <span
                  class="font-bold text-sm text-highlighted block pb-1 border-b border-default"
                  >Key Glossary & Concepts</span
                >
                <div
                  v-if="activeLesson.glossaries?.length"
                  class="grid sm:grid-cols-2 gap-3.5"
                >
                  <div
                    v-for="g in activeLesson.glossaries"
                    :key="g.id"
                    class="p-3.5 rounded-xl border border-default bg-elevated/30 space-y-1.5 shadow-sm"
                  >
                    <div
                      class="text-xs font-bold text-primary flex items-center gap-1"
                    >
                      <UIcon name="i-lucide-help-circle" />
                      {{ g.term }}
                    </div>
                    <div class="text-xs text-muted leading-relaxed">
                      {{ g.definition }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-10 text-muted text-xs">
                  No glossary terms generated for this lesson.
                </div>
              </div>

              <!-- Tab 4: Resources (Links) -->
              <div
                v-else-if="activeTab === 'resources'"
                class="space-y-4 animate-fade-in"
              >
                <span
                  class="font-bold text-sm text-highlighted block pb-1 border-b border-default"
                  >Curated Documentation & Videos</span
                >
                <div
                  v-if="activeLesson.resources?.length"
                  class="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <template v-for="r in activeLesson.resources" :key="r.id">
                    <!-- YouTube Video Embed -->
                    <div
                      v-if="r.type === 'VIDEO' && isYouTubeUrl(r.url)"
                      class="md:col-span-2 p-4 rounded-xl border border-default bg-elevated/20 space-y-3 shadow-sm flex flex-col"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span
                          class="text-xs font-bold text-highlighted flex items-center gap-1.5"
                        >
                          <UIcon
                            name="i-lucide-play-circle"
                            class="text-primary"
                          />
                          {{ r.title }}
                        </span>
                        <UBadge
                          label="YOUTUBE"
                          color="primary"
                          size="sm"
                          variant="subtle"
                        />
                      </div>
                      <div
                        class="aspect-video rounded-xl overflow-hidden border border-default shadow-inner bg-black"
                      >
                        <iframe
                          :src="getYouTubeEmbedUrl(r.url)"
                          class="w-full h-full"
                          frameborder="0"
                          allow="
                            accelerometer;
                            autoplay;
                            clipboard-write;
                            encrypted-media;
                            gyroscope;
                            picture-in-picture;
                          "
                          allowfullscreen
                        />
                      </div>
                      <div
                        v-if="r.description"
                        class="text-[11px] text-muted leading-relaxed"
                      >
                        {{ r.description }}
                      </div>
                    </div>

                    <!-- General Resource Links -->
                    <a
                      v-else
                      :href="resolveResourceUrl(r)"
                      target="_blank"
                      class="p-4 rounded-xl border border-default bg-elevated/20 hover:border-primary/50 hover:shadow-md transition-all duration-300 block space-y-1.5 group"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span
                          class="text-xs font-bold text-highlighted group-hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <UIcon
                            :name="
                              r.type === 'VIDEO'
                                ? 'i-lucide-play-circle'
                                : 'i-lucide-external-link'
                            "
                          />
                          {{ r.title }}
                        </span>
                        <UBadge
                          :label="r.type"
                          color="neutral"
                          size="sm"
                          variant="subtle"
                        />
                      </div>
                      <div
                        class="text-[11px] text-muted leading-relaxed line-clamp-2"
                        v-if="r.description"
                      >
                        {{ r.description }}
                      </div>
                    </a>
                  </template>
                </div>
                <div v-else class="text-center py-10 text-muted text-xs">
                  No resource links available for this lesson.
                </div>
              </div>

              <!-- Tab 5: Quizzes (Interactive question verification) -->
              <div
                v-else-if="activeTab === 'quiz'"
                class="space-y-4 animate-fade-in"
              >
                <div v-if="activeLesson.quizzes?.length">
                  <div
                    v-for="quiz in activeLesson.quizzes"
                    :key="quiz.id"
                    class="space-y-5"
                  >
                    <span
                      class="font-bold text-sm text-highlighted block pb-1 border-b border-default"
                      >{{ quiz.title }}</span
                    >

                    <div
                      v-for="(q, qIdx) in quiz.questions"
                      :key="q.id"
                      class="p-4 rounded-xl border border-default bg-elevated/20 space-y-4 shadow-sm"
                    >
                      <div
                        class="text-xs font-bold text-highlighted flex gap-1.5 items-start leading-relaxed"
                      >
                        <UBadge
                          :label="'Q' + (Number(qIdx) + 1)"
                          color="primary"
                          size="sm"
                          class="rounded-lg shrink-0"
                        />
                        <span>{{ q.questionText }}</span>
                      </div>

                      <!-- Options List -->
                      <div class="space-y-2">
                        <button
                          v-for="opt in q.options"
                          :key="opt"
                          @click="handleSelectAnswer(q.id, opt)"
                          class="w-full text-left p-3 rounded-lg border text-xs leading-relaxed transition-all duration-200 flex items-center justify-between gap-3"
                          :class="[
                            selectedAnswers[q.id] === opt
                              ? 'border-primary bg-primary/5 font-semibold text-primary'
                              : 'border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800',
                            submittedQuizzes[q.id] && q.correctAnswer === opt
                              ? 'bg-success/5 border-success text-success ring-1 ring-success/30'
                              : '',
                            submittedQuizzes[q.id] &&
                            selectedAnswers[q.id] === opt &&
                            q.correctAnswer !== opt
                              ? 'bg-error/5 border-error text-error'
                              : '',
                          ]"
                        >
                          <span>{{ opt }}</span>
                          <UIcon
                            v-if="
                              submittedQuizzes[q.id] && q.correctAnswer === opt
                            "
                            name="i-lucide-check-circle"
                            class="h-4 w-4 text-success shrink-0"
                          />
                          <UIcon
                            v-else-if="
                              submittedQuizzes[q.id] &&
                              selectedAnswers[q.id] === opt &&
                              q.correctAnswer !== opt
                            "
                            name="i-lucide-x-circle"
                            class="h-4 w-4 text-error shrink-0"
                          />
                        </button>
                      </div>

                      <!-- Submit Question button -->
                      <div
                        class="flex justify-end pt-1"
                        v-if="!submittedQuizzes[q.id]"
                      >
                        <UButton
                          color="primary"
                          size="xs"
                          :disabled="!selectedAnswers[q.id]"
                          @click="handleSubmitQuestion(q.id)"
                        >
                          Submit Answer
                        </UButton>
                      </div>

                      <!-- Explanation result box -->
                      <div
                        v-if="submittedQuizzes[q.id]"
                        class="p-3 bg-default border border-default rounded-lg text-[11px] leading-relaxed animate-fade-in"
                        :class="
                          selectedAnswers[q.id] === q.correctAnswer
                            ? 'text-success-700 bg-success/5 border-success/20'
                            : 'text-stone-700 dark:text-stone-200'
                        "
                      >
                        <div class="font-bold mb-1 flex items-center gap-1">
                          <UIcon name="i-lucide-info" />
                          {{
                            selectedAnswers[q.id] === q.correctAnswer
                              ? "Correct!"
                              : "Incorrect Answer"
                          }}
                        </div>
                        <div v-if="q.explanation">{{ q.explanation }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-10 text-muted text-xs">
                  No instant quiz generated for this lesson.
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

      <!-- Right Panel: AI Coach Chat Sidebar (4 cols, Hidden on Mobile) -->
      <div
        class="hidden lg:flex lg:col-span-4 flex-col border border-default bg-elevated/30 rounded-2xl overflow-hidden h-[calc(100vh-var(--ui-header-height)-4rem)]"
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
                class="px-3.5 py-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed shadow-sm"
                :class="
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-tl-none text-stone-800 dark:text-stone-100'
                "
              >
                <div
                  class="prose dark:prose-invert text-xs max-w-none text-inherit"
                  v-html="
                    parseMarkdown(cleanMessageContent(getTextFromMessage(msg)))
                  "
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Chat message input prompt -->
        <div class="p-4 border-t border-default bg-elevated/50 sticky bottom-0">
          <!-- Floating autocomplete lesson list -->
          <div
            v-if="showLessonDropdown"
            class="absolute bottom-16 left-4 right-4 bg-white dark:bg-stone-900 border border-default rounded-xl shadow-lg p-2 max-h-48 overflow-y-auto z-50 space-y-1 animate-fade-in"
          >
            <div
              class="text-[10px] text-muted font-bold px-2 pb-1.5 border-b border-default uppercase tracking-wider"
            >
              Select a Lesson to Reference
            </div>
            <button
              v-for="lesson in filteredLessonsForDropdown"
              :key="lesson.id"
              @click="insertLessonMention(lesson)"
              class="w-full text-left px-2 py-1.5 text-xs hover:bg-primary/10 hover:text-primary rounded-lg cursor-pointer transition-colors flex items-center gap-2"
            >
              <UIcon
                :name="
                  lesson.type === 'VIDEO'
                    ? 'i-lucide-video'
                    : lesson.type === 'AUDIO'
                      ? 'i-lucide-headphones'
                      : lesson.type === 'PDF'
                        ? 'i-lucide-file'
                        : 'i-lucide-file-text'
                "
                class="w-3.5 h-3.5"
              />
              <span class="truncate">{{ lesson.title }}</span>
            </button>
          </div>

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

    <!-- Mobile Chat Floating Action Button (FAB) -->
    <UButton
      color="primary"
      size="xl"
      icon="i-lucide-sparkles"
      class="lg:hidden fixed bottom-6 right-6 z-40 rounded-full shadow-xl shadow-amber-500/25 h-14 w-14 flex items-center justify-center font-bold"
      @click="showMobileChat = true"
    />

    <!-- Mobile Chat Slide-over Drawer -->
    <Transition name="fade">
      <div
        v-if="showMobileChat"
        class="lg:hidden fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex justify-end"
        @click.self="showMobileChat = false"
      >
        <Transition
          name="slide-left"
          @after-leave="showMobileChat = false"
          appear
        >
          <div
            v-if="showMobileChat"
            class="w-full max-w-md bg-stone-50 dark:bg-stone-950 h-full shadow-2xl border-l border-stone-200 dark:border-stone-800 flex flex-col"
          >
            <!-- Mobile Chat Header -->
            <div
              class="px-4 py-3 border-b border-default bg-elevated/50 flex items-center justify-between"
            >
              <div class="flex items-center gap-2.5">
                <div class="rounded-full p-2 bg-primary/10 text-primary">
                  <UIcon name="i-lucide-sparkles" class="h-4 w-4" />
                </div>
                <div>
                  <div class="text-sm font-bold text-highlighted">
                    AI Learning Coach
                  </div>
                  <div
                    class="text-[10px] text-muted flex items-center gap-1 mt-0.5"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full bg-success animate-pulse"
                    />
                    Tuned to current lesson context
                  </div>
                </div>
              </div>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-x"
                @click="showMobileChat = false"
                class="rounded-xl"
              />
            </div>

            <!-- Mobile Chat messages view -->
            <div
              class="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4 bg-stone-50 dark:bg-stone-950"
            >
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
                    activeLesson?.title || roadmapQuery.data.value?.title
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
                    class="px-3.5 py-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed shadow-sm"
                    :class="
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-tr-none'
                        : 'bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-tl-none text-stone-800 dark:text-stone-100'
                    "
                  >
                    <div
                      class="prose dark:prose-invert text-xs max-w-none text-inherit"
                      v-html="
                        parseMarkdown(
                          cleanMessageContent(getTextFromMessage(msg)),
                        )
                      "
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Mobile Chat message input prompt -->
            <div
              class="p-4 border-t border-default bg-elevated/50 sticky bottom-0"
            >
              <!-- Floating autocomplete lesson list -->
              <div
                v-if="showLessonDropdown"
                class="absolute bottom-16 left-4 right-4 bg-white dark:bg-stone-900 border border-default rounded-xl shadow-lg p-2 max-h-48 overflow-y-auto z-50 space-y-1 animate-fade-in"
              >
                <div
                  class="text-[10px] text-muted font-bold px-2 pb-1.5 border-b border-default uppercase tracking-wider"
                >
                  Select a Lesson to Reference
                </div>
                <button
                  v-for="lesson in filteredLessonsForDropdown"
                  :key="lesson.id"
                  @click="insertLessonMention(lesson)"
                  class="w-full text-left px-2 py-1.5 text-xs hover:bg-primary/10 hover:text-primary rounded-lg cursor-pointer transition-colors flex items-center gap-2"
                >
                  <UIcon
                    :name="
                      lesson.type === 'VIDEO'
                        ? 'i-lucide-video'
                        : lesson.type === 'AUDIO'
                          ? 'i-lucide-headphones'
                          : lesson.type === 'PDF'
                            ? 'i-lucide-file'
                            : 'i-lucide-file-text'
                    "
                    class="w-3.5 h-3.5"
                  />
                  <span class="truncate">{{ lesson.title }}</span>
                </button>
              </div>

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
        </Transition>
      </div>
    </Transition>
  </UContainer>
</template>

<style scoped>
.prose {
  font-family: inherit;
}
.prose :deep(h1) {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--ui-text-highlighted);
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.prose :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ui-text-highlighted);
  margin-top: 1.25rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid var(--ui-border-default);
  padding-bottom: 0.25rem;
}
.prose :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
.prose :deep(p) {
  margin-top: 0.6rem;
  margin-bottom: 0.6rem;
  line-height: 1.6;
}
.prose :deep(ul) {
  list-style-type: disc;
  margin-left: 1.25rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding-left: 0.25rem;
}
.prose :deep(ol) {
  list-style-type: decimal;
  margin-left: 1.25rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding-left: 0.25rem;
}
.prose :deep(li) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}
.prose :deep(strong) {
  font-weight: 700;
  color: var(--ui-text-highlighted);
}
.prose :deep(code) {
  font-family: monospace;
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--ui-primary);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.85em;
  border: 1px solid var(--ui-border-default);
}
.prose :deep(pre) {
  background-color: #171717;
  color: #f5f5f5;
  padding: 1rem;
  border-radius: 0.75rem;
  font-family: monospace;
  font-size: 0.85em;
  overflow-x: auto;
  margin-top: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #262626;
}
.prose :deep(pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
  border: none;
  font-size: inherit;
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

/* Mobile chat transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.25s ease;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
}
</style>
