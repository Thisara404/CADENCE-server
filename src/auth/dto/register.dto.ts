import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid work email' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(4, { message: 'Password must be at least 4 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsEnum(Role, { message: 'Role must be TEAM_MEMBER, MANAGER, or ADMIN' })
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  title?: string;
}
