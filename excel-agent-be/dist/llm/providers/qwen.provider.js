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
var QwenProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QwenProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let QwenProvider = QwenProvider_1 = class QwenProvider {
    configService;
    logger = new common_1.Logger(QwenProvider_1.name);
    name = 'Qwen';
    apiKey;
    baseUrl;
    model;
    maxOutputTokens;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('DASHSCOPE_API_KEY') ?? '';
        this.baseUrl =
            this.configService.get('DASHSCOPE_BASE_URL') ??
                'https://dashscope.aliyuncs.com/compatible-mode/v1';
        this.model = this.configService.get('QWEN_MODEL') ?? 'qwen-turbo';
        this.maxOutputTokens =
            parseInt(this.configService.get('MAX_OUTPUT_TOKENS') ?? '512', 10) || 512;
    }
    isAvailable() {
        return !!this.apiKey;
    }
    async chat(systemPrompt, userPrompt, context, modelOverride) {
        if (!this.apiKey) {
            throw new Error('DASHSCOPE_API_KEY is not configured');
        }
        const model = modelOverride ?? this.model;
        const userContent = `${context || ''}\n\nUser Question: ${userPrompt}`;
        this.logger.log(`[LLM_REQUEST] model=${model} | systemLen=${systemPrompt.length} | userContentLen=${userContent.length}`);
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent },
                ],
                max_tokens: this.maxOutputTokens,
                temperature: 0.1,
            }),
        });
        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`[LLM_RESPONSE] status=${response.status} | error=${errBody.slice(0, 200)}`);
            throw new Error(`Qwen/DashScope API returned status ${response.status}: ${errBody}`);
        }
        const data = (await response.json());
        const content = (data.choices?.[0]?.message?.content ?? '').trim();
        this.logger.log(`[LLM_RESPONSE] status=${response.status} | contentLen=${content.length} | preview="${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);
        return content;
    }
};
exports.QwenProvider = QwenProvider;
exports.QwenProvider = QwenProvider = QwenProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], QwenProvider);
//# sourceMappingURL=qwen.provider.js.map