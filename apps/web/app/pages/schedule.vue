<script setup lang="ts">
import { useQuery, useQueryClient } from "@tanstack/vue-query";

definePageMeta({
  middleware: ["auth"],
  layout: "dashboard",
});

const { $authClient, $orpc } = useNuxtApp();
const session = $authClient.useSession();
const router = useRouter();

// Fetch schedule across all roadmaps
const scheduleQuery = useQuery({
  ...$orpc.onboarding.getSchedule.queryOptions(),
  enabled: computed(() => !!session.value?.data?.user),
});

// View state
const viewMode = ref<"year" | "month" | "day">("month");
const currentDate = ref(new Date());

const selectedYear = ref(currentDate.value.getFullYear());
const selectedMonth = ref(currentDate.value.getMonth()); // 0-11
const selectedDay = ref(currentDate.value.getDate());

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Navigate months
function prevMonth() {
  if (selectedMonth.value === 0) {
    selectedMonth.value = 11;
    selectedYear.value--;
  } else {
    selectedMonth.value--;
  }
}

function nextMonth() {
  if (selectedMonth.value === 11) {
    selectedMonth.value = 0;
    selectedYear.value++;
  } else {
    selectedMonth.value++;
  }
}

// Navigate years
function prevYear() {
  selectedYear.value--;
}

function nextYear() {
  selectedYear.value++;
}

// Group scheduled lessons by date (YYYY-MM-DD)
const scheduledLessonsMap = computed(() => {
  const lessons = scheduleQuery.data.value || [];
  const map: Record<string, any[]> = {};

  for (const lesson of lessons) {
    if (lesson.scheduledDate) {
      const d = new Date(lesson.scheduledDate);
      const key = d.toISOString().split("T")[0] ?? "";
      if (key) {
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push(lesson);
      }
    }
  }

  return map;
});

// Grid data for selected month
const calendarDays = computed(() => {
  const year = selectedYear.value;
  const month = selectedMonth.value;

  // First day of the month
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 is Sunday, etc.

  // Total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days: {
    date: Date | null;
    dayNum: number | null;
    dateStr: string;
    lessons: any[];
    completedCount: number;
    isToday: boolean;
  }[] = [];

  // Padding days from previous month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push({
      date: null,
      dayNum: null,
      dateStr: "",
      lessons: [],
      completedCount: 0,
      isToday: false,
    });
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0] ?? "";

  // Days of current month
  for (let i = 1; i <= totalDays; i++) {
    const date = new Date(year, month, i);
    const dateStr = date.toISOString().split("T")[0] ?? "";
    const lessons = scheduledLessonsMap.value[dateStr] || [];
    const completedCount = lessons.filter((l) => l.isCompleted).length;

    days.push({
      date,
      dayNum: i,
      dateStr,
      lessons,
      completedCount,
      isToday: dateStr === todayStr,
    });
  }

  return days;
});

// Yearly statistics / monthly breakdown
const yearlyBreakdown = computed(() => {
  const year = selectedYear.value;
  const list = [];

  for (let m = 0; m < 12; m++) {
    // Total days in month m
    const totalDays = new Date(year, m + 1, 0).getDate();
    let lessonsCount = 0;
    let completedCount = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const lessons = scheduledLessonsMap.value[dateStr] || [];
      lessonsCount += lessons.length;
      completedCount += lessons.filter((l) => l.isCompleted).length;
    }

    list.push({
      monthIdx: m,
      monthName: MONTH_NAMES[m] || "",
      lessonsCount,
      completedCount,
      percent:
        lessonsCount > 0
          ? Math.round((completedCount / lessonsCount) * 100)
          : 0,
    });
  }

  return list;
});

// Daily view agenda list
const selectedDateStr = computed(() => {
  const m = String(selectedMonth.value + 1).padStart(2, "0");
  const d = String(selectedDay.value).padStart(2, "0");
  return `${selectedYear.value}-${m}-${d}`;
});

const dailyLessons = computed(() => {
  return scheduledLessonsMap.value[selectedDateStr.value] || [];
});

const dailyProgress = computed(() => {
  const lessons = dailyLessons.value;
  const total = lessons.length;
  const completed = lessons.filter((l) => l.isCompleted).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return {
    total,
    completed,
    percent,
  };
});

function selectMonthFromYear(monthIdx: number) {
  selectedMonth.value = monthIdx;
  viewMode.value = "month";
}

function selectDayFromMonth(day: any) {
  if (day.dayNum) {
    selectedDay.value = day.dayNum;
    viewMode.value = "day";
  }
}

function handleGoToStudy(roadmapId: string) {
  router.push(`/roadmaps/${roadmapId}`);
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Schedule Page Header -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-5"
    >
      <div class="text-left">
        <h1
          class="text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-50"
        >
          Your Learning Schedule
        </h1>
        <p
          class="text-stone-500 dark:text-stone-400 text-xs mt-1 leading-relaxed"
        >
          Manage, track, and navigate scheduled study goals dynamically. Stay in
          sync across all active curriculums.
        </p>
      </div>

      <!-- View Selector (Yearly, Monthly, Daily) -->
      <div
        class="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl self-start md:self-auto shadow-inner"
      >
        <UButton
          size="xs"
          :variant="viewMode === 'year' ? 'solid' : 'ghost'"
          :color="viewMode === 'year' ? 'primary' : 'neutral'"
          class="rounded-lg px-3"
          @click="viewMode = 'year'"
        >
          Yearly
        </UButton>
        <UButton
          size="xs"
          :variant="viewMode === 'month' ? 'solid' : 'ghost'"
          :color="viewMode === 'month' ? 'primary' : 'neutral'"
          class="rounded-lg px-3"
          @click="viewMode = 'month'"
        >
          Monthly
        </UButton>
        <UButton
          size="xs"
          :variant="viewMode === 'day' ? 'solid' : 'ghost'"
          :color="viewMode === 'day' ? 'primary' : 'neutral'"
          class="rounded-lg px-3"
          @click="viewMode = 'day'"
        >
          Daily View
        </UButton>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="scheduleQuery.status.value === 'pending'"
      class="flex h-[50vh] flex-col items-center justify-center gap-3 animate-fade-in"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="h-8 w-8 animate-spin text-amber-500"
      />
      <span
        class="text-xs text-stone-500 font-semibold uppercase tracking-wider"
        >Syncing Schedule calendar...</span
      >
    </div>

    <!-- Error State -->
    <UAlert
      v-else-if="scheduleQuery.status.value === 'error'"
      color="error"
      icon="i-lucide-alert-circle"
      title="Failed to load schedule"
      :description="scheduleQuery.error.value?.message"
    />

    <!-- Main Dynamic Viewer Content -->
    <div v-else class="space-y-6">
      <!-- CASE A: YEARLY VIEW -->
      <div
        v-if="viewMode === 'year'"
        class="space-y-6 animate-fade-in text-left"
      >
        <!-- Calendar Controls -->
        <div
          class="flex items-center justify-between bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-2xl shadow-sm"
        >
          <div class="text-lg font-bold text-stone-900 dark:text-stone-50">
            Year {{ selectedYear }}
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-chevron-left"
              class="rounded-lg"
              @click="prevYear"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-chevron-right"
              class="rounded-lg"
              @click="nextYear"
            />
          </div>
        </div>

        <!-- 12 Months Grid -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <UCard
            v-for="month in yearlyBreakdown"
            :key="month.monthIdx"
            class="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 hover:border-amber-500/50 dark:hover:border-amber-500/50 hover:shadow-md transition-all duration-300 cursor-pointer"
            @click="selectMonthFromYear(month.monthIdx)"
          >
            <div class="space-y-3">
              <div
                class="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2"
              >
                <span class="font-bold text-stone-900 dark:text-white text-sm">
                  {{ month.monthName }}
                </span>
                <UIcon
                  name="i-lucide-calendar"
                  class="text-stone-400 dark:text-stone-500 h-4 w-4"
                />
              </div>

              <!-- Stats details -->
              <div class="space-y-2">
                <div class="flex justify-between text-xs">
                  <span class="text-stone-500 dark:text-stone-400"
                    >Goals Scheduled</span
                  >
                  <span class="font-bold text-stone-900 dark:text-white"
                    >{{ month.lessonsCount }} lessons</span
                  >
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-stone-500 dark:text-stone-400"
                    >Completed</span
                  >
                  <span class="font-bold text-green-600 dark:text-green-400"
                    >{{ month.completedCount }} lessons</span
                  >
                </div>

                <!-- Monthly progress visual bar -->
                <div class="space-y-1 pt-1">
                  <div
                    class="flex justify-between text-[10px] font-bold text-stone-400 dark:text-stone-500"
                  >
                    <span>PROGRESS</span>
                    <span>{{ month.percent }}%</span>
                  </div>
                  <div
                    class="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1 overflow-hidden"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="
                        month.percent === 100 ? 'bg-green-500' : 'bg-amber-500'
                      "
                      :style="{ width: `${month.percent}%` }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <!-- CASE B: MONTHLY VIEW -->
      <div
        v-else-if="viewMode === 'month'"
        class="space-y-6 animate-fade-in text-left"
      >
        <!-- Month Controls -->
        <div
          class="flex items-center justify-between bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-2xl shadow-sm"
        >
          <div class="text-lg font-bold text-stone-900 dark:text-stone-50">
            {{ MONTH_NAMES[selectedMonth] }} {{ selectedYear }}
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-chevron-left"
              class="rounded-lg"
              @click="prevMonth"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-chevron-right"
              class="rounded-lg"
              @click="nextMonth"
            />
          </div>
        </div>

        <!-- Monthly Calendar Grid Layout -->
        <div
          class="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-white dark:bg-stone-900/50 shadow-sm"
        >
          <!-- Calendar Days Header -->
          <div
            class="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50"
          >
            <div
              v-for="dayName in WEEK_DAYS"
              :key="dayName"
              class="py-3 text-center text-xs font-bold text-stone-500 dark:text-stone-400 border-r last:border-r-0 border-stone-200 dark:border-stone-800"
            >
              {{ dayName }}
            </div>
          </div>

          <!-- Calendar Days Grid -->
          <div class="grid grid-cols-7">
            <div
              v-for="(day, idx) in calendarDays"
              :key="idx"
              class="min-h-[110px] p-2 border-b border-r last:border-r-0 last:border-b-0 border-stone-200 dark:border-stone-800 transition-colors flex flex-col justify-between"
              :class="[
                day.dayNum
                  ? 'hover:bg-amber-500/5 cursor-pointer bg-white dark:bg-stone-900/10'
                  : 'bg-stone-100/50 dark:bg-stone-950/20',
                day.isToday
                  ? 'bg-amber-500/5 dark:bg-amber-500/5 border-2 border-amber-500/50'
                  : '',
              ]"
              @click="selectDayFromMonth(day)"
            >
              <!-- Day Num & indicators -->
              <div class="flex items-center justify-between">
                <span
                  class="text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
                  :class="[
                    day.isToday
                      ? 'bg-amber-500 text-white font-extrabold'
                      : 'text-stone-900 dark:text-white',
                    !day.dayNum ? 'opacity-30' : '',
                  ]"
                >
                  {{ day.dayNum }}
                </span>

                <!-- Lesson completion indicators -->
                <div
                  v-if="day.lessons.length > 0"
                  class="flex items-center gap-1"
                >
                  <span
                    class="text-[10px] font-bold text-muted px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 border border-default/60"
                  >
                    {{ day.completedCount }}/{{ day.lessons.length }}
                  </span>
                </div>
              </div>

              <!-- List mini labels of scheduled events -->
              <div
                v-if="day.dayNum && day.lessons.length > 0"
                class="space-y-1 mt-2"
              >
                <div
                  v-for="lesson in day.lessons.slice(0, 2)"
                  :key="lesson.id"
                  class="text-[9px] px-1.5 py-0.5 rounded border leading-tight truncate text-left"
                  :class="[
                    lesson.isCompleted
                      ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400 font-medium'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium',
                  ]"
                >
                  {{ lesson.title }}
                </div>
                <div
                  v-if="day.lessons.length > 2"
                  class="text-[8px] text-stone-400 dark:text-stone-500 text-left pl-1 font-bold"
                >
                  + {{ day.lessons.length - 2 }} more...
                </div>
              </div>
              <div v-else />
            </div>
          </div>
        </div>
      </div>

      <!-- CASE C: DAILY AGENDA VIEW -->
      <div
        v-else-if="viewMode === 'day'"
        class="space-y-6 animate-fade-in text-left"
      >
        <!-- Day Picker panel -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-2xl shadow-sm"
        >
          <div class="flex items-center gap-3">
            <div class="rounded-full p-3 bg-amber-500/10 text-amber-500">
              <UIcon name="i-lucide-calendar-days" class="h-6 w-6" />
            </div>
            <div>
              <h2
                class="text-base font-extrabold text-stone-950 dark:text-white"
              >
                {{ MONTH_NAMES[selectedMonth] }} {{ selectedDay }},
                {{ selectedYear }}
              </h2>
              <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Detailed study goals for today.
              </p>
            </div>
          </div>

          <!-- Quick back to month button -->
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-arrow-left"
            class="rounded-xl rounded-l-xl self-start sm:self-auto"
            @click="viewMode = 'month'"
          >
            Back to Calendar
          </UButton>
        </div>

        <!-- Progress aggregation stats for this specific day -->
        <div
          v-if="dailyLessons.length > 0"
          class="p-5 border border-stone-200 dark:border-stone-800 rounded-2xl bg-white dark:bg-stone-900/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div class="space-y-1 text-center md:text-left w-full md:w-auto">
            <h3 class="text-sm font-bold text-stone-900 dark:text-white">
              Aggregated Progress
            </h3>
            <p
              class="text-xs text-stone-500 dark:text-stone-400 max-w-sm leading-relaxed"
            >
              Complete scheduled blocks to maintain velocity. Study time
              aggregates automatically as you work!
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-6 justify-center">
            <div class="flex flex-col items-center">
              <span
                class="text-xl font-extrabold text-stone-950 dark:text-white"
              >
                {{ dailyProgress.completed }} / {{ dailyProgress.total }}
              </span>
              <span
                class="text-[10px] text-stone-400 uppercase font-bold tracking-wider"
                >Lessons Done</span
              >
            </div>

            <!-- Aggregated progress circular style or horizontal bar -->
            <div class="flex flex-col items-center">
              <div class="flex items-center gap-2">
                <span class="text-xl font-extrabold text-amber-500">
                  {{ dailyProgress.percent }}%
                </span>
                <UIcon
                  name="i-lucide-rocket"
                  class="h-5 w-5 text-amber-500 animate-bounce"
                />
              </div>
              <span
                class="text-[10px] text-stone-400 uppercase font-bold tracking-wider"
                >Completion Velocity</span
              >
            </div>
          </div>
        </div>

        <!-- Agenda Agenda List list -->
        <div
          v-if="dailyLessons.length === 0"
          class="flex flex-col items-center justify-center text-center p-10 border border-stone-200 border-dashed rounded-2xl min-h-[35vh] bg-white/50 dark:bg-stone-900/10"
        >
          <UIcon
            name="i-lucide-coffee"
            class="h-8 w-8 text-stone-400 dark:text-stone-500 mb-2"
          />
          <div class="font-bold text-stone-900 dark:text-white text-sm">
            Rest & Recharge Day
          </div>
          <p
            class="text-xs text-stone-500 dark:text-stone-400 max-w-sm mt-1 leading-relaxed"
          >
            No study goals are scheduled for today! Use this time to review
            glossaries, practice flashcards, or take a well-deserved study
            break.
          </p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UCard
            v-for="lesson in dailyLessons"
            :key="lesson.id"
            class="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300"
          >
            <div class="space-y-4 text-left">
              <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <span
                    class="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider block"
                  >
                    {{ lesson.roadmapTitle }}
                  </span>
                  <h3
                    class="text-sm font-bold text-stone-950 dark:text-white leading-snug"
                  >
                    {{ lesson.title }}
                  </h3>
                </div>

                <div
                  class="rounded-xl p-2 bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500 border border-stone-200 dark:border-stone-700"
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
                    class="h-5 w-5"
                  />
                </div>
              </div>

              <!-- Media details -->
              <div
                class="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400"
              >
                <UIcon name="i-lucide-hash" class="h-3.5 w-3.5" />
                <span>{{ lesson.chapterTitle }}</span>
              </div>

              <div
                class="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800 mt-2"
              >
                <div class="flex items-center gap-1.5 text-xs">
                  <UIcon
                    :name="
                      lesson.isCompleted
                        ? 'i-lucide-check-circle-2'
                        : 'i-lucide-circle'
                    "
                    class="h-4 w-4"
                    :class="
                      lesson.isCompleted ? 'text-green-500' : 'text-stone-400'
                    "
                  />
                  <span class="font-medium text-stone-600 dark:text-stone-300">
                    {{ lesson.isCompleted ? "Completed" : "Scheduled Agenda" }}
                  </span>
                  <span
                    v-if="lesson.timeSpent > 0"
                    class="text-[10px] text-stone-400 font-normal ml-1"
                  >
                    (studied {{ Math.round(lesson.timeSpent / 60) }}m)
                  </span>
                </div>

                <UButton
                  color="primary"
                  size="xs"
                  icon="i-lucide-book-open"
                  class="rounded-xl px-3"
                  @click="handleGoToStudy(lesson.roadmapId)"
                >
                  Start Studying
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
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
