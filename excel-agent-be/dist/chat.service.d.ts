import { PromptService } from './prompt.service';
export declare class ChatService {
    private readonly promptService;
    private readonly logger;
    private readonly ollamaUrl;
    constructor(promptService: PromptService);
    generateResponse(userPrompt: string, excelContext: string): Promise<string>;
    routeTask(userPrompt: string, schema: any, structureContext?: string): Promise<any>;
}
