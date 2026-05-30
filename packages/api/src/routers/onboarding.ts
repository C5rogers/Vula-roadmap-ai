import prisma from "@roadmap_ai/db";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import z from "zod";

import { protectedProcedure } from "../index";

const onboardingInputSchema = z.object({
  learningGoals: z.string().min(1),
  experienceLevel: z.string().min(1), // e.g., "beginner", "intermediate", "advanced"
  learningStyle: z.string().min(1), // e.g., "document", "video", "mixed"
  weeklyCommitment: z.number().int().min(1), // in hours
  preferredDuration: z.string().min(1), // e.g., "4 weeks"
  additionalNotes: z.string().optional(),
  availabilityDays: z
    .array(z.string())
    .default(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
  availabilityHours: z.number().int().min(1).max(24).default(2),
});

// Reuse schemas for nested Quizzes
const questionSchema = z.object({
  questionText: z
    .string()
    .describe("The text of the quiz question, e.g. 'What is React Hooks?'"),
  options: z
    .array(z.string())
    .describe(
      "List of multiple choice options, e.g. ['A function', 'A component', 'A state manager', 'None of the above']",
    ),
  correctAnswer: z.string().describe("The exact text of the correct option"),
  explanation: z
    .string()
    .describe("A helpful explanation of why this answer is correct"),
});

const quizSchema = z.object({
  title: z.string().describe("Title of the quiz, e.g. 'useState Basics Quiz'"),
  questions: z
    .array(questionSchema)
    .describe("List of questions for this quiz"),
});

const roadmapObjectSchema = z.object({
  title: z
    .string()
    .describe(
      "The overall title of the learning roadmap, e.g. 'Mastering React in 4 Weeks'",
    ),
  description: z
    .string()
    .describe("A concise high-level description of what the roadmap covers"),
  overview: z
    .string()
    .describe(
      "A deep-dive overview of the curriculum and what they will achieve",
    ),
  summary: z.string().describe("A summary of the roadmap outcomes"),
  targetGoal: z
    .string()
    .describe("The core target goal, e.g. 'React Development'"),
  learningStrategy: z
    .string()
    .describe(
      "A description of the learning strategy used, e.g., 'Hands-on project-based building'",
    ),
  promptToLearn: z
    .string()
    .describe(
      "A highly motivating and personalized prompt tailored to the user's specific learning style preference (e.g. video, document, mixed) and experience level, guiding them on how best to tackle this roadmap and learn efficiently.",
    ),
  finalQuiz: quizSchema.describe(
    "An overall course final quiz for the roadmap. It must contain exactly 5 comprehensive questions covering the entire roadmap topics.",
  ),
  chapters: z.array(
    z.object({
      title: z
        .string()
        .describe(
          "The chapter title, e.g. 'Chapter 1: Getting Started with React Hooks'",
        ),
      description: z
        .string()
        .describe("A brief description of this chapter's learning objectives"),
      overview: z.string().describe("Deep-dive overview of this chapter"),
      summary: z.string().describe("Summary of this chapter"),
      order: z
        .number()
        .int()
        .describe("The sequential order of the chapter, starting from 1"),
      quiz: quizSchema.describe(
        "A chapter-level assessment quiz. It must contain exactly 3 questions testing the chapter's objectives.",
      ),
      lessons: z.array(
        z.object({
          title: z
            .string()
            .describe("The lesson title, e.g. 'Understanding useState'"),
          type: z
            .enum(["TEXT", "VIDEO", "AUDIO", "PDF"])
            .describe(
              "The media type of this lesson. Distribute types among TEXT, VIDEO, AUDIO, and PDF lessons to make a rich, multi-sensory curriculum. Generate TEXT for written articles, VIDEO for video lectures, AUDIO for podcast/lectures, and PDF for slide document guides.",
            ),
          overview: z
            .string()
            .describe("A clear outline of what this lesson covers"),
          content: z
            .string()
            .describe(
              "The content of the lesson based strictly on its type. If TEXT: detailed markdown article. If VIDEO: a valid, highly specific, and relevant YouTube or educational video platform link. If AUDIO: a valid, realistic MP3 or audio stream URL. If PDF: a valid, realistic document or slide-deck PDF link.",
            ),
          order: z
            .number()
            .int()
            .describe(
              "The sequential order of the lesson within the chapter, starting from 1",
            ),
          resources: z
            .array(
              z.object({
                title: z.string().describe("Title of the learning resource"),
                url: z
                  .string()
                  .describe("Actual or highly plausible URL of the resource"),
                type: z
                  .string()
                  .describe(
                    "The resource type, e.g., 'DOCUMENT', 'VIDEO', 'ARTICLE'",
                  ),
                description: z.string().optional(),
              }),
            )
            .describe(
              "A list of 1-2 curated learning resources for this lesson",
            ),
          flashcards: z
            .array(
              z.object({
                front: z.string().describe("Front/Question of the flashcard"),
                back: z.string().describe("Back/Answer of the flashcard"),
              }),
            )
            .describe(
              "A list of 2-4 flashcards for active recall study of the lesson's key concepts",
            ),
          glossaries: z
            .array(
              z.object({
                term: z
                  .string()
                  .describe("Key term/concept introduced in the lesson"),
                definition: z
                  .string()
                  .describe("Simple and clear definition of the term"),
              }),
            )
            .describe(
              "A list of 2-4 key glossary terms and definitions introduced in this lesson",
            ),
          quiz: quizSchema.describe(
            "An instant lesson-level quiz. It must contain exactly 2 quick questions to test active understanding of this lesson's content.",
          ),
        }),
      ),
    }),
  ),
});

// In-memory global progress state map for background generation
interface GenerationState {
  status: "idle" | "generating" | "complete" | "error";
  progress: number;
  message: string;
  roadmapId?: string;
}
const generationProgress = new Map<string, GenerationState>();

async function generateRoadmapSchedule(
  userId: string,
  roadmapId: string,
  availabilityDays: string[],
  availabilityHours: number,
) {
  // 1. Get all lessons of the new roadmap in order
  const lessons = await prisma.lesson.findMany({
    where: {
      chapter: {
        roadmapId,
      },
    },
    orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
  });

  if (lessons.length === 0) return;

  // 2. Get existing scheduled lessons of OTHER roadmaps
  const existingLessons = await prisma.lesson.findMany({
    where: {
      chapter: {
        roadmap: {
          userId,
          id: { not: roadmapId },
        },
      },
      scheduledDate: { not: null },
    },
    select: {
      scheduledDate: true,
    },
  });

  // 3. Populate existing lessons count per day
  const lessonsCount: Record<string, number> = {};
  for (const el of existingLessons) {
    if (el.scheduledDate) {
      const dateKey = el.scheduledDate.toISOString().split("T")[0] ?? "";
      if (dateKey) {
        lessonsCount[dateKey] = (lessonsCount[dateKey] ?? 0) + 1;
      }
    }
  }

  // 4. Match day names
  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const daysLower = availabilityDays.map((d) => d.toLowerCase());

  let currentDate = new Date();
  // Start scheduling at 9:00 AM
  currentDate.setHours(9, 0, 0, 0);

  for (const lesson of lessons) {
    let scheduled = false;
    let loopCount = 0;
    while (!scheduled && loopCount < 365) {
      const dayName = (
        DAY_NAMES[currentDate.getDay()] ?? "Monday"
      ).toLowerCase();
      if (daysLower.includes(dayName)) {
        const dateKey = currentDate.toISOString().split("T")[0] ?? "";
        if (dateKey) {
          const currentCount = lessonsCount[dateKey] ?? 0;
          if (currentCount < availabilityHours) {
            // Schedule it!
            const scheduledTime = new Date(currentDate);
            // Offset hour by how many lessons already scheduled
            scheduledTime.setHours(9 + currentCount, 0, 0, 0);

            await prisma.lesson.update({
              where: { id: lesson.id },
              data: {
                scheduledDate: scheduledTime,
              },
            });

            lessonsCount[dateKey] = currentCount + 1;
            scheduled = true;
          } else {
            // Day is full, move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else {
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // Not an available day of the week, move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      loopCount++;
    }
  }
}

export const onboardingRouter = {
  getProfile: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    return await prisma.userProfile.findUnique({
      where: { userId },
    });
  }),

  getSchedule: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    // Get all lessons across all user's roadmaps that have a scheduledDate
    const lessons = await prisma.lesson.findMany({
      where: {
        chapter: {
          roadmap: {
            userId,
          },
        },
        scheduledDate: { not: null },
      },
      include: {
        progress: {
          where: { userId },
        },
        chapter: {
          include: {
            roadmap: true,
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    return lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      scheduledDate: lesson.scheduledDate,
      chapterTitle: lesson.chapter.title,
      roadmapId: lesson.chapter.roadmap.id,
      roadmapTitle: lesson.chapter.roadmap.title,
      isCompleted: lesson.progress?.[0]?.isCompleted ?? false,
      completedAt: lesson.progress?.[0]?.completedAt ?? null,
      timeSpent: lesson.progress?.[0]?.timeSpent ?? 0,
    }));
  }),

  getRoadmaps: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    return await prisma.roadmap.findMany({
      where: { userId },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                progress: {
                  where: { userId },
                },
              },
            },
          },
        },
        enrollments: {
          where: { userId },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getRoadmap: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      return await prisma.roadmap.findUnique({
        where: { id: input.id },
        include: {
          chapters: {
            orderBy: { order: "asc" },
            include: {
              lessons: {
                orderBy: { order: "asc" },
                include: {
                  resources: true,
                  flashcards: true,
                  glossaries: true,
                  progress: {
                    where: { userId },
                  },
                  quizzes: {
                    include: {
                      questions: true,
                    },
                  },
                },
              },
              quizzes: {
                include: {
                  questions: true,
                },
              },
            },
          },
          quizzes: {
            include: {
              questions: true,
            },
          },
        },
      });
    }),

  saveProgress: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        videoProgress: z.number().nullable().optional(),
        audioProgress: z.number().nullable().optional(),
        pdfCurrentPage: z.number().int().nullable().optional(),
        pdfTotalPages: z.number().int().nullable().optional(),
        scrollPercent: z.number().nullable().optional(),
        timeSpent: z.number().int().default(0),
        isCompleted: z.boolean().default(false),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const existing = await prisma.lessonProgress.findUnique({
        where: {
          userId_lessonId: {
            userId,
            lessonId: input.lessonId,
          },
        },
      });

      const isNowCompleted =
        input.isCompleted || (existing?.isCompleted ?? false);
      const completedAtValue = isNowCompleted
        ? (existing?.completedAt ?? new Date())
        : null;

      const progress = await prisma.lessonProgress.upsert({
        where: {
          userId_lessonId: {
            userId,
            lessonId: input.lessonId,
          },
        },
        update: {
          isCompleted: isNowCompleted,
          completedAt: completedAtValue,
          videoProgress: input.videoProgress ?? undefined,
          audioProgress: input.audioProgress ?? undefined,
          pdfCurrentPage: input.pdfCurrentPage ?? undefined,
          pdfTotalPages: input.pdfTotalPages ?? undefined,
          scrollPercent: input.scrollPercent ?? undefined,
          timeSpent: {
            increment: input.timeSpent,
          },
        },
        create: {
          userId,
          lessonId: input.lessonId,
          isCompleted: input.isCompleted,
          completedAt: input.isCompleted ? new Date() : null,
          videoProgress: input.videoProgress,
          audioProgress: input.audioProgress,
          pdfCurrentPage: input.pdfCurrentPage,
          pdfTotalPages: input.pdfTotalPages,
          scrollPercent: input.scrollPercent,
          timeSpent: input.timeSpent,
        },
      });

      // Synchronize overall Enrollment progressPercent in the DB!
      try {
        const lesson = await prisma.lesson.findUnique({
          where: { id: input.lessonId },
          include: {
            chapter: true,
          },
        });

        if (lesson?.chapter?.roadmapId) {
          const roadmapId = lesson.chapter.roadmapId;

          // Count all lessons of this roadmap to calculate exact percentage
          const allLessons = await prisma.lesson.findMany({
            where: {
              chapter: {
                roadmapId,
              },
            },
            include: {
              progress: {
                where: { userId },
              },
            },
          });

          const total = allLessons.length;
          const completed = allLessons.filter(
            (l) => l.progress?.[0]?.isCompleted,
          ).length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

          // Update the Enrollment table record progressPercent
          await prisma.enrollment.updateMany({
            where: {
              userId,
              roadmapId,
            },
            data: {
              progressPercent: pct,
            },
          });
        }
      } catch (syncErr) {
        console.error("Failed to sync enrollment progress:", syncErr);
      }

      return { success: true, progress };
    }),

  getProgressAnalysis: protectedProcedure
    .input(z.object({ roadmapId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Fetch all lessons within the chapters of this roadmap
      const lessons = await prisma.lesson.findMany({
        where: {
          chapter: {
            roadmapId: input.roadmapId,
          },
        },
        include: {
          progress: {
            where: { userId },
          },
        },
      });

      const totalLessons = lessons.length;
      let completedLessons = 0;
      let totalTimeSpent = 0;
      let lastStudiedAt: Date | null = null;

      // Group study time by lesson type
      const timeSpentByType: Record<string, number> = {
        TEXT: 0,
        VIDEO: 0,
        AUDIO: 0,
        PDF: 0,
      };

      for (const lesson of lessons) {
        const userProgress = lesson.progress?.[0];
        if (userProgress) {
          if (userProgress.isCompleted) {
            completedLessons++;
          }
          totalTimeSpent += userProgress.timeSpent;

          if (!lastStudiedAt || userProgress.lastStudiedAt > lastStudiedAt) {
            lastStudiedAt = userProgress.lastStudiedAt;
          }

          // Accumulate study time by type
          let lessonType = "TEXT";
          if (lesson.content) {
            const trimmed = lesson.content.trim();
            if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(trimmed)) {
              lessonType = "VIDEO";
            } else if (trimmed.endsWith(".mp3") || trimmed.includes(".mp3?")) {
              lessonType = "AUDIO";
            } else if (trimmed.endsWith(".pdf") || trimmed.includes(".pdf?")) {
              lessonType = "PDF";
            }
          }
          const time = userProgress.timeSpent || 0;
          timeSpentByType[lessonType] =
            (timeSpentByType[lessonType] || 0) + time;
        }
      }

      const completionRate =
        totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

      return {
        success: true,
        roadmapId: input.roadmapId,
        analysis: {
          totalLessons,
          completedLessons,
          completionRate: Math.round(completionRate * 100) / 100, // round to 2 decimal places
          totalTimeSpentSeconds: totalTimeSpent,
          totalTimeSpentMinutes: Math.round((totalTimeSpent / 60) * 100) / 100,
          lastStudiedAt,
          timeSpentByType,
        },
      };
    }),

  getChatHistory: protectedProcedure
    .input(z.object({ roadmapId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const chatSession = await prisma.chatSession.findFirst({
        where: { userId, roadmapId: input.roadmapId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return chatSession?.messages || [];
    }),

  getAnalyticsDashboard: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    // 1. Fetch all lesson progress logs for this user with lesson details
    const progresses = await prisma.lessonProgress.findMany({
      where: { userId },
      include: {
        lesson: true,
      },
      orderBy: { lastStudiedAt: "desc" },
    });

    // 2. Fetch all enrolled roadmaps for chapters and lessons
    const roadmaps = await prisma.roadmap.findMany({
      where: { userId },
      include: {
        chapters: {
          include: {
            lessons: true,
          },
        },
      },
    });

    let totalLessonsCount = 0;
    let completedLessonsCount = 0;
    let totalTimeSpentSeconds = 0;

    // Group study time spent by type
    const timeSpentByType: Record<string, number> = {
      TEXT: 0,
      VIDEO: 0,
      AUDIO: 0,
      PDF: 0,
    };

    for (const progress of progresses) {
      totalTimeSpentSeconds += progress.timeSpent;
      const type = progress.lesson?.type || "TEXT";
      timeSpentByType[type] = (timeSpentByType[type] || 0) + progress.timeSpent;
      if (progress.isCompleted) {
        completedLessonsCount++;
      }
    }

    for (const roadmap of roadmaps) {
      for (const chapter of roadmap.chapters) {
        totalLessonsCount += chapter.lessons?.length || 0;
      }
    }

    // 3. Compile learning velocity curve based on studied dates
    const lastStudiedDays = progresses
      .slice(0, 7)
      .map((p) => {
        const date = new Date(p.lastStudiedAt).toLocaleDateString("en-US", {
          weekday: "short",
        });
        return {
          day: date,
          hours: Math.round((p.timeSpent / 3600) * 100) / 100 || 0.1,
        };
      })
      .reverse();

    const velocityDays =
      lastStudiedDays.length > 0
        ? lastStudiedDays
        : [
            { day: "Mon", hours: 0 },
            { day: "Tue", hours: 0 },
            { day: "Wed", hours: 0 },
            { day: "Thu", hours: 0 },
            { day: "Fri", hours: 0 },
            { day: "Sat", hours: 0 },
            { day: "Sun", hours: 0 },
          ];

    // 4. Construct a timeline of actual recent activities
    const activities = progresses.slice(0, 4).map((p) => ({
      title: p.isCompleted
        ? `Completed: "${p.lesson?.title}"`
        : `Studied: "${p.lesson?.title}"`,
      category: p.lesson?.type || "TEXT",
      time: new Date(p.lastStudiedAt).toLocaleDateString(),
      desc: `Spent ${Math.round(p.timeSpent)} seconds studying this lesson.`,
    }));

    return {
      success: true,
      stats: {
        totalTimeSpentSeconds,
        totalTimeSpentMinutes:
          Math.round((totalTimeSpentSeconds / 60) * 10) / 10,
        totalTimeSpentHours:
          Math.round((totalTimeSpentSeconds / 3600) * 10) / 10,
        totalLessonsCount,
        completedLessonsCount,
        completionRate:
          totalLessonsCount > 0
            ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
            : 0,
        activeRoadmapsCount: roadmaps.length,
        timeSpentByType,
      },
      velocityCurve: {
        categories: velocityDays.map((d) => d.day),
        data: velocityDays.map((d) => d.hours),
      },
      recentActivities:
        activities.length > 0
          ? activities
          : [
              {
                title: "Enrolled in learning track",
                category: "Enrollment",
                time: "Just now",
                desc: "Gemini designed a personalized curriculum matching your goals.",
              },
            ],
    };
  }),

  getGenerationStatus: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const fallback: GenerationState = {
      status: "idle",
      progress: 0,
      message: "No roadmap currently generating.",
    };
    return generationProgress.get(userId) || fallback;
  }),

  submit: protectedProcedure
    .input(onboardingInputSchema)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 1. Instantly trigger background generating status
      generationProgress.set(userId, {
        status: "generating",
        progress: 5,
        message: "Saving your profile preferences and learning style...",
      });

      // Update/create UserProfile synchronously to prevent race conditions
      const profile = await prisma.userProfile.upsert({
        where: { userId },
        update: {
          learningGoals: input.learningGoals,
          experienceLevel: input.experienceLevel,
          learningStyle: input.learningStyle,
          weeklyCommitment: input.weeklyCommitment,
          preferredDuration: input.preferredDuration,
          additionalNotes: input.additionalNotes,
          availabilityDays: input.availabilityDays,
          availabilityHours: input.availabilityHours,
        },
        create: {
          userId,
          learningGoals: input.learningGoals,
          experienceLevel: input.experienceLevel,
          learningStyle: input.learningStyle,
          weeklyCommitment: input.weeklyCommitment,
          preferredDuration: input.preferredDuration,
          additionalNotes: input.additionalNotes,
          availabilityDays: input.availabilityDays,
          availabilityHours: input.availabilityHours,
        },
      });

      // 2. Perform AI roadmap generation as a background promise
      // This immediately unblocks Hono from waiting, preventing any HTTP timeout.
      (async () => {
        try {
          generationProgress.set(userId, {
            status: "generating",
            progress: 20,
            message:
              "Consulting Gemini AI to design your curriculum chapters...",
          });

          const prompt = `You are an elite educational AI agent that designs perfect, personalized structured learning roadmaps.
Design a highly custom roadmap for a student with the following onboarding preferences:
- Learning Goals: ${input.learningGoals}
- Experience Level: ${input.experienceLevel}
- Learning Style Preference: ${input.learningStyle} (e.g. document, video, mixed)
- Weekly Commitment: ${input.weeklyCommitment} hours
- Preferred Duration: ${input.preferredDuration}
${input.additionalNotes ? `- Additional Notes: ${input.additionalNotes}` : ""}

Please generate a cohesive Roadmap. The Roadmap must contain between 2 to 4 Chapters (depending on duration and goals). Each Chapter must contain between 2 to 4 Lessons.

CRITICAL FORMATTING INSTRUCTIONS FOR LESSON TYPES (MUST MATCH PERFECTLY):
For each lesson, choose a type from ["TEXT", "VIDEO", "AUDIO", "PDF"] and generate its 'content' as follows:
- If type is 'TEXT': 'content' must be a highly detailed, comprehensive textbook-style study guide in Markdown. Include clear sub-headings, explanations, code blocks (formatted beautifully), and key takeaways.
- If type is 'VIDEO': 'content' must be a single, valid, and highly relevant educational video link (e.g., from YouTube like https://www.youtube.com/watch?v=dQw4w9WgXcQ or similar educational platforms) related directly to the lesson topic. Do not include any outline text, transcripts, summaries, or timestamps. ONLY include a single raw, valid HTTP/HTTPS URL/link.
- If type is 'AUDIO': 'content' must be a single, valid, and highly relevant educational audio or MP3 stream URL (e.g., a podcast or MP3 file link) related directly to the lesson topic. Do not include any outline text, script, or conversational transcription text. ONLY include a single raw, valid HTTP/HTTPS URL/link.
- If type is 'PDF': 'content' must be a single, valid, and highly relevant link to a downloadable PDF guide or slide deck document (e.g., a PDF document link) related directly to the lesson topic. Do not include any slides, text outlines, or boundary slide text. ONLY include a single raw, valid HTTP/HTTPS URL/link.

For each Lesson, generate:
1. An 'overview' (a brief outline of what is covered) and 'content' formatted strictly according to its chosen lesson type as specified above.
2. Curate 1 to 2 learning 'resources' (with realistic titles, URLs, and types matching their style like VIDEO or ARTICLE).
3. Design 2 to 4 active-recall 'flashcards' (with front questions and back answers) for quick study.
4. Extract 2 to 4 key 'glossaries' (terms and definitions).
5. Add an instant lesson-level 'quiz' (with exactly 2 questions, 4 options each, correct answer text, and detailed explanation).

For each Chapter:
1. Design a chapter-level assessment 'quiz' (with exactly 3 questions testing chapter-wide understanding).

For the overall Roadmap:
1. Design an overall course final 'quiz' (with exactly 5 comprehensive questions covering the entire roadmap).

Return the result structured according to the schema.`;

          generationProgress.set(userId, {
            status: "generating",
            progress: 40,
            message:
              "Gemini AI is parsing and structuring lesson components...",
          });

          let aiRoadmap;
          try {
            const result = await generateObject({
              model: google("gemini-2.5-flash"),
              schema: roadmapObjectSchema,
              prompt,
            });
            aiRoadmap = result.object;
          } catch (error) {
            console.warn(
              "Failed to generate with gemini-2.5-flash, falling back to gemini-1.5-flash:",
              error,
            );
            const result = await generateObject({
              model: google("gemini-1.5-flash"),
              schema: roadmapObjectSchema,
              prompt,
            });
            aiRoadmap = result.object;
          }

          generationProgress.set(userId, {
            status: "generating",
            progress: 75,
            message:
              "Curriculum generated! Saving chapters and custom lesson structures to database...",
          });

          // 3. Save the generated roadmap into the database
          const savedRoadmap = await prisma.roadmap.create({
            data: {
              userId,
              title: aiRoadmap.title,
              description: aiRoadmap.description,
              overview: aiRoadmap.overview,
              summary: aiRoadmap.summary,
              targetGoal: aiRoadmap.targetGoal,
              learningStrategy: aiRoadmap.learningStrategy,
              quizzes: aiRoadmap.finalQuiz
                ? {
                    create: [
                      {
                        title: aiRoadmap.finalQuiz.title,
                        type: "FINAL",
                        questions: {
                          create: aiRoadmap.finalQuiz.questions.map((q) => ({
                            questionText: q.questionText,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                          })),
                        },
                      },
                    ],
                  }
                : undefined,
              chapters: {
                create: aiRoadmap.chapters.map((chapter) => ({
                  title: chapter.title,
                  description: chapter.description,
                  overview: chapter.overview,
                  summary: chapter.summary,
                  order: chapter.order,
                  quizzes: chapter.quiz
                    ? {
                        create: [
                          {
                            title: chapter.quiz.title,
                            type: "CHAPTER",
                            questions: {
                              create: chapter.quiz.questions.map((q) => ({
                                questionText: q.questionText,
                                options: q.options,
                                correctAnswer: q.correctAnswer,
                                explanation: q.explanation,
                              })),
                            },
                          },
                        ],
                      }
                    : undefined,
                  lessons: {
                    create: chapter.lessons.map((lesson) => ({
                      title: lesson.title,
                      type: lesson.type, // Save the generated type!
                      overview: lesson.overview,
                      content: lesson.content,
                      order: lesson.order,
                      resources: {
                        create:
                          lesson.resources?.map((r) => ({
                            title: r.title,
                            url: r.url,
                            type: r.type,
                            description: r.description,
                          })) || [],
                      },
                      flashcards: {
                        create:
                          lesson.flashcards?.map((f) => ({
                            front: f.front,
                            back: f.back,
                          })) || [],
                      },
                      glossaries: {
                        create:
                          lesson.glossaries?.map((g) => ({
                            term: g.term,
                            definition: g.definition,
                          })) || [],
                      },
                      quizzes: lesson.quiz
                        ? {
                            create: [
                              {
                                title: lesson.quiz.title,
                                type: "INSTANT",
                                questions: {
                                  create: lesson.quiz.questions.map((q) => ({
                                    questionText: q.questionText,
                                    options: q.options,
                                    correctAnswer: q.correctAnswer,
                                    explanation: q.explanation,
                                  })),
                                },
                              },
                            ],
                          }
                        : undefined,
                    })),
                  },
                })),
              },
            },
          });

          generationProgress.set(userId, {
            status: "generating",
            progress: 95,
            message: "Finishing up roadmap enrollment...",
          });

          // 4. Enroll the user automatically in this newly generated roadmap
          await prisma.enrollment.upsert({
            where: {
              userId_roadmapId: {
                userId,
                roadmapId: savedRoadmap.id,
              },
            },
            update: {
              status: "ENROLLED",
            },
            create: {
              userId,
              roadmapId: savedRoadmap.id,
              status: "ENROLLED",
            },
          });

          // Generate Roadmap Schedule based on user availability and previously generated schedules!
          try {
            const userProfile = await prisma.userProfile.findUnique({
              where: { userId },
            });
            if (
              userProfile &&
              userProfile.availabilityDays &&
              userProfile.availabilityHours
            ) {
              const rawDays = userProfile.availabilityDays;
              const days = Array.isArray(rawDays) ? (rawDays as string[]) : [];
              const hours =
                typeof userProfile.availabilityHours === "number"
                  ? userProfile.availabilityHours
                  : 2;
              if (days.length > 0) {
                await generateRoadmapSchedule(
                  userId,
                  savedRoadmap.id,
                  days,
                  hours,
                );
              }
            }
          } catch (scheduleErr) {
            console.error(
              "Failed to generate schedule for roadmap:",
              scheduleErr,
            );
          }

          // Done! Complete background state
          generationProgress.set(userId, {
            status: "complete",
            progress: 100,
            message: "Curriculum designed! Redirecting you now...",
            roadmapId: savedRoadmap.id,
          });
        } catch (error) {
          console.error("Background roadmap generation failed:", error);
          generationProgress.set(userId, {
            status: "error",
            progress: 0,
            message: `Generation failed: ${error instanceof Error ? error.message : "AI model error"}`,
          });
        }
      })();

      return {
        success: true,
        status: "started",
        profile,
      };
    }),
};
