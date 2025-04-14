import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { KendraClient } from '@aws-sdk/client-kendra';
import { S3Client } from '@aws-sdk/client-s3';
import { BedrockClient } from '@aws-sdk/client-bedrock';

/**
 * Decorator factory that refreshes AWS credentials before method execution
 */
export function refreshAwsCredentials(profile: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            // Refresh the credentials before method execution
            const credentials = refreshCredentials(profile);

            // Refresh Bedrock client
            this.bedrockClient = new BedrockClient({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Refresh Bedrock Agent client
            this.bedrockAgentClient = new BedrockAgentClient({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Refresh Bedrock Runtime client
            this.bedrockRuntimeClient = new BedrockAgentRuntimeClient({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Refresh Kendra client
            this.kendraClient = new KendraClient({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Refresh S3 client
            this.s3Client = new S3Client({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Execute the original method with the refreshed credentials
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

const parseIni = (
    input: string
): {
    [key: string]: string | { [key: string]: string };
} => {
    const result: { [key: string]: string | { [key: string]: string } } = {};
    let section = result;

    input.split('\n').forEach((line) => {
        let match;
        if ((match = line.match(/^\s*\[\s*([^\]]*)\s*\]\s*$/))) {
            section = result[match[1]] = {};
        } else if ((match = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/))) {
            section[match[1]] = match[2];
        }
    });

    return result;
};

/**
 * Refresh AWS credentials using the AWS SDK
 */
function refreshCredentials(profile: string): AwsCredentialIdentity {
    const filePath = path.join(os.homedir(), '.aws', 'credentials'); // TODO: make it setting

    if (!fs.existsSync(filePath)) {
        throw 'Cannot find AWS credentials file';
    }

    const content = fs.readFileSync(filePath).toString('utf8');
    const credentialsContent = parseIni(content);

    for (const [profileName, data] of Object.entries(credentialsContent)) {
        if (profileName !== profile) {
            continue;
        }

        const credentialsData = data as any;

        return {
            accessKeyId: credentialsData.aws_access_key_id,
            secretAccessKey: credentialsData.aws_secret_access_key,
            sessionToken: credentialsData.aws_session_token,
        };
    }

    throw 'Cannot find profile in credentials file';
}
