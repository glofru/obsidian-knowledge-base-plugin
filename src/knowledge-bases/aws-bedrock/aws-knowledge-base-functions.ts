import {
    BedrockAgentClient,
    GetKnowledgeBaseCommand,
    KnowledgeBaseSummary,
    ListKnowledgeBasesCommand,
} from '@aws-sdk/client-bedrock-agent';
import {
    DataSourceSummary,
    DataSourceSyncJob,
    DataSourceSyncJobStatus,
    DescribeDataSourceCommand,
    DescribeDataSourceCommandOutput,
    KendraClient,
    ListDataSourcesCommand,
    ListDataSourceSyncJobsCommand,
    StartDataSourceSyncJobCommand,
} from '@aws-sdk/client-kendra';
import cacheManager from '@type-cacheable/core';
import { GetProductsCommand, Pricing } from '@aws-sdk/client-pricing';

const SYNC_ID_SEPARATOR = '|';

export interface KnowledgeBaseRequestProps {
    bedrockAgentClient: BedrockAgentClient;
    kendraClient: KendraClient;
    knowledgeBaseId: string;
}

const getKnowledgeBase = async ({
    knowledgeBaseId,
    bedrockAgentClient,
}: KnowledgeBaseRequestProps): Promise<any> => {
    const cachedKB = await cacheManager.client?.get(`kb-${knowledgeBaseId}`);
    if (cachedKB) {
        console.log('Using cached knowledge base');
        return cachedKB;
    }

    const command = new GetKnowledgeBaseCommand({
        knowledgeBaseId,
    });
    const response = await bedrockAgentClient.send(command);

    await cacheManager.client?.set(
        `kb-${knowledgeBaseId}`,
        response.knowledgeBase
    );

    return response.knowledgeBase;
};

const getKBKendraIndexId = async (
    props: KnowledgeBaseRequestProps
): Promise<string | undefined> => {
    const knowledgeBase = await getKnowledgeBase(props);
    return knowledgeBase?.knowledgeBaseConfiguration?.kendraKnowledgeBaseConfiguration?.kendraIndexArn?.split(
        '/'
    )[1];
};

const listKendraDataSources = async ({
    kendraClient,
    kendraIndexId,
}: {
    kendraClient: KendraClient;
    kendraIndexId: string;
}): Promise<DataSourceSummary[]> => {
    const cachedDataSources = await cacheManager.client?.get(
        `list-${kendraIndexId}`
    );
    if (cachedDataSources) {
        console.log('Using cached data sources');
        return cachedDataSources;
    }

    const command = new ListDataSourcesCommand({
        IndexId: kendraIndexId,
    });
    const response = await kendraClient.send(command);

    await cacheManager.client?.set(
        `list-${kendraIndexId}`,
        response.SummaryItems
    );

    return response.SummaryItems ?? [];
};

const listKendraDataSourcesSyncJobs = async ({
    kendraClient,
    kendraIndexId,
    dataSourceId,
}: {
    kendraClient: KendraClient;
    kendraIndexId: string;
    dataSourceId: string;
}): Promise<DataSourceSyncJob | undefined> => {
    const command = new ListDataSourceSyncJobsCommand({
        IndexId: kendraIndexId,
        Id: dataSourceId,
        MaxResults: 1,
    });
    const response = await kendraClient.send(command);

    return response.History?.at(0);
};

const describeKendraDataSources = async ({
    kendraClient,
    kendraIndexId,
}: {
    kendraClient: KendraClient;
    kendraIndexId: string;
}): Promise<DescribeDataSourceCommandOutput[]> => {
    const dataSources = await listKendraDataSources({
        kendraClient,
        kendraIndexId,
    });

    return await Promise.all(
        dataSources.map(async ({ Id: dataSourceId }) => {
            const command = new DescribeDataSourceCommand({
                Id: dataSourceId,
                IndexId: kendraIndexId,
            });
            return await kendraClient.send(command);
        })
    );
};

const syncKendraIndex = async ({
    kendraClient,
    kendraIndexId,
}: {
    kendraClient: KendraClient;
    kendraIndexId: string;
}): Promise<string> => {
    const dataSources = await listKendraDataSources({
        kendraClient,
        kendraIndexId,
    });

    const dataSourceIds = await Promise.all(
        dataSources.map(async ({ Id }) => {
            if (!Id) {
                throw 'Data source ID is undefined';
            }

            const command = new StartDataSourceSyncJobCommand({
                Id,
                IndexId: kendraIndexId,
            });
            await kendraClient.send(command);
            return Id;
        })
    );

    return dataSourceIds.join(SYNC_ID_SEPARATOR);
};

export const syncKnowledgeBase = async (
    props: KnowledgeBaseRequestProps
): Promise<string> => {
    const kendraIndexId = await getKBKendraIndexId(props);

    if (!kendraIndexId) {
        throw 'TODO: only Kendra KB are supported';
    }

    const { kendraClient } = props;
    return syncKendraIndex({ kendraIndexId, kendraClient });
};

export const getKnowledgeBaseS3BucketName = async (
    props: KnowledgeBaseRequestProps
): Promise<string> => {
    const kendraIndexId = await getKBKendraIndexId(props);

    if (!kendraIndexId) {
        throw 'TODO: only Kendra KB are supported';
    }

    for (const dataSource of await describeKendraDataSources({
        kendraClient: props.kendraClient,
        kendraIndexId,
    })) {
        const bucketName =
            dataSource?.Configuration?.S3Configuration?.BucketName ??
            (dataSource?.Configuration?.TemplateConfiguration?.Template as any)[
                'connectionConfiguration'
            ]['repositoryEndpointMetadata']['BucketName'];

        if (bucketName) {
            return bucketName;
        }
    }

    throw 'No S3 bucket found for the Kendra index';
};

export const getDataSourcesStatus = async (
    props: KnowledgeBaseRequestProps,
    syncId: string
): Promise<DataSourceSyncJobStatus[]> => {
    const kendraIndexId = await getKBKendraIndexId(props);

    if (!kendraIndexId) {
        throw 'TODO: only Kendra KB are supported';
    }

    const dataSourceIds = syncId.split(SYNC_ID_SEPARATOR);

    const syncJobs = await Promise.all(
        dataSourceIds.map((dataSourceId) =>
            listKendraDataSourcesSyncJobs({
                kendraClient: props.kendraClient,
                kendraIndexId,
                dataSourceId,
            })
        )
    );

    return syncJobs.map(
        (job) => job?.Status ?? DataSourceSyncJobStatus.SUCCEEDED
    );
};

export const listKnowledgeBases = async ({
    bedrockAgentClient,
}: {
    bedrockAgentClient: BedrockAgentClient;
}): Promise<KnowledgeBaseSummary[]> => {
    let nextToken: string | undefined;
    let allKnowledgeBases: KnowledgeBaseSummary[] = [];

    do {
        // Create and send the ListKnowledgeBasesCommand
        const command = new ListKnowledgeBasesCommand({
            nextToken,
        });

        try {
            const response = await bedrockAgentClient.send(command);

            // Process the response
            if (response.knowledgeBaseSummaries) {
                allKnowledgeBases = allKnowledgeBases.concat(
                    response.knowledgeBaseSummaries
                );
            }

            // Update the nextToken for pagination
            nextToken = response.nextToken;
        } catch (error) {
            console.error('Error listing knowledge bases:', error);
            break;
        }
    } while (nextToken);

    return allKnowledgeBases;
};

export interface AWSRegion {
    name: string;
    code: string;
}

export const listRegions = async ({
    pricingClient,
}: {
    pricingClient: Pricing;
}): Promise<AWSRegion[]> => {
    // List region from the pricing client

    const regions: AWSRegion[] = [];
    let nextToken: string | undefined;

    try {
        do {
            const response = await pricingClient.send(
                new GetProductsCommand({
                    ServiceCode: 'AmazonKendra',
                    Filters: [
                        {
                            // @ts-ignore
                            Type: 'CONTAINS',
                            Field: 'usagetype',
                            Value: 'KendraIntelligentRanking',
                        },
                    ],
                    FormatVersion: 'aws_v1',
                    NextToken: nextToken,
                })
            );

            for (const product of response.PriceList ?? []) {
                const productObj = JSON.parse(product as string);
                const regionName = productObj.product.attributes?.location;
                const regionCode = productObj.product.attributes?.regionCode;
                if (regionName && regionCode) {
                    regions.push({
                        name: regionName,
                        code: regionCode,
                    });
                }
            }

            nextToken = response.NextToken;
        } while (nextToken);

        regions.sort((a, b) => a.name.localeCompare(b.name));

        return regions;
    } catch (error) {
        console.error('Error fetching Kendra regions via Pricing API:', error);
        throw error;
    }
};
