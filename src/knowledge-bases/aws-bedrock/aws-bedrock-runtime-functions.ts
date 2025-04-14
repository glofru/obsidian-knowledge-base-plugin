import {
    BedrockAgentRuntimeClient,
    RetrieveAndGenerateCommand,
    RetrieveAndGenerateCommandOutput,
    RetrieveAndGenerateStreamCommand,
    RetrieveAndGenerateStreamCommandOutput,
} from '@aws-sdk/client-bedrock-agent-runtime';

export interface RetrieveAndGenerateProps {
    bedrockRuntimeClient: BedrockAgentRuntimeClient;
    knowledgeBaseId: string;
    modelArn: string;
    text: string;
    sessionId?: string;
}

export const retrieveAndGenerate = async ({
    text,
    sessionId,
    modelArn,
    knowledgeBaseId,
    bedrockRuntimeClient,
}: RetrieveAndGenerateProps): Promise<RetrieveAndGenerateCommandOutput> => {
    const command = new RetrieveAndGenerateCommand({
        input: {
            text,
        },
        retrieveAndGenerateConfiguration: {
            type: 'KNOWLEDGE_BASE',
            knowledgeBaseConfiguration: {
                knowledgeBaseId,
                modelArn: modelArn,
            },
        },
        sessionId,
    });

    return await bedrockRuntimeClient.send(command);
};

export const retrieveAndGenerateStream = async ({
    text,
    sessionId,
    modelArn,
    knowledgeBaseId,
    bedrockRuntimeClient,
}: RetrieveAndGenerateProps): Promise<RetrieveAndGenerateStreamCommandOutput> => {
    const command = new RetrieveAndGenerateStreamCommand({
        input: {
            text,
        },
        retrieveAndGenerateConfiguration: {
            type: 'KNOWLEDGE_BASE',
            knowledgeBaseConfiguration: {
                knowledgeBaseId,
                modelArn: modelArn,
            },
        },
        sessionId,
    });

    return await bedrockRuntimeClient.send(command);
};
