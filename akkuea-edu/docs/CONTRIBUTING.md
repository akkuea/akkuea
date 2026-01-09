# Contributing to Akkuea

Thank you for your interest in contributing to **Akkuea**! 💙  
We welcome new contributors and want to make the process as smooth and inclusive as possible.  

Please read this guide carefully before submitting your contribution.

---

## 📦 Development Setup

1. **Fork** the repository and **clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/akkuea.git
   cd akkuea
   ```

2. Install dependencies:
    ```bash
    bun install
    ```

3. Run the app locally:
    ```bash
    bun run dev
    ```

---

## 🌱 Branching Strategy

- Use descriptive branch names:
  - `feature/<short-description>` for new features
  - `fix/<short-description>` for bug fixes
  - `docs/<short-description>` for documentation

Example:  
```
feature/add-profile-page
```

---

## 🔄 Pull Request (PR) Process

1. Ensure your branch is up to date with `main`.
   ```bash
   git pull origin main
   ```

2. Push your changes and open a PR.  
   - Provide a clear **title** and **description**.  
   - Reference related issues (e.g., `Closes #123`).  
   - Add screenshots or examples when applicable.  

3. All PRs require **at least one review** before merging.  

4. Resolve merge conflicts if they appear.

---

## 🧹 Code Style

- Follow the existing project style and conventions.  
- Use **Prettier** and **ESLint** for formatting and linting.  

Run linting:
```bash
bun run lint
```

Run tests:
```bash
bun run test
```

PRs will only be merged if they pass linting and tests ✅.

---

## 📝 Commit Message Format

We follow the **Conventional Commits** standard:

```
type(scope): short description
```

Examples:
- `feat(auth): add login with Google`
- `fix(ui): correct navbar spacing`
- `docs: update README with setup steps`

Types include: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

---

## 🤝 Community & Support

- Please read our [Code of Conduct](./CODE_OF_CONDUCT.md).  
- Join our community for questions, support, and updates: [Akkuea Telegram](https://t.me/Akkuea).  

---

## 🚀 Tips for New Contributors

- Don’t worry if it’s your first contribution — we’re here to help!  
- Be respectful, open, and constructive in reviews.  
- If you’re stuck, ask for help in the community chat.  

---

Thanks again for helping us improve **Akkuea**! 🙌  
Together we’re building something amazing.  
 ,M