import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class TaskItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Task name is required' })
  taskName: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus = TaskStatus.TODO;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  plannedPercentage?: number = 0;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  actualPercentage?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  plannedHours?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  spentHours?: number = 0;

  @IsString()
  @IsOptional()
  deliverableOutput?: string;
}
