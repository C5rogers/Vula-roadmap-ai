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
              "The media type of this lesson. Distribute types among TEXT, VIDEO, AUDIO, and PDF lessons to make a rich, multi-sensory curriculum. Generate TEXT for written articles, VIDEO for video lectures/walkthroughs, AUDIO for podcast/lecture transcripts, and PDF for slides/printable guides.",
            ),
          overview: z
            .string()
            .describe("A clear outline of what this lesson covers"),
          content: z
            .string()
            .describe(
              "Comprehensive, highly engaging study notes and guidelines in Markdown format, tailored to the user's experience level, learning style and commitment",
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

export const onboardingRouter = {
  getProfile: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    return await prisma.userProfile.findUnique({
      where: { userId },
    });
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
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getRoadmap: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
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
          const lessonType = lesson.type || "TEXT";
          timeSpentByType[lessonType] =
            (timeSpentByType[lessonType] || 0) + userProgress.timeSpent;
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

  submit: protectedProcedure
    .input(onboardingInputSchema)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 1. Save or update the onboarding information in the UserProfile database
      const profile = await prisma.userProfile.upsert({
        where: { userId },
        update: {
          learningGoals: input.learningGoals,
          experienceLevel: input.experienceLevel,
          learningStyle: input.learningStyle,
          weeklyCommitment: input.weeklyCommitment,
          preferredDuration: input.preferredDuration,
          additionalNotes: input.additionalNotes,
        },
        create: {
          userId,
          learningGoals: input.learningGoals,
          experienceLevel: input.experienceLevel,
          learningStyle: input.learningStyle,
          weeklyCommitment: input.weeklyCommitment,
          preferredDuration: input.preferredDuration,
          additionalNotes: input.additionalNotes,
        },
      });

      // 2. Generate roadmap using the Gemini Pro / Gemini Flash AI model
      const prompt = `You are an elite educational AI agent that designs perfect, personalized structured learning roadmaps.
Design a highly custom roadmap for a student with the following onboarding preferences:
- Learning Goals: ${input.learningGoals}
- Experience Level: ${input.experienceLevel}
- Learning Style Preference: ${input.learningStyle} (e.g. document, video, mixed)
- Weekly Commitment: ${input.weeklyCommitment} hours
- Preferred Duration: ${input.preferredDuration}
${input.additionalNotes ? `- Additional Notes: ${input.additionalNotes}` : ""}

Please generate a cohesive Roadmap. The Roadmap must contain between 2 to 4 Chapters (depending on duration and goals). Each Chapter must contain between 2 to 4 Lessons.
For each Lesson:
1. Generate an 'overview' (a brief outline of what is covered) and 'content' (detailed, markdown-formatted study notes, concepts, practical hands-on exercises, or guides, customized to their experience level and learning style).
2. Curate 1 to 2 learning 'resources' (with realistic titles, URLs, and types matching their style like VIDEO or ARTICLE).
3. Design 2 to 4 active-recall 'flashcards' (with front questions and back answers) for quick study.
4. Extract 2 to 4 key 'glossaries' (terms and definitions).
5. Add an instant lesson-level 'quiz' (with exactly 2 questions, 4 options each, correct answer text, and detailed explanation).

For each Chapter:
1. Design a chapter-level assessment 'quiz' (with exactly 3 questions testing chapter-wide understanding).

For the overall Roadmap:
1. Design an overall course final 'quiz' (with exactly 5 comprehensive questions covering the entire roadmap).

Return the result structured according to the schema.`;

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
        include: {
          chapters: {
            include: {
              lessons: true,
            },
          },
        },
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

      return {
        success: true,
        profile,
        roadmap: {
          id: savedRoadmap.id,
          title: savedRoadmap.title,
          description: savedRoadmap.description,
          overview: savedRoadmap.overview,
          summary: savedRoadmap.summary,
          promptToLearn: aiRoadmap.promptToLearn,
          chapters: savedRoadmap.chapters,
        },
      };
    }),
};
