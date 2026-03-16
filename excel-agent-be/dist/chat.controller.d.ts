import { ChatService } from './chat.service';
export interface ChatMessageDto {
    role: 'user' | 'assistant';
    content: string;
}
export interface ChatRequestDto {
    prompt: string;
    context: string;
    history?: ChatMessageDto[];
}
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    handleChat(body: ChatRequestDto): Promise<{
        reply: string;
    }>;
}
