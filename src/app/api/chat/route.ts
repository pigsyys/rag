// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { generateEmbeddingWithTitan } from "../lib/awsBedrock";
import { getDbPool, getOrCreateAppUser, AppUser } from "../lib/database";
import { getOpenAIChatCompletion } from "../lib/llm";

interface ChatRequestBody {
    query: string;
    datasetName: string;
    history?: { sender: "user" | "ai"; text: string }[];
}

interface DbChunkRow {
    text_chunk: string;
}

async function retrieveContextFromDB(
    datasetName: string,
    queryEmbedding: number[],
    limit: number = 3
): Promise<string[]> {
    // ... (retrieveContextFromDB implementation remains the same)
    if (!/^[a-zA-Z0-9_]+$/.test(datasetName)) {
        throw new Error(
            `Invalid dataset name format for DB query: ${datasetName}.`
        );
    }
    const dbPool = getDbPool();
    const client = await dbPool.connect();
    const embeddingString = `[${queryEmbedding.join(",")}]`;
    const sqlQuery = `
    SELECT text_chunk
    FROM ${datasetName}
    ORDER BY embedding <-> $1::vector
    LIMIT $2;
  `;
    try {
        const result = await client.query<DbChunkRow>(sqlQuery, [
            embeddingString,
            limit,
        ]);
        return result.rows.map((row) => row.text_chunk);
    } catch (dbError) {
        console.error(
            `Error querying NeonDB for dataset ${datasetName}:`,
            dbError
        );
        throw new Error(
            `Database query failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`
        );
    } finally {
        client.release();
    }
}

export async function POST(request: NextRequest) {
    const authObject = await auth();
    const userId = authObject.userId;
    if (!userId) {
        return NextResponse.json(
            { error: "Unauthorized. Please sign in." },
            { status: 401 }
        );
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
        return NextResponse.json(
            { error: "User details not found after sign-in." },
            { status: 401 }
        );
    }

    let appUser: AppUser;
    try {
        const primaryEmail = clerkUser.emailAddresses.find(
            (e) => e.id === clerkUser.primaryEmailAddressId
        )?.emailAddress;
        appUser = await getOrCreateAppUser(
            userId,
            primaryEmail,
            "pending_approval"
        ); // Default new users
    } catch (dbError) {
        console.error("Failed to get or create app user:", dbError);
        return NextResponse.json(
            { error: "Error processing your user account." },
            { status: 500 }
        );
    }

    const allowedAccessLevelsForChat: string[] = ["admin"];
    if (!allowedAccessLevelsForChat.includes(appUser.access_level)) {
        console.log(
            `Access DENIED for chat for user ${userId}. Current access level: ${appUser.access_level}`
        );
        return NextResponse.json(
            {
                error: "Access Denied. Your account is not approved or lacks permission for this feature.",
            },
            { status: 403 }
        );
    }
    console.log(
        `Chat access GRANTED for user: ${appUser.clerk_user_id}, Access Level: ${appUser.access_level}`
    );

    try {
        const body = (await request.json()) as ChatRequestBody;
        const { query, datasetName, history = [] } = body;

        if (!query || query.trim() === "") {
            /* ... validation ... */ return NextResponse.json(
                { error: "Query is required." },
                { status: 400 }
            );
        }
        if (!datasetName || datasetName.trim() === "") {
            /* ... validation ... */ return NextResponse.json(
                { error: "Dataset name is required." },
                { status: 400 }
            );
        }
        if (!/^[a-zA-Z0-9_]+$/.test(datasetName) || datasetName.length > 50) {
            /* ... validation ... */ return NextResponse.json(
                { error: "Invalid dataset name format." },
                { status: 400 }
            );
        }

        console.log(`Chat API: Dataset "${datasetName}", Query: "${query}"`);

        // 1. Generate embedding for the user's query
        let queryEmbedding: number[] | null = null; // Initialize
        try {
            queryEmbedding = await generateEmbeddingWithTitan(query);
            console.log("Query Embedding Dimensions:", queryEmbedding.length);
        } catch (error) {
            console.error("Failed to generate query embedding:", error);
            return NextResponse.json(
                {
                    error: "Failed to process query embedding.",
                    details:
                        error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
        // queryEmbedding will definitely be assigned here if no error was thrown and returned above

        // 2. Retrieve relevant context from NeonDB (pgvector)
        let contextChunks: string[] = []; // Initialize to empty array
        try {
            // queryEmbedding cannot be null here due to the error handling above
            contextChunks = await retrieveContextFromDB(
                datasetName,
                queryEmbedding!,
                3
            );
            if (contextChunks.length === 0) {
                console.log(
                    `No relevant context chunks found in dataset "${datasetName}" for the query.`
                );
            }
        } catch (error) {
            console.error("Failed to retrieve context from database:", error);
            return NextResponse.json(
                {
                    error: "Failed to retrieve context from database.",
                    details:
                        error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }

        // 3. Construct prompt for the LLM
        let promptContext =
            "No specific context found from the database for this query.";
        if (contextChunks.length > 0) {
            promptContext = contextChunks.join("\n---\n");
        }
        const historyString = history
            .map((h) => `${h.sender === "user" ? "User" : "AI"}: ${h.text}`)
            .join("\n");
        const fullPrompt = `
${historyString ? `Previous conversation:\n${historyString}\n\n---\n` : ""}
Based on the following context, answer the user's question.
If the context is "No specific context found...", try to answer based on general knowledge but clearly state that the specific information was not found in the provided documents.

Context:
---
${promptContext}
---
User Question: ${query}

Answer:`;

        // 4. Call the chosen LLM (OpenAI)
        let llmAnswer: string | null =
            "Sorry, I could not generate a response at this time."; // Initialize with a default
        try {
            const openAIResponse = await getOpenAIChatCompletion({
                prompt: fullPrompt,
                model: "gpt-3.5-turbo",
            });
            if (openAIResponse) {
                // Check if response is not null
                llmAnswer = openAIResponse;
            } else {
                console.warn(
                    "LLM returned null or empty content, using default error message."
                );
            }
        } catch (error) {
            console.error("Error calling LLM:", error);
            llmAnswer = `Sorry, there was an error communicating with the AI. (${error instanceof Error ? error.message : "Unknown AI error"})`;
        }

        return NextResponse.json(
            { answer: llmAnswer, datasetUsed: datasetName },
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "Chat API Error (Outer Catch for request body parsing or other unhandled):",
            error
        );
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return NextResponse.json(
                { error: "Invalid JSON in request body." },
                { status: 400 }
            );
        }
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An unknown error occurred";
        return NextResponse.json(
            { error: "Failed to process chat request.", details: errorMessage },
            { status: 500 }
        );
    }
}
