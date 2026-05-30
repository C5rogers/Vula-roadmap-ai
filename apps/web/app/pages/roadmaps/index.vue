<script setup lang="ts">
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";

definePageMeta({
  middleware: ["auth"],
  layout: "dashboard",
});

const { $authClient, $orpc } = useNuxtApp();
const queryClient = useQueryClient();
const router = useRouter();

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

// Polling query for background generation progress
const isGenerating = ref(false);
const generationProgressPercent = ref(0);
const generationMessage = ref("");

const generationStatusQuery = useQuery({
  ...$orpc.onboarding.getGenerationStatus.queryOptions(),
  enabled: computed(() => !!session.value?.data?.user && isGenerating.value),
  refetchInterval: computed(() => (isGenerating.value ? 1500 : false)),
});

// Watch polling results to update UI progress and handle completion
watch(
  () => generationStatusQuery.data.value,
  (status) => {
    if (!status) return;

    if (status.status === "generating") {
      generationProgressPercent.value = status.progress;
      generationMessage.value = status.message;
    } else if (status.status === "complete" && status.roadmapId) {
      generationProgressPercent.value = 100;
      generationMessage.value = "Complete! Launching curriculum...";
      isGenerating.value = false;

      // Invalidate queries to fetch updated profile and roadmaps lists
      queryClient.invalidateQueries();

      // Redirect to the newly generated roadmap details page
      router.push(`/roadmaps/${status.roadmapId}`);
    } else if (status.status === "error") {
      isGenerating.value = false;
      generationProgressPercent.value = 0;
      generationMessage.value = "";
      alert(status.message || "Failed to generate roadmap. Please try again.");
    }
  },
);

const onboardingMutation = useMutation(
  $orpc.onboarding.submit.mutationOptions({
    onSuccess: () => {
      // Submit successful! Transition to polling state
      isGenerating.value = true;
      generationProgressPercent.value = 5;
      generationMessage.value = "Saving your profile preferences...";
    },
  }),
);

// --- 2. Onboarding form state ---
const isCreatingRoadmap = ref(false);
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

function startNewRoadmap() {
  isCreatingRoadmap.value = true;
  formStep.value = 1;
  onboardingForm.value = {
    learningGoals: "",
    experienceLevel: "beginner",
    learningStyle: "mixed",
    weeklyCommitment: 5,
    preferredDuration: "4 weeks",
    additionalNotes: "",
  };
}

// Calculate exact curriculum progress percentage dynamically!
function getRoadmapProgress(roadmap: any): number {
  if (!roadmap?.chapters) return 0;
  let totalLessons = 0;
  let completedLessons = 0;
  for (const chapter of roadmap.chapters) {
    if (chapter.lessons) {
      for (const lesson of chapter.lessons) {
        totalLessons++;
        if (lesson.progress?.[0]?.isCompleted) {
          completedLessons++;
        }
      }
    }
  }
  if (totalLessons === 0) return 0;
  return Math.round((completedLessons / totalLessons) * 100);
}

onUnmounted(() => {
  if (loadingInterval) clearInterval(loadingInterval);
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- --- Loading State --- -->
    <div
      v-if="
        profileQuery.status.value === 'pending' ||
        roadmapsQuery.status.value === 'pending'
      "
      class="flex h-[60vh] flex-col items-center justify-center gap-4 animate-fade-in"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="h-8 w-8 animate-spin text-amber-500"
      />
      <div
        class="text-stone-500 dark:text-stone-400 text-xs font-semibold tracking-wider uppercase"
      >
        Loading your roadmaps...
      </div>
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
        (!profileQuery.data.value || isCreatingRoadmap) &&
        !onboardingMutation.isSuccess.value
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
            class="animate-ping absolute inline-flex h-20 w-20 rounded-full bg-amber-500/20 opacity-75"
          ></div>
          <div
            class="relative rounded-full p-6 bg-amber-500/10 border border-amber-500/20"
          >
            <UIcon
              name="i-lucide-sparkles"
              class="h-12 w-12 text-amber-500 animate-bounce"
            />
          </div>
        </div>
        <div class="space-y-2">
          <h2
            class="text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-50"
          >
            Generating Your Personalized Roadmap
          </h2>
          <p
            class="text-stone-500 dark:text-stone-400 text-sm max-w-md mx-auto h-8 flex items-center justify-center font-medium"
          >
            {{ loadingMessages[currentLoadingMessageIdx] }}
          </p>
        </div>
        <div
          class="w-full max-w-xs bg-stone-200 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden"
        >
          <div
            class="bg-amber-500 h-full rounded-full animate-pulse"
            :style="{
              width: `${((currentLoadingMessageIdx + 1) / loadingMessages.length) * 100}%`,
            }"
          ></div>
        </div>
      </div>

      <!-- Onboarding Wizard Card (NO AI SLOP, clean handcrafted aesthetics) -->
      <UCard
        v-else
        class="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 backdrop-blur-sm shadow-sm"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <div
                class="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest"
              >
                Step {{ formStep }} of 3
              </div>
              <div
                class="text-xl font-bold tracking-tight text-stone-950 dark:text-stone-50 mt-1"
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
                    ? 'bg-amber-500'
                    : 'bg-stone-200 dark:bg-stone-800'
                "
              />
            </div>
          </div>
        </template>

        <div class="py-4 space-y-6 text-left">
          <!-- Step 1: Goals -->
          <div v-if="formStep === 1" class="space-y-4">
            <div class="space-y-2">
              <label
                class="text-sm font-bold text-stone-900 dark:text-stone-100"
                >What are your learning goals?</label
              >
              <p
                class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed"
              >
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
              <label
                class="text-sm font-bold text-stone-900 dark:text-stone-100"
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
                  class="justify-center capitalize font-medium rounded-xl py-3 border border-stone-200/50 dark:border-stone-800/50"
                  @click="onboardingForm.experienceLevel = level"
                >
                  {{ level }}
                </UButton>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-2">
              <div class="space-y-2">
                <label
                  class="text-sm font-bold text-stone-900 dark:text-stone-100"
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

              <div class="space-y-2">
                <label
                  class="text-sm font-bold text-stone-900 dark:text-stone-100"
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
              <label
                class="text-sm font-bold text-stone-900 dark:text-stone-100"
                >Preferred learning style</label
              >
              <p
                class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed"
              >
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
                  class="justify-center capitalize font-medium rounded-xl py-3 border border-stone-200/50 dark:border-stone-800/50"
                  @click="onboardingForm.learningStyle = style"
                >
                  {{ style }}
                </UButton>
              </div>
            </div>

            <div class="space-y-2 pt-2">
              <label
                class="text-sm font-bold text-stone-900 dark:text-stone-100"
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
            <UButton
              v-else-if="formStep === 1 && profileQuery.data.value"
              color="neutral"
              variant="ghost"
              @click="isCreatingRoadmap = false"
            >
              Cancel
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

    <!-- --- Main Roadmaps Grid View --- -->
    <div v-else class="space-y-6 animate-fade-in">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-5"
      >
        <div class="text-left">
          <h1
            class="text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-50"
          >
            Your Curriculum Roadmaps
          </h1>
          <p
            class="text-stone-500 dark:text-stone-400 text-xs mt-1 leading-relaxed"
          >
            Access your custom learning pathways. Describe your next goal to
            generate a new specialized curriculum.
          </p>
        </div>
        <UButton
          color="primary"
          variant="solid"
          icon="i-lucide-plus"
          @click="startNewRoadmap"
          class="self-start md:self-auto rounded-xl shadow-sm hover:shadow-md transition-shadow"
        >
          New Roadmap
        </UButton>
      </div>

      <!-- Empty state if no roadmaps -->
      <div
        v-if="!roadmapsQuery.data.value?.length"
        class="flex flex-col items-center justify-center text-center py-20 px-4 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-white/50 dark:bg-stone-900/10"
      >
        <div
          class="rounded-full p-4 bg-stone-100 dark:bg-stone-900 text-stone-400 dark:text-stone-500 mb-4"
        >
          <UIcon name="i-lucide-map" class="w-8 h-8" />
        </div>
        <h3 class="text-base font-bold text-stone-900 dark:text-white">
          No Roadmaps Yet
        </h3>
        <p
          class="text-xs text-stone-500 dark:text-stone-400 max-w-sm mt-1 leading-relaxed"
        >
          Unlock your next learning journey. Click "New Roadmap" above and let
          Roadie AI design a perfect, step-by-step syllabus for your targets.
        </p>
      </div>

      <!-- Curriculum Cards Grid (Premium Handcrafted Aesthetics, NO SLOP) -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CurriculumCard
          v-for="roadmap in roadmapsQuery.data.value"
          :key="roadmap.id"
          :title="roadmap.title"
          :description="roadmap.description"
          :progress="getRoadmapProgress(roadmap)"
          :href="`/roadmaps/${roadmap.id}`"
          :createdAt="new Date(roadmap.createdAt).toLocaleDateString()"
          :chapterCount="roadmap.chapters?.length || 0"
        />
      </div>
    </div>
  </div>
</template>
