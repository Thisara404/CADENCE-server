import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatAiDto {
  @IsString()
  @IsNotEmpty({ message: 'Query message cannot be empty' })
  query: string;

  @IsString()
  @IsOptional()
  currentTab?: string;

  @IsString()
  @IsOptional()
  currentPath?: string;

  @IsOptional()
  tabContext?: Record<string, any>;
}
