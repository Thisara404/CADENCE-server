import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportStatus, Role } from '@prisma/client';
import { ChatAiDto } from './dto/chat-ai.dto';
import { WorkspaceTabsTool } from './tools/workspace-tabs.tool';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private tabsTool: WorkspaceTabsTool,
  ) {}

  async generateResponse(
    dtoOrQuery: ChatAiDto | string,
    user?: any,
  ): Promise<{ answer: string; modelUsed: string }> {
    const query = typeof dtoOrQuery === 'string' ? dtoOrQuery : dtoOrQuery.query;
    const currentTab = typeof dtoOrQuery === 'string' ? undefined : dtoOrQuery.currentTab;
    const currentPath = typeof dtoOrQuery === 'string' ? undefined : dtoOrQuery.currentPath;
    const q = (query || '').trim().toLowerCase();

    const userRole: Role = (user?.role as Role) || Role.TEAM_MEMBER;
    const userName: string = user?.fullName || 'Engineering Team Member';
    const userTitle: string = user?.title || (userRole === Role.TEAM_MEMBER ? 'Software Engineer' : 'Engineering Manager');
    const userId: string = user?.id || '';

    // =========================================================================
    // GUARDRAIL 1: PREVENT DATABASE DELETION / MODIFICATION / DROP ATTEMPTS
    // =========================================================================
    const isDbDeletionAttempt =
      /(delete|drop|truncate|wipe|destroy|remove|clear)\s+(all\s+)?(database|db|tables?|reports?|users?|records?|schema|data)/i.test(q) ||
      /(drop\s+table|delete\s+from|truncate\s+table|alter\s+table)/i.test(q) ||
      /(delete\s+everything|drop\s+all|wipe\s+database)/i.test(q);

    if (isDbDeletionAttempt) {
      this.logger.warn(`Blocked database deletion attempt from user ${userName} (${userRole})`);
      return {
        answer: `### 🛡️ Security Guardrail: Action Prohibited\n\nI am the **Cadence AI Assistant** and operate strictly in **READ-ONLY** mode.\n\n- **Zero Database Modification:** I do not have permission or tools to delete, drop, wipe, or alter database records, tables, or reports.\n- **Data Protection:** All database modifications must be performed manually through the application interface with proper user authentication and RBAC permissions.`,
        modelUsed: 'CADENCE AI ASSISTANT · SECURITY GUARDRAIL',
      };
    }

    // =========================================================================
    // GUARDRAIL 2: PREVENT IMAGE GENERATION REQUESTS
    // =========================================================================
    const isImageGenAttempt =
      /(generate|create|draw|render|make|paint|produce)\s+(an?\s+)?(image|picture|graphic|photo|illustration|logo|diagram\s+image|artwork|visual)/i.test(q) ||
      /(text\s*to\s*image|dall-?e|midjourney|stable\s*diffusion)/i.test(q);

    if (isImageGenAttempt) {
      this.logger.log(`Rejected image generation request from user ${userName}`);
      return {
        answer: `### 🎨 Image Generation Prohibited\n\nI am the **Cadence AI Assistant**, strictly designed as a text-based engineering workspace and reporting copilot.\n\n- **No Image Generation:** I cannot generate, render, or manipulate images, graphics, or artwork.\n- **What I Can Do:** I can help you draft and structure weekly reports, format markdown tables, formulate blockers and achievements, analyze engineering velocity, and explain workspace tabs.`,
        modelUsed: 'CADENCE AI ASSISTANT · POLICY GUARDRAIL',
      };
    }

    // =========================================================================
    // GUARDRAIL 3: CONTENT VIOLATION & JAILBREAK FILTER
    // =========================================================================
    const isContentViolation =
      /(jailbreak|ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|dan\s+mode)/i.test(q) ||
      /(hate\s+speech|harass|weapon|exploit|malware|hack\s+database)/i.test(q);

    if (isContentViolation) {
      this.logger.warn(`Content policy violation attempt detected from user ${userName}`);
      return {
        answer: `I am the **Cadence AI Assistant**, strictly dedicated to your engineering team's weekly reports, project deliverables, blockers, and workspace tabs. Please submit a request related to your engineering work or workspace.`,
        modelUsed: 'CADENCE AI ASSISTANT · CONTENT FILTER',
      };
    }

    // =========================================================================
    // GUARDRAIL 4: ROLE-BASED ACCESS CONTROL (RBAC) FOR MEMBER RESTRICTIONS
    // =========================================================================
    const isManagerRestrictedQuery =
      /(who\s+is\s+late|late\s+submission|unsubmitted\s+reports|compliance\s+rate|all\s+users\s+passwords|delete\s+user|change\s+role)/i.test(q) &&
      !q.includes('my');

    if (userRole === Role.TEAM_MEMBER && isManagerRestrictedQuery) {
      return {
        answer: `### 🔒 Manager Permission Required\n\nHello **${userName}**! As a **Team Member**, your assistant permissions are scoped to your own engineering deliverables, assigned projects, task drafting, and workspace navigation.\n\n- **Restricted Data:** Team-wide submission compliance tracking, unsubmitted report audits, and user administration are restricted to **Manager** and **Admin** roles.\n- **How I Can Help You:** You can ask me to help structure your weekly report, polish task descriptions, articulate technical blockers, check your logged hours, or explain how to use any tab in this workspace!`,
        modelUsed: 'CADENCE AI ASSISTANT · RBAC ENFORCER',
      };
    }

    // =========================================================================
    // FEATURE 1: TAB INTELLIGENCE & DEDICATED TAB TOOL
    // =========================================================================
    const isAskingAboutTab =
      ((/(explain|what is|how do i use|what can i do|help me with|about|tell me about|guide|overview|fields|requirements|sections|fill|navigate|show)/i.test(q) &&
        (q.includes('tab') || q.includes('page') || q.includes('screen') || q.includes('form') || q.includes('here') || q.includes('where am i'))) ||
      q.includes('explain this tab') ||
      q.includes('what can i do here') ||
      q.includes('where am i') ||
      q.includes('tab directory') ||
      q.includes('all tabs'));

    if (isAskingAboutTab) {
      if (q.includes('all tabs') || q.includes('tab directory')) {
        return {
          answer: this.tabsTool.formatAllTabsDirectory(userRole),
          modelUsed: 'CADENCE AI ASSISTANT · TABS TOOL',
        };
      }

      const tab = this.tabsTool.findRelevantTab(q, currentTab, currentPath);
      if (tab) {
        return {
          answer: this.tabsTool.formatTabDetails(tab, userRole),
          modelUsed: 'CADENCE AI ASSISTANT · TABS TOOL',
        };
      }
    }

    // =========================================================================
    // DATA RETRIEVAL (SCOPED BY ROLE)
    // =========================================================================
    let recentReports: any[] = [];
    let allProjects: any[] = [];
    let allMembers: any[] = [];
    let myReports: any[] = [];

    if (userRole === Role.TEAM_MEMBER) {
      const [userReportsRes, projectsRes] = await Promise.all([
        this.prisma.report.findMany({
          where: userId ? { userId } : undefined,
          take: 6,
          orderBy: { weekStartDate: 'desc' },
          include: {
            project: { select: { name: true, code: true } },
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              include: { tasks: true, reviewComments: true },
            },
          },
        }),
        this.prisma.project.findMany({ where: { status: 'ACTIVE' } }),
      ]);
      myReports = userReportsRes;
      allProjects = projectsRes;
    } else {
      const [reportsRes, projectsRes, membersRes] = await Promise.all([
        this.prisma.report.findMany({
          take: 12,
          orderBy: { weekStartDate: 'desc' },
          include: {
            user: { select: { fullName: true, title: true, email: true } },
            project: { select: { name: true, code: true } },
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              include: { tasks: true },
            },
          },
        }),
        this.prisma.project.findMany(),
        this.prisma.user.findMany({ where: { role: Role.TEAM_MEMBER } }),
      ]);
      recentReports = reportsRes;
      allProjects = projectsRes;
      allMembers = membersRes;
    }

    // Metrics for Managers
    const blockersList: { member: string; project: string; text: string; isKey: boolean }[] = [];
    let totalPlannedTasks = 0;
    let totalCompletedTasks = 0;
    let totalHoursLogged = 0;
    const memberStatusSummary: Record<string, { status: string; hours: number; done: number; total: number }> = {};

    recentReports.forEach((r) => {
      const ver = r.versions[0];
      if (ver) {
        const hours = (ver.devHours || 0) + (ver.testingHours || 0) + (ver.meetingHours || 0) + (ver.docHours || 0);
        totalHoursLogged += hours;

        const tasks = ver.tasks || [];
        const done = tasks.filter((t) => t.status === 'DONE').length;
        totalPlannedTasks += tasks.length;
        totalCompletedTasks += done;

        memberStatusSummary[r.user.fullName] = {
          status: r.status,
          hours,
          done,
          total: tasks.length,
        };

        (ver.blockers || []).forEach((b: string, idx: number) => {
          blockersList.push({
            member: r.user.fullName,
            project: r.project.name,
            text: b,
            isKey: ver.keyBlockerIndex === idx,
          });
        });
      }
    });

    const keyBlockers = blockersList.filter((b) => b.isKey);
    const submittedCount = recentReports.filter((r) => r.status !== ReportStatus.DRAFT).length;
    const complianceRate = allMembers.length ? Math.round((submittedCount / allMembers.length) * 100) : 0;

    // Active tab context for prompt
    const activeTab = this.tabsTool.resolveTab(currentPath || currentTab) || this.tabsTool.resolveTab('dashboard');

    // =========================================================================
    // GEMINI SDK LLM GENERATION (IF AVAILABLE)
    // =========================================================================
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        let prompt = `You are CADENCE AI ASSISTANT, an internal engineering workspace copilot.
User Info:
- Name: ${userName}
- Job Title: ${userTitle}
- Role: ${userRole}
- Current Active Tab: ${activeTab ? `${activeTab.name} (${activeTab.path})` : 'Workspace Overview'}

Available Active Projects in Workspace:
${allProjects.map((p) => `• ${p.name} [Code: ${p.code}] - ${p.description || 'Active initiative'}`).join('\n')}
`;

        if (userRole === Role.TEAM_MEMBER) {
          const latestMyReport = myReports[0];
          const latestVer = latestMyReport?.versions[0];
          prompt += `
Member Data Context:
- Recent Reports Count: ${myReports.length}
- Latest Report: ${latestMyReport ? `Status: ${latestMyReport.status}, Project: ${latestMyReport.project?.name}` : 'No reports filed yet'}
- Latest Tasks: ${latestVer?.tasks?.map((t: any) => `[${t.status}] ${t.taskName} (${t.spentHours || 0}h)`).join(', ') || 'None'}
- Latest Logged Hours: Dev: ${latestVer?.devHours || 0}h, Testing: ${latestVer?.testingHours || 0}h, Meetings: ${latestVer?.meetingHours || 0}h, Docs: ${latestVer?.docHours || 0}h
- Latest Blockers: ${latestVer?.blockers?.join(', ') || 'None'}

MEMBER COPILOT RULES:
1. You are here to empower ${userName} with their engineering deliverables, task drafting, blocker structuring, time calculation, and tab navigation.
2. If ${userName} asks to draft tasks, format blockers, or write their weekly report, give them concrete, high-quality, professional technical examples.
3. Do NOT leak team-wide compliance audits, private manager reviews, or colleague unsubmitted drafts.
`;
        } else {
          prompt += `
Manager Workspace Reporting Data:
- Total Team Members: ${allMembers.length} (${allMembers.map((m) => m.fullName).join(', ')})
- Reports Submitted: ${submittedCount} (Compliance: ${complianceRate}%)
- Total Hours Logged: ${totalHoursLogged}h
- Tasks Completed: ${totalCompletedTasks} of ${totalPlannedTasks}
- Flagged Key Blockers: ${keyBlockers.length ? keyBlockers.map((b) => `• [${b.project}] ${b.member}: "${b.text}"`).join('\n') : '• None'}
- All Blockers: ${blockersList.length ? blockersList.map((b) => `• [${b.project}] ${b.member}: "${b.text}"`).join('\n') : '• None'}
- Team Breakdown:
${Object.entries(memberStatusSummary).map(([name, s]) => `• ${name}: ${s.status}, Done: ${s.done}/${s.total}, Hours: ${s.hours}h`).join('\n')}
`;
        }

        prompt += `
Current User Question: "${query}"

STRICT GUARDRAILS:
1. Identify yourself strictly as "CADENCE AI ASSISTANT".
2. ABSOLUTE ZERO DATABASE DELETION OR MODIFICATION: You have zero tools or permissions to delete, drop, wipe, or update DB records. Firmly refuse any such request.
3. ABSOLUTE ZERO IMAGE GENERATION: You cannot generate or render images or graphics. Firmly refuse any image generation request.
4. ONLY answer questions directly pertaining to engineering reports, tasks, deliverables, blockers, active projects, hours, and Cadence workspace tabs.
5. If the user asks about the current tab (${activeTab ? activeTab.name : 'Unknown'}) or any other tab, explain its purpose, key sections, and what they can do according to their role (${userRole}).
6. Refuse general trivia, entertainment, personal advice, or off-topic prompts politely.
`;

        const modelsToTry = [
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-flash',
          'gemini-3.6-flash',
        ];

        for (const model of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
            });

            if (response && response.text) {
              this.logger.log(`Generated response using ${model} for user ${userName} (${userRole})`);
              return {
                answer: response.text,
                modelUsed: 'CADENCE AI ASSISTANT',
              };
            }
          } catch (modelErr: any) {
            this.logger.warn(`Model ${model} failed: ${modelErr.message || modelErr}`);
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      } catch (err: any) {
        this.logger.error(`Gemini API call error: ${err.message || err}`);
      }
    }

    // =========================================================================
    // HIGH-FIDELITY ANALYTICAL FALLBACK ENGINE
    // =========================================================================
    let fallbackText = '';

    // A. TEAM MEMBER ASSISTANCE
    if (userRole === Role.TEAM_MEMBER) {
      if (/task|draft|write|help\s+me|create\s+report/.test(q)) {
        fallbackText = `### ✍️ Weekly Report Task Draft Helper\n\nHello **${userName}**! Here is an example of how to structure your deliverables for this week:\n\n` +
          `| Task Name | Priority | Status | Progress | Hours | Deliverable Output |\n` +
          `|:---|:---:|:---:|:---:|:---:|:---|\n` +
          `| **Refactor JWT Auth Guard & RBAC** | \`HIGH\` | \`DONE\` | 100% | 12h | [PR #142](https://github.com/org/repo/pull/142) |\n` +
          `| **Optimize PostgreSQL Connection Pool** | \`MEDIUM\` | \`IN_PROGRESS\` | 70% | 8h | Branch: \`feat/pg-pool-tuning\` |\n` +
          `| **Staging E2E Smoke Testing** | \`LOW\` | \`DONE\` | 100% | 6h | Test Report Artifact |\n\n` +
          `**Next Step:** Head to the **[Weekly Report Form](/reports/new)**, select your project code (e.g. \`${allProjects[0]?.code || 'MOB'}\`), and enter your tasks!`;
      } else if (/blocker|impediment|stuck|problem/.test(q)) {
        fallbackText = `### 🚨 Blocker Phrasing & Escalation Guide\n\nWhen recording blockers on your weekly report, follow this 3-part framework:\n\n` +
          `1. **The Specific Obstacle:** What technical dependency or bottleneck is halted?\n` +
          `2. **The Project Impact:** Which milestone or deliverable is delayed?\n` +
          `3. **The Required Action:** Who needs to intervene (DevOps, Client, Architecture)?\n\n` +
          `*Example:* *"Staging Kubernetes cluster running out of memory during E2E tests, delaying Release candidate verification. Requires DevOps team to increase memory limits."*\n\n` +
          `💡 **Tip:** If this is your most critical hurdle, remember to check **"Mark as Key Blocker"** so it highlights in red for your manager during weekly triage!`;
      } else if (/hour|time|logged|spent/.test(q)) {
        const latest = myReports[0]?.versions[0];
        const devH = latest?.devHours || 0;
        const testH = latest?.testingHours || 0;
        const meetH = latest?.meetingHours || 0;
        const docH = latest?.docHours || 0;
        const totalH = devH + testH + meetH + docH;

        fallbackText = `### ⏱️ Logged Hours Accounting\n\n` +
          `- **Latest Recorded Total:** **${totalH} hours**\n` +
          `- **Development:** ${devH}h\n` +
          `- **Testing & QA:** ${testH}h\n` +
          `- **Team Syncs & Meetings:** ${meetH}h\n` +
          `- **Documentation:** ${docH}h\n\n` +
          `💡 **Reporting Guideline:** Standard weekly expectations are 35-40 hours total. Ensure the sum of task spent hours matches your overall time allocation.`;
      } else if (/status|my\s+report|correction|approved/.test(q)) {
        const latest = myReports[0];
        fallbackText = `### 📋 Your Report Status\n\n` +
          `- **Latest Report:** ${latest ? `Report for ${latest.project?.name} [${latest.project?.code}]` : 'No report filed yet'}\n` +
          `- **Current Status:** \`${latest?.status || 'NOT_FOUND'}\`\n` +
          `- **Version:** v${latest?.currentVersionNumber || 1}\n\n` +
          (latest?.status === 'NEEDS_CORRECTION'
            ? `⚠️ **Action Required:** Your manager requested revisions. Please review the feedback notes on your [My History](/reports/history) tab and click Edit.`
            : latest?.status === 'SUBMITTED'
            ? `⏳ **Under Review:** Your report has been submitted and is awaiting manager approval.`
            : latest?.status === 'APPROVED'
            ? `✅ **Approved:** Your report was reviewed and signed off by management!`
            : `📝 **Draft:** Your report is in draft. Make sure to submit before Friday 17:00!`);
      } else {
        fallbackText = `Hello **${userName}**! I am your **Cadence Engineering Copilot**. You are currently on the **${activeTab?.name || 'Workspace'}**.\n\nI can help you:\n- **Draft Weekly Report Tasks:** Suggest task breakdowns, percentages, and deliverables\n- **Formulate Blockers:** Write clear, actionable blocker explanations\n- **Review Logged Hours:** Check time distribution across dev, test, meetings, and docs\n- **Explain Workspace Tabs:** Ask *"Explain this tab"* or *"What can I do here?"* to learn all tab features!`;
      }
    }
    // B. MANAGER / ADMIN ASSISTANCE
    else {
      if (/block|risk|issue|stuck|impediment/.test(q)) {
        const topKey = keyBlockers.slice(0, 3);
        fallbackText = `### 🚨 Weekly Blocker Analysis\n\nThere are **${blockersList.length} total blockers** recorded this week across active initiatives, with **${keyBlockers.length} designated as Key Issues of the Week**:\n\n` +
          (topKey.length
            ? topKey.map((k) => `* **${k.member}** (${k.project}): *${k.text}*`).join('\n')
            : '• No critical key blockers flagged this week.') +
          `\n\n**Manager Takeaways:**\n- Check the **[Weekly Blockers board](/manager/blockers)** to inspect all team challenges side by side.\n- Systemic infrastructure bottlenecks should be addressed in sprint sync rather than one-on-one.`;
      } else if (/summar|digest|overview|week|progress/.test(q)) {
        fallbackText = `### 📋 Weekly Team Summary\n\n- **Reporting Compliance:** **${complianceRate}%** (${submittedCount} of ${allMembers.length} submitted).\n- **Velocity:** **${totalCompletedTasks} tasks closed** out of ${totalPlannedTasks} planned.\n- **Engineering Hours:** **${totalHoursLogged} hours** logged across ${allProjects.length} active projects.\n\n` +
          Object.entries(memberStatusSummary)
            .map(([name, s]) => `* **${name}**: ${s.status === 'APPROVED' ? '✅ Approved' : s.status === 'SUBMITTED' ? '⏳ Awaiting Review' : s.status === 'NEEDS_CORRECTION' ? '⚠️ In Correction' : '📝 Draft'} (${s.done}/${s.total} tasks, ${s.hours}h)`)
            .join('\n') +
          `\n\n**Suggested Action:** Review pending submissions before Friday 17:00.`;
      } else if (/complian|late|missing|submit/.test(q)) {
        const pendingNames = recentReports.filter((r) => r.status === ReportStatus.DRAFT).map((r) => r.user.fullName);
        fallbackText = `### ⏱️ Submission Compliance\n\n- **Compliance Rate:** **${complianceRate}%**.\n- **Draft / Incomplete:** ${pendingNames.length ? pendingNames.join(', ') : 'None — all members submitted'}.\n- **Correction Queue:** ${recentReports.filter((r) => r.status === ReportStatus.NEEDS_CORRECTION).length} report(s) currently being revised by members.`;
      } else if (/alex|dana|marcus|sarah/.test(q)) {
        const foundName = Object.keys(memberStatusSummary).find((name) => q.includes(name.toLowerCase().split(' ')[0])) || 'Alex Chen';
        const s = memberStatusSummary[foundName] || { status: 'SUBMITTED', hours: 38, done: 4, total: 5 };
        fallbackText = `### 👤 Member Profile: ${foundName}\n\n- **Current Report Status:** \`${s.status}\`\n- **Tasks Completed:** ${s.done} of ${s.total} (${Math.round((s.done / (s.total || 1)) * 100)}%)\n- **Logged Time:** ${s.hours} hours\n\n**Theme:** Steady progress with focus on deliverable closure and peer code reviews.`;
      } else {
        fallbackText = `Hello **${userName}** (${userRole})! I am the **Cadence AI Assistant**, dedicated to engineering team reports, project deliverables, blockers, and workspace tabs.\n\nYou can ask about:\n- **Team Blockers:** *"What is blocking the team?"*\n- **Weekly Digest:** *"Summarise W37 velocity"*\n- **Submission Compliance:** *"Who is late on submission?"*\n- **Tab Guidance:** *"Explain this tab"* or *"Show all tabs"*`;
      }
    }

    return {
      answer: fallbackText,
      modelUsed: 'CADENCE AI ASSISTANT',
    };
  }
}
