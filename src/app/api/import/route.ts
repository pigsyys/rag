import { NextRequest, NextResponse } from "next/server";
import { generateEmbeddingWithTitan } from "../lib/awsBedrock"; // USE THIS IMPORT
import { MAX_EMBEDDING_CHUNK_CHAR_LENGTH, chunkText } from "../lib/textUtils"; // Ensure this path is correct
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDbPool, getOrCreateAppUser, AppUser } from "../lib/database";

// --- DATABASE SETUP AND HELPERS ---
async function registerDatasetInMetadata(
    datasetTableName: string,
    displayName?: string,
    description?: string
): Promise<void> {
    const dbPool = getDbPool();
    const client = await dbPool.connect();
    try {
        const query = `
      INSERT INTO app_datasets (dataset_table_name, display_name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (dataset_table_name) DO UPDATE
      SET updated_at = CURRENT_TIMESTAMP`;
        await client.query(query, [
            datasetTableName,
            displayName || datasetTableName,
            description || null,
        ]);
        console.log(
            `Dataset "${datasetTableName}" registered/updated in app_datasets.`
        );
    } catch (error) {
        console.error(
            `Error registering dataset "${datasetTableName}" in metadata:`,
            error
        );
        throw error;
    } finally {
        client.release();
    }
}

async function ensureDatasetTableExists(
    datasetName: string,
    userDisplayName?: string
): Promise<void> {
    if (!/^[a-zA-Z0-9_]+$/.test(datasetName) || datasetName.length > 50) {
        throw new Error(
            `Invalid dataset name format for table creation: ${datasetName}. Only alphanumeric, underscores, max 50 chars allowed.`
        );
    }
    const dbPool = getDbPool();
    const client = await dbPool.connect();
    try {
        await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${datasetName} (
                id SERIAL PRIMARY KEY,
                text_chunk TEXT NOT NULL,
                embedding VECTOR(1024)
            );
        `;
        await client.query(createTableQuery);
        console.log(
            `Ensured table "${datasetName}" exists with correct schema.`
        );
        const indexName = `idx_hnsw_${datasetName}_embedding`;
        const createIndexQuery = `
            CREATE INDEX IF NOT EXISTS ${indexName} ON ${datasetName} USING hnsw (embedding vector_l2_ops);
        `;
        await client.query(createIndexQuery);
        console.log(
            `Ensured HNSW index "${indexName}" on table "${datasetName}" exists.`
        );
        await registerDatasetInMetadata(
            datasetName,
            userDisplayName || datasetName
        );
    } catch (error) {
        console.error(
            `Error in ensureDatasetTableExists for "${datasetName}":`,
            error
        );
        throw error;
    } finally {
        client.release();
    }
}

async function storeInNeon(
    datasetName: string,
    textChunk: string,
    embeddingVector: number[]
): Promise<void> {
    const dbPool = getDbPool();
    const client = await dbPool.connect();
    const embeddingString = `[${embeddingVector.join(",")}]`;
    const query = `
    INSERT INTO ${datasetName} (text_chunk, embedding)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING;`;
    try {
        await client.query(query, [textChunk, embeddingString]);
    } catch (error) {
        console.error(
            `Error storing chunk in NeonDB for dataset ${datasetName} (table should exist):`,
            error
        );
        throw error;
    } finally {
        client.release();
    }
}
// --- END OF DATABASE SETUP ---

// Main API Handler
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
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const text = formData.get("text") as string | null;
        const datasetName = formData.get("datasetName") as string | null;

        if (!datasetName || datasetName.trim() === "") {
            return NextResponse.json(
                { error: "Dataset name is required." },
                { status: 400 }
            );
        }
        if (!/^[a-zA-Z0-9_]+$/.test(datasetName) || datasetName.length > 50) {
            return NextResponse.json(
                {
                    error: "Invalid dataset name. Use only alphanumeric, underscores, max 50 chars.",
                },
                { status: 400 }
            );
        }

        let contentToProcess: string | null = null;
        if (file) {
            const fileExtension = file.name.split(".").pop()?.toLowerCase();
            if (["txt", "md"].includes(fileExtension || "")) {
                contentToProcess = await file.text();
            } else {
                return NextResponse.json(
                    {
                        error: `Unsupported file type: ${fileExtension}. Please use .txt or .md.`,
                    },
                    { status: 400 }
                );
            }
        } else if (text && text.trim() !== "") {
            contentToProcess = text;
        } else {
            return NextResponse.json(
                { error: "No file or text content provided." },
                { status: 400 }
            );
        }
        if (!contentToProcess || contentToProcess.trim() === "") {
            return NextResponse.json(
                { error: "Content to process is empty." },
                { status: 400 }
            );
        }

        await ensureDatasetTableExists(datasetName, datasetName); // Pass datasetName as display name for now
        console.log(`Database setup ensured for dataset: ${datasetName}`);

        console.log(`Original content length: ${contentToProcess.length}`);
        const chunks = chunkText(
            contentToProcess,
            MAX_EMBEDDING_CHUNK_CHAR_LENGTH
        );
        console.log(
            `Content chunked into ${chunks.length} pieces for dataset ${datasetName}.`
        );

        let successfulEmbeddingsAndStorage = 0;
        let failedOperations = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk.trim() === "") continue;
            try {
                const embedding = await generateEmbeddingWithTitan(chunk); // Uses imported function
                await storeInNeon(datasetName, chunk, embedding);
                successfulEmbeddingsAndStorage++;
            } catch (error) {
                console.error(
                    `Failed to process or store chunk ${i + 1} for dataset ${datasetName}:`,
                    error
                );
                failedOperations++;
            }
        }

        console.log(
            `Finished processing for dataset ${datasetName}. Stored: ${successfulEmbeddingsAndStorage}, Failed: ${failedOperations}`
        );

        if (
            successfulEmbeddingsAndStorage === 0 &&
            contentToProcess.trim().length > 0 &&
            chunks.length > 0
        ) {
            return NextResponse.json(
                { error: "Failed to process and store any content." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                message: `Import process finished for dataset "${datasetName}". Successfully processed and stored: ${successfulEmbeddingsAndStorage} chunk(s). Failed operations: ${failedOperations} chunk(s).`,
                dataset: datasetName,
                chunksProcessedAndStored: successfulEmbeddingsAndStorage,
                chunksFailed: failedOperations,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Import API Error:", error);
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An unknown error occurred";
        return NextResponse.json(
            { error: "Failed to import data.", details: errorMessage },
            { status: 500 }
        );
    }
}
