// app/page.tsx
import Link from "next/link";

export default function HomePage() {
    return (
        <div className="text-center py-10">
            <h1 className="text-4xl font-bold mb-6 text-gray-800">
                Welcome to Your RAG Application
            </h1>
            <p className="text-lg text-gray-600 mb-8">
                Navigate to the chatbot or import your data.
            </p>
            <div className="space-x-4">
                <Link
                    href="/chat"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
                >
                    Go to Chatbot
                </Link>
                <Link
                    href="/import"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
                >
                    Import Data
                </Link>
            </div>
        </div>
    );
}
