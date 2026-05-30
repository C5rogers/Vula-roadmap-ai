<script setup lang="ts">
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { ref, computed, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";

const { $authClient, $orpc } = useNuxtApp();
const queryClient = useQueryClient();
const router = useRouter();

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
      // Navigate to the newly created roadmap details page
      router.push(`/roadmaps/${data.roadmap.id}`);
    },
  }),
);

// --- 2. Onboarding form state ---
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

// Navigate to details page for selected roadmap
function selectRoadmap(roadmap: any) {
  router.push(`/roadmaps/${roadmap.id}`);
}

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

    <!-- --- Main Dashboard View --- -->
    <div v-else class="space-y-6 animate-fade-in">
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
  </UContainer>
</template>

<style scoped>
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
