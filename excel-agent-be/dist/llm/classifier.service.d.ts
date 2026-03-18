import { ConfigService } from '@nestjs/config';
export type TaskType = 'complex' | 'high_volume' | 'simple';
export declare class ClassifierService {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    classify(prompt: string, context: string, rowCount?: number): Promise<TaskType>;
    private estimateRowCount;
}
