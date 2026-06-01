<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const { $authClient } = useNuxtApp();
const session = $authClient.useSession();

const props = defineProps<{
  activeLessonTitle: string;
  contextPrompt?: string;
}>();

const emit = defineEmits(["close"]);

const status = ref<"loading" | "question" | "roasting" | "result">("loading");
const mockQuestion = ref("");
const userAnswer = ref("");
const roastReply = ref("");
const score = ref(0);
const timeLeft = ref(30);

let timerInterval: any = null;

onMounted(async () => {
  await generateInterviewQuestion();
});

async function generateInterviewQuestion() {
  status.value = "loading";
  try {
    const config = useRuntimeConfig();
    const serverUrl = config.public.serverUrl || "http://localhost:3000";
    
    // Request a hard mock interview question
    const messages = [
      {
        id: "sys-" + Date.now(),
        role: "system",
        content: `You are an elite, highly critical senior systems engineer. Generate exactly ONE hard mock interview question based on this lesson topic: "${props.activeLessonTitle}". Do not add any conversational filler. Just return the raw question text.`
      },
      {
        id: "user-" + Date.now(),
        role: "user",
        content: `Topic: ${props.activeLessonTitle}`
      }
    ];

    const uId = session.value?.data?.user?.id || "";
    const res = await fetch(`${serverUrl}/ai?userId=${uId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) throw new Error("API call failed");

    const text = await res.text();
    const cleanedText = text
      .replace(/0:"/g, "")
      .replace(/\\n/g, " ")
      .replace(/"/g, "")
      .trim();

    mockQuestion.value = cleanedText || `Explain the core mechanism of ${props.activeLessonTitle} and why naive implementations fail in high-concurrency production environments.`;
    status.value = "question";
    startTimer();
  } catch (err) {
    console.error("Failed to generate question:", err);
    mockQuestion.value = `Explain the core mechanism of ${props.activeLessonTitle} and why naive implementations fail in high-concurrency production environments.`;
    status.value = "question";
    startTimer();
  }
}

function startTimer() {
  timeLeft.value = 30;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    } else {
      clearInterval(timerInterval);
      submitAnswer();
    }
  }, 1000);
}

async function submitAnswer() {
  if (timerInterval) clearInterval(timerInterval);
  status.value = "roasting";

  try {
    const config = useRuntimeConfig();
    const serverUrl = config.public.serverUrl || "http://localhost:3000";
    
    const messages = [
      {
        id: "sys-" + Date.now(),
        role: "system",
        content: `You are an elite, brutally honest senior engineer conducting a mock interview.
        The user answered this question: "${mockQuestion.value}".
        Their answer: "${userAnswer.value || 'No answer provided (ran out of time)'}".
        
        Roast their answer in exactly 2 sentences. Be harsh but funny.
        Finally, append a score out of 100 formatted exactly as 'SCORE: X'.`
      },
      {
        id: "user-" + Date.now(),
        role: "user",
        content: userAnswer.value || "I ran out of time."
      }
    ];

    const uId = session.value?.data?.user?.id || "";
    const res = await fetch(`${serverUrl}/ai?userId=${uId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) throw new Error("API call failed");

    const text = await res.text();
    
    const cleanedText = text.trim();

    // Extract score
    const scoreMatch = cleanedText.match(/SCORE:\s*(\d+)/i);
    if (scoreMatch && scoreMatch[1]) {
      score.value = parseInt(scoreMatch[1]);
      roastReply.value = cleanedText.replace(/SCORE:\s*\d+/i, "").trim();
    } else {
      score.value = Math.floor(Math.random() * 40) + 10; // low default score for roasts
      roastReply.value = cleanedText;
    }

    // Play a boom sound effect natively
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(120, audioCtx.currentTime); // Low bass frequency
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
      osc.start();
      osc.stop(audioCtx.currentTime + 1);
    } catch (soundErr) {
      console.warn("Audio Context sound blocked or not supported:", soundErr);
    }

    status.value = "result";
  } catch (err) {
    console.error("Failed to roast answer:", err);
    status.value = "question";
  }
}

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});
</script>

<template>
  <div class="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" @click.self="emit('close')">
    <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-2xl w-full relative animate-fade-in text-stone-900 dark:text-stone-100 flex flex-col items-center">
      <!-- Close Button -->
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        class="absolute top-4 right-4 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800"
        size="md"
        @click="emit('close')"
      />

      <div class="w-full text-center space-y-6 flex flex-col items-center justify-center">
        <div class="space-y-1">
          <span class="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center justify-center gap-1.5 animate-pulse">
            <UIcon name="i-lucide-flame" /> Hard Modality
          </span>
          <h2 class="text-2xl font-black text-stone-900 dark:text-white tracking-tight">Roast My Knowledge</h2>
          <p class="text-stone-500 dark:text-stone-400 text-xs leading-relaxed">
            {{ activeLessonTitle ? `Active Lesson: ${activeLessonTitle}` : "A brutal mock interview with an unforgiving senior engineer." }}
          </p>
        </div>

        <!-- --- 1. Loading State --- -->
        <div v-if="status === 'loading'" class="py-12 flex flex-col items-center gap-4">
          <UIcon name="i-lucide-loader-2" class="h-10 w-10 animate-spin text-amber-500" />
          <span class="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Formulating brutal interview question...</span>
        </div>

        <!-- --- 2. Question State --- -->
        <div v-else-if="status === 'question'" class="space-y-6 text-left animate-fade-in w-full">
          <!-- Countdown Timer -->
          <div class="text-center">
            <div class="text-5xl font-black text-amber-500 font-mono tracking-tight tabular-nums">
              00:{{ timeLeft.toString().padStart(2, '0') }}
            </div>
            <span class="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Time Remaining to formulate argument</span>
          </div>

          <!-- Question Box (Beautiful Amber theme matching Rest of Roadie) -->
          <div class="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-2">
            <span class="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-wider flex items-center gap-1">
              <UIcon name="i-lucide-help-circle" /> Question
            </span>
            <div class="text-sm font-semibold text-stone-900 dark:text-white leading-relaxed whitespace-pre-line">{{ mockQuestion }}</div>
          </div>

          <!-- Answer box -->
          <div class="space-y-3 w-full">
            <UTextarea
              v-model="userAnswer"
              placeholder="Type your explanation or core thesis here. Senior engineer is watching..."
              :rows="5"
              class="w-full rounded-xl"
            />
            <div class="flex justify-end">
              <UButton
                color="primary"
                icon="i-lucide-flame"
                class="rounded-xl px-6 py-2.5 font-bold hover:scale-[1.02] active:scale-95 transition-all text-stone-950 cursor-pointer shadow-md shadow-amber-500/10"
                @click="submitAnswer"
              >
                Submit Answer
              </UButton>
            </div>
          </div>
        </div>

        <!-- --- 3. Roasting Processing State --- -->
        <div v-else-if="status === 'roasting'" class="py-12 flex flex-col items-center gap-4">
          <UIcon name="i-lucide-flame" class="h-10 w-10 animate-bounce text-amber-500" />
          <span class="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider animate-pulse">Analyzing your response... prepare to be roasted</span>
        </div>

        <!-- --- 4. Result Reveal State --- -->
        <div v-else-if="status === 'result'" class="space-y-6 animate-fade-in text-left w-full">
          <!-- Giant Score Gauge indicator -->
          <div class="flex flex-col items-center justify-center text-center p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3 relative overflow-hidden">
            <div class="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full"></div>
            <div class="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full"></div>
            
            <span class="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest relative z-10">Brutal Assessment Score</span>
            <div class="text-7xl font-black text-amber-500 relative z-10 tabular-nums">
              {{ score }}<span class="text-lg text-stone-500 font-semibold">/100</span>
            </div>
            
            <!-- Rating badge -->
            <UBadge
              :label="score >= 80 ? 'CRITICAL SUCCESS' : score >= 50 ? 'NAIVE ATTEMPT' : 'ABSOLUTE SLOP'"
              :color="score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error'"
              size="sm"
              class="relative z-10 font-bold tracking-wider text-[9px]"
            />
          </div>

          <!-- Roast text block -->
          <div class="p-6 bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/80 rounded-2xl space-y-3">
            <span class="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <UIcon name="i-lucide-meh" /> Senior Roast Letter
            </span>
            <p class="text-sm text-stone-850 dark:text-stone-200 leading-relaxed font-medium italic">
              "{{ roastReply }}"
            </p>
          </div>

          <div class="flex justify-center gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              class="rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800"
              @click="generateInterviewQuestion"
            >
              Try Another Question
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              class="rounded-xl font-bold text-stone-950 cursor-pointer shadow-md shadow-amber-500/10"
              @click="emit('close')"
            >
              Back to Syllabus
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
