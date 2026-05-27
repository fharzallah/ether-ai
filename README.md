ETHER – Your Ruthless Intellectual Partner

ETHER is an Electron-based AI chat application that routes requests intelligently across multiple API providers (Groq, Gemini, Cerebras) while maintaining a distinct personality: honest, direct, and unapologetically critical.

What Makes ETHER Different

Most AI assistants are built to validate your ideas. ETHER does the opposite.

The Ruthless Mentoring Principle

ETHER operates as a frankly honest intellectual partner, not a passive yes-man:

•     Active Voice & Directness – No emojis, no fluff. Straight to the point.

•     Critical Analysis – Every idea gets scrutinized. If it's weak, ETHER will tell you why and how to fix it.

•     No False Politeness – Disagreement is expected. Contradiction is welcome.

•     Adaptive Response Length – Summary needed? Ultra-concise. Complex work? Detailed with concrete examples.

•     Refuses Empty Answers – Long useless explanations and overly technical guides are rejected by design.

Core Features

•     Multi-API Routing – Intelligently switches between Groq, Gemini (3 accounts), and Cerebras based on task requirements

•     Multiple Modes – Teacher mode, Creative mode, Image generation mode

•     Cloudflare Workers Backend – Serverless integration for API orchestration

•     Electron Desktop App – Cross-platform, local-first architecture

•     Custom Personality – Adapted to your exact communication preferences

Current Status

v1.1.0 – In active development.

•     ✅ Core routing & API integration working

•     ✅ Multi-mode functionality stable

•     ✅ Cloudflare Workers backend deployed

•     ⚙️ DuckDuckGo search parser (fragile, planned replacement with Serper/Tavily)

•     🔄 Stripe monetization planned (~€9.99/month)

Tech Stack

•     Frontend – Electron, React

•     APIs – Groq, Google Gemini, Cerebras

•     Backend – Cloudflare Workers

•     Environment – Node.js with dotenv for secure API key management

•     Search – DuckDuckGo (planned: Serper or Tavily API)

Getting Started

Prerequisites

•     Node.js 16+

•     Electron

•     API keys for Groq, Gemini, and/or Cerebras

Installation

1.     Clone the repository


git clone [https://github.com/fadiharzallah4-cyber/ether-ai.git](https://github.com/fadiharzallah4-cyber/ether-ai.git)
cd ether-ai


2.     Install dependencies


npm install


3.     Set up environment variables
Create a .env file in the root directory:


GROQ_API_KEY=your_groq_key
GEMINI_API_KEYS=key1,key2,key3
CEREBRAS_API_KEY=your_cerebras_key


4.     Start the app


npm start


How It Works

ETHER routes your input based on task type, API capability, and your preferences. Just ask, and ETHER picks the right tool.

Known Limitations

•     Search relies on DuckDuckGo HTML parsing (fragile) → migration to stable API planned

•     Stripe integration not yet implemented

•     Docs being polished

Philosophy

ETHER rejects the idea that AI should be universally friendly. Intellectual growth requires honesty. Expect directness, expect to be challenged, expect better ideas.

Contributing

Personal project in active development. Feedback welcome.

License

[TBD]

Built with ruthless honesty in mind.
