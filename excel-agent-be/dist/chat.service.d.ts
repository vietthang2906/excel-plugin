export declare class ChatService {
    private readonly logger;
    private readonly ollamaUrl;
    generateResponse(userPrompt: string, excelContext: string): Promise<string>;
    routeTask(userPrompt: string, schema: any): Promise<any>;
}
