<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";

definePageMeta({
  middleware: ["auth"],
  layout: "dashboard",
});

const { $authClient, $orpc } = useNuxtApp();
const session = $authClient.useSession();
const colorMode = useColorMode();

const profileQuery = useQuery({
  ...$orpc.onboarding.getProfile.queryOptions(),
  enabled: computed(() => !!session.value?.data?.user),
});

// Redirect to onboarding dashboard if they don't have a profile yet
watch(
  () => profileQuery.data.value,
  (profile) => {
    if (profileQuery.status.value === "success" && !profile) {
      navigateTo("/roadmaps", { replace: true });
    }
  },
  { immediate: true },
);

// Fetch enrolled roadmaps list
const roadmapsQuery = useQuery({
  ...$orpc.onboarding.getRoadmaps.queryOptions(),
  enabled: computed(
    () => !!session.value?.data?.user && !!profileQuery.data.value,
  ),
});

// Fetch full persistent user learning analytics compiled from DB!
const analyticsQuery = useQuery(
  computed(() => ({
    ...$orpc.onboarding.getAnalyticsDashboard.queryOptions(),
    enabled: !!session.value?.data?.user,
  })),
);

// Reactively determine if current color mode is dark
// Reactively determine if current color mode is dark
const isDark = computed(() => colorMode.value === "dark");

// Metric Cards Data compiled dynamically from DB
const metrics = computed(() => {
  const stats = analyticsQuery.data.value?.stats;

  const totalHrsVal = stats?.totalTimeSpentHours || "0.0";
  const completedLessons = stats?.completedLessonsCount || 0;
  const totalLessons = stats?.totalLessonsCount || 0;
  const passedRate = stats?.completionRate || 0;

  // Calculate dynamic mastery index level
  const level = Math.min(Math.floor(completedLessons / 3) + 1, 5);

  return [
    {
      label: "Total Study Time",
      value: `${totalHrsVal} Hrs`,
      change: "Tracks total seconds spent on learning activities",
      icon: "i-lucide-clock",
    },
    {
      label: "Current Streak",
      value: completedLessons > 0 ? "Active Day" : "Start Today",
      change: "Enrolled pathways tracker",
      icon: "i-lucide-flame",
    },
    {
      label: "Curriculum Progress",
      value: `${completedLessons} / ${totalLessons}`,
      change: `${passedRate}% Lessons completed`,
      icon: "i-lucide-check-circle",
    },
    {
      label: "Mastery Index",
      value: `Level ${level}`,
      change: "Incremented based on your lesson read metrics",
      icon: "i-lucide-award",
    },
  ];
});

// Activity Timeline compiled dynamically from DB lesson completion logs
const recentActivities = computed(() => {
  return (
    analyticsQuery.data.value?.recentActivities || [
      {
        title: "Enrolled in learning track",
        category: "Enrollment",
        time: "Just now",
        desc: "Gemini designed a personalized curriculum matching your goals.",
      },
    ]
  );
});

// --- 3. ApexCharts Configuration Options ---

// 3.1 Spline Area Chart (Learning Velocity Hours Trend)
const velocityChartSeries = computed(() => {
  const dataList = analyticsQuery.data.value?.velocityCurve?.data || [
    0, 0, 0, 0, 0, 0, 0,
  ];
  return [
    {
      name: "Study Hours Trend",
      data: dataList,
    },
  ];
});

const velocityChartOptions = computed(() => {
  const categoriesList = analyticsQuery.data.value?.velocityCurve
    ?.categories || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    chart: {
      type: "area",
      toolbar: { show: false },
      background: "transparent",
    },
    colors: ["#f59e0b"], // Amber-500
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 3 },
    grid: {
      borderColor: isDark.value ? "#292524" : "#e7e5e4", // stone-800 vs stone-200
      strokeDashArray: 4,
    },
    xaxis: {
      categories: categoriesList,
      labels: {
        style: {
          colors: isDark.value ? "#a8a29e" : "#78716c", // stone-400 vs stone-500
          fontFamily: "Inter, system-ui, sans-serif",
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark.value ? "#a8a29e" : "#78716c",
          fontFamily: "Inter, system-ui, sans-serif",
        },
      },
    },
    tooltip: {
      theme: isDark.value ? "dark" : "light",
    },
  };
});

// 3.2 Radar Chart (Skill Dimensions Index)
const radarChartSeries = [
  {
    name: "Score",
    data: [85, 75, 90, 60, 70, 80],
  },
];

const radarChartOptions = computed(() => ({
  chart: {
    type: "radar",
    toolbar: { show: false },
    background: "transparent",
  },
  colors: ["#d97706"], // Amber-600
  stroke: { width: 2 },
  fill: { opacity: 0.25 },
  markers: { size: 4, colors: ["#d97706"] },
  xaxis: {
    categories: [
      "Syntax & Core",
      "Architecture",
      "APIs & Web",
      "DevOps",
      "Databases",
      "Testing",
    ],
    labels: {
      style: {
        colors: Array(6).fill(isDark.value ? "#e7e5e4" : "#44403c"), // stone-200 vs stone-700
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "10px",
        fontWeight: 600,
      },
    },
  },
  yaxis: { show: false, max: 100 },
  tooltip: {
    theme: isDark.value ? "dark" : "light",
  },
}));

// 3.3 Bar Chart (Study Minutes Spent by Content Type)
const barChartSeries = computed(() => {
  const timeByType = analyticsQuery.data.value?.stats?.timeSpentByType || {};
  return [
    {
      name: "Study Minutes",
      data: [
        Math.round((timeByType.TEXT || 0) / 60),
        Math.round((timeByType.VIDEO || 0) / 60),
        Math.round((timeByType.AUDIO || 0) / 60),
        Math.round((timeByType.PDF || 0) / 60),
      ],
    },
  ];
});

const barChartOptions = computed(() => ({
  chart: {
    type: "bar",
    toolbar: { show: false },
    background: "transparent",
  },
  colors: ["#f59e0b"],
  plotOptions: {
    bar: {
      borderRadius: 6,
      columnWidth: "50%",
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: isDark.value ? "#292524" : "#e7e5e4",
    strokeDashArray: 4,
  },
  xaxis: {
    categories: [
      "Text Notes",
      "Video Lectures",
      "Audio Podcast",
      "PDF Slide Deck",
    ],
    labels: {
      style: {
        colors: isDark.value ? "#a8a29e" : "#78716c",
        fontFamily: "Inter, system-ui, sans-serif",
      },
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: isDark.value ? "#a8a29e" : "#78716c",
        fontFamily: "Inter, system-ui, sans-serif",
      },
    },
  },
  tooltip: {
    theme: isDark.value ? "dark" : "light",
  },
}));

// 3.4 Donut Chart (Curriculum Progress Completed vs Remaining)
const donutChartSeries = computed(() => {
  const stats = analyticsQuery.data.value?.stats;
  const completed = stats?.completedLessonsCount || 0;
  const total = stats?.totalLessonsCount || 0;
  const remaining = Math.max(0, total - completed);

  // Return completed vs remaining count
  return [completed, remaining];
});

const donutChartOptions = computed(() => ({
  chart: {
    type: "donut",
    background: "transparent",
  },
  colors: ["#22c55e", "#78716c"], // green-500 (Completed) vs stone-500 (Remaining)
  labels: ["Completed", "Remaining Lessons"],
  dataLabels: { enabled: false },
  stroke: { show: false },
  legend: {
    position: "bottom" as const,
    labels: {
      colors: isDark.value ? "#e7e5e4" : "#44403c",
      useSeriesColors: false,
    },
    fontFamily: "Inter, system-ui, sans-serif",
  },
  tooltip: {
    theme: isDark.value ? "dark" : "light",
  },
}));
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-5 text-left"
    >
      <div>
        <h1
          class="text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-50"
        >
          Learning Analytics
        </h1>
        <p
          class="text-stone-500 dark:text-stone-400 text-xs mt-1 leading-relaxed"
        >
          Monitor your velocity, check active recalls, and verify core metrics
          across all your registered curriculum tracks.
        </p>
      </div>
    </div>

    <!-- Top Row: Metrics (Premium Bespoke Handcrafted Cards) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="m in metrics"
        :key="m.label"
        class="flex items-center justify-between p-6 bg-white dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 dark:border-stone-800/50 shadow-sm"
      >
        <div class="space-y-2 text-left">
          <span
            class="text-xs text-stone-400 dark:text-stone-500 font-semibold tracking-wide uppercase"
          >
            {{ m.label }}
          </span>
          <div
            class="text-2xl font-black text-stone-900 dark:text-white tracking-tight"
          >
            {{ m.value }}
          </div>
          <p
            class="text-[10px] text-amber-600 dark:text-amber-500 font-semibold tracking-wide uppercase"
          >
            {{ m.change }}
          </p>
        </div>
        <div
          class="h-10 w-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300"
        >
          <UIcon :name="m.icon" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Main Chart: Learning Velocity Spline Graph (Interactive ApexCharts) -->
    <div
      class="p-6 bg-white dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 dark:border-stone-800/50 shadow-sm space-y-4"
    >
      <div class="text-left">
        <h2
          class="text-base font-bold text-stone-900 dark:text-white tracking-tight"
        >
          Learning Velocity (Daily Hours)
        </h2>
        <p
          class="text-stone-400 text-[10px] uppercase font-semibold tracking-wider"
        >
          Last 30 Active Days
        </p>
      </div>

      <div class="relative w-full overflow-hidden">
        <ClientOnly>
          <apexchart
            height="320"
            width="100%"
            :options="velocityChartOptions"
            :series="velocityChartSeries"
          />
          <template #fallback>
            <div
              class="h-[320px] flex items-center justify-center bg-stone-100/30 dark:bg-stone-900/10 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 animate-pulse"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="w-6 h-6 animate-spin text-stone-400"
              />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- Middle Row: Bar and Donut Charts -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Weekly Performance (Bar Chart) -->
      <div
        class="p-6 bg-white dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 dark:border-stone-800/50 shadow-sm space-y-4"
      >
        <div class="text-left">
          <h2
            class="text-base font-bold text-stone-900 dark:text-white tracking-tight"
          >
            Weekly Breakdown
          </h2>
          <p
            class="text-stone-400 text-[10px] uppercase font-semibold tracking-wider"
          >
            Hourly distribution
          </p>
        </div>
        <div class="relative w-full overflow-hidden">
          <ClientOnly>
            <apexchart
              height="260"
              width="100%"
              :options="barChartOptions"
              :series="barChartSeries"
            />
            <template #fallback>
              <div
                class="h-[260px] flex items-center justify-center bg-stone-100/30 dark:bg-stone-900/10 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 animate-pulse"
              >
                <UIcon
                  name="i-lucide-loader-2"
                  class="w-6 h-6 animate-spin text-stone-400"
                />
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>

      <!-- Curriculum Progress Status (Donut Chart) -->
      <div
        class="p-6 bg-white dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 dark:border-stone-800/50 shadow-sm space-y-4"
      >
        <div class="text-left">
          <h2
            class="text-base font-bold text-stone-900 dark:text-white tracking-tight"
          >
            Curriculum Status
          </h2>
          <p
            class="text-stone-400 text-[10px] uppercase font-semibold tracking-wider"
          >
            Completion stages
          </p>
        </div>
        <div
          class="relative w-full overflow-hidden flex items-center justify-center"
        >
          <ClientOnly>
            <apexchart
              height="260"
              width="100%"
              :options="donutChartOptions"
              :series="donutChartSeries"
            />
            <template #fallback>
              <div
                class="h-[260px] w-full flex items-center justify-center bg-stone-100/30 dark:bg-stone-900/10 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 animate-pulse"
              >
                <UIcon
                  name="i-lucide-loader-2"
                  class="w-6 h-6 animate-spin text-stone-400"
                />
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Radar Chart & Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Radar Chart (Bespoke Handcrafted Hexagon Radar) -->
      <div
        class="lg:col-span-5 p-6 bg-white dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 dark:border-stone-800/50 shadow-sm flex flex-col justify-between"
      >
        <div class="text-left mb-4">
          <h2
            class="text-base font-bold text-stone-900 dark:text-white tracking-tight"
          >
            Skill Dimension Index
          </h2>
          <p
            class="text-stone-400 text-[10px] uppercase font-semibold tracking-wider"
          >
            Multi-discipline coverage
          </p>
        </div>

        <div class="flex items-center justify-center w-full">
          <ClientOnly>
            <apexchart
              height="280"
              width="100%"
              :options="radarChartOptions"
              :series="radarChartSeries"
            />
            <template #fallback>
              <div
                class="h-[280px] w-full flex items-center justify-center bg-stone-100/30 dark:bg-stone-900/10 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 animate-pulse"
              >
                <UIcon
                  name="i-lucide-loader-2"
                  class="w-6 h-6 animate-spin text-stone-400"
                />
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>

      <!-- Recent Activity Timeline (Bespoke Handcrafted Timeline, NO SLOP) -->
      <div
        class="lg:col-span-7 p-6 bg-white dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 dark:border-stone-800/50 shadow-sm flex flex-col justify-between"
      >
        <div class="text-left mb-6">
          <h2
            class="text-base font-bold text-stone-900 dark:text-white tracking-tight"
          >
            Recent Activity
          </h2>
          <p
            class="text-stone-400 text-[10px] uppercase font-semibold tracking-wider"
          >
            Historical progress ledger
          </p>
        </div>

        <!-- Vertical Timeline Ledger -->
        <div
          class="relative flex-grow space-y-6 text-left pl-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-stone-200 dark:before:bg-stone-800"
        >
          <div
            v-for="(act, idx) in recentActivities"
            :key="idx"
            class="relative space-y-1"
          >
            <!-- Timeline Node Indicator -->
            <div
              :class="[
                'absolute -left-[20px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-stone-900 bg-amber-500',
                idx > 0 ? 'bg-stone-300 dark:bg-stone-700' : '',
              ]"
            ></div>

            <div class="flex items-center justify-between gap-4">
              <span
                class="text-sm font-bold text-stone-900 dark:text-white leading-tight"
              >
                {{ act.title }}
              </span>
              <span
                class="text-[10px] text-stone-400 dark:text-stone-500 font-medium whitespace-nowrap"
              >
                {{ act.time }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <span
                class="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500"
              >
                {{ act.category }}
              </span>
            </div>

            <p
              class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed pt-0.5"
            >
              {{ act.desc }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
