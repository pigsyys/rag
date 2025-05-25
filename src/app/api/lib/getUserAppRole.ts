import { auth } from "@clerk/nextjs/server";
import { getDbPool, AppUser } from "./database"; // Assuming AppUser is exported from database.ts

/**
 * Fetches the application-specific role/access_level for the currently authenticated user.
 * Returns null if the user is not authenticated or not found in app_users.
 */
export async function getUserAppRole(): Promise<string | null> {
    const { userId } = await auth();

    if (!userId) {
        return null; // Not authenticated
    }

    const dbPool = getDbPool();
    const client = await dbPool.connect();
    try {
        const result = await client.query<Pick<AppUser, "access_level">>(
            "SELECT access_level FROM app_users WHERE clerk_user_id = $1",
            [userId]
        );
        if (result.rows.length > 0) {
            return result.rows[0].access_level;
        }
        return null; // User authenticated with Clerk but not found in our app_users table (or no access_level)
    } catch (error) {
        console.error("Error fetching user app role:", error);
        return null; // Or handle error more specifically
    } finally {
        client.release();
    }
}
