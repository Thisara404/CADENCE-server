import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { WorkspaceTabsTool } from './tools/workspace-tabs.tool';

@Module({
  controllers: [AiController],
  providers: [AiService, WorkspaceTabsTool],
  exports: [AiService, WorkspaceTabsTool],
})
export class AiModule {}
