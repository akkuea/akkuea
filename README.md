# Akkuea 🚀🎓

[![GitHub stars](https://img.shields.io/github/stars/akkuea/akkuea?style=social)](https://github.com/akkuea/akkuea)
[![GitHub issues](https://img.shields.io/github/issues/akkuea/akkuea)](https://github.com/akkuea/akkuea/issues)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/akkuea/akkuea/blob/main/LICENSE)

## 🌟 Welcome to Akkuea

Akkuea is not just a platform—it's a **global community** redefining the future of education. Powered by **open-source technology**, **AI**, and **blockchain**, Akkuea transforms how knowledge is accessed, created, and shared. Our mission is to make high-quality education **free**, **accessible**, and **collaborative** for everyone, everywhere. 🌍

Join us in building a **decentralized educational ecosystem** where educators, students, and creators are empowered, rewarded, and connected. Akkuea is a social network with **purpose**. ✨

## 📋 Table of Contents

- [Akkuea 🚀🎓](#akkuea-)
  - [🌟 Welcome to Akkuea](#-welcome-to-akkuea)
  - [📋 Table of Contents](#-table-of-contents)
  - [🎯 Mission \& Vision](#-mission--vision)
    - [Mission](#mission)
    - [Vision](#vision)
  - [🚀 Why Akkuea?](#-why-akkuea)
    - [The Problem](#the-problem)
    - [Our Solution](#our-solution)
  - [📚 Key Features](#-key-features)
  - [👥 Key Users](#-key-users)
  - [💰 Reward System](#-reward-system)
  - [🛠️ Technology Stack](#️-technology-stack)
  - [🚀 Getting Started](#-getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Individual Package Development](#individual-package-development)
    - [Docker Setup (Alternative)](#docker-setup-alternative)
    - [Verification](#verification)
    - [Common Issues \& Troubleshooting](#common-issues--troubleshooting)
    - [Next Steps](#next-steps)
  - [⚡ Quick Start](#-quick-start)
  - [🧪 Testing](#-testing)
    - [Running Tests](#running-tests)
    - [Test Structure](#test-structure)
  - [🔧 Environment Variables](#-environment-variables)
    - [Backend (.env in packages/gin)](#backend-env-in-packagesgin)
    - [Frontend (.env.local in packages/nextjs)](#frontend-envlocal-in-packagesnextjs)
  - [🔄 Development Workflow](#-development-workflow)
    - [Git Workflow](#git-workflow)
    - [Commit Convention](#commit-convention)
    - [Code Style](#code-style)
  - [📊 Project Status](#-project-status)
  - [💬 Get Involved](#-get-involved)
  - [🫡 Thanks to Our Contributors](#-thanks-to-our-contributors)
  - [📜 License](#-license)

---

## 🎯 Mission & Vision

### Mission

To create a collaborative platform where education is **free**, **accessible**, and **high-quality**, built by a diverse and motivated community. We empower those who teach, learn, and share while recognizing the value of every contribution.

### Vision

A world where anyone, regardless of background, can access and contribute to a **global knowledge library**. Akkuea aims to be the leading educational ecosystem for **collective, decentralized, and rewarded learning**.

---

## 🚀 Why Akkuea?

### The Problem

- 📚 **Scattered Resources**: Educational content is fragmented across platforms, making it hard to find and reuse.
- 🖼️ **Low Quality**: Many resources suffer from poor visuals or organization.
- 💸 **Lack of Incentives**: Educators and creators often go unrewarded for their efforts.
- 🌐 **Language Barriers**: Content is often limited to major languages.
- 🔒 **Proprietary Platforms**: Closed systems prioritize profit over impact.

### Our Solution

- **Centralized Hub**: A single platform with intelligent filters for educational content by level, language, and format.
- **AI-Powered Enhancement**: Automatic improvements to readability, visuals, and structure.
- **Transparent Rewards**: A **Stellar blockchain-based token system** that fairly rewards contributions.
- **Global Access**: Automatic translations, multi-format resources, and device compatibility.
- **Creator Marketplace**: Connect directly with designers for personalized resources, paid in tokens.

---

## 📚 Key Features

| Feature                       | Description                                                      |
| ----------------------------- | ---------------------------------------------------------------- |
| **Centralized Resources**     | Find and share educational materials in one place.               |
| **Rewards for Participation** | Earn tokens for contributing value to the community.             |
| **AI Visual Enhancement**     | Enhance documents and images for better educational impact.      |
| **Transparent Blockchain**    | Secure, traceable rewards via Stellar.                           |
| **Internal Marketplace**      | Request personalized resources from designers, paid with tokens. |
| **Automatic Translation**     | Multilingual access for global inclusivity.                      |
| **Multi-Platform**            | Fully functional on computers, tablets, and mobiles.             |
| **Accessibility**             | Easy-to-read, multi-format resources for all users.              |
| **Open Source**               | Developers worldwide can contribute to Akkuea’s growth.          |

---

## 👥 Key Users

- **Educators**: Share materials, access peer resources, and earn rewards for contributions.
- **Students**: Discover documents, quizzes, infographics, and join study groups.
- **Designers & Artists**: Create visuals, animations, and multimedia, earning credits and commissions.
- **AI Assistance**: Curates content, translates, simplifies, and enhances resources ethically.

---

## 💰 Reward System

Akkuea’s **Stellar blockchain** powers a transparent incentive system:

- **Earn Tokens**: Publish impactful content and receive tokens based on community engagement.
- **Bonuses**: Consistent contributors gain distinctions and extra rewards.
- **Traceable Credits**: Every AI-enhanced or collaborative resource tracks contributions.
- **Use Tokens**: Access marketplace services or withdraw for external use.

**Sharing knowledge = Creating value.** That value is now rewarded! 💡

---

## 🛠️ Technology Stack

- **Next.js**: Modern, fast, and scalable frontend framework.
- **Stellar Blockchain**: Secure and transparent reward system.
- **Generative & Analytical AI**: Powers translation, image enhancement, and content creation.
- **Open-Source Development**: Community-driven improvement for global collaboration.

---

## 🚀 Getting Started

Ready to contribute to the future of education? Follow these steps to get Akkuea running on your local machine.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.11.0 or higher ([Download here](https://nodejs.org/))
- **Bun**: Version 1.0.25 or higher ([Installation guide](https://bun.sh/docs/installation))
- **Go**: Version 1.24.2 or higher ([Download here](https://golang.org/dl/))
- **PostgreSQL**: Version 13.0 or higher for the backend database ([Installation guide](https://www.postgresql.org/download/))
- **Git**: For version control ([Download here](https://git-scm.com/downloads))

> **💡 Tip**: We recommend using a version manager like [asdf](https://asdf-vm.com/) or [nvm](https://github.com/nvm-sh/nvm) to manage multiple Node.js versions.

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/akkuea/akkuea.git
   cd akkuea
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   For the Go backend:

   ```bash
   cd packages/gin
   cp env.example .env
   ```

   Edit the `.env` file with your database credentials and configuration:

   ```env
   DB_HOST=localhost
   DB_USER=your_postgres_user
   DB_PASSWORD=your_postgres_password
   DB_NAME=akkuea
   DB_PORT=5432
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

4. **Set up the database**

   Create a PostgreSQL database:

   ```bash
   createdb akkuea
   ```

   Or using PostgreSQL CLI:

   ```sql
   CREATE DATABASE akkuea;
   ```

5. **Start the development servers**

   From the root directory:

   ```bash
   bun run dev
   ```

   This will start all services in parallel:
   - **Frontend**: http://localhost:3000
   - **Go API**: http://localhost:8080

### Individual Package Development

You can also run individual packages:

```bash
# Frontend (Next.js)
cd packages/nextjs
bun run dev

# Go API Backend
cd packages/gin
go run main.go
```

### Docker Setup (Alternative)

If you prefer using Docker:

```bash
cd packages/gin
docker-compose up -d
```

This will start the Go backend with PostgreSQL in containers.

### Verification

Once everything is running, you should be able to:

- ✅ Access the frontend at http://localhost:3000
- ✅ Make API calls to http://localhost:8080
- ✅ See database connections working without errors

### Common Issues & Troubleshooting

**Port conflicts**: If ports 3000 or 8080 are already in use, you can modify them in the respective package configurations.

**Database connection issues**:

- Ensure PostgreSQL is running: `brew services start postgresql` (macOS) or `sudo systemctl start postgresql` (Linux)
- Verify your database credentials in the `.env` file
- Check if the database exists: `psql -l`

**Bun installation issues**:

- On macOS: `curl -fsSL https://bun.sh/install | bash`
- On Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
- On Linux: `curl -fsSL https://bun.sh/install | bash`

**Go module issues**: Run `go mod tidy` in the `packages/gin` directory.

### Next Steps

- 📖 Check out our [Contributing Guide](CONTRIBUTING.md) for development guidelines
- 🐛 Report issues on [GitHub Issues](https://github.com/akkuea/akkuea/issues)
- 💬 Join our [Telegram community](https://t.me/akkuea_community) for support

---

## ⚡ Quick Start

For experienced developers who want to get up and running fast:

```bash
# Clone and setup
git clone https://github.com/akkuea/akkuea.git
cd akkuea
bun install

# Setup backend environment
cd packages/gin
cp env.example .env
# Edit .env with your database credentials

# Create database
createdb akkuea

# Start all services
cd ../..
bun run dev
```

Visit http://localhost:3000 to see the frontend and http://localhost:8080 for the API.

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun test

# Frontend tests
cd packages/nextjs
bun test

# Backend tests
cd packages/gin
go test ./...

# Run tests with coverage
go test -cover ./...
```

### Test Structure

- **Frontend**: Jest and React Testing Library for component tests
- **Backend**: Go's built-in testing framework with testify for assertions
- **Integration**: End-to-end tests using Playwright (coming soon)

---

## 🔧 Environment Variables

### Backend (.env in packages/gin)

| Variable          | Description                       | Default     | Required |
| ----------------- | --------------------------------- | ----------- | -------- |
| `DB_HOST`         | PostgreSQL host                   | `localhost` | ✅       |
| `DB_USER`         | Database username                 | -           | ✅       |
| `DB_PASSWORD`     | Database password                 | -           | ✅       |
| `DB_NAME`         | Database name                     | `akkuea`    | ✅       |
| `DB_PORT`         | Database port                     | `5432`      | ✅       |
| `JWT_SECRET`      | JWT signing secret                | -           | ✅       |
| `PORT`            | API server port                   | `8080`      | ❌       |
| `STELLAR_NETWORK` | Stellar network (testnet/mainnet) | `testnet`   | ❌       |
| `AI_API_KEY`      | AI service API key                | -           | ❌       |

### Frontend (.env.local in packages/nextjs)

| Variable                      | Description     | Default                 | Required |
| ----------------------------- | --------------- | ----------------------- | -------- |
| `NEXT_PUBLIC_API_URL`         | Backend API URL | `http://localhost:8080` | ✅       |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Stellar network | `testnet`               | ❌       |

---

## 🔄 Development Workflow

### Git Workflow

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/akkuea.git
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** and commit:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```
5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a Pull Request** on GitHub

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### Code Style

- **Frontend**: ESLint + Prettier configuration
- **Backend**: Go fmt + golangci-lint
- **Commits**: Conventional commits format

Run linting before committing:

```bash
# Frontend
cd packages/nextjs
bun run lint

# Backend
cd packages/gin
golangci-lint run
```

---

## 📊 Project Status

🧱 **Under active development**  
We’re building the future of education, and we need your help! Contribute, leave feedback, or simply star the repo to show your support. 🌟

---

## 💬 Get Involved

- **Contribute**: Check out our [Contributing Guide](CONTRIBUTING.md) to get started.
- **Report Issues**: Open an issue on [GitHub](https://github.com/akkuea/akkuea/issues).
- **Join the Community**: Connect with us on our [Telegram group](https://t.me/akkuea_community).
- **Star the Repo**: Show your support by starring [Akkuea on GitHub](https://github.com/akkuea/akkuea)! ⭐

---

## 🫡 Thanks to Our Contributors

<a href="https://github.com/akkuea/akkuea/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=akkuea/akkuea" alt="Contributors" />
</a>

We’re grateful for every contribution that brings us closer to revolutionizing education! 🙌

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

**Join the educational revolution! 🚀🎓**  
**Happy Learning & Contributing! ✨**
