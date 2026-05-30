<script setup lang="ts">
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { Chat } from "@ai-sdk/vue";
import { getTextFromMessage } from "@nuxt/ui/utils/ai";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { ref, computed, watch } from "vue";

const { $authClient, $orpc } = useNuxtApp();
const queryClient = useQueryClient();

definePageMeta({
  middleware: ["auth"],
});

const session = $authClient.useSession();

// --- 1. Queries and Mutations ---
const profileQuery = useQuery({
  ...$orpc.onboarding.getProfile.queryOptions(),
  enabled: computed(() => !!session.value?.data?.user),
});

const roadmapsQuery = useQuery({
  ...$orpc.onboarding.getRoadmaps.queryOptions(),
  enabled: computed(
    () => !!session.value?.data?.user && !!profileQuery.data.value,
  ),
});

const onboardingMutation = useMutation(
  $orpc.onboarding.submit.mutationOptions({
    onSuccess: (data) => {
      // Invalidate queries to fetch updated profile and roadmap lists
      queryClient.invalidateQueries();
      activeRoadmap.value = data.roadmap;
      viewMode.value = "detail";
    },
  }),
);

// --- 2. State Management ---
const viewMode = ref<"dashboard" | "detail">("dashboard");
const activeRoadmap = ref<any>(null);
const activeLesson = ref<any>(null);

// Onboarding form state
const formStep = ref(1);
const onboardingForm = ref({
  learningGoals: "",
  experienceLevel: "beginner",
  learningStyle: "mixed",
  weeklyCommitment: 5,
  preferredDuration: "4 weeks",
  additionalNotes: "",
});

const loadingMessages = [
  "Mapping your custom learning path...",
  "Analyzing experience level guidelines...",
  "Assembling chapter structures...",
  "Generating detailed markdown lessons...",
  "Creating contextual quiz structures...",
  "Configuring your AI Learning Coach...",
];
const currentLoadingMessageIdx = ref(0);
let loadingInterval: any = null;

// Watch mutation to trigger loading interval message changes
watch(
  () => onboardingMutation.isPending.value,
  (isPending) => {
    if (isPending) {
      currentLoadingMessageIdx.value = 0;
      loadingInterval = setInterval(() => {
        currentLoadingMessageIdx.value =
          (currentLoadingMessageIdx.value + 1) % loadingMessages.length;
      }, 3500);
    } else {
      if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
      }
    }
  },
);

// Form step controls
function nextStep() {
  if (formStep.value < 3) formStep.value++;
}
function prevStep() {
  if (formStep.value > 1) formStep.value--;
}

function handleOnboardingSubmit() {
  if (!onboardingForm.value.learningGoals.trim()) return;
  onboardingMutation.mutate(onboardingForm.value);
}

// Select roadmap to view detail
function selectRoadmap(roadmap: any) {
  activeRoadmap.value = roadmap;
  viewMode.value = "detail";
  // Select first lesson of first chapter as default active lesson
  if (roadmap.chapters?.[0]?.lessons?.[0]) {
    activeLesson.value = roadmap.chapters[0].lessons[0];
  } else {
    activeLesson.value = null;
  }
}

// --- 3. Contextual AI Chat ---
const chatInput = ref("");
const chatMessages = ref<UIMessage[]>([]);
const aiApiUrl = `${useRuntimeConfig().public.serverUrl}/ai`;

let chatInstance = ref<Chat<any> | null>(null);

// Watch active lesson or active roadmap change to reinitialize chat with context
watch(
  [() => activeRoadmap.value?.id, () => activeLesson.value?.id],
  ([roadmapId, lessonId]) => {
    if (!roadmapId) {
      chatInstance.value = null;
      return;
    }

    // Prepare system instructions context
    const contextPrompt = `You are a world-class AI Learning Coach assisting the user on their learning journey.
Context details:
- Learning Roadmap: ${activeRoadmap.value.title}
- Target Goal: ${activeRoadmap.value.targetGoal}
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
              activeRoadmap.value.promptToLearn ||
              `Welcome to your learning journey for "${activeRoadmap.value.title}"! How can I help you tackle this lesson today?`,
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
  if (!chatInstance.value) return [];
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

// Clean up loading message index if component destroyed
onUnmounted(() => {
  if (loadingInterval) clearInterval(loadingInterval);
});
</script>

<template>
  <UContainer
    class="py-6 max-w-7xl min-h-[calc(100vh-var(--ui-header-height)-3rem)]"
  >
    <!-- --- Loading State --- -->
    <div
      v-if="profileQuery.status.value === 'pending'"
      class="flex h-[60vh] flex-col items-center justify-center gap-4"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="h-10 w-10 animate-spin text-primary"
      />
      <div class="text-muted text-sm">Loading your profile...</div>
    </div>

    <!-- --- Error State --- -->
    <UAlert
      v-else-if="profileQuery.status.value === 'error'"
      color="error"
      icon="i-lucide-alert-circle"
      title="Failed to load profile"
      :description="profileQuery.error.value?.message"
    />

    <!-- --- Step-by-Step Onboarding Form View --- -->
    <div
      v-else-if="
        !profileQuery.data.value && !onboardingMutation.isSuccess.value
      "
      class="mx-auto max-w-2xl py-6"
    >
      <!-- Loading Generation state -->
      <div
        v-if="onboardingMutation.isPending.value"
        class="flex flex-col items-center justify-center text-center py-20 px-4 space-y-6"
      >
        <div class="relative flex items-center justify-center">
          <div
            class="animate-ping absolute inline-flex h-20 w-20 rounded-full bg-primary/20 opacity-75"
          ></div>
          <div class="relative rounded-full p-6 bg-primary/10">
            <UIcon
              name="i-lucide-sparkles"
              class="h-12 w-12 text-primary animate-bounce"
            />
          </div>
        </div>
        <div class="space-y-2">
          <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
            Generating Your Personalized Roadmap
          </h2>
          <p
            class="text-muted text-sm max-w-md mx-auto h-8 flex items-center justify-center font-medium"
          >
            {{ loadingMessages[currentLoadingMessageIdx] }}
          </p>
        </div>
        <div
          class="w-full max-w-xs bg-default/40 rounded-full h-1.5 overflow-hidden"
        >
          <div
            class="bg-primary h-full rounded-full animate-pulse"
            :style="{
              width: `${((currentLoadingMessageIdx + 1) / loadingMessages.length) * 100}%`,
            }"
          ></div>
        </div>
      </div>

      <!-- Onboarding Wizard Card -->
      <UCard v-else class="shadow-md rounded-2xl border border-default">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <div
                class="text-xs font-semibold text-primary uppercase tracking-wider"
              >
                Step {{ formStep }} of 3
              </div>
              <div
                class="text-2xl font-bold tracking-tight text-highlighted mt-0.5"
              >
                Let's Customize Your Journey
              </div>
            </div>
            <div class="flex gap-1">
              <div
                v-for="step in 3"
                :key="step"
                class="h-1.5 w-8 rounded-full transition-all duration-300"
                :class="
                  step <= formStep
                    ? 'bg-primary'
                    : 'bg-default-300 bg-neutral-200'
                "
              />
            </div>
          </div>
        </template>

        <div class="py-4 space-y-6">
          <!-- Step 1: Goals -->
          <div v-if="formStep === 1" class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-sm font-semibold text-highlighted"
                >What are your learning goals?</label
              >
              <p class="text-xs text-muted">
                Tell us exactly what tools, stack, or skills you want to learn.
                Be as specific or broad as you like.
              </p>
              <UTextarea
                v-model="onboardingForm.learningGoals"
                placeholder="e.g. I want to build interactive modern web applications using Nuxt 3, Tailwind CSS, and learn how to expose robust type-safe backend APIs with Node.js and SQLite."
                :rows="4"
                class="mt-2 w-full"
                required
              />
            </div>
          </div>

          <!-- Step 2: Experience & Commitment -->
          <div v-if="formStep === 2" class="space-y-5">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-highlighted"
                >What is your experience level in this area?</label
              >
              <div class="grid grid-cols-3 gap-3">
                <UButton
                  v-for="level in ['beginner', 'intermediate', 'advanced']"
                  :key="level"
                  :color="
                    onboardingForm.experienceLevel === level
                      ? 'primary'
                      : 'neutral'
                  "
                  :variant="
                    onboardingForm.experienceLevel === level ? 'solid' : 'soft'
                  "
                  class="justify-center capitalize font-medium rounded-xl py-3"
                  @click="onboardingForm.experienceLevel = level"
                >
                  {{ level }}
                </UButton>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-2">
              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-highlighted"
                  >Weekly commitment (Hours)</label
                >
                <UInput
                  v-model.number="onboardingForm.weeklyCommitment"
                  type="number"
                  min="1"
                  max="168"
                  class="w-full"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-highlighted"
                  >Preferred duration</label
                >
                <USelect
                  v-model="onboardingForm.preferredDuration"
                  :items="[
                    '2 weeks',
                    '4 weeks',
                    '6 weeks',
                    '8 weeks',
                    '12 weeks',
                  ]"
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <!-- Step 3: Style & Notes -->
          <div v-if="formStep === 3" class="space-y-5">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-highlighted"
                >Preferred learning style</label
              >
              <p class="text-xs text-muted">
                We will custom shape content, markdown files, resources and
                prompts to best match your favorite way of learning.
              </p>
              <div class="grid grid-cols-3 gap-3 mt-2">
                <UButton
                  v-for="style in ['document', 'video', 'mixed']"
                  :key="style"
                  :color="
                    onboardingForm.learningStyle === style
                      ? 'primary'
                      : 'neutral'
                  "
                  :variant="
                    onboardingForm.learningStyle === style ? 'solid' : 'soft'
                  "
                  class="justify-center capitalize font-medium rounded-xl py-3"
                  @click="onboardingForm.learningStyle = style"
                >
                  {{ style }}
                </UButton>
              </div>
            </div>

            <div class="space-y-1.5 pt-2">
              <label class="text-sm font-semibold text-highlighted"
                >Additional notes (Optional)</label
              >
              <UTextarea
                v-model="onboardingForm.additionalNotes"
                placeholder="e.g. I already know CSS and basic JavaScript, but have zero experience with server side frameworks or rendering."
                :rows="3"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-between">
            <UButton
              v-if="formStep > 1"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-left"
              @click="prevStep"
            >
              Back
            </UButton>
            <div v-else />

            <div class="flex gap-2">
              <UButton
                v-if="formStep < 3"
                color="primary"
                trailing-icon="i-lucide-arrow-right"
                :disabled="
                  formStep === 1 && !onboardingForm.learningGoals.trim()
                "
                @click="nextStep"
              >
                Next
              </UButton>

              <UButton
                v-else
                color="primary"
                icon="i-lucide-sparkles"
                @click="handleOnboardingSubmit"
              >
                Generate Roadmap
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </div>

    <!-- --- Main Dashboard / Roadmap View --- -->
    <div v-else-if="viewMode === 'dashboard'" class="space-y-6 animate-fade-in">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-default pb-5"
      >
        <div>
          <h1
            class="text-3xl font-extrabold tracking-tight text-highlighted sm:text-4xl"
          >
            Your Learning Center
          </h1>
          <p class="text-muted text-sm mt-1">
            Access your generated curriculum pathways and interact with your AI
            tutor.
          </p>
        </div>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-plus"
          @click="
            profileQuery.refetch() // This can let them restart onboarding if profile is cleared
          "
          class="self-start md:self-auto rounded-xl"
        >
          Create New Roadmap
        </UButton>
      </div>

      <!-- General Statistics -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UCard class="p-2 border border-default bg-elevated/40">
          <div class="flex items-center gap-3">
            <div class="rounded-lg p-2.5 bg-primary/10 text-primary">
              <UIcon name="i-lucide-book-open" class="h-6 w-6" />
            </div>
            <div>
              <div class="text-xs text-muted font-medium">
                Pathways Enrolled
              </div>
              <div class="text-xl font-bold text-highlighted">
                {{ roadmapsQuery.data.value?.length || 0 }} Active
              </div>
            </div>
          </div>
        </UCard>

        <UCard class="p-2 border border-default bg-elevated/40">
          <div class="flex items-center gap-3">
            <div class="rounded-lg p-2.5 bg-success/10 text-success">
              <UIcon name="i-lucide-graduation-cap" class="h-6 w-6" />
            </div>
            <div>
              <div class="text-xs text-muted font-medium">Learning Style</div>
              <div class="text-xl font-bold text-highlighted capitalize">
                {{ profileQuery.data.value?.learningStyle }}
              </div>
            </div>
          </div>
        </UCard>

        <UCard class="p-2 border border-default bg-elevated/40">
          <div class="flex items-center gap-3">
            <div class="rounded-lg p-2.5 bg-warning/10 text-warning">
              <UIcon name="i-lucide-calendar" class="h-6 w-6" />
            </div>
            <div>
              <div class="text-xs text-muted font-medium">
                Weekly Commitment
              </div>
              <div class="text-xl font-bold text-highlighted">
                {{ profileQuery.data.value?.weeklyCommitment }} Hours/Week
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Roadmaps Grid in Card Format -->
      <div class="space-y-4 pt-4">
        <h2
          class="text-xl font-semibold tracking-tight text-highlighted flex items-center gap-2"
        >
          <UIcon name="i-lucide-compass" />
          Your Curriculums
        </h2>

        <div
          v-if="roadmapsQuery.status.value === 'pending'"
          class="grid sm:grid-cols-2 gap-4"
        >
          <USkeleton v-for="i in 2" :key="i" class="h-44 w-full rounded-2xl" />
        </div>

        <UEmpty
          v-else-if="!roadmapsQuery.data.value?.length"
          icon="i-lucide-route"
          title="No roadmaps yet"
          description="Click 'Create New Roadmap' to get customized AI learning paths."
        />

        <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <UCard
            v-for="roadmap in roadmapsQuery.data.value"
            :key="roadmap.id"
            class="hover:shadow-lg hover:border-primary/40 transition-all duration-300 cursor-pointer border border-default rounded-2xl flex flex-col justify-between"
            @click="selectRoadmap(roadmap)"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between">
                <UBadge
                  :label="roadmap.targetGoal"
                  color="primary"
                  variant="subtle"
                />
                <div class="text-xs text-muted flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" />
                  {{ new Date(roadmap.createdAt).toLocaleDateString() }}
                </div>
              </div>

              <div>
                <h3
                  class="text-lg font-bold text-highlighted line-clamp-1 hover:text-primary transition-colors"
                >
                  {{ roadmap.title }}
                </h3>
                <p class="text-muted text-xs line-clamp-2 mt-1">
                  {{ roadmap.description }}
                </p>
              </div>
            </div>

            <template #footer>
              <div
                class="flex items-center justify-between text-xs text-muted pt-2 border-t border-default"
              >
                <span class="flex items-center gap-1 font-medium">
                  <UIcon name="i-lucide-folder" />
                  {{ roadmap.chapters?.length }} Chapters
                </span>
                <span
                  class="text-primary font-semibold flex items-center gap-0.5"
                >
                  Learn
                  <UIcon name="i-lucide-chevron-right" />
                </span>
              </div>
            </template>
          </UCard>
        </div>
      </div>
    </div>

    <!-- --- Detail Active Roadmap and Syllabus View --- -->
    <div
      v-else-if="viewMode === 'detail' && activeRoadmap"
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
            @click="viewMode = 'dashboard'"
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
            {{ activeRoadmap.title }}
          </h1>
          <p class="text-muted text-sm leading-relaxed max-w-3xl">
            {{ activeRoadmap.description }}
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
                v-for="(chapter, cIdx) in activeRoadmap.chapters"
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
                activeLesson?.title || activeRoadmap.title
              }}". I can write code, explain details or test your knowledge!
            </p>
          </div>

          <!-- Chat logs list -->
          <div v-else class="space-y-4">
            <div
              v-for="msg in chatInstance.messages.filter(
                (m) => m.role !== 'system',
              )"
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
