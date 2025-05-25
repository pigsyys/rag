import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Navbar() {
    return (
        <nav className="bg-gray-800 p-4 text-white">
            <div className="container mx-auto flex justify-between items-center">
                <Link href="/" className="text-xl font-bold">
                    RAG App
                </Link>
                <div className="space-x-4 flex flex-row">
                    <Link href="/chat" className="hover:text-gray-300">
                        Chatbot
                    </Link>
                    <Link href="/import" className="hover:text-gray-300">
                        Import Data
                    </Link>
                    <div className="hover:cursor-pointer">
                        <SignedOut>
                            <SignInButton />
                        </SignedOut>
                    </div>
                    <div className="h-6">
                        <div className="relative -top-0.5">
                            <SignedIn>
                                <UserButton />
                            </SignedIn>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
