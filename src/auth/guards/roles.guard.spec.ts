import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard (RBAC Automated Unit Tests)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (userRole?: Role): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRole ? { id: 'user-123', role: userRole } : null,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should allow access when no roles are required on the endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockExecutionContext(Role.TEAM_MEMBER);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access (throw 403 ForbiddenException) when a TEAM_MEMBER calls a MANAGER-restricted endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.MANAGER, Role.ADMIN]);
    const context = createMockExecutionContext(Role.TEAM_MEMBER);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Forbidden: Requires one of [MANAGER, ADMIN]',
    );
  });

  it('should grant access (return true) when a MANAGER calls a MANAGER-restricted endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.MANAGER, Role.ADMIN]);
    const context = createMockExecutionContext(Role.MANAGER);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should grant access (return true) when an ADMIN calls a MANAGER/ADMIN endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.MANAGER, Role.ADMIN]);
    const context = createMockExecutionContext(Role.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw 403 ForbiddenException if no user or role is attached to the request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.MANAGER]);
    const context = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
