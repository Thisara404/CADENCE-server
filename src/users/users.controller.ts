import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  // Profile management for current logged-in user
  @Patch('me/profile')
  async updateProfile(@CurrentUser() user: any, @Body() body: any) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Patch('me/change-password')
  async changeOwnPassword(@CurrentUser() user: any, @Body() body: any) {
    return this.usersService.changeOwnPassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // Admin and Manager can create user accounts with passwords
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  async createUser(@Body() dto: any) {
    return this.usersService.createUser(dto);
  }

  // Only Admin can delete accounts (with root admin protection)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  // Admin can reset password for any user
  @Roles(Role.ADMIN)
  @Patch(':id/password')
  async resetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.usersService.changePassword(id, newPassword);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body('role') role: Role) {
    return this.usersService.updateRole(id, role);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/status')
  async toggleStatus(@Param('id') id: string) {
    return this.usersService.toggleStatus(id);
  }
}
