import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Project code is required' })
  code: string;

  @IsString()
  @IsOptional()
  description?: string;
}
