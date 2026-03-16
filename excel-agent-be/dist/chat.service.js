"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
let ChatService = ChatService_1 = class ChatService {
    logger = new common_1.Logger(ChatService_1.name);
    ollamaUrl = 'http://127.0.0.1:11434/api/generate';
    async generateResponse(userPrompt, excelContext) {
        const systemPrompt = `You are an expert AI assistant operating inside Microsoft Excel.
Your task is to answer the user's question based Strictly and Exclusively on the provided JSON data representing the current worksheet.

CRITICAL INSTRUCTIONS:
1. ONLY use the data provided below. NEVER invent, guess, hallucinate, or synthesize information, names, numbers, or facts.
2. If the user's question cannot be completely answered using the provided data, you MUST reply with exactly: "I cannot answer this based on the provided spreadsheet data. Note that data must be in the active worksheet."
3. When answering, be concise and direct. Do not add conversational filler.
4. If the data is empty ("[]") or missing, inform the user that their worksheet appears to be empty and there is no data to answer questions about.

--- CURRENT SPREADSHEET DATA (JSON ARRAY) ---
${excelContext || "[]"}
--------------------------------`;
        const fullPrompt = `${systemPrompt}\n\nUser Question: ${userPrompt}\n\nAnswer:`;
        let first10Lines = '';
        try {
            const parsed = JSON.parse(excelContext || '[]');
            const displayData = Array.isArray(parsed) ? parsed.slice(0, 5) : parsed;
            first10Lines = JSON.stringify(displayData, null, 2);
        }
        catch (e) {
            const contextLines = (excelContext || '').split(/\r?\n/);
            first10Lines = contextLines.slice(0, 10).join('\n');
        }
        this.logger.log(`Sending prompt to local Llama 3 (Context length: ${excelContext?.length || 0} chars)\nFirst few records of context:\n${first10Lines}`);
        try {
            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama3.1',
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.1
                    }
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }
            const data = (await response.json());
            return data.response.trim();
        }
        catch (error) {
            this.logger.error('Failed to communicate with Ollama', error);
            throw error;
        }
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)()
], ChatService);
//# sourceMappingURL=chat.service.js.map