import {
    BedrockRuntimeClient,
    InvokeModelCommand,
    InvokeModelCommandInput,
    InvokeModelCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

const TITAN_EMBEDDINGS_V2_MODEL_ID = "amazon.titan-embed-text-v2:0";

let bedrockClient: BedrockRuntimeClient;

function getBedrockClient(): BedrockRuntimeClient {
    if (!bedrockClient) {
        if (!process.env.AWS_REGION) {
            throw new Error(
                "AWS_REGION environment variable is not set. Please check your .env.local file."
            );
        }
        bedrockClient = new BedrockRuntimeClient({
            region: process.env.AWS_REGION,
            // Credentials will be picked up from environment variables by default
            // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
        });
        console.log("BedrockRuntimeClient initialized.");
    }
    return bedrockClient;
}

/**
 * Generates an embedding for the given text using Amazon Titan Text Embeddings V2.
 * @param text The text to embed.
 * @returns A promise that resolves to an array of numbers representing the embedding.
 * @throws Error if embedding generation fails.
 */
export async function generateEmbeddingWithTitan(
    text: string
): Promise<number[]> {
    const client = getBedrockClient();
    const params: InvokeModelCommandInput = {
        modelId: TITAN_EMBEDDINGS_V2_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            inputText: text,
            // dimensions: 1024, // Optional: default is 1024 for float
            // normalize: true,   // Optional: default is true, recommended for similarity search
        }),
    };

    try {
        const command = new InvokeModelCommand(params);
        const response: InvokeModelCommandOutput = await client.send(command);

        const responseBodyString = new TextDecoder().decode(response.body);
        const parsedResponseBody = JSON.parse(responseBodyString);

        if (
            parsedResponseBody.embedding &&
            Array.isArray(parsedResponseBody.embedding)
        ) {
            // console.log( // Less verbose logging for a utility function
            //   `Generated embedding. Dimensions: ${parsedResponseBody.embedding.length}, Tokens: ${parsedResponseBody.inputTextTokenCount}`
            // );
            return parsedResponseBody.embedding;
        } else {
            console.error(
                "Invalid response structure from Bedrock:",
                parsedResponseBody
            );
            throw new Error("Failed to parse embedding from Bedrock response.");
        }
    } catch (error) {
        console.error("Error generating embedding with Titan:", error);
        throw new Error(
            `Bedrock API call failed: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}
