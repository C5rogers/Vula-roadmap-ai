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
      lessons: z.array(
        z.object({
          title: z
            .string()
            .describe("The lesson title, e.g. 'Understanding useState'"),
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

Please generate a cohesive Roadmap. The Roadmap must contain between 2 to 6 Chapters (depending on duration and goals). Each Chapter must contain between 2 to 5 Lessons.
For each Lesson, generate an 'overview' (a brief outline of what is covered) and 'content' (detailed, markdown-formatted study notes, concepts, practical hands-on exercises, or guides, customized to their experience level and learning style).
Also generate a highly motivating 'promptToLearn' message custom tailored to their experience level and preferred learning style.
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
          chapters: {
            create: aiRoadmap.chapters.map((chapter) => ({
              title: chapter.title,
              description: chapter.description,
              overview: chapter.overview,
              summary: chapter.summary,
              order: chapter.order,
              lessons: {
                create: chapter.lessons.map((lesson) => ({
                  title: lesson.title,
                  overview: lesson.overview,
                  content: lesson.content,
                  order: lesson.order,
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
