import { IsNotEmpty, IsString } from 'class-validator';

export class ChatAiDto {
  @IsString()
  @IsNotEmpty({ message: 'Query message cannot be empty' })
  query: string;
}
