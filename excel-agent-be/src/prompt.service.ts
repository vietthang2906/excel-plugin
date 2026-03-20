import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PromptService implements OnModuleInit {
    private readonly logger = new Logger(PromptService.name);
    private behaviorRules = '';
    private routerInstructions = '';
    private metadataPrompt = '';

    onModuleInit() {
        const promptsDir = path.join(__dirname, 'prompts');
        this.behaviorRules = fs.readFileSync(
            path.join(promptsDir, 'behavior-rules.txt'),
            'utf-8',
        );
        this.routerInstructions = fs.readFileSync(
            path.join(promptsDir, 'router-instructions.txt'),
            'utf-8',
        );
        this.metadataPrompt = fs.readFileSync(
            path.join(promptsDir, 'metadata-prompt.txt'),
            'utf-8',
        );
        this.logger.log(
            `Loaded prompt files (behavior-rules: ${this.behaviorRules.length} chars, router-instructions: ${this.routerInstructions.length} chars, metadata-prompt: ${this.metadataPrompt.length} chars)`,
        );
    }

    /**
     * Build the full system prompt for the Answer LLM.
     *
     * Assembly order (per system-prompt-structure.txt):
     *   1. behavior-rules.txt  — Section 0 (structure-first) + Sections 1–20 (behavioral rules)
     *   2. metadata-prompt.txt — Sheet metadata guide + Locate/Map/Extract examples
     *   3. Excel subset data   — Rows fetched by the Router phase (may be empty)
     *   4. User question
     */
    buildAnswerPrompt(excelContext: string, userQuestion: string): string {
        const systemPrompt = `${this.behaviorRules}

${this.metadataPrompt}

================================================================================
EXCEL SUBSET DATA (fetched by Router)
================================================================================
${excelContext || '(none — no data was fetched for this question)'}
================================================================================`;

        return `${systemPrompt}\n\nUser Question: ${userQuestion}\n\nAnswer:`;
    }
    /**
     * Build the full system prompt for the Router LLM.
     *
     * assembly order:
     *   1. router-instructions.txt — decision logic + {{SCHEMA_BLOCK}}
     *   2. Optional structure context — (e.g., Spine Scan results)
     *   3. User question
     */
    buildRouterPrompt(schemaBlock: string, userQuestion: string, structureContext?: string): string {
        let systemPrompt = this.routerInstructions.replace(
            '{{SCHEMA_BLOCK}}',
            schemaBlock,
        );

        if (structureContext) {
            systemPrompt += `\n\n================================================================================\nADDITIONAL STRUCTURE CONTEXT (from structural scanning phase)\n================================================================================\n${structureContext}\n================================================================================`;
        }

        return `${systemPrompt}\n\nUser Question: ${userQuestion}\n\nAgent Output:`;
    }
}
