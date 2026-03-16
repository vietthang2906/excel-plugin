"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ChatService = ChatService_1 = class ChatService {
    configService;
    logger = new common_1.Logger(ChatService_1.name);
    apiKey;
    apiUrl = 'https://api.anthropic.com/v1/messages';
    model;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.getOrThrow('ANTHROPIC_API_KEY');
        this.model = this.configService.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6';
    }
    async generateResponse(userPrompt, excelContext, history = []) {
        const systemPrompt = `You are an expert AI assistant operating inside Microsoft Excel.
Your task is to answer the user's question based Strictly and Exclusively on the provided JSON data representing all worksheets in the workbook.

The data is structured as an object where each key is a sheet name and each value is an array of row objects (first row = headers).

CRITICAL INSTRUCTIONS:
1. ONLY use the data provided below. NEVER invent, guess, hallucinate, or synthesize information, names, numbers, or facts.
2. If the user's question cannot be completely answered using the provided data, you MUST reply with exactly: "I cannot answer this based on the provided spreadsheet data."
3. When answering, be concise and direct. Do not add conversational filler.
4. If the data is empty or all sheets are empty, inform the user that the workbook appears to have no data to answer questions about.
5. When referencing data from multiple sheets, indicate which sheet(s) the data comes from.

--- WORKBOOK DATA (ALL SHEETS) ---
${excelContext || '{}'}
--------------------------------`;
        let first10Lines = '';
        try {
            const parsed = JSON.parse(excelContext || '{}');
            let displayData = parsed;
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                displayData = Object.fromEntries(Object.entries(parsed).slice(0, 2).map(([k, v]) => [
                    k,
                    Array.isArray(v) ? v.slice(0, 3) : v,
                ]));
            }
            else if (Array.isArray(parsed)) {
                displayData = parsed.slice(0, 5);
            }
            first10Lines = JSON.stringify(displayData, null, 2);
        }
        catch (e) {
            const contextLines = (excelContext || '').split(/\r?\n/);
            first10Lines = contextLines.slice(0, 10).join('\n');
        }
        this.logger.log(`Sending prompt to Claude (Context length: ${excelContext?.length || 0} chars)\nFirst few records of context:\n${first10Lines}`);
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [
                        ...history
                            .filter((m) => m.role === 'user' || m.role === 'assistant')
                            .map((m) => ({ role: m.role, content: m.content })),
                        { role: 'user', content: userPrompt },
                    ],
                }),
            });
            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Claude API returned status ${response.status}: ${errBody}`);
            }
            const data = (await response.json());
            const textBlock = data.content?.find((b) => b.type === 'text');
            return (textBlock?.text ?? '').trim();
        }
        catch (error) {
            this.logger.error('Failed to communicate with Claude API', error);
            throw error;
        }
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ChatService);
//# sourceMappingURL=chat.service.js.map