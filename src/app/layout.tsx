import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/navbar"; // Ensure correct path and casing
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/nextjs"; // Import auth
import { auth } from "@clerk/nextjs/server";
import { getUserAppRole } from "./api/lib/getUserAppRole"; // Import your new helper

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "My RAG Application",
    description: "Chatbot with custom data",
};

export default async function RootLayout({
    // Make RootLayout async
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { userId } = await auth(); // Get userId to see if anyone is signed in at all
    let userAppRole: string | null = null;

    if (userId) {
        userAppRole = await getUserAppRole();
    }

    const isAdmin = userAppRole === "admin";

    return (
        <ClerkProvider>
            <html lang="en">
                <body
                    className={`${inter.className} bg-gray-100 min-h-screen flex flex-col`}
                >
                    <Navbar /> {/* Navbar is visible to everyone */}
                    <main className="flex-grow container mx-auto p-4 md:p-6">
                        {userId ? ( // First check if signed in at all
                            isAdmin ? (
                                // User is signed in AND is an admin
                                children
                            ) : (
                                // User is signed in BUT NOT an admin
                                <div className="text-center py-10">
                                    <h1 className="text-3xl font-bold text-red-600 mb-4">
                                        Access Denied
                                    </h1>
                                    <p className="text-lg text-gray-700">
                                        You do not have permission to view this
                                        application. Please contact an
                                        administrator if you believe this is an
                                        error.
                                    </p>
                                    {/* You might want to show a sign-out button here from Clerk */}
                                </div>
                            )
                        ) : (
                            // User is not signed in
                            <div className="text-center py-10">
                                <h1 className="text-3xl font-bold text-gray-800 mb-4">
                                    Please Log In
                                </h1>
                                <p className="text-lg text-gray-600">
                                    You need to be logged in to use this
                                    application.
                                </p>
                                {/* Clerk's <SignInButton /> or a link to your sign-in page could go here,
                                    or rely on Navbar for sign-in links */}
                            </div>
                        )}
                    </main>
                    <footer className="bg-gray-200 text-center p-4 text-sm text-gray-600">
                        © {new Date().getFullYear()} RAG App
                    </footer>
                </body>
            </html>
        </ClerkProvider>
    );
}
