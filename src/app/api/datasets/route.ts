// src/app/api/datasets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { generateEmbeddingWithTitan } from "../lib/awsBedrock";
import { getDbPool, getOrCreateAppUser, AppUser } from "../lib/database";
import { getOpenAIChatCompletion } from "../lib/llm";

export interface DatasetMetadata {
    id: number;
    dataset_table_name: string;
    display_name: string | null;
    description: string | null;
    created_at: Date;
    updated_at: Date;
}

export async function GET() {
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
        const dbPool = getDbPool();
        const client = await dbPool.connect();

        try {
            const result = await client.query<DatasetMetadata>(
                "SELECT id, dataset_table_name, display_name, description, created_at, updated_at FROM app_datasets ORDER BY display_name ASC, created_at DESC"
            );
            return NextResponse.json(result.rows, { status: 200 });
        } catch (dbError) {
            console.error("Database query error in /api/datasets:", dbError);
            throw dbError; // Throw to be caught by the outer catch
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("API Error in /api/datasets:", error);
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An unknown error occurred";
        return NextResponse.json(
            { error: "Failed to fetch datasets.", details: errorMessage },
            { status: 500 }
        );
    }
}
