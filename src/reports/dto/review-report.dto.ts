import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export enum ReviewActionType {
  APPROVE = 'APPROVE',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
}

export class ReviewReportDto {
  @IsEnum(ReviewActionType, { message: 'Action must be APPROVE or REQUEST_CHANGES' })
  @IsNotEmpty()
  action: ReviewActionType;

  @ValidateIf((o) => o.action === ReviewActionType.REQUEST_CHANGES)
  @IsNotEmpty({ message: 'Feedback comment is required when requesting changes' })
  @IsString()
  comment?: string;
}
