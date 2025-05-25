import OpenAI from "openai";

let openai: OpenAI;

function getOpenAIClient(): OpenAI {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error(
                "OPENAI_API_KEY environment variable is not set. Please check your .env.local file."
            );
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        console.log("OpenAI client initialized.");
    }
    return openai;
}

interface GetChatCompletionOptions {
    prompt: string;
    model?: string; // e.g., "gpt-3.5-turbo", "gpt-4"
    maxTokens?: number;
    temperature?: number;
    // Add other OpenAI parameters as needed
}

/**
 * Gets a chat completion from the OpenAI API.
 * @param options The options for the chat completion.
 * @returns The content of the AI's response.
 */
export async function getOpenAIChatCompletion(
    options: GetChatCompletionOptions
): Promise<string | null> {
    const client = getOpenAIClient();
    const {
        prompt,
        model = "gpt-4.1-nano", // Default model
        maxTokens = 1000, // Default max tokens for the response
        temperature = 0.7, // Default temperature
    } = options;

    try {
        console.log(`Sending prompt to OpenAI model: ${model}`);
        // For chat models, it's better to use the chat completions endpoint
        // with a messages array.
        const completion = await client.chat.completions.create({
            model: model,
            messages: [
                // You can add a system message here if desired
                // { role: "system", content: "You are a helpful AI assistant." },
                { role: "user", content: prompt },
            ],
            max_tokens: maxTokens,
            temperature: temperature,
            // stream: false, // Set to true for streaming later
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
            console.log("Received response from OpenAI.");
            return content.trim();
        } else {
            console.error(
                "OpenAI response did not contain content:",
                completion
            );
            return "Sorry, I couldn't generate a response at this time.";
        }
    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        // Consider more specific error handling based on OpenAI error types
        if (error instanceof OpenAI.APIError) {
            throw new Error(
                `OpenAI API Error: ${error.status} ${error.name} ${error.message}`
            );
        }
        throw new Error(
            `Failed to get completion from OpenAI: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}
