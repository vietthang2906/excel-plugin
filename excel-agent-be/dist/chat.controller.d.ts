import { ChatService } from './chat.service';
export interface ChatRequestDto {
    prompt: string;
    context: string;
}
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    handleChat(body: ChatRequestDto): Promise<{
        reply: string;
    }>;
}
