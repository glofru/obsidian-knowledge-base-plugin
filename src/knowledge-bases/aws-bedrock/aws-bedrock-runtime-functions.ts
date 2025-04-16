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

export const citationEventToQueryCitation = ({
    generatedResponsePart,
    retrievedReferences,
}: CitationEvent): QueryCitation => ({
    messagePart: generatedResponsePart?.textResponsePart?.span ?? {},
    references:
        retrievedReferences?.map(({ location }) => {
            const startIndex =
                location?.kendraDocumentLocation?.uri?.startsWith(
                    'https://s3.us-west-2.amazonaws'
                )
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
