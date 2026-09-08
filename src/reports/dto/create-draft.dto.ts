import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskItemDto } from './task-item.dto';

export class SaveDraftDto {
  @IsString()
  @IsOptional()
  reportId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Project ID is required' })
  projectId: string;

  @IsDateString()
  @IsNotEmpty({ message: 'Week start date is required' })
  weekStartDate: string;

  @IsDateString()
  @IsNotEmpty({ message: 'Week end date is required' })
  weekEndDate: string;

  @IsString()
  @IsOptional()
  tasksPlannedNextWeek?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockers?: string[] = [];

  @IsInt()
  @IsOptional()
  keyBlockerIndex?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  achievements?: string[] = [];

  @IsInt()
  @IsOptional()
  keyAchievementIndex?: number;

  @IsNumber()
  @IsOptional()
  devHours?: number = 0;

  @IsNumber()
  @IsOptional()
  testingHours?: number = 0;

  @IsNumber()
  @IsOptional()
  meetingHours?: number = 0;

  @IsNumber()
  @IsOptional()
  docHours?: number = 0;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskItemDto)
  @IsOptional()
  tasks?: TaskItemDto[] = [];
}
