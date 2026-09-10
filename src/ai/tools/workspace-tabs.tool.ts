import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface TabDefinition {
  id: string;
  name: string;
  path: string;
  description: string;
  allowedRoles: Role[];
  sections: string[];
  roleCapabilities: {
    [key in Role]?: string[];
  };
  keyFields?: string[];
  tips: string[];
}

@Injectable()
export class WorkspaceTabsTool {
  private readonly tabs: TabDefinition[] = [
    {
      id: 'dashboard',
      name: 'Engineering Dashboard',
      path: '/dashboard',
      description:
        'High-level operational overview of team submission compliance, engineering velocity, open blockers, project workload, and time distribution.',
      allowedRoles: [Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN],
      sections: [
        'Submission Compliance KPI & Deadline Countdown (Fridays 17:00)',
        'Open Blockers Count & Critical Flag Indicators',
        'Engineering Velocity & Weekly Completed Tasks Trend',
        'Team Member Status Breakdown (Draft, Submitted, Needs Correction, Approved)',
        'Project Workload & Hours Logged by Project',
        'Time Breakdown (Dev, Testing, Meetings, Documentation)',
      ],
      roleCapabilities: {
        [Role.TEAM_MEMBER]: [
          'View aggregate team delivery pace and active company milestones',
          'Check overall weekly compliance rate',
        ],
        [Role.MANAGER]: [
          'Triage late submissions and trigger reminders',
          'Review systemic blockers impacting multiple projects',
          'Analyze workload distribution to prevent engineering burnout',
          'Filter metrics by specific week or project code',
        ],
        [Role.ADMIN]: [
          'Full operational oversight and engineering capacity management',
          'Audit team submission trends across quarters',
        ],
      },
      tips: [
        'Managers should check this tab on Friday afternoons to verify team compliance.',
        'Filter by project to isolate resource bottlenecks.',
      ],
    },
    {
      id: 'weekly-report-new',
      name: 'Weekly Report Form',
      path: '/reports/new',
      description:
        'Primary submission interface for individual engineering weekly deliverables, tasks breakdown, blockers, achievements, and hours accounting.',
      allowedRoles: [Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN],
      sections: [
        'Project Assignment Selector',
        'Reporting Period Dates (Monday to Friday)',
        'Tasks Breakdown Table (Task Name, Priority, Status, Planned %, Actual %, Planned & Spent Hours, Deliverable Links)',
        'Tasks Planned for Next Week (Bullet points of upcoming commitments)',
        'Blockers & Key Blocker Designation (Impediments requiring manager escalation)',
        'Weekly Achievements & Key Win Designation (Milestones reached)',
        'Time Breakdown Allocation (Dev, Testing, Meetings, Documentation)',
        'Additional Manager Notes & Submission Status',
      ],
      roleCapabilities: {
        [Role.TEAM_MEMBER]: [
          'Create new weekly reports or update drafts',
          'Break down engineering tasks with granular percentage progress',
          'Record spent hours across dev, testing, meetings, and docs',
          'Flag the #1 Key Blocker for urgent manager attention',
          'Highlight major achievements to showcase contribution',
          'Save as Draft to continue later, or Submit for Manager Review',
          'Revise and resubmit if the manager requests corrections',
        ],
        [Role.MANAGER]: [
          'Preview report format or create reports for assigned initiatives',
        ],
        [Role.ADMIN]: [
          'Submit administrative reports or test report submissions',
        ],
      },
      keyFields: [
        'Project: Choose which project code (e.g., MOB, CLD, INT) this week applies to.',
        'Tasks: Minimum 1 task required. Must provide task name, status (TODO/IN_PROGRESS/BLOCKED/DONE), and spent hours.',
        'Blockers: Optional but critical if blocked. Mark the single most severe item as Key Blocker.',
        'Time Breakdown: Dev Hours + Testing Hours + Meeting Hours + Doc Hours.',
      ],
      tips: [
        'Always link deliverable PRs, Jira tickets, or doc URLs in Deliverable Output.',
        'Ensure total hours logged match your logged tasks spent hours for clean accounting.',
        'Submissions are due before Friday 17:00 UTC.',
      ],
    },
    {
      id: 'reports-history',
      name: 'Team Reports & My History',
      path: '/reports/history',
      description:
        'Audit log of all past and current weekly reports. Functions as "My History" for members and "Team Reports Review Queue" for managers.',
      allowedRoles: [Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN],
      sections: [
        'Filter by Report Status (ALL, DRAFT, SUBMITTED, NEEDS_CORRECTION, APPROVED)',
        'Report Cards with Version Numbers, Date Range, User, and Project Code',
        'Status Badges (Approved = Green, Submitted = Blue, Needs Correction = Amber, Draft = Gray)',
        'Review Feedback & Revision Comments',
        'Full Report Version Diff Inspector',
      ],
      roleCapabilities: {
        [Role.TEAM_MEMBER]: [
          'Review all personal past weekly submissions',
          'Inspect previous version snapshots (Version 1, Version 2, etc.)',
          'Read manager review comments and requested modifications',
          'Click Edit to resume editing Drafts or reports in Needs Correction status',
        ],
        [Role.MANAGER]: [
          'Review reports submitted by all team members',
          'Approve reports that meet engineering quality standards',
          'Request Changes with targeted feedback for incomplete submissions',
          'Filter queue to quickly identify pending reviews',
        ],
        [Role.ADMIN]: [
          'Full audit access to all historic reports across all users and departments',
        ],
      },
      tips: [
        'If your report is marked "Needs Correction", review the manager comments at the top and resubmit an updated version.',
        'Managers can inspect version diffs to see what changes were made since the last submission.',
      ],
    },
    {
      id: 'weekly-blockers',
      name: 'Weekly Blockers & Achievements',
      path: '/manager/blockers',
      description:
        'Cross-team side-by-side aggregation board designed for rapid blockers triage and sprint wins recognition without opening individual reports.',
      allowedRoles: [Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN],
      sections: [
        'Filter by Target Week (All Weeks or specific Week #)',
        'Display Mode Selector (Blockers Only, Achievements Only, Both Side-by-Side)',
        'Key Flagged Blockers with Red Warning Callouts',
        'Team Member Attribution and Project Tagging',
        'Major Wins & Milestone Highlights',
      ],
      roleCapabilities: {
        [Role.TEAM_MEMBER]: [
          'Gain visibility into shared systemic impediments across teams',
          'See colleagues achievements to foster collaborative problem solving',
        ],
        [Role.MANAGER]: [
          'Rapidly isolate critical infrastructure or vendor blockers during standup',
          'Spot recurring dependencies across different project streams',
          'Gather highlights for executive and stakeholder updates',
        ],
        [Role.ADMIN]: [
          'Strategic review of organizational impediments and cross-functional hurdles',
        ],
      },
      tips: [
        'Use "Both" mode for weekly retrospectives and sync meetings.',
        'Items marked with red alert badges are designated as Key Blockers by members.',
      ],
    },
    {
      id: 'projects',
      name: 'Projects Management',
      path: '/projects',
      description:
        'Engineering project directory defining project codes, active/archived statuses, deliverable goals, and report counts.',
      allowedRoles: [Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN],
      sections: [
        'Project Grid with Name, Unique Code (e.g. MOB, CLD, INT), and Description',
        'Active vs Archived Project Status Indicators',
        'Total Reports Associated with Each Project',
        'Create New Project Dialog (Admin/Manager)',
        'Edit Project Metadata Dialog (Admin/Manager)',
      ],
      roleCapabilities: {
        [Role.TEAM_MEMBER]: [
          'Browse available projects to find the correct project code for weekly reporting',
          'Read project scope and team deliverables',
        ],
        [Role.MANAGER]: [
          'Create new engineering projects and assign unique alphanumeric codes',
          'Edit project descriptions and milestones',
          'Archive completed initiatives to keep member selectors tidy',
        ],
        [Role.ADMIN]: [
          'Full lifecycle project governance and code prefix allocation',
        ],
      },
      tips: [
        'Project codes must be unique and are automatically formatted to uppercase.',
        'Archiving a project preserves all historical weekly reports associated with it.',
      ],
    },
    {
      id: 'admin-users',
      name: 'Users & Roles Management',
      path: '/admin/users',
      description:
        'Central administrative directory for user accounts, role-based access control, account activations, and credential management.',
      allowedRoles: [Role.ADMIN],
      sections: [
        'User Directory Table (Name, Email, Role, Department, Status, Actions)',
        'Role Badges: TEAM_MEMBER, MANAGER, ADMIN',
        'Create User Modal with Temporary Password Setup',
        'Admin Password Reset Modal for Locked or Forgotten Accounts',
        'Account Status Toggle (Active / Suspended)',
        'User Deletion with Confirmation Safeguard',
      ],
      roleCapabilities: {
        [Role.TEAM_MEMBER]: [
          'Restricted access: Tab not accessible to Team Members.',
        ],
        [Role.MANAGER]: [
          'Restricted access: Tab not accessible to Managers (Admin-only).',
        ],
        [Role.ADMIN]: [
          'Create new user accounts and invite team members',
          'Promote or demote user roles (TEAM_MEMBER <-> MANAGER <-> ADMIN)',
          'Reset credentials for users who forgot passwords',
          'Suspend inactive or offboarded personnel',
        ],
      },
      tips: [
        'Role changes take effect immediately on next authentication refresh.',
        'Never delete a user who has active weekly reports unless archiving is intended.',
      ],
    },
    {
      id: 'settings',
      name: 'Profile & Settings',
      path: '/settings',
      description:
        'Personal account configuration allowing users to customize their profile identity, role badge, department, avatar color, and login password.',
      allowedRoles: [Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN],
      sections: [
        'Profile Information Form (Full Name, Job Title, Department)',
        'Avatar Color Customizer with Interactive Swatches',
        'Role & Email Read-Only Summary',
        'Change Password Form (Current Password, New Password, Confirm Password)',
      ],
      roleCapabilities: {
        [Role.TEAM_MEMBER]: [
          'Update display name and title as job roles evolve',
          'Select signature avatar badge color',
          'Securely update personal password',
        ],
        [Role.MANAGER]: [
          'Manage manager profile details and credentials',
        ],
        [Role.ADMIN]: [
          'Manage administrator credentials and profile identity',
        ],
      },
      tips: [
        'Your avatar color is visible to colleagues in team reports and comment headers.',
        'Passwords must be at least 6 characters.',
      ],
    },
  ];

  /**
   * Resolves tab details for a given tab identifier, route path, or query string.
   */
  resolveTab(tabOrPath?: string): TabDefinition | undefined {
    if (!tabOrPath) return undefined;
    const clean = tabOrPath.trim().toLowerCase();

    return this.tabs.find(
      (t) =>
        t.path.toLowerCase() === clean ||
        t.id.toLowerCase() === clean ||
        t.name.toLowerCase() === clean ||
        clean.includes(t.path.toLowerCase()) ||
        clean.includes(t.name.toLowerCase()) ||
        t.name.toLowerCase().includes(clean),
    );
  }

  /**
   * Detects which tab the user is inquiring about based on query text and current tab.
   */
  findRelevantTab(query: string, currentTab?: string, currentPath?: string): TabDefinition | undefined {
    const q = query.toLowerCase();

    // Check if query is explicitly asking about "this tab" or "current page"
    if (
      q.includes('this tab') ||
      q.includes('this page') ||
      q.includes('current tab') ||
      q.includes('where am i') ||
      q.includes('here') ||
      q.includes('explain this') ||
      q.includes('what can i do here')
    ) {
      if (currentPath) {
        const byPath = this.resolveTab(currentPath);
        if (byPath) return byPath;
      }
      if (currentTab) {
        const byTab = this.resolveTab(currentTab);
        if (byTab) return byTab;
      }
    }

    // Check if user specifically named a tab in query
    if (q.includes('dashboard') || q.includes('velocity') || q.includes('overview')) {
      return this.resolveTab('dashboard');
    }
    if (q.includes('blocker') || q.includes('achievement') || q.includes('win') || q.includes('impediment')) {
      return this.resolveTab('weekly-blockers');
    }
    if (q.includes('weekly report') || q.includes('submit report') || q.includes('draft report') || q.includes('new report') || q.includes('form')) {
      return this.resolveTab('weekly-report-new');
    }
    if (q.includes('history') || q.includes('past report') || q.includes('team report') || q.includes('previous report')) {
      return this.resolveTab('reports-history');
    }
    if (q.includes('project') || q.includes('projects')) {
      return this.resolveTab('projects');
    }
    if (q.includes('user') || q.includes('role') || q.includes('admin/user') || q.includes('permission')) {
      return this.resolveTab('admin-users');
    }
    if (q.includes('setting') || q.includes('profile') || q.includes('password') || q.includes('avatar')) {
      return this.resolveTab('settings');
    }

    // Default to current tab if provided
    if (currentPath) {
      const byPath = this.resolveTab(currentPath);
      if (byPath) return byPath;
    }
    if (currentTab) {
      const byTab = this.resolveTab(currentTab);
      if (byTab) return byTab;
    }

    return undefined;
  }

  /**
   * Generates a rich, Markdown-formatted explanation for a tab tailored to the user's role.
   */
  formatTabDetails(tab: TabDefinition, userRole: Role): string {
    const isAllowed = tab.allowedRoles.includes(userRole);
    if (!isAllowed) {
      return `### 🔒 Restricted Tab: ${tab.name}\n\nThe **${tab.name}** tab (\`${tab.path}\`) is restricted to **${tab.allowedRoles.join(', ')}** roles. As a **${userRole}**, you do not have permission to access or modify this tab.`;
    }

    const capabilities = tab.roleCapabilities[userRole] || [
      'Standard workspace access for this section.',
    ];

    let out = `### 📍 Tab Overview: **${tab.name}** (\`${tab.path}\`)\n\n`;
    out += `**Purpose:** ${tab.description}\n\n`;

    out += `#### 🛠️ What You Can Do as **${userRole}**:\n`;
    capabilities.forEach((c) => {
      out += `- ${c}\n`;
    });
    out += `\n`;

    out += `#### 📋 Key Sections on this Tab:\n`;
    tab.sections.forEach((s) => {
      out += `• **${s}**\n`;
    });
    out += `\n`;

    if (tab.keyFields && tab.keyFields.length) {
      out += `#### 📝 Key Fields & Requirements:\n`;
      tab.keyFields.forEach((f) => {
        out += `* ${f}\n`;
      });
      out += `\n`;
    }

    if (tab.tips && tab.tips.length) {
      out += `💡 **Helpful Tips:**\n`;
      tab.tips.forEach((t) => {
        out += `- ${t}\n`;
      });
    }

    return out;
  }

  /**
   * Returns a complete index of all tabs accessible to the specified role.
   */
  formatAllTabsDirectory(userRole: Role): string {
    let out = `### 🗺️ Cadence Workspace Tabs Directory\n\nHere are all tabs in your workspace and what you can do on each:\n\n`;

    this.tabs.forEach((t) => {
      const allowed = t.allowedRoles.includes(userRole);
      const icon = allowed ? '✅' : '🔒';
      const roleStatus = allowed ? `Accessible to ${userRole}` : `Requires ${t.allowedRoles.join(' / ')}`;

      out += `#### ${icon} **${t.name}** (\`${t.path}\`)\n`;
      out += `*${t.description}*\n`;
      out += `- **Access Level:** ${roleStatus}\n`;

      if (allowed && t.roleCapabilities[userRole]) {
        out += `- **Your Key Actions:** ${t.roleCapabilities[userRole]?.slice(0, 2).join('; ')}\n`;
      }
      out += `\n`;
    });

    return out;
  }
}
