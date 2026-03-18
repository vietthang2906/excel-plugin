import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClassifierService } from './classifier.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { QwenProvider } from './providers/qwen.provider';

@Module({
    imports: [ConfigModule],
    providers: [ClassifierService, AnthropicProvider, DeepSeekProvider, QwenProvider, OllamaProvider],
    exports: [ClassifierService, AnthropicProvider, DeepSeekProvider, QwenProvider, OllamaProvider],
})
export class LlmModule {}
