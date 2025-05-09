import {
    BedrockAgentRuntimeClient,
    CitationEvent,
    RetrieveAndGenerateCommand,
    RetrieveAndGenerateCommandOutput,
    RetrieveAndGenerateStreamCommand,
    RetrieveAndGenerateStreamCommandOutput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { QueryCitation } from '../knowledge-base';

export interface RetrieveAndGenerateProps {
    bedrockRuntimeClient: BedrockAgentRuntimeClient;
    knowledgeBaseId: string;
    modelArn: string;
    numberOfResults?: number;
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
    numberOfResults,
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
                retrievalConfiguration: {
                    vectorSearchConfiguration: {
                        numberOfResults,
                    },
                },
                knowledgeBaseId,
                modelArn: modelArn,
            },
        },
        sessionId,
    });

    return await bedrockRuntimeClient.send(command);
};

const isS3Url = (url: string | undefined): boolean => {
    if (!url) {
        return false;
    }
    return /^https:\/\/s3\.[a-z0-9-]+\.amazonaws/.test(url);
};

export const citationEventToQueryCitation = ({
    generatedResponsePart,
    retrievedReferences,
}: CitationEvent): QueryCitation => ({
    messagePart: generatedResponsePart?.textResponsePart?.span ?? {},
    references:
        retrievedReferences?.map(({ location }) => {
            const startIndex = isS3Url(location?.kendraDocumentLocation?.uri)
                ? 4
                : 3;
            return {
                fileName: decodeURIComponent(
                    location?.kendraDocumentLocation?.uri
                        ?.split('/')
                        .slice(startIndex)
                        .join('/') ?? ''
                ),
            };
        }) ?? [],
});
