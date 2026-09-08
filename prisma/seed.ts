import { PrismaClient, Role, ReportStatus, TaskPriority, TaskStatus, ProjectStatus, ReviewAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing records in reverse dependency order
  await prisma.reviewComment.deleteMany();
  await prisma.taskItem.deleteMany();
  await prisma.reportVersion.deleteMany();
  await prisma.report.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const sarah = await prisma.user.create({
    data: {
      id: 'u-sarah-manager',
      email: 'manager@company.com',
      passwordHash,
      fullName: 'Sarah Kim',
      role: Role.ADMIN,
      department: 'Engineering Leadership',
      title: 'Engineering Manager',
      avatarColor: '#ec3013',
      active: true,
    },
  });

  const alex = await prisma.user.create({
    data: {
      id: 'u-alex-member',
      email: 'alex@company.com',
      passwordHash,
      fullName: 'Alex Chen',
      role: Role.TEAM_MEMBER,
      department: 'Frontend Engineering',
      title: 'Senior Frontend Engineer',
      avatarColor: '#2563eb',
      active: true,
    },
  });

  const dana = await prisma.user.create({
    data: {
      id: 'u-dana-member',
      email: 'dana@company.com',
      passwordHash,
      fullName: 'Dana Lee',
      role: Role.TEAM_MEMBER,
      department: 'Platform Engineering',
      title: 'DevOps / Cloud Engineer',
      avatarColor: '#059669',
      active: true,
    },
  });

  const marcus = await prisma.user.create({
    data: {
      id: 'u-marcus-member',
      email: 'marcus@company.com',
      passwordHash,
      fullName: 'Marcus Vance',
      role: Role.TEAM_MEMBER,
      department: 'Backend Engineering',
      title: 'Backend Systems Engineer',
      avatarColor: '#7c3aed',
      active: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: 'u-admin-root',
      email: 'admin@cadence.com',
      passwordHash,
      fullName: 'Cadence Admin',
      role: Role.ADMIN,
      department: 'Engineering Operations',
      title: 'Principal Administrator',
      avatarColor: '#111827',
      active: true,
    },
  });

  console.log('✅ Created 5 users (2 Admins/Managers, 3 Team Members)');

  // 2. Create Projects
  const mobileProject = await prisma.project.create({
    data: {
      id: 'proj-mobile',
      name: 'Mobile App Redesign',
      code: 'MAR-01',
      description: 'Next-gen cross-platform mobile experience with offline reporting support',
      status: ProjectStatus.ACTIVE,
    },
  });

  const cloudProject = await prisma.project.create({
    data: {
      id: 'proj-cloud',
      name: 'Cloud Migration',
      code: 'CLM-02',
      description: 'Migrating legacy monolithic workloads to Kubernetes microservices on AWS',
      status: ProjectStatus.ACTIVE,
    },
  });

  const toolingProject = await prisma.project.create({
    data: {
      id: 'proj-tooling',
      name: 'Internal Tooling',
      code: 'INT-03',
      description: 'Developer productivity tools, CI pipelines, and automated reporting services',
      status: ProjectStatus.ACTIVE,
    },
  });

  console.log('✅ Created 3 projects');

  // Dates for 4 weeks
  // W34: 4 weeks ago
  // W35: 3 weeks ago
  // W36: 2 weeks ago
  // W37: Current week
  const now = new Date();
  const getWeekRange = (weeksAgo: number) => {
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1) - weeksAgo * 7;
    monday.setDate(diff);
    monday.setHours(9, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(18, 0, 0, 0);

    return { start: monday, end: friday };
  };

  const w34 = getWeekRange(3);
  const w35 = getWeekRange(2);
  const w36 = getWeekRange(1);
  const w37 = getWeekRange(0);

  // W34 Reports (All APPROVED)
  const repW34Alex = await prisma.report.create({
    data: {
      userId: alex.id,
      projectId: mobileProject.id,
      weekStartDate: w34.start,
      weekEndDate: w34.end,
      status: ReportStatus.APPROVED,
      currentVersionNumber: 1,
      versions: {
        create: {
          versionNumber: 1,
          tasksPlannedNextWeek: 'Complete design system color tokens and typography scale integration.',
          blockers: ['Awaiting final Figma component specs from design team.'],
          keyBlockerIndex: 0,
          achievements: ['Delivered mobile navigation drawer prototype ahead of schedule.'],
          keyAchievementIndex: 0,
          devHours: 24,
          testingHours: 6,
          meetingHours: 4,
          docHours: 4,
          notes: 'Smooth iteration overall; design team was quick to clarify drawer animations.',
          tasks: {
            create: [
              {
                taskName: 'Navigation drawer animation specs',
                priority: TaskPriority.HIGH,
                status: TaskStatus.DONE,
                plannedPercentage: 100,
                actualPercentage: 100,
                plannedHours: 12,
                spentHours: 11,
                deliverableOutput: 'https://github.com/org/mobile/pull/101',
              },
              {
                taskName: 'Figma token parser script',
                priority: TaskPriority.MEDIUM,
                status: TaskStatus.DONE,
                plannedPercentage: 100,
                actualPercentage: 100,
                plannedHours: 8,
                spentHours: 8,
                deliverableOutput: 'PR #104 merged',
              },
            ],
          },
        },
      },
      reviewComments: {
        create: {
          reviewerId: sarah.id,
          comment: 'Excellent work delivering the navigation prototype early!',
          action: ReviewAction.APPROVED,
        },
      },
    },
  });

  // W35 Reports (All APPROVED)
  await prisma.report.create({
    data: {
      userId: alex.id,
      projectId: mobileProject.id,
      weekStartDate: w35.start,
      weekEndDate: w35.end,
      status: ReportStatus.APPROVED,
      currentVersionNumber: 1,
      versions: {
        create: {
          versionNumber: 1,
          tasksPlannedNextWeek: 'Build user profile and settings views with biometric unlock.',
          blockers: ['iOS simulator certificate expired, renewed after 2 hours.'],
          keyBlockerIndex: 0,
          achievements: ['Integrated offline cache layer using SQLite storage.'],
          keyAchievementIndex: 0,
          devHours: 26,
          testingHours: 6,
          meetingHours: 5,
          docHours: 2,
          tasks: {
            create: [
              {
                taskName: 'Offline storage caching adapter',
                priority: TaskPriority.HIGH,
                status: TaskStatus.DONE,
                plannedPercentage: 100,
                actualPercentage: 100,
                plannedHours: 16,
                spentHours: 18,
                deliverableOutput: 'https://github.com/org/mobile/pull/112',
              },
              {
                taskName: 'Biometric unlock research and spikes',
                priority: TaskPriority.MEDIUM,
                status: TaskStatus.DONE,
                plannedPercentage: 100,
                actualPercentage: 100,
                plannedHours: 8,
                spentHours: 7,
                deliverableOutput: 'Spike doc in Notion',
              },
            ],
          },
        },
      },
      reviewComments: {
        create: {
          reviewerId: sarah.id,
          comment: 'Approved. Offline cache benchmark looks very solid.',
          action: ReviewAction.APPROVED,
        },
      },
    },
  });

  // W36 Report for Dana (NEEDS_CORRECTION demonstration with Version 1 & Review Comment)
  const danaW36 = await prisma.report.create({
    data: {
      userId: dana.id,
      projectId: cloudProject.id,
      weekStartDate: w36.start,
      weekEndDate: w36.end,
      currentVersionNumber: 2,
      status: ReportStatus.NEEDS_CORRECTION,
      versions: {
        create: [
          {
            versionNumber: 1,
            tasksPlannedNextWeek: 'Set up Terraform configurations for multi-region EKS cluster.',
            blockers: [
              'Staging AWS quota limit reached for c6g.large instances',
              'IAM role propagation delay during automated terraform run',
            ],
            keyBlockerIndex: 0,
            achievements: ['Completed Dockerfile optimization, reducing image size by 62%.'],
            keyAchievementIndex: 0,
            devHours: 20,
            testingHours: 10,
            meetingHours: 4,
            docHours: 3,
            notes: 'Initial submission. Quota limit ticket filed with AWS support (ref #9021).',
            submittedAt: w36.end,
            tasks: {
              create: [
                {
                  taskName: 'Multi-stage Dockerfile overhaul',
                  priority: TaskPriority.HIGH,
                  status: TaskStatus.DONE,
                  plannedPercentage: 100,
                  actualPercentage: 100,
                  plannedHours: 12,
                  spentHours: 11,
                  deliverableOutput: '', // Missing deliverable link flagged by manager
                },
                {
                  taskName: 'EKS cluster Helm charts setup',
                  priority: TaskPriority.HIGH,
                  status: TaskStatus.IN_PROGRESS,
                  plannedPercentage: 80,
                  actualPercentage: 50,
                  plannedHours: 14,
                  spentHours: 16,
                  deliverableOutput: 'Work in branch feat/helm-setup',
                },
              ],
            },
          },
          {
            versionNumber: 2,
            tasksPlannedNextWeek: 'Deploy Helm charts across secondary region staging cluster.',
            blockers: [
              'Staging AWS quota limit reached for c6g.large instances (ticket escalated)',
            ],
            keyBlockerIndex: 0,
            achievements: [
              'Completed Dockerfile optimization, reducing image size by 62%.',
              'Attached GitHub PR link and automated CI validation artifacts.',
            ],
            keyAchievementIndex: 1,
            devHours: 22,
            testingHours: 11,
            meetingHours: 4,
            docHours: 3,
            notes: 'Revised submission: Added Dockerfile overhaul PR #402 and updated Helm notes.',
            submittedAt: new Date(w36.end.getTime() + 86400000), // Next day
            tasks: {
              create: [
                {
                  taskName: 'Multi-stage Dockerfile overhaul',
                  priority: TaskPriority.HIGH,
                  status: TaskStatus.DONE,
                  plannedPercentage: 100,
                  actualPercentage: 100,
                  plannedHours: 12,
                  spentHours: 12,
                  deliverableOutput: 'https://github.com/org/infra/pull/402', // Added in v2!
                },
                {
                  taskName: 'EKS cluster Helm charts setup',
                  priority: TaskPriority.HIGH,
                  status: TaskStatus.DONE,
                  plannedPercentage: 80,
                  actualPercentage: 85,
                  plannedHours: 14,
                  spentHours: 15,
                  deliverableOutput: 'https://github.com/org/infra/tree/feat/helm-setup',
                },
              ],
            },
          },
        ],
      },
      reviewComments: {
        create: [
          {
            reviewerId: sarah.id,
            comment:
              'Please provide the deliverable PR link for the Dockerfile overhaul and update the EKS Helm chart notes before resubmitting.',
            action: ReviewAction.REQUESTED_CHANGES,
          },
        ],
      },
    },
  });

  // W37 Reports (Current Week):
  // 1. Marcus Vance (SUBMITTED - Ready for manager review demonstration!)
  await prisma.report.create({
    data: {
      userId: marcus.id,
      projectId: toolingProject.id,
      weekStartDate: w37.start,
      weekEndDate: w37.end,
      status: ReportStatus.SUBMITTED,
      currentVersionNumber: 1,
      versions: {
        create: {
          versionNumber: 1,
          tasksPlannedNextWeek: 'Build GitHub Actions composite step for report validation.',
          blockers: [
            'Shared redis instance memory saturation during high concurrency test runs',
            'Flaky mock SMTP server in local test harness',
          ],
          keyBlockerIndex: 0,
          achievements: ['Implemented rate limiter middleware with zero latency penalty.'],
          keyAchievementIndex: 0,
          devHours: 25,
          testingHours: 8,
          meetingHours: 3,
          docHours: 3,
          tasks: {
            create: [
              {
                taskName: 'Sliding window rate-limiter middleware',
                priority: TaskPriority.HIGH,
                status: TaskStatus.DONE,
                plannedPercentage: 100,
                actualPercentage: 100,
                plannedHours: 14,
                spentHours: 15,
                deliverableOutput: 'https://github.com/org/tooling/pull/88',
              },
              {
                taskName: 'Swagger API documentation generation',
                priority: TaskPriority.MEDIUM,
                status: TaskStatus.DONE,
                plannedPercentage: 100,
                actualPercentage: 100,
                plannedHours: 8,
                spentHours: 6,
                deliverableOutput: 'https://api.internal.company.com/docs',
              },
              {
                taskName: 'Redis connection pool health check',
                priority: TaskPriority.HIGH,
                status: TaskStatus.IN_PROGRESS,
                plannedPercentage: 100,
                actualPercentage: 70,
                plannedHours: 10,
                spentHours: 9,
                deliverableOutput: 'Branch: feat/redis-health',
              },
            ],
          },
        },
      },
    },
  });

  // 2. Alex Chen (DRAFT - Ready for personal report page editing & submission demonstration!)
  await prisma.report.create({
    data: {
      userId: alex.id,
      projectId: mobileProject.id,
      weekStartDate: w37.start,
      weekEndDate: w37.end,
      status: ReportStatus.DRAFT,
      currentVersionNumber: 1,
      versions: {
        create: {
          versionNumber: 1,
          tasksPlannedNextWeek: 'Finalize end-to-end integration tests on iOS simulator.',
          blockers: [
            'Waiting on backend GraphQL schema update for offline report queueing',
          ],
          keyBlockerIndex: 0,
          achievements: ['Refactored theme tokens to support automated dark mode.'],
          keyAchievementIndex: 0,
          devHours: 18,
          testingHours: 4,
          meetingHours: 4,
          docHours: 2,
          tasks: {
            create: [
              {
                taskName: 'Dark mode theme token refactor',
                priority: TaskPriority.HIGH,
                status: TaskStatus.DONE,
                plannedPercentage: 100,
                actualPercentage: 100,
                plannedHours: 10,
                spentHours: 9,
                deliverableOutput: 'https://github.com/org/mobile/pull/130',
              },
              {
                taskName: 'Offline queue synchronization state machine',
                priority: TaskPriority.HIGH,
                status: TaskStatus.IN_PROGRESS,
                plannedPercentage: 80,
                actualPercentage: 60,
                plannedHours: 14,
                spentHours: 12,
                deliverableOutput: 'Branch: feat/offline-queue',
              },
            ],
          },
        },
      },
    },
  });

  console.log('✅ Seeded 4 weeks of historical reports with all 4 statuses (Approved, Needs Correction, Submitted, Draft)');
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
