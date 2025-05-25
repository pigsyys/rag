import { Pool, QueryResult } from "pg";

let pool: Pool;

export function getDbPool(): Pool {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error(
                "DATABASE_URL environment variable is not set. Please check your .env.local file."
            );
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false, // Required for NeonDB, consider more secure options for production
            },
        });

        pool.on("error", (err) => {
            console.error("Unexpected error on idle client in pool", err);
            // You might want to re-initialize the pool or handle this more gracefully
        });
        console.log("Database pool initialized.");
    }
    return pool;
}

export interface AppUser {
    id: number;
    clerk_user_id: string;
    email: string | null;
    access_level: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * Retrieves an application user by their Clerk User ID.
 * If the user doesn't exist, it creates a new one with a default access level.
 * @param clerkUserId The user's ID from Clerk.
 * @param email The user's email from Clerk (can be null if not available/primary).
 * @param defaultAccessLevel The access level to assign if creating a new user.
 * @returns The AppUser object from your database.
 */
export async function getOrCreateAppUser(
    clerkUserId: string,
    email?: string | null,
    // When a new user record is created in *your* database for the first time,
    // their access level will be 'pending_approval'.
    defaultAccessLevel: string = "pending_approval"
): Promise<AppUser> {
    if (!clerkUserId) {
        throw new Error(
            "Clerk User ID is required to get or create an app user."
        );
    }

    const dbPool = getDbPool();
    const client = await dbPool.connect();

    try {
        const selectQuery = "SELECT * FROM app_users WHERE clerk_user_id = $1";
        let result: QueryResult<AppUser> = await client.query(selectQuery, [
            clerkUserId,
        ]);

        if (result.rows.length > 0) {
            console.log(
                `Found existing app_user for clerk_user_id: ${clerkUserId} with access_level: ${result.rows[0].access_level}`
            );
            if (email && result.rows[0].email !== email) {
                // Only update email if it's different, to also update updated_at
                await client.query(
                    "UPDATE app_users SET email = $1, updated_at = NOW() WHERE clerk_user_id = $2",
                    [email, clerkUserId]
                );
                result.rows[0].email = email;
                result.rows[0].updated_at = new Date(); // Reflect update in returned object
                console.log(`Updated email for app_user: ${clerkUserId}`);
            }
            return result.rows[0];
        } else {
            console.log(
                `Creating new app_user for clerk_user_id: ${clerkUserId} with default access_level: ${defaultAccessLevel}`
            );
            const insertQuery = `
        INSERT INTO app_users (clerk_user_id, email, access_level)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
            const userEmail = email || null;
            result = await client.query(insertQuery, [
                clerkUserId,
                userEmail,
                defaultAccessLevel,
            ]);
            if (result.rows.length > 0) {
                return result.rows[0];
            } else {
                throw new Error("Failed to create and retrieve new app user.");
            }
        }
    } catch (error) {
        console.error("Error in getOrCreateAppUser:", error);
        throw error;
    } finally {
        client.release();
    }
}

export interface DatasetMetadataFromDB {
    id: number;
    dataset_table_name: string;
    display_name: string | null;
    description: string | null;
    created_at: Date; // Note: This will be a string after JSON serialization
    updated_at: Date; // Note: This will be a string after JSON serialization
}
