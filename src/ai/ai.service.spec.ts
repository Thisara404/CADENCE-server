import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceTabsTool } from './tools/workspace-tabs.tool';
import { Role } from '@prisma/client';

describe('AiService Autofill & Copilot Tests', () => {
  let aiService: AiService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      report: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'proj-mobile', name: 'Mobile App Redesign', code: 'MAR-01', status: 'ACTIVE' },
          { id: 'proj-cloud', name: 'Cloud Migration', code: 'CLM-02', status: 'ACTIVE' },
          { id: 'proj-tooling', name: 'Internal Tooling', code: 'INT-03', status: 'ACTIVE' },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: mockPrismaService },
        WorkspaceTabsTool,
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
  });

  const memberUser = {
    id: 'u-thisara-member',
    fullName: 'Thisara Dasun',
    role: Role.TEAM_MEMBER,
    title: 'Associate Software Engineer',
  };

  it('1. should automatically trigger fill_report_form when user asks: "i want add mobile design project with 2 blockers and 5 highlights"', async () => {
    const res = await aiService.generateResponse(
      'i want add mobile design project with 2 blockers and 5 highlights',
      memberUser,
    );

    expect(res.toolCall).toBeDefined();
    expect(res.toolCall?.tool).toBe('fill_report_form');
    expect(res.toolCall?.data.projectId).toBe('proj-mobile');
    expect(res.toolCall?.data.projectCode).toBe('MAR-01');
    expect(res.toolCall?.data.projectName).toBe('Mobile App Redesign');
    expect(res.toolCall?.data.blockers.length).toBe(2);
    expect(res.toolCall?.data.achievements.length).toBe(5);
    expect(res.toolCall?.data.tasks.length).toBe(5);
    expect(res.answer).toContain('⚡ Cadence AI Internal Tool Executed');
    expect(res.answer).toContain('Mobile App Redesign');
  });

  it('2. should trigger fill_report_form and maintain context when user asks: "can you add those to the form"', async () => {
    // First interaction defines context
    await aiService.generateResponse(
      'i want add mobile design project with 2 blockers and 5 highlights',
      memberUser,
    );

    // Follow-up interaction
    const res = await aiService.generateResponse('can you add those to the form', memberUser);

    expect(res.toolCall).toBeDefined();
    expect(res.toolCall?.tool).toBe('fill_report_form');
    expect(res.toolCall?.data.projectCode).toBe('MAR-01');
    expect(res.toolCall?.data.blockers.length).toBe(2);
    expect(res.toolCall?.data.achievements.length).toBe(5);
  });

  it('3. should trigger fill_report_form when user says: "no i want to autofill it"', async () => {
    const res = await aiService.generateResponse('no i want to autofill it', memberUser);

    expect(res.toolCall).toBeDefined();
    expect(res.toolCall?.tool).toBe('fill_report_form');
    expect(res.toolCall?.data.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.toolCall?.data.blockers.length).toBeGreaterThanOrEqual(1);
  });

  it('4. should trigger fill_report_form when user clicks chip: "⚡ Auto-fill 5 tasks, blockers & highlights"', async () => {
    const res = await aiService.generateResponse(
      '⚡ Auto-fill 5 tasks, blockers & highlights',
      memberUser,
    );

    expect(res.toolCall).toBeDefined();
    expect(res.toolCall?.tool).toBe('fill_report_form');
    expect(res.toolCall?.data.tasks.length).toBe(5);
    expect(res.toolCall?.data.blockers.length).toBe(2);
  });

  it('5. should reject form autofill if caller is MANAGER (RBAC guardrail)', async () => {
    const managerUser = {
      id: 'u-sarah-mgr',
      fullName: 'Sarah Jenkins',
      role: Role.MANAGER,
      title: 'Engineering Director',
    };

    const res = await aiService.generateResponse(
      'i want add mobile design project with 2 blockers and 5 highlights',
      managerUser,
    );

    expect(res.toolCall).toBeUndefined();
    expect(res.modelUsed).toContain('RBAC ENFORCER');
    expect(res.answer).toContain('Action Restricted to Team Members');
  });

  it('6. should route "explain this tab" to WorkspaceTabsTool without triggering autofill', async () => {
    const res = await aiService.generateResponse(
      { query: 'explain this tab', currentTab: 'Weekly Report Form', currentPath: '/reports/new' },
      memberUser,
    );

    expect(res.toolCall).toBeUndefined();
    expect(res.modelUsed).toContain('TABS TOOL');
    expect(res.answer).toContain('Weekly Report Form');
  });
});
